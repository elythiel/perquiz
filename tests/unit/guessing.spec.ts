import { describe, expect, it } from 'vitest'
import { deckOrder, resolveRoomToken, roomToken } from '../../server/utils/guessing'

/**
 * The guard on the one secret this game has: which room belongs to whom.
 *
 * The sheet has to name every room and every participant in the same payload,
 * which is exactly the shape of an accidental answer key. These tests are what
 * keeps the two apart — a handle that cannot be compared, cannot be guessed,
 * cannot be borrowed from another player, and does not betray its room by its
 * position in the list.
 */

const SECRET = '0123456789abcdef0123456789abcdef'
const OTHER_SECRET = 'fedcba9876543210fedcba9876543210'
const ROOMS = [3, 7, 11, 19, 23, 42]

describe('the handle standing in for a room', () => {
  it('is the same every time, so a reload does not reshuffle the deck', () => {
    expect(roomToken(1, 7, SECRET)).toBe(roomToken(1, 7, SECRET))
  })

  it('differs per room', () => {
    const tokens = ROOMS.map(room => roomToken(1, room, SECRET))
    expect(new Set(tokens).size).toBe(ROOMS.length)
  })

  // Two players comparing screens must not be able to pool what they know.
  it('differs per viewer for the very same room', () => {
    expect(roomToken(1, 7, SECRET)).not.toBe(roomToken(2, 7, SECRET))
  })

  it('is a fixed-width digest whatever the id behind it', () => {
    for (const room of [1, 7, 999_999]) {
      expect(roomToken(1, room, SECRET)).toMatch(/^[0-9a-f]{32}$/)
    }
  })

  // Adjacent ids must not produce adjacent handles, or sorting by handle would
  // quietly reproduce sorting by id — the mapping again, one step removed.
  it('scatters neighbouring ids', () => {
    const neighbours = [10, 11, 12].map(room => roomToken(1, room, SECRET))
    for (const [left, right] of [[0, 1], [1, 2], [0, 2]] as const) {
      expect(neighbours[left]![0]).not.toBe(undefined)
      expect(neighbours[left]!.slice(0, 4)).not.toBe(neighbours[right]!.slice(0, 4))
    }
  })

  it('changes with the server secret', () => {
    expect(roomToken(1, 7, SECRET)).not.toBe(roomToken(1, 7, OTHER_SECRET))
  })
})

describe('reading a handle back', () => {
  it('finds the room it was minted for', () => {
    expect(resolveRoomToken(roomToken(4, 19, SECRET), 4, ROOMS, SECRET)).toBe(19)
  })

  // The heart of it: a handle is worthless in anyone else's hands.
  it('refuses a handle minted for another player', () => {
    expect(resolveRoomToken(roomToken(4, 19, SECRET), 5, ROOMS, SECRET)).toBeUndefined()
  })

  it('refuses a room that has left play', () => {
    const token = roomToken(4, 19, SECRET)
    expect(resolveRoomToken(token, 4, ROOMS.filter(room => room !== 19), SECRET)).toBeUndefined()
  })

  it.each([
    ['a tampered handle', `${roomToken(4, 19, SECRET).slice(0, 31)}0`],
    ['an empty string', ''],
    ['a plain room id', '19'],
    ['a number', 19],
    ['null', null],
    ['undefined', undefined],
    ['an object', { token: 'x' }],
  ])('refuses %s', (_label, token) => {
    expect(resolveRoomToken(token, 4, ROOMS, SECRET)).toBeUndefined()
  })

  it('never resolves against an empty candidate list', () => {
    expect(resolveRoomToken(roomToken(4, 19, SECRET), 4, [], SECRET)).toBeUndefined()
  })
})

describe('the order the deck is dealt in', () => {
  it('holds exactly the rooms it was given', () => {
    expect([...deckOrder(ROOMS, 1, SECRET)].sort((a, b) => a - b)).toEqual([...ROOMS].sort((a, b) => a - b))
  })

  it('is stable for one viewer', () => {
    expect(deckOrder(ROOMS, 1, SECRET)).toEqual(deckOrder(ROOMS, 1, SECRET))
  })

  // Otherwise position in the deck would line up with position in the
  // participant list, which is the mapping written a second way.
  it('is not the natural id order', () => {
    const natural = [...ROOMS].sort((a, b) => a - b)
    const shuffledForSomeone = [1, 2, 3, 4, 5].map(viewer => deckOrder(ROOMS, viewer, SECRET))
    expect(shuffledForSomeone.some(order => order.join() !== natural.join())).toBe(true)
  })

  it('differs between viewers', () => {
    const orders = [1, 2, 3, 4, 5].map(viewer => deckOrder(ROOMS, viewer, SECRET).join())
    expect(new Set(orders).size).toBeGreaterThan(1)
  })

  it('does not mutate what it was given', () => {
    const input = [...ROOMS]
    deckOrder(input, 1, SECRET)
    expect(input).toEqual(ROOMS)
  })
})
