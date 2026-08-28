import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { roomToken } from '../../server/utils/guessing'
import { useTestApi } from '../support/api'

/**
 * The second invariant of SPEC §9: the room → owner mapping never leaves the
 * server before `revealed`, except through the reveal show.
 *
 * It is the one secret the whole game rests on, and the obvious implementation
 * gives it away — a room keyed by its owner's id, next to a list of
 * participants carrying those same ids, is an answer key in devtools. So what
 * these tests check is not "does the endpoint work" but "what exactly came out
 * of it": the shape of every room object, and the fact that no id, no order and
 * no filename in a payload can be lined up with a name.
 */

interface Sheet {
  phase: string
  rooms: { token: string, photos: string[], guess: number | null }[]
  participants: { id: number, displayName: string }[]
  answered: number
  total: number
}

const CAST = ['Alice', 'Bruno', 'Chloé', 'Dimitri', 'Elena', 'Farid'] as const

let ids: Record<string, number>
let cookies: Record<string, string>

beforeEach(async () => {
  const api = await useTestApi()
  api.reset()

  ids = {}
  cookies = {}
  for (const name of CAST) {
    ids[name] = api.createUser(name)
    cookies[name] = await api.signIn(ids[name]!)
    // Everyone but Farid has a room in play, so "a participant without a room"
    // is part of every scenario below rather than a case nobody tried.
    if (name !== 'Farid') {
      api.addPhoto(ids[name]!)
      api.addPhoto(ids[name]!)
    }
  }
})

async function sheetFor(name: string): Promise<Sheet> {
  const api = await useTestApi()
  const response = await api.fetch('/api/guess', { cookie: cookies[name]! })
  expect(response.status).toBe(200)
  return response.json() as Promise<Sheet>
}

/** The owner a handle stands for — knowable here, because the test holds the key. */
async function ownerOf(token: string, viewer: string): Promise<number | undefined> {
  const api = await useTestApi()
  return Object.values(ids).find(id => roomToken(ids[viewer]!, id, api.sessionPassword) === token)
}

/** Every leaf of a payload, so an id can be looked for as a value. */
function scalars(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(scalars)
  if (value && typeof value === 'object') return Object.values(value).flatMap(scalars)
  return [value]
}

describe('the guess sheet', () => {
  it('describes a room with a handle, its photographs, and my own answer — nothing else', async () => {
    const sheet = await sheetFor('Alice')

    expect(sheet.rooms).not.toHaveLength(0)
    for (const room of sheet.rooms) {
      // The shape *is* the guarantee: there is no field an owner could hide in.
      expect(Object.keys(room).sort()).toEqual(['guess', 'photos', 'token'])
      expect(room.token).toMatch(/^[0-9a-f]{32}$/)
    }
  })

  it('never offers me my own room', async () => {
    const sheet = await sheetFor('Alice')
    const owners = await Promise.all(sheet.rooms.map(room => ownerOf(room.token, 'Alice')))

    expect(owners).not.toContain(ids.Alice)
    expect(sheet.rooms).toHaveLength(4)
  })

  it('leaves a participant with no photographs out of the deck, but on the list', async () => {
    const sheet = await sheetFor('Alice')
    const owners = await Promise.all(sheet.rooms.map(room => ownerOf(room.token, 'Alice')))

    expect(owners).not.toContain(ids.Farid)
    expect(sheet.participants.map(person => person.displayName)).toContain('Farid')
  })

  it('carries no participant id inside a room, only in the suspect list', async () => {
    const sheet = await sheetFor('Alice')
    const everyone = new Set<unknown>(Object.values(ids))

    for (const room of sheet.rooms) {
      // Values, not a substring search of the JSON: a 32-hex photo name
      // contains "24" often enough that grepping for ids would pass or fail by
      // luck. `guess` is left out — the reader's own answer is theirs to know.
      const { guess: _mine, ...rest } = room
      expect(scalars(rest).filter(value => everyone.has(value))).toEqual([])
    }
  })

  it('gives two players different handles for the same room', async () => {
    const alice = await sheetFor('Alice')
    const bruno = await sheetFor('Bruno')

    // Chloé's room is on both sheets; comparing screens must tell them nothing.
    const shared = await Promise.all(alice.rooms.map(room => ownerOf(room.token, 'Alice')))
    const chloesRoomForAlice = alice.rooms[shared.indexOf(ids.Chloé!)]!

    const brunoOwners = await Promise.all(bruno.rooms.map(room => ownerOf(room.token, 'Bruno')))
    const chloesRoomForBruno = bruno.rooms[brunoOwners.indexOf(ids.Chloé!)]!

    expect(chloesRoomForAlice.photos).toEqual(chloesRoomForBruno.photos)
    expect(chloesRoomForAlice.token).not.toBe(chloesRoomForBruno.token)
  })

  it('deals the deck in an order that is not the participant order', async () => {
    const sheet = await sheetFor('Alice')
    const owners = await Promise.all(sheet.rooms.map(room => ownerOf(room.token, 'Alice')))

    // Database order would line position in the deck up with position in the
    // suspect list, which is the mapping written a second way.
    expect(owners).not.toEqual([...owners].sort((left, right) => left! - right!))
  })

  it('counts only the rooms in play', async () => {
    const api = await useTestApi()
    api.addGuess(ids.Alice!, ids.Bruno!, ids.Chloé!)

    const sheet = await sheetFor('Alice')
    expect(sheet).toMatchObject({ answered: 1, total: 4 })
  })
})

