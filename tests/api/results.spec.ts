import { beforeEach, describe, expect, it } from 'vitest'
import { useTestApi } from '../support/api'

/**
 * The personal debrief: the score each player reads at the end.
 *
 * The last screen of the evening, and the one people argue with. Everything on
 * it is derived — the rank from shared standings, the room cards from the same
 * deck order the guess sheet dealt — so the failure mode is not a crash but a
 * number that is quietly one off in front of everyone.
 *
 * Four things are pinned: my own score and rank, who shares that rank, a room
 * left blank staying blank rather than becoming a wrong answer, and the order
 * of the cards, which is the reader's own deck and not the database's.
 */

let alice: number
let bruno: number
let chloe: number
let david: number
let cookie: string

beforeEach(async () => {
  const api = await useTestApi()
  api.reset()

  alice = api.createUser('Alice')
  bruno = api.createUser('Bruno')
  chloe = api.createUser('Chloé')
  david = api.createUser('David')
  cookie = await api.signIn(alice)

  for (const player of [bruno, chloe, david]) api.addPhoto(player)
  api.setPhase('revealed')
})

async function debrief(as = cookie) {
  const api = await useTestApi()
  const response = await api.fetch('/api/results', { cookie: as })
  return { status: response.status, body: await response.json() }
}

describe('my own line', () => {
  it('counts the rooms I got right and no others', async () => {
    const api = await useTestApi()
    api.addGuess(alice, bruno, bruno) // right
    api.addGuess(alice, chloe, david) // wrong
    // David's room left blank.

    const { body } = await debrief()
    expect(body.me).toMatchObject({ id: alice, score: 1, total: 3 })
  })

  it('is first when nobody scored more', async () => {
    const api = await useTestApi()
    api.addGuess(alice, bruno, bruno)
    api.addGuess(alice, chloe, chloe)
    api.addGuess(bruno, chloe, alice)

    const { body } = await debrief()
    expect(body.me.rank).toBe(1)
    expect(body.tiedWith).toEqual([])
  })

  it('names the others on my rank, and only them', async () => {
    const api = await useTestApi()
    // Alice and Bruno on one each, Chloé on none.
    api.addGuess(alice, bruno, bruno)
    api.addGuess(bruno, chloe, chloe)

    const { body } = await debrief()
    expect(body.me.rank).toBe(1)
    expect(body.tiedWith).toEqual(['Bruno'])
  })

  it('puts a player who answered nothing last, without inventing a score', async () => {
    const api = await useTestApi()
    api.addGuess(bruno, chloe, chloe)

    const { body } = await debrief()
    expect(body.me.score).toBe(0)
    expect(body.me.rank).toBeGreaterThan(1)
  })
})

describe('the room cards', () => {
  it('leaves a blank room blank rather than calling it wrong', async () => {
    const api = await useTestApi()
    api.addGuess(alice, bruno, bruno)

    const { body } = await debrief()
    const cards = body.rooms as { ownerName: string, guessName: string | null, correct: boolean }[]

    const answered = cards.find(card => card.ownerName === 'Bruno')!
    expect(answered).toMatchObject({ guessName: 'Bruno', correct: true })

    // Two rooms were never answered. `correct: false` on a card that says
    // nothing would read as "you were wrong", which is a different claim.
    const blanks = cards.filter(card => card.guessName === null)
    expect(blanks).toHaveLength(2)
    expect(blanks.every(card => card.correct === false)).toBe(true)
  })

  it('names the answer I gave when it was the wrong one', async () => {
    const api = await useTestApi()
    api.addGuess(alice, bruno, david)

    const { body } = await debrief()
    const card = body.rooms.find((room: { ownerName: string }) => room.ownerName === 'Bruno')

    expect(card).toMatchObject({ guessName: 'David', correct: false })
  })

  it('never includes my own room', async () => {
    const api = await useTestApi()
    api.addPhoto(alice)

    const { body } = await debrief()
    expect(body.rooms.map((room: { ownerName: string }) => room.ownerName)).not.toContain('Alice')
    expect(body.me.total).toBe(3)
  })

  it('deals them in my deck order, which is mine and not the database\'s', async () => {
    const { body } = await debrief()
    const mine = body.rooms.map((room: { ownerName: string }) => room.ownerName)

    // Same set as the sheet, and the sheet's own order — the guess sheet is
    // the one place that order is minted, so the debrief reads in the order
    // the reader answered rather than by user id.
    const api = await useTestApi()
    api.setPhase('open')
    const sheet = await (await api.fetch('/api/guess', { cookie })).json()
    api.setPhase('revealed')

    const owners = sheet.rooms.map((room: { photos: string[] }) => room.photos[0])
    const debriefPhotos = body.rooms.map((room: { photos: string[] }) => room.photos[0])

    expect(debriefPhotos).toEqual(owners)
    expect([...mine].sort()).toEqual(['Bruno', 'Chloé', 'David'])
  })
})
