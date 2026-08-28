import type { GamePhase } from '#shared/types/game'
import { isBeforeLock } from '#shared/utils/game'
import { and, asc, eq, sql } from 'drizzle-orm'
import { guesses, photos, users } from '../database/schema'

/**
 * Everything the owner of a room may do to it, and the one condition on all of
 * it: nothing has been frozen yet.
 *
 * Two phases qualify, and not the same two as guessing. A room is built during
 * `preparation` and stays editable through `open`, because photos and answers
 * are concurrent (SPEC §2); the sheet, meanwhile, only opens at `open`. That is
 * why this is no longer the same guard as the one in `recordGuess()` — one
 * function holding two rights that have started to diverge is a right granted
 * by accident.
 *
 * The phase check lives here rather than in each route, because "everything is
 * read-only once locked" (SPEC §2) is an invariant, and an invariant repeated
 * in five handlers is one that will be missing from the sixth.
 */

export function assertRoomsEditable(): void {
  const { phase } = useGameState()
  if (!isBeforeLock(phase)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'The rooms are no longer editable',
      data: { phase },
    })
  }
}

export interface RoomPhoto {
  name: string
  position: number
}

export function roomPhotos(userId: number): RoomPhoto[] {
  return useDatabase()
    .select({ name: photos.filename, position: photos.position })
    .from(photos)
    .where(eq(photos.userId, userId))
    .orderBy(asc(photos.position))
    .all()
}

/**
 * Every room's photographs at once, in the order their owners arranged them.
 *
 * The sibling of `roomPhotos()` above, for the three screens that draw the
 * whole game rather than one room — the guess sheet, the reveal show and the
 * results. All three had copied the same loop, and none of them filters: it is
 * always the whole table, always the same order.
 *
 * That order is not decoration. `position` is what the owner set, and the show
 * and the debrief walk a room's pictures in it.
 */
export function photosByOwner(): Map<number, string[]> {
  const byOwner = new Map<number, string[]>()

  for (const row of useDatabase()
    .select({ owner: photos.userId, name: photos.filename })
    .from(photos)
    .orderBy(asc(photos.userId), asc(photos.position))
    .all()) {
    byOwner.set(row.owner, [...(byOwner.get(row.owner) ?? []), row.name])
  }

  return byOwner
}

export interface RoomState {
  phase: GamePhase
  displayName: string
  photos: RoomPhoto[]
  /** Players other than me — how wide the audience for this room is. */
  otherPlayers: number
  /** Guesses already made about my room; discarded if it leaves play. */
  guessesOnMyRoom: number
}

export function roomState(userId: number): RoomState {
  const db = useDatabase()

  return {
    phase: useGameState().phase,
    displayName: db.select({ name: users.displayName }).from(users)
      .where(eq(users.id, userId)).get()?.name ?? '',
    photos: roomPhotos(userId),
    otherPlayers: toCount(db.select({ count: sql<number>`count(*)` }).from(users)
      .where(sql`${users.id} <> ${userId}`).get()),
    guessesOnMyRoom: toCount(db.select({ count: sql<number>`count(*)` }).from(guesses)
      .where(eq(guesses.roomUserId, userId)).get()),
  }
}

/**
 * Removes one photo, and — if it was the last one — the guesses about a room
 * that no longer exists.
 *
 * PAGES `/my-room`: a room with no photos leaves everyone's sheet, and the
 * answers people had written about it go with it. Keeping them would mean a
 * score counted against a room nobody can see any more.
 */
export function deleteRoomPhoto(userId: number, name: string): { remaining: number, discardedGuesses: number } {
  return deletePhoto(name, userId)
}

/**
 * The same removal, done by a moderator, who owns none of it.
 *
 * `owner` is the scope: an owner may only reach into their own room, a
 * moderator into any (SPEC §3). Nothing about the owner comes back out — the
 * admin panel must never learn whose room it just touched (SPEC §7).
 */
export function deleteAnyPhoto(name: string): { remaining: number, discardedGuesses: number } {
  return deletePhoto(name)
}

function deletePhoto(name: string, owner?: number): { remaining: number, discardedGuesses: number } {
  const db = useDatabase()

  return db.transaction((tx) => {
    const scope = owner === undefined
      ? eq(photos.filename, name)
      : and(eq(photos.userId, owner), eq(photos.filename, name))

    const removed = tx.delete(photos)
      .where(scope)
      .returning({ position: photos.position, userId: photos.userId })
      .all()

    if (removed.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'No such photo' })
    }

    const userId = removed[0]!.userId

    // Positions stay 0..n-1 and contiguous, so the grid never shows a gap.
    tx.run(sql`
      update ${photos} set position = position - 1
      where user_id = ${userId} and position > ${removed[0]!.position}
    `)

    const remaining = tx.select({ count: sql<number>`count(*)` }).from(photos)
      .where(eq(photos.userId, userId)).get()?.count ?? 0

    if (remaining > 0) return { remaining, discardedGuesses: 0 }

    const discarded = tx.delete(guesses)
      .where(eq(guesses.roomUserId, userId))
      .returning({ guesser: guesses.guesserId })
      .all()

    return { remaining, discardedGuesses: discarded.length }
  })
}

/** Rewrites the order from the names the owner listed, in the order they listed them. */
export function reorderRoomPhotos(userId: number, order: readonly string[]): RoomPhoto[] {
  const db = useDatabase()

  return db.transaction((tx) => {
    const current = tx.select({ name: photos.filename }).from(photos)
      .where(eq(photos.userId, userId)).all().map(row => row.name)

    const sameSet = current.length === order.length
      && new Set(order).size === order.length
      && order.every(name => current.includes(name))

    if (!sameSet) {
      throw createError({
        statusCode: 400,
        statusMessage: 'The new order must list each of your photos exactly once',
      })
    }

    // `(user_id, position)` is indexed but not unique, so a straight rewrite
    // would work. It is still done in two passes, through an offset, because
    // that keeps the operation independent of the order the rows are touched
    // in — and it is what makes the index safe to tighten later, should a
    // duplicate position ever turn out to be worth forbidding outright.
    tx.run(sql`update ${photos} set position = position + ${order.length} where user_id = ${userId}`)
    order.forEach((name, position) => {
      tx.update(photos).set({ position })
        .where(and(eq(photos.userId, userId), eq(photos.filename, name)))
        .run()
    })

    return roomPhotos(userId)
  })
}
