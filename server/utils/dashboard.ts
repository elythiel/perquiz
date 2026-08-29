import type { DashboardState } from '#shared/types/dashboard'
import { asc, eq, sql } from 'drizzle-orm'
import { guesses, photos, users } from '../database/schema'

/**
 * What the dashboard needs to say "here is where you stand".
 *
 * One query set, one shape, no scores. Score and rank are M8's: SPEC §5 keeps
 * them out of every response until the game is `revealed`, and the util that
 * computes shared ranks is that milestone's deliverable — building a second
 * one here would be the kind of duplicate that quietly disagrees with itself.
 */

/**
 * Reads the dashboard, then stamps the visit.
 *
 * A GET with a write in it, on purpose: "since your last visit" only means
 * anything if looking counts as visiting. The consequence is deliberate and
 * visible — reload the page and the count is gone, because it no longer is.
 */
export function dashboardState(viewerId: number): DashboardState {
  const db = useDatabase()

  const myPhotos = db
    .select({ name: photos.filename })
    .from(photos)
    .where(eq(photos.userId, viewerId))
    .orderBy(asc(photos.position))
    .all()
    .map(row => row.name)

  const lastSeenAt = db
    .select({ at: users.lastSeenAt })
    .from(users)
    .where(eq(users.id, viewerId))
    .get()?.at

  // A room enters play with its first photo, so that is the moment to compare
  // against — not the owner's account, which is far older.
  const newRooms = lastSeenAt
    ? toCount(db.get<{ count: number }>(sql`
        select count(*) as count from (
          select user_id, min(created_at) as entered
          from photos where user_id <> ${viewerId}
          group by user_id
        ) where entered > ${Math.floor(lastSeenAt.getTime() / 1000)}
      `))
    : 0

  const total = toCount(db.get<{ count: number }>(sql`
    select count(distinct user_id) as count from ${photos} where user_id <> ${viewerId}
  `))

  const state: DashboardState = {
    phase: useGameState().phase,
    myPhotos,
    roomsInPlay: toCount(db.get<{ count: number }>(sql`
      select count(distinct user_id) as count from ${photos}
    `)),
    participants: toCount(db.select({ count: sql<number>`count(*)` }).from(users).get()),
    // Only answers about rooms still in play, or the dashboard would say 9/8
    // the day somebody deletes their last photo. The guess sheet counts the
    // same way; these two numbers are read side by side.
    answered: toCount(db.get<{ count: number }>(sql`
      select count(*) as count from ${guesses}
      where guesser_id = ${viewerId}
        and room_user_id in (select distinct user_id from ${photos})
    `)),
    total,
    newRooms,
  }

  db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, viewerId)).run()

  return state
}
