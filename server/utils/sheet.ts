import type { GamePhase } from '#shared/types/game'
import { and, asc, eq, sql } from 'drizzle-orm'
import { sessionSecret } from './subkey'
import { guesses, photos, users } from '../database/schema'

/**
 * Building one player's guess sheet.
 *
 * Two lists leave this file. The rooms, each behind an opaque handle and
 * carrying nothing but photographs. The participants, by name and id, which is
 * not a secret — everybody knows who is playing. What never leaves is which
 * name goes with which handle.
 */

export interface SheetRoom {
  /** Opaque, per-viewer. See server/utils/guessing.ts. */
  token: string
  photos: string[]
  /** The viewer's own answer: a participant id, or null. Their own to know. */
  guess: number | null
  /**
   * The names this room offers, in the same alphabetical order as
   * `participants` — never in the order they were derived in, which would put
   * the owner first.
   */
  suspects: number[]
}

export interface SheetParticipant {
  id: number
  displayName: string
}

export interface GuessSheet {
  phase: GamePhase
  rooms: SheetRoom[]
  participants: SheetParticipant[]
  answered: number
  total: number
}

/**
 * Everyone who could plausibly live somewhere: the pool the decoys come from.
 *
 * Every user, photographs or not — a player who has uploaded nothing is still
 * a credible answer, and leaving them out would make "has a room in play" the
 * readable half of the secret.
 *
 * Deliberately not `participants`, which excludes the viewer. Using that as
 * the pool would make the derivation depend on who is looking, silently, which
 * is the one thing `suspectsFor()` exists not to do.
 */
function roster(): number[] {
  return useDatabase().select({ id: users.id }).from(users).orderBy(asc(users.id)).all()
    .map(row => row.id)
}

/**
 * The rooms this player may be asked about: in play, and not their own.
 *
 * "In play" is having at least one photo (SPEC §3), which is why a room can
 * appear or vanish between two visits and the sheet is never cached.
 */
export function answerableRooms(viewerId: number): number[] {
  return useDatabase()
    .selectDistinct({ id: photos.userId })
    .from(photos)
    .where(sql`${photos.userId} <> ${viewerId}`)
    .all()
    .map(row => row.id)
}

/**
 * Before the game opens there is no sheet — not a closed one, none at all.
 *
 * `/guess` follows `/results` here: a screen that has nothing to show is not
 * shown, and the route that feeds it says so rather than answering with an
 * empty-looking page. From `locked` onwards the sheet is back, read-only: what
 * is being refused is the phase before it existed, not the phases after it
 * froze.
 */
function assertSheetIsOut(): void {
  const { phase } = useGameState()
  if (phase === 'preparation') {
    throw createError({ statusCode: 409, statusMessage: 'not-open-yet', data: { phase } })
  }
}

export function guessSheet(viewerId: number): GuessSheet {
  assertSheetIsOut()

  const db = useDatabase()
  const rooms = deckOrder(answerableRooms(viewerId), viewerId, sessionSecret())

  const answers = new Map(db
    .select({ room: guesses.roomUserId, guessed: guesses.guessedUserId })
    .from(guesses)
    .where(eq(guesses.guesserId, viewerId))
    .all()
    .map(row => [row.room, row.guessed]))

  const roomPhotographs = photosByOwner()

  const participants = db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(sql`${users.id} <> ${viewerId}`)
    .orderBy(asc(users.displayName))
    .all()

  const pool = roster()

  const sheet = rooms.map<SheetRoom>((roomUserId) => {
    const guess = answers.get(roomUserId) ?? null
    const offered = suspectsFor(roomUserId, pool, sessionSecret())

    return {
      token: roomToken(viewerId, roomUserId, sessionSecret()),
      photos: roomPhotographs.get(roomUserId) ?? [],
      // Answers about rooms that have left play are kept but not counted: the
      // room may come back, and throwing them away on a phone's whim would be
      // worse than carrying them.
      guess,
      /*
       * Built by filtering the already-sorted `participants`, which does three
       * things at once: the order is alphabetical rather than derived, the
       * viewer is dropped — they are not in that list — and the ids are the
       * ones the client already knows.
       *
       * Dropping the viewer here rather than before the derivation is what
       * keeps the list the same for everybody. The consequence is deliberate:
       * on the rooms where the viewer happened to be a decoy, they see five
       * names instead of six. It tells them nothing they did not know — they
       * live in none of these rooms — and topping the list back up to six
       * would be a per-reader sixth name, which is exactly the leak avoided.
       *
       * An answer saved before this list existed is added back. The reader
       * already knows that name: it is on their own sheet. Leaving it out
       * would show them an answer they cannot see selected.
       */
      suspects: participants
        .filter(person => offered.has(person.id) || person.id === guess)
        .map(person => person.id),
    }
  })

  return {
    phase: useGameState().phase,
    rooms: sheet,
    participants,
    answered: sheet.filter(room => room.guess !== null).length,
    total: sheet.length,
  }
}

