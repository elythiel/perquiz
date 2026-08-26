import { eq, sql } from 'drizzle-orm'
import { identities, users } from '../database/schema'

/**
 * Just-in-time provisioning: the first login creates the account.
 *
 * The provider owns who exists and who may play; Perquiz owns the game. So a
 * login writes exactly two things — a local profile the game can join on, and
 * an identity row remembering which subject at which provider it came from.
 *
 * `is_admin` is rewritten at EVERY login, never only at creation: it is a
 * cache of the provider's role, and a cache that is only ever filled once is
 * a stale answer waiting to happen (SPEC §1).
 */

export interface Provisioning {
  provider: string
  subject: string
  displayName: string
  isAdmin: boolean
}

export interface SignedInUser {
  id: number
  displayName: string
  isAdmin: boolean
}

export function provisionUser(provisioning: Provisioning): SignedInUser {
  const db = useDatabase()

  // One transaction: a user without their identity would be an account nobody
  // can ever sign into again, and the next login would create a duplicate.
  return db.transaction((tx): SignedInUser => {
    const existing = tx
      .select({ id: users.id, displayName: users.displayName })
      .from(identities)
      .innerJoin(users, eq(users.id, identities.userId))
      .where(sql`${identities.provider} = ${provisioning.provider} and ${identities.subject} = ${provisioning.subject}`)
      .get()

    if (existing) {
      tx.update(users)
        .set({ isAdmin: provisioning.isAdmin })
        .where(eq(users.id, existing.id))
        .run()

      return { ...existing, isAdmin: provisioning.isAdmin }
    }

    const isTaken = (name: string) =>
      tx.select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.displayName}) = lower(${name})`)
        .get() !== undefined

    const displayName = uniqueDisplayName(provisioning.displayName, isTaken)

    const created = tx.insert(users)
      .values({ displayName, isAdmin: provisioning.isAdmin })
      .returning({ id: users.id })
      .get()

    tx.insert(identities)
      .values({
        userId: created.id,
        provider: provisioning.provider,
        subject: provisioning.subject,
      })
      .run()

    return { id: created.id, displayName, isAdmin: provisioning.isAdmin }
  })
}

/** The signed-in user behind a session's `userId`, or `undefined` if it is stale. */
export function findUserById(id: number): SignedInUser | undefined {
  return useDatabase()
    .select({ id: users.id, displayName: users.displayName, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, id))
    .get()
}
