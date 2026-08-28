import type { PerquizDatabase } from '../database/client'
import type { SessionIdentity } from './session'
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
 *
 * That identity row is also what a session names, so resolving one is the same
 * query here and on every later request — see `selectByIdentity`.
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

/**
 * Just the `select`, so the same query serves the login — which runs it inside
 * its transaction, and must see its own uncommitted writes — and the request
 * middleware, which runs it outside of one.
 */
type Reader = Pick<PerquizDatabase, 'select'>

/**
 * The user behind an identity: the ONE resolution both a login and every later
 * request go through.
 *
 * Written once because the two must not drift: the login decides who an
 * identity already belongs to, and the middleware decides who a cookie is —
 * and those are the same question asked twice.
 */
function selectByIdentity(db: Reader, provider: string, subject: string): SignedInUser | undefined {
  return db
    .select({ id: users.id, displayName: users.displayName, isAdmin: users.isAdmin })
    .from(identities)
    .innerJoin(users, eq(users.id, identities.userId))
    .where(sql`${identities.provider} = ${provider} and ${identities.subject} = ${subject}`)
    .get()
}

export function provisionUser(provisioning: Provisioning): SignedInUser {
  const db = useDatabase()

  // One transaction: a user without their identity would be an account nobody
  // can ever sign into again, and the next login would create a duplicate.
  return db.transaction((tx): SignedInUser => {
    const existing = selectByIdentity(tx, provisioning.provider, provisioning.subject)

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

/**
 * The signed-in user a session's identity points at, or `undefined` when it
 * points at nobody.
 *
 * Two ways to get `undefined`, and the second is the reason this takes an
 * identity rather than a `users.id` (card 79): the account was removed, or the
 * database was rebuilt and nothing there answers to that provider and subject
 * any more. Neither can resolve to a DIFFERENT person, because the pair is not
 * a row number that a reset counter hands to the next arrival.
 */
export function findUserByIdentity({ provider, subject }: SessionIdentity): SignedInUser | undefined {
  return selectByIdentity(useDatabase(), provider, subject)
}
