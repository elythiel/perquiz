import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { useTestApi } from '../support/api'

/**
 * Where a photograph sits in its room, and what happens to the others when one
 * leaves.
 *
 * The grid draws in `position` order and the owner drags to change it, so the
 * column is not decoration: a gap or a duplicate shows up as a picture in the
 * wrong place, or as two that swap on every reload. Positions are therefore
 * 0..n-1 and contiguous at all times, which deleting from the middle is the
 * only thing that really threatens.
 *
 * The reorder guard is the other half. It accepts a permutation of the room
 * and nothing else — vikunja-108 found that the `sameSet` check refusing a
 * subset or a repeat had never been exercised, which for a rule this cheap to
 * break silently is a poor place to have no test.
 */

let owner: number
let cookie: string
let names: string[]

beforeEach(async () => {
  const api = await useTestApi()
  api.reset()

  owner = api.createUser('Alice')
  cookie = await api.signIn(owner)
  names = ['one', 'two', 'three', 'four'].map(() => api.addPhoto(owner))
})

async function positions() {
  const api = await useTestApi()
  return api.db.all<{ filename: string, position: number }>(
    sql`select filename, position from photos where user_id = ${owner} order by position`,
  )
}

async function reorder(order: unknown) {
  const api = await useTestApi()
  return api.fetch('/api/my-room/photos', {
    method: 'PATCH',
    cookie,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ order }),
  })
}

describe('removing one from the middle', () => {
  it('closes the gap rather than leaving one', async () => {
    const api = await useTestApi()

    const response = await api.fetch(`/api/my-room/photos/${names[1]}`, { method: 'DELETE', cookie })
    expect(response.status).toBe(200)

    const left = await positions()
    expect(left.map(row => row.position)).toEqual([0, 1, 2])
    expect(left.map(row => row.filename)).toEqual([names[0], names[2], names[3]])
  })

  it('keeps them contiguous through several removals', async () => {
    const api = await useTestApi()

    for (const name of [names[1], names[0]]) {
      await api.fetch(`/api/my-room/photos/${name}`, { method: 'DELETE', cookie })
    }

    expect((await positions()).map(row => row.position)).toEqual([0, 1])
  })

  it('answers a name this room does not hold with a slug, not a sentence', async () => {
    const api = await useTestApi()
    const stranger = api.addPhoto(api.createUser('Bruno'))

    const response = await api.fetch(`/api/my-room/photos/${stranger}`, { method: 'DELETE', cookie })
    expect(response.status).toBe(404)
    expect((await response.json()).statusMessage).toBe('no-such-photo')
  })
})

describe('the new order a reorder is allowed to be', () => {
  it('accepts a permutation and writes it', async () => {
    const wanted = [names[3], names[0], names[2], names[1]]

    expect((await reorder(wanted)).status).toBe(200)
    expect((await positions()).map(row => row.filename)).toEqual(wanted)
  })

  it('refuses a list that names one photograph twice', async () => {
    const response = await reorder([names[0], names[0], names[2], names[3]])

    expect(response.status).toBe(400)
    expect((await response.json()).statusMessage).toBe('invalid-order')
    // Nothing moved: a refused reorder is not a partial one.
    expect((await positions()).map(row => row.filename)).toEqual(names)
  })

  it('refuses a list that leaves one out', async () => {
    const response = await reorder([names[0], names[1], names[2]])

    expect(response.status).toBe(400)
    expect((await positions()).map(row => row.filename)).toEqual(names)
  })

  it('refuses a list carrying a name from somebody else\'s room', async () => {
    const api = await useTestApi()
    const stranger = api.addPhoto(api.createUser('Bruno'))

    expect((await reorder([names[0], names[1], names[2], stranger])).status).toBe(400)
    expect((await positions()).map(row => row.filename)).toEqual(names)
  })

  it('refuses a body that is not a list of photo names at all', async () => {
    for (const body of [['../etc/passwd'], 'nope', 42, [{ name: names[0] }]]) {
      const response = await reorder(body)
      expect(response.status).toBe(400)
      expect((await response.json()).statusMessage).toBe('invalid-order')
    }
  })
})
