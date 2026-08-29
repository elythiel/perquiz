import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { useTestApi } from '../support/api'

/**
 * The projected show: what it counts, and what it refuses to re-shuffle.
 *
 * The one screen where the room → owner mapping is allowed out (SPEC §6), so
 * everything it says is read aloud to a room of people and cannot be quietly
 * wrong. Two halves are pinned here. The arithmetic — who voted for whom, and
 * how many said nothing — because a chart that is off by one turns a story
 * into an argument. And the order, because a show is driven live from one
 * browser: a refresh, a laptop waking up, a second tab opened by mistake, and
 * a re-deal halfway through would leave the room watching a room it has
 * already seen.
 */

let alice: number
let bruno: number
let chloe: number
let david: number
let adminCookie: string

/** A fixed seed, so the deal below is a golden value rather than a coin toss. */
const SEED = 'perquiz-test-seed'

beforeEach(async () => {
  const api = await useTestApi()
  api.reset()

  alice = api.createUser('Alice')
  bruno = api.createUser('Bruno')
  chloe = api.createUser('Chloé')
  david = api.createUser('David', { isAdmin: true })
  adminCookie = await api.signIn(david)

  // Three rooms in play; David has no photographs, so he is a player without
  // a room — which is the case that makes `noAnswer` worth counting properly.
  api.addPhoto(alice)
  api.addPhoto(bruno)
  api.addPhoto(chloe)

  api.setPhase('locked')
  api.db.run(sql`update app_state set reveal_seed = ${SEED}`)
})

async function show(cookie = adminCookie) {
  const api = await useTestApi()
  const response = await api.fetch('/api/reveal', { cookie })
  return { status: response.status, body: await response.json() }
}

describe('what the chart says about a room', () => {
  it('tallies the votes and names everyone who cast one', async () => {
    const api = await useTestApi()
    // Alice's room: two people say Alice (right), one says Bruno.
    api.addGuess(bruno, alice, alice)
    api.addGuess(chloe, alice, alice)
    api.addGuess(david, alice, bruno)

    const { body } = await show()
    const room = body.rooms.find((candidate: { owner: { id: number } }) => candidate.owner.id === alice)

    expect(room.votes).toEqual([
      { displayName: 'Alice', count: 2, isOwner: true },
      { displayName: 'Bruno', count: 1, isOwner: false },
    ])
  })

  it('breaks a tie on the name, in French', async () => {
    const api = await useTestApi()
    // One vote each, so only the name can decide the order — and « Chloé »
    // sorts before « David » only if the comparison knows about accents.
    // Nobody names themselves: the database refuses it, and so does the sheet.
    api.addGuess(bruno, alice, david)
    api.addGuess(david, alice, chloe)

    const { body } = await show()
    const room = body.rooms.find((candidate: { owner: { id: number } }) => candidate.owner.id === alice)

    expect(room.votes.map((vote: { displayName: string }) => vote.displayName)).toEqual(['Chloé', 'David'])
  })

  it('counts everyone who said nothing, the owner excepted', async () => {
    const api = await useTestApi()
    // Four players. Alice cannot answer about her own room, so three could
    // have; one did.
    api.addGuess(bruno, alice, alice)

    const { body } = await show()
    const room = body.rooms.find((candidate: { owner: { id: number } }) => candidate.owner.id === alice)

    expect(room.noAnswer).toBe(2)
  })

  it('leaves a room nobody answered with a full house of silence', async () => {
    const { body } = await show()
    const room = body.rooms.find((candidate: { owner: { id: number } }) => candidate.owner.id === chloe)

    expect(room.votes).toEqual([])
    expect(room.noAnswer).toBe(3)
  })
})

describe('the order the rooms are dealt in', () => {
  /** The deal for `SEED`, read once and pinned: the shuffle is the point. */
  const dealFor = (body: { rooms: { owner: { id: number } }[] }) =>
    body.rooms.map(room => room.owner.id)

  it('is a shuffle and not the order the rooms were created in', async () => {
    const { body } = await show()

    expect([...dealFor(body)].sort((left, right) => left - right)).toEqual([alice, bruno, chloe])
    expect(dealFor(body)).not.toEqual([alice, bruno, chloe])
  })

  it('is the same on a second read — a refresh does not re-deal', async () => {
    const first = await show()
    const second = await show()

    expect(dealFor(second.body)).toEqual(dealFor(first.body))
  })

  it('survives a phase flipped down and back, which is where a slip happens', async () => {
    /*
     * `setPhase` never clears `reveal_seed`, and that is deliberate rather
     * than forgotten: an admin who taps the wrong phase mid-party and flips
     * straight back must not find the show re-dealt underneath them. Pinned
     * here so nobody "fixes" it into a reset by reflex.
     */
    const api = await useTestApi()
    const before = await show()

    await api.fetch('/api/admin/phase', {
      method: 'PATCH',
      cookie: adminCookie,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phase: 'open' }),
    })
    await api.fetch('/api/admin/phase', {
      method: 'PATCH',
      cookie: adminCookie,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phase: 'locked' }),
    })

    const after = await show()
    expect(dealFor(after.body)).toEqual(dealFor(before.body))
    expect(api.db.get<{ seed: string }>(sql`select reveal_seed as seed from app_state`)?.seed).toBe(SEED)
  })
})