/**
 * The other half of the phase gate, and the narrow one.
 *
 * Guessing is `open` and nothing else: `preparation` has not opened the sheet
 * yet, `locked` has closed it. It sits here, next to its only caller, rather
 * than beside the room guard it used to share — the two rights are no longer
 * the same right, and the failure to prevent is a room guard widening and
 * quietly taking guessing with it.
 */
function assertGuessingIsOpen(): void {
  const { phase } = useGameState()
  if (phase !== 'open') {
    throw createError({
      statusCode: 409,
      statusMessage: 'The guess sheet is not open',
      data: { phase },
    })
  }
}

/**
 * Writes one answer, or replaces it.
 *
 * Every rule is checked here even though the database also holds two of them
 * as CHECK constraints: a constraint gives a 500, and a player who tapped a
 * name deserves a sentence instead.
 */
export function recordGuess(viewerId: number, token: unknown, participantId: unknown) {
  assertGuessingIsOpen()

  const roomUserId = resolveRoomToken(token, viewerId, answerableRooms(viewerId), sessionSecret())
  if (roomUserId === undefined) {
    throw createError({ statusCode: 404, statusMessage: 'unknown-room' })
  }

  if (typeof participantId !== 'number' || !Number.isInteger(participantId)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid-participant' })
  }

  // Naming yourself is not a guess, and the sheet never offers it (SPEC §4).
  if (participantId === viewerId) {
    throw createError({ statusCode: 422, statusMessage: 'invalid-participant' })
  }

  const db = useDatabase()
  const exists = db.select({ id: users.id }).from(users)
    .where(eq(users.id, participantId)).get()
  if (!exists) {
    throw createError({ statusCode: 422, statusMessage: 'invalid-participant' })
  }

  /*
   * The fifth refusal: a name this room never offered.
   *
   * The grid only draws six, so nobody reaches this by tapping — which is why
   * it reuses the existing slug rather than earning a message of its own. The
   * sheet already knows how to say "Non enregistré — réessayer", and a control
   * that is merely not drawn is a courtesy; the guard is what makes it a rule
   * (the same reasoning as the moderation route in #58).
   *
   * The reader's own current answer passes even when it predates the short
   * list, for the same reason the sheet still offers it: it is already theirs.
   */
  const offered = suspectsFor(roomUserId, roster(), sessionSecret())
  const current = db.select({ guessed: guesses.guessedUserId }).from(guesses)
    .where(and(eq(guesses.guesserId, viewerId), eq(guesses.roomUserId, roomUserId))).get()

  if (!offered.has(participantId) && current?.guessed !== participantId) {
    throw createError({ statusCode: 422, statusMessage: 'invalid-participant' })
  }

  db.insert(guesses)
    .values({ guesserId: viewerId, roomUserId, guessedUserId: participantId })
    .onConflictDoUpdate({
      target: [guesses.guesserId, guesses.roomUserId],
      set: { guessedUserId: participantId, updatedAt: new Date() },
    })
    .run()

  const sheet = guessSheet(viewerId)
  return { answered: sheet.answered, total: sheet.total }
}
