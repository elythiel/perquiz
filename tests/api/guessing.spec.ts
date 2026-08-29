import { beforeEach, describe, expect, it } from 'vitest'
import { useTestApi } from '../support/api'

/**
 * The rule that stops a forged answer: you may only name someone the sheet
 * offered you.
 *
 * The short list is six names per room (SPEC §4), derived from the room and
 * never from the reader. Nothing in the interface can name anyone else — but
 * the interface is not the boundary, a POST is, and without this guard a
 * player with a console could answer every room with every participant in turn
 * and read the score back. It is the fifth and last check in `recordGuess`,
 * and it was the only one with no test.
 *
 * It also has an exception, which is the half worth writing down: an answer
 * that predates the list stays replaceable by itself. Someone who answered
 * before a sign-up displaced the fifth decoy must still be able to re-save
 * what is already on their sheet, or their own screen would start refusing
 * what it shows them.
 */

let viewer: number
let cookie: string
let roster: number[]

beforeEach(async () => {
  const api = await useTestApi()
  api.reset()

  viewer = api.createUser('Alice')
  cookie = await api.signIn(viewer)

  // Ten players and six names per room, so four participants are always left
  // off any given short list — which is what makes this testable at all, and
  // with enough margin that the tests below can ask for two of them.
  roster = [viewer]
  for (const name of ['Bruno', 'Chloé', 'David', 'Émile', 'Fatou', 'Gaël', 'Hugo', 'Inès', 'Jonas']) {
    roster.push(api.createUser(name))
  }

  api.addPhoto(roster[1]!)
  api.setPhase('open')
})

/** The first room of the viewer's deck, with the names it offers. */
async function firstRoom() {
  const api = await useTestApi()
  const sheet = await (await api.fetch('/api/guess', { cookie })).json()
  return sheet.rooms[0] as { token: string, suspects: number[], guess: number | null }
}

async function answer(token: string, participant: number) {
  const api = await useTestApi()
  return api.fetch('/api/guess', {
    method: 'PATCH',
    cookie,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ room: token, participant }),
  })
}

describe('naming somebody the sheet never offered', () => {
  it('is refused, even though they are a real participant', async () => {
    const room = await firstRoom()
    const outsider = roster.find(id => id !== viewer && !room.suspects.includes(id))

    // The setup exists to produce one; if it stops doing so the test is lying.
    expect(outsider).toBeDefined()

    const response = await answer(room.token, outsider!)
    expect(response.status).toBe(422)
    expect((await response.json()).statusMessage).toBe('invalid-participant')
  })

  it('leaves the sheet exactly as it was', async () => {
    const room = await firstRoom()
    const outsider = roster.find(id => id !== viewer && !room.suspects.includes(id))!

    await answer(room.token, outsider)

    expect((await firstRoom()).guess).toBeNull()
  })

  it('accepts one the sheet did offer, so the refusal is about the list', async () => {
    const room = await firstRoom()
    const offered = room.suspects.find(id => id !== viewer)!

    const response = await answer(room.token, offered)
    expect(response.status).toBe(200)
    expect((await firstRoom()).guess).toBe(offered)
  })
})

describe('an answer older than the list it is no longer on', () => {
  it('can still be re-saved as itself', async () => {
    /*
     * Staged the way the game stages it: the answer is already in the table,
     * naming somebody this room does not offer any more. That is a sign-up
     * having displaced the fifth decoy since — the short lists only ever
     * shrink from the bottom — and the player's own screen still shows the
     * name. Re-saving it must work.
     */
    const api = await useTestApi()
    const room = await firstRoom()
    const outsider = roster.find(id => id !== viewer && !room.suspects.includes(id))!

    api.addGuess(viewer, roster[1]!, outsider)
    expect((await firstRoom()).guess).toBe(outsider)

    expect((await answer(room.token, outsider)).status).toBe(200)
    expect((await firstRoom()).guess).toBe(outsider)
  })

  it('does not let a second stranger in through the same door', async () => {
    const api = await useTestApi()
    const room = await firstRoom()
    const outsiders = roster.filter(id => id !== viewer && !room.suspects.includes(id))
    expect(outsiders.length).toBeGreaterThanOrEqual(2)

    api.addGuess(viewer, roster[1]!, outsiders[0]!)

    // The exception is "what you already answered", not "anyone off the list".
    expect((await answer(room.token, outsiders[1]!)).status).toBe(422)
    expect((await firstRoom()).guess).toBe(outsiders[0])
  })
})