describe('answering', () => {
  async function patch(name: string, body: unknown) {
    const api = await useTestApi()
    return api.fetch('/api/guess', {
      method: 'PATCH',
      cookie: cookies[name]!,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('accepts a handle from my own sheet, and answers with a count only', async () => {
    const sheet = await sheetFor('Alice')
    const response = await patch('Alice', { room: sheet.rooms[0]!.token, participant: ids.Bruno })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ answered: 1, total: 4 })
  })

  it('refuses a handle minted for somebody else', async () => {
    const bruno = await sheetFor('Bruno')

    // Bruno's handle for Chloé's room, replayed by Alice. The rooms exist, both
    // players may answer them, and it still resolves to nothing: the viewer is
    // part of what the handle is made of.
    const response = await patch('Alice', { room: bruno.rooms[0]!.token, participant: ids.Chloé })

    expect(response.status).toBe(404)
  })

  it('refuses a raw user id where a handle belongs', async () => {
    const response = await patch('Alice', { room: String(ids.Bruno), participant: ids.Chloé })
    expect(response.status).toBe(404)
  })

  it.each([
    ['naming myself', () => ({ participant: ids.Alice }), 422],
    ['naming nobody', () => ({ participant: 9999 }), 422],
    ['naming a string', () => ({ participant: 'Bruno' }), 400],
    ['naming a fraction', () => ({ participant: 1.5 }), 400],
  ])('refuses %s', async (_label, body, status) => {
    const sheet = await sheetFor('Alice')
    const response = await patch('Alice', { room: sheet.rooms[0]!.token, ...body() })
    expect(response.status).toBe(status)
  })

  it('is closed once the game is locked', async () => {
    const api = await useTestApi()
    const sheet = await sheetFor('Alice')

    api.setPhase('locked')
    const response = await patch('Alice', { room: sheet.rooms[0]!.token, participant: ids.Bruno })

    expect(response.status).toBe(409)
  })
})

describe('the phases that hold the answers back', () => {
  it('refuses the results until the game is revealed', async () => {
    const api = await useTestApi()

    for (const phase of ['open', 'locked'] as const) {
      api.setPhase(phase)
      expect((await api.fetch('/api/results', { cookie: cookies.Alice! })).status).toBe(409)
    }

    api.setPhase('revealed')
    expect((await api.fetch('/api/results', { cookie: cookies.Alice! })).status).toBe(200)
  })

  it('names the owners once revealed — that is the point of the debrief', async () => {
    const api = await useTestApi()
    api.addGuess(ids.Alice!, ids.Bruno!, ids.Bruno!)
    api.setPhase('revealed')

    const results = await (await api.fetch('/api/results', { cookie: cookies.Alice! })).json()
    expect(results.rooms.map((room: { ownerName: string }) => room.ownerName).sort())
      .toEqual(['Bruno', 'Chloé', 'Dimitri', 'Elena'])
    expect(results.rooms.find((room: { ownerName: string }) => room.ownerName === 'Bruno'))
      .toMatchObject({ guessName: 'Bruno', correct: true })
  })

  it('refuses the show while the game is still open, even to an admin', async () => {
    const api = await useTestApi()
    const admin = await api.signIn(api.createUser('Régie', { isAdmin: true }))

    api.setPhase('open')
    expect((await api.fetch('/api/reveal', { cookie: admin })).status).toBe(409)

    api.setPhase('locked')
    expect((await api.fetch('/api/reveal', { cookie: admin })).status).toBe(200)
  })
})

describe('the dashboard', () => {
  it('shows me my own photographs and counts for everything else', async () => {
    const api = await useTestApi()
    const response = await api.fetch('/api/dashboard', { cookie: cookies.Alice! })
    const state = await response.json()

    const mine = api.db.all<{ filename: string }>(
      sql`select filename from photos where user_id = ${ids.Alice}`,
    )

    expect(state.myPhotos).toHaveLength(2)
    expect(Object.keys(state).sort()).toEqual([
      'answered', 'myPhotos', 'newRooms', 'participants', 'phase', 'roomsInPlay', 'total',
    ])

    // Every other photograph in the game is absent: the dashboard talks about
    // rooms in numbers, and a filename is a thing you can then go and look at.
    const others = api.db.all<{ filename: string }>(
      sql`select filename from photos where user_id <> ${ids.Alice}`,
    )
    const payload = JSON.stringify(state)
    for (const row of others) expect(payload).not.toContain(row.filename)
    for (const row of mine) expect(payload).toContain(row.filename)
  })
})

describe('the admin panel, whose admin also plays', () => {
  it('names participants without saying which rooms they answered', async () => {
    const api = await useTestApi()
    const admin = await api.signIn(api.createUser('Régie', { isAdmin: true }))
    api.addGuess(ids.Alice!, ids.Bruno!, ids.Chloé!)

    const panel = await (await api.fetch('/api/admin', { cookie: admin })).json()
    const alice = panel.participants.find((row: { displayName: string }) => row.displayName === 'Alice')

    expect(Object.keys(alice).sort()).toEqual([
      'answered', 'displayName', 'id', 'lastActivity', 'photos', 'ready', 'total',
    ])
    expect(alice).toMatchObject({ answered: 1, total: 4 })
  })

  it('hands the moderation grid over with no owner attached', async () => {
    const api = await useTestApi()
    const admin = await api.signIn(api.createUser('Régie', { isAdmin: true }))

    const panel = await (await api.fetch('/api/admin', { cookie: admin })).json()
    expect(panel.moderation).toHaveLength(10)
    for (const name of panel.moderation) expect(name).toMatch(/^[0-9a-f]{32}$/)
  })

  it('orders that grid the same way whatever order the photographs arrived in', async () => {
    const api = await useTestApi()
    const names = ['a'.repeat(32), 'b'.repeat(32), 'c'.repeat(32), 'd'.repeat(32)]

    /** Two owners, four fixed names, dealt in a given order. */
    async function gridAfter(order: [number, number, number, number]) {
      api.reset()
      const left = api.createUser('Gauche')
      const right = api.createUser('Droite')
      const owners = [left, right]
      for (const index of order) {
        api.addPhoto(owners[index % 2]!, { name: names[index]! })
      }
      const cookie = await api.signIn(api.createUser('Régie', { isAdmin: true }))
      const panel = await (await api.fetch('/api/admin', { cookie })).json()
      return panel.moderation
    }

    // Insertion order is what groups a room's photographs together, and next
    // to a list of per-person counts that is most of the answer key. The order
    // has to come from the names alone — which also means the grid does not
    // reshuffle under the moderator's finger between two visits.
    expect(await gridAfter([0, 1, 2, 3])).toEqual(await gridAfter([3, 2, 1, 0]))
  })

  it('says what a removal would destroy without saying whose room it touches', async () => {
    const api = await useTestApi()
    const admin = await api.signIn(api.createUser('Régie', { isAdmin: true }))
    api.addGuess(ids.Alice!, ids.Bruno!, ids.Chloé!)

    const preview = await (await api.fetch(`/api/admin/participants/${ids.Chloé}`, { cookie: admin })).json()
    expect(Object.keys(preview).sort())
      .toEqual(['displayName', 'guessesLost', 'guessesMade', 'photos'])
    // A count, not the names — those would be the photographs of a named room.
    expect(preview.photos).toBe(2)
    expect(preview.guessesLost).toBe(1)
  })
})
