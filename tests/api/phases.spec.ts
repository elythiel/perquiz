import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { roomToken } from '../../server/utils/guessing'
import { useTestApi } from '../support/api'

/**
 * Two locks, two boundaries (SPEC §2).
 *
 * `preparation` and `open` differ by exactly one right — answering — and the
 * temptation the code fell into once already is to hold both behind a single
 * guard. These tests take the two apart on purpose: every case asserts a room
 * mutation AND a guess in the same phase, so a guard that widens or narrows
 * far enough to swallow the other one fails here rather than at the party.
 */

let alice: number
let aliceCookie: string
let bruno: number
let brunoCookie: string
let adminCookie: string

beforeEach(async () => {
  const api = await useTestApi()
  api.reset()

  alice = api.createUser('Alice')
  aliceCookie = await api.signIn(alice)
  bruno = api.createUser('Bruno')
  brunoCookie = await api.signIn(bruno)
  adminCookie = await api.signIn(api.createUser('Régie', { isAdmin: true }))

  api.addPhoto(alice)
  api.addPhoto(bruno)
})

/** Renaming: the cheapest of the five room mutations, and gated by the same guard. */
async function rename(cookie: string, displayName: string) {
  const api = await useTestApi()
  return api.fetch('/api/my-room/name', {
    method: 'PATCH',
    cookie,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName }),
  })
}

/** Reordering and deleting, so the guard is proved on more than one handler. */
async function reorder(cookie: string, order: string[]) {
  const api = await useTestApi()
  return api.fetch('/api/my-room/photos', {
    method: 'PATCH',
    cookie,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ order }),
  })
}

async function removePhoto(cookie: string, name: string) {
  const api = await useTestApi()
  return api.fetch(`/api/my-room/photos/${name}`, { method: 'DELETE', cookie })
}

/**
 * One answer on Bruno's room, written by Alice.
 *
 * The handle is minted here rather than read back from `GET /api/guess`,
 * because in `preparation` that route is closed too — and the point of the
 * test is what the *write* does with a handle that is otherwise valid, not
 * that the read got there first.
 */
async function guess(): Promise<Response> {
  const api = await useTestApi()

  return api.fetch('/api/guess', {
    method: 'PATCH',
    cookie: aliceCookie,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ room: roomToken(alice, bruno, api.sessionPassword), participant: bruno }),
  })
}

describe('during preparation', () => {
  beforeEach(async () => (await useTestApi()).setPhase('preparation'))

  it('lets an owner build their room', async () => {
    const api = await useTestApi()
    const second = api.addPhoto(alice)
    const [first] = api.db.all<{ filename: string }>(
      sql`select filename from photos where user_id = ${alice} order by position`,
    ).map(row => row.filename)

    expect((await rename(aliceCookie, 'Alice B.')).status).toBe(200)
    expect((await reorder(aliceCookie, [second, first!])).status).toBe(200)
    expect((await removePhoto(aliceCookie, second)).status).toBe(200)
  })

  it('refuses a guess: the sheet is not open yet', async () => {
    expect((await guess()).status).toBe(409)
  })

  it('has no sheet to hand out at all — /guess does not exist yet', async () => {
    const api = await useTestApi()
    expect((await api.fetch('/api/guess', { cookie: aliceCookie })).status).toBe(409)
  })

  it('refuses the reveal show: there is nothing to reveal', async () => {
    const api = await useTestApi()
    expect((await api.fetch('/api/reveal', { cookie: adminCookie })).status).toBe(409)
  })

  it('freezes nothing, so `locked_at` stays empty', async () => {
    const api = await useTestApi()
    const lockedAt = () => api.db.get<{ at: number | null }>(
      sql`select locked_at as at from app_state where id = 1`,
    )?.at ?? null

    await api.fetch('/api/admin/phase', {
      method: 'PATCH',
      cookie: adminCookie,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phase: 'locked' }),
    })
    expect(lockedAt()).not.toBeNull()

    // Back to preparation: the freeze is undone, exactly as a return to `open`
    // undoes it. A stamp surviving here would date a lock that no longer holds.
    await api.fetch('/api/admin/phase', {
      method: 'PATCH',
      cookie: adminCookie,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phase: 'preparation' }),
    })
    expect(lockedAt()).toBeNull()
  })
})

describe('once open', () => {
  beforeEach(async () => (await useTestApi()).setPhase('open'))

  it('opens guessing without closing the room — both at once (SPEC §2)', async () => {
    const api = await useTestApi()
    const extra = api.addPhoto(bruno)

    expect((await guess()).status).toBe(200)
    expect((await rename(brunoCookie, 'Bruno C.')).status).toBe(200)
    expect((await removePhoto(brunoCookie, extra)).status).toBe(200)
  })
})

describe('once locked', () => {
  beforeEach(async () => (await useTestApi()).setPhase('locked'))

  it('closes both: the room guard widened for preparation, not for the lock', async () => {
    expect((await rename(aliceCookie, 'Alice C.')).status).toBe(409)
    expect((await guess()).status).toBe(409)
  })
})
