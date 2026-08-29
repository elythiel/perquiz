import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { provisionUser } from '../../server/utils/provisioning'
import { useTestApi } from '../support/api'

/**
 * The front door: the login that creates an account the first time.
 *
 * Every player in the game arrives through this function and it had no test of
 * its own until vikunja-108 — which is a strange gap for the one piece of code
 * that decides who exists. Four things are pinned, and all four are ways the
 * evening goes wrong rather than ways the types do.
 *
 * The provider owns who may play; Perquiz owns the game (SPEC §1). That split
 * is what makes the second test below matter more than it looks: an admin role
 * taken away at the provider has to be gone here too, at the very next login,
 * or a revocation is a thing that was said and not done.
 */

function login(subject: string, options: { name?: string, isAdmin?: boolean } = {}) {
  return provisionUser({
    provider: 'test',
    subject,
    displayName: options.name ?? 'Alice',
    isAdmin: options.isAdmin ?? false,
  })
}

const countUsers = async () => {
  const api = await useTestApi()
  return api.db.get<{ count: number }>(sql`select count(*) as count from users`)?.count
}

const countIdentities = async () => {
  const api = await useTestApi()
  return api.db.get<{ count: number }>(sql`select count(*) as count from identities`)?.count
}

beforeEach(async () => {
  const api = await useTestApi()
  api.reset()
})

describe('signing in twice', () => {
  it('is the same account, not a second one', async () => {
    const first = login('sub-alice')
    const second = login('sub-alice')

    expect(second.id).toBe(first.id)
    expect(await countUsers()).toBe(1)
    expect(await countIdentities()).toBe(1)
  })

  it('recognises the subject and not the name, which the player may have changed', async () => {
    const first = login('sub-alice', { name: 'Alice' })
    // The provider now sends a different `name` claim for the same person.
    const second = login('sub-alice', { name: 'Alice Martin' })

    expect(second.id).toBe(first.id)
    // The local profile wins: renaming in-app is a thing this game offers, and
    // a login that overwrote it would take it back every morning.
    expect(second.displayName).toBe('Alice')
  })

  it('is a different account for the same name at a different subject', async () => {
    const first = login('sub-alice')
    const second = login('sub-other')

    expect(second.id).not.toBe(first.id)
    expect(await countUsers()).toBe(2)
  })
})

describe('the admin role, which is a cache and not a fact', () => {
  it('is rewritten at every login, so a revocation actually lands', async () => {
    expect(login('sub-admin', { isAdmin: true }).isAdmin).toBe(true)

    // The role is taken away at the provider; the next token says so.
    const after = login('sub-admin', { isAdmin: false })

    expect(after.isAdmin).toBe(false)
    const api = await useTestApi()
    expect(api.db.get<{ admin: number }>(
      sql`select is_admin as admin from users where id = ${after.id}`,
    )?.admin).toBe(0)
  })

  it('is granted the same way round', async () => {
    const before = login('sub-alice', { isAdmin: false })
    expect(login('sub-alice', { isAdmin: true })).toMatchObject({ id: before.id, isAdmin: true })
  })
})

describe('two people who arrive under the same name', () => {
  it('gives the second one a suffix rather than refusing them', async () => {
    expect(login('sub-one', { name: 'Alice' }).displayName).toBe('Alice')
    expect(login('sub-two', { name: 'Alice' }).displayName).toBe('Alice 2')
    expect(login('sub-three', { name: 'Alice' }).displayName).toBe('Alice 3')
  })

  it('treats a name as taken whatever its case, the way the index does', async () => {
    login('sub-one', { name: 'Alice' })
    expect(login('sub-two', { name: 'alice' }).displayName).toBe('alice 2')
  })
})

describe('the transaction around the pair', () => {
  it('leaves no user behind when the identity cannot be written', async () => {
    /*
     * A user without an identity is an account nobody can ever sign into
     * again — and worse, the next attempt would sail past the lookup and
     * create a duplicate. The two writes are therefore one transaction, and
     * this is the only way to see that from outside: make the second write
     * fail and check that the first went with it.
     */
    const api = await useTestApi()
    api.db.run(sql`
      create trigger refuse_identity before insert on identities
      begin select raise(abort, 'no identity for you'); end
    `)

    try {
      expect(() => login('sub-alice')).toThrow(/no identity for you/)
      expect(await countUsers()).toBe(0)
      expect(await countIdentities()).toBe(0)
    }
    finally {
      api.db.run(sql`drop trigger refuse_identity`)
    }
  })
})
