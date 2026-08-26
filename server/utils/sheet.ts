import type { GamePhase } from '#shared/types/game'
import { asc, eq, sql } from 'drizzle-orm'
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

function secret(): string {
  return useRuntimeConfig().sessionPassword
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

export function guessSheet(viewerId: number): GuessSheet {
  const db = useDatabase()
  const rooms = deckOrder(answerableRooms(viewerId), viewerId, secret())

  const answers = new Map(db
    .select({ room: guesses.roomUserId, guessed: guesses.guessedUserId })
    .from(guesses)
    .where(eq(guesses.guesserId, viewerId))
    .all()
    .map(row => [row.room, row.guessed]))

  const photosByOwner = new Map<number, string[]>()
  for (const row of db
    .select({ owner: photos.userId, name: photos.filename })
    .from(photos)
    .orderBy(asc(photos.userId), asc(photos.position))
    .all()) {
    const list = photosByOwner.get(row.owner) ?? []
    list.push(row.name)
    photosByOwner.set(row.owner, list)
  }

  const participants = db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(sql`${users.id} <> ${viewerId}`)
    .orderBy(asc(users.displayName))
    .all()

  const sheet = rooms.map<SheetRoom>(roomUserId => ({
    token: roomToken(viewerId, roomUserId, secret()),
    photos: photosByOwner.get(roomUserId) ?? [],
    // Answers about rooms that have left play are kept but not counted: the
    // room may come back, and throwing them away on a phone's whim would be
    // worse than carrying them.
    guess: answers.get(roomUserId) ?? null,
  }))

  return {
    phase: useGameState().phase,
    rooms: sheet,
    participants,
    answered: sheet.filter(room => room.guess !== null).length,
    total: sheet.length,
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
  assertPhaseIsOpen()

  const roomUserId = resolveRoomToken(token, viewerId, answerableRooms(viewerId), secret())
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
