import type { H3Event } from 'h3'
import type { GamePhase } from '#shared/types/game'
import { createHmac } from 'node:crypto'
import { asc, eq, sql } from 'drizzle-orm'
import { APP_STATE_ID, appState, guesses, photos, users } from '../database/schema'

/**
 * Running the game without ever seeing the answer key.
 *
 * The whole difficulty of this panel is that admins play too (SPEC §7): every
 * figure it shows is one an ordinary player must not be able to derive the
 * room → owner mapping from. So participation is named but says nothing about
 * WHICH rooms anyone answered, and moderation shows photographs with no owner
 * and in an order that does not group them by room.
 */

export function assertAdmin(event: H3Event): number {
  const user = event.context.user
  if (!user?.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'forbidden' })
  }
  return user.id
}

export interface Participation {
  id: number
  displayName: string
  photos: number
  answered: number
  /** Rooms this person could answer: everyone else's room in play. */
  total: number
  /** Unix seconds of their most recent trace, or null if they never came. */
  lastActivity: number | null
  /** A room in play and a finished sheet: nothing left to wait for. */
  ready: boolean
}

export interface AdminPanel {
  phase: GamePhase
  lockedAt: number | null
  participants: Participation[]
  ready: number
  /** Every photo in the game, owner stripped and order broken. */
  moderation: string[]
}

/**
 * The photo grid, shuffled so that neighbours are not room-mates.
 *
 * Insertion order groups a room's photographs together, which next to a list
 * of per-person photo counts is most of the answer key. Sorted by a keyed
 * digest instead: stable, so deleting one photo does not reshuffle the grid
 * under the moderator's finger, and unrelated to who uploaded what.
 */
function moderationOrder(names: readonly string[], secret: string): string[] {
  const key = createHmac('sha256', secret).update('perquiz:moderation-order').digest()
  const rank = (name: string) => createHmac('sha256', key).update(name).digest('hex')
  return [...names].sort((left, right) => rank(left).localeCompare(rank(right)))
}

export function adminPanel(): AdminPanel {
  const db = useDatabase()
  const state = useGameState()

  const roomsInPlay = db
    .selectDistinct({ id: photos.userId })
    .from(photos)
    .all()
    .map(row => row.id)

  const rows = db.all<{
    id: number
    displayName: string
    photos: number
    answered: number
    lastActivity: number | null
  }>(sql`
    select
      u.id                                                              as id,
      u.display_name                                                    as displayName,
      (select count(*) from photos p where p.user_id = u.id)            as photos,
      (select count(*) from guesses g
         where g.guesser_id = u.id
           and g.room_user_id in (select distinct user_id from photos))  as answered,
      max(
        coalesce(u.last_seen_at, 0),
        coalesce((select max(created_at) from photos p where p.user_id = u.id), 0),
        coalesce((select max(updated_at) from guesses g where g.guesser_id = u.id), 0)
      )                                                                  as lastActivity
    from users u
    order by u.display_name collate nocase
  `)

  const participants = rows.map<Participation>((row) => {
    // Their own room never appears on their own sheet.
    const total = roomsInPlay.filter(id => id !== row.id).length
    return {
      ...row,
      total,
      lastActivity: row.lastActivity ? row.lastActivity : null,
      ready: row.photos > 0 && total > 0 && row.answered >= total,
    }
  })

  const names = db
    .select({ name: photos.filename })
    .from(photos)
    .orderBy(asc(photos.filename))
    .all()
    .map(row => row.name)

  return {
    phase: state.phase,
    lockedAt: state.lockedAt ? Math.floor(state.lockedAt.getTime() / 1000) : null,
    participants,
    ready: participants.filter(person => person.ready).length,
    moderation: moderationOrder(names, useRuntimeConfig().sessionPassword),
  }
}

/**
 * Moves the game, in either direction.
 *
 * Every transition is allowed, reversals included: SPEC §2 says an admin who
 * locked by mistake must be able to reopen. `locked_at` marks when the answers
 * were frozen, so it is stamped on the way in and cleared only by a return to
 * `open` — going on to `revealed` keeps it, because the freeze still happened.
 */
export function setPhase(phase: GamePhase) {
  useDatabase()
    .update(appState)
    .set({ phase, lockedAt: phase === 'open' ? null : (useGameState().lockedAt ?? new Date()) })
    .where(eq(appState.id, APP_STATE_ID))
    .run()

  return { phase }
}

export interface Removal {
  displayName: string
  photos: string[]
  /** Answers they wrote themselves. */
  guessesMade: number
  /**
   * Answers OTHER people wrote that this deletion destroys.
   *
   * Three foreign keys point at a participant from `guesses`, and all three
   * cascade: the guesser, the room, and — easy to miss — the person named as
   * the suspect. Removing somebody therefore erases every answer that accused
   * them, on rooms that have nothing to do with them. Counted as one distinct
   * set, because a right answer about their own room is both at once.
   */
  guessesLost: number
}

/** What deleting this participant would take with it, before it is done. */
export function removalPreview(userId: number): Removal {
  const db = useDatabase()
  const person = db.select({ displayName: users.displayName }).from(users)
    .where(eq(users.id, userId)).get()

  if (!person) throw createError({ statusCode: 404, statusMessage: 'unknown-participant' })

  const count = (row: { count: number } | undefined) => row?.count ?? 0

  return {
    displayName: person.displayName,
    photos: db.select({ name: photos.filename }).from(photos)
      .where(eq(photos.userId, userId)).all().map(row => row.name),
    guessesMade: count(db.select({ count: sql<number>`count(*)` }).from(guesses)
      .where(eq(guesses.guesserId, userId)).get()),
    guessesLost: count(db.get<{ count: number }>(sql`
      select count(*) as count from ${guesses}
      where guesser_id <> ${userId}
        and (room_user_id = ${userId} or guessed_user_id = ${userId})
    `)),
  }
}

/**
 * Removes a participant and everything of theirs.
 *
 * The row goes, and the schema's cascades take the identity, the photos and
 * the guesses — both the ones they wrote and the ones written about their
 * room. Their access is untouched: it lives at the identity provider, so
 * signing in again gives them a fresh, empty account (PAGES `/admin`).
 */
export function removeParticipant(userId: number): Removal {
  const preview = removalPreview(userId)
  useDatabase().delete(users).where(eq(users.id, userId)).run()
  return preview
}
