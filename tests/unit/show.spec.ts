import { describe, expect, it } from 'vitest'
import { clampCursor, ordinal, sceneAt, totalScenes } from '../../shared/utils/show'

/**
 * The reveal show's position, which lives entirely in the URL.
 *
 * "Survives a refresh mid-session" is the milestone's acceptance criterion, and
 * it reduces to this: one integer means the same slide every time, whoever
 * asks. Worth testing rather than trusting, because the arithmetic shifts the
 * day the podium has two steps instead of three.
 */

const SHOW = { rooms: 3, podiumSteps: 3 }

describe('walking the show', () => {
  it('spends three steps on each room, in order', () => {
    expect([0, 1, 2, 3, 4, 5].map(cursor => sceneAt(cursor, SHOW))).toEqual([
      { kind: 'room', room: 0, step: 1 },
      { kind: 'room', room: 0, step: 2 },
      { kind: 'room', room: 0, step: 3 },
      { kind: 'room', room: 1, step: 1 },
      { kind: 'room', room: 1, step: 2 },
      { kind: 'room', room: 1, step: 3 },
    ])
  })

  it('climbs the podium once the rooms are done', () => {
    expect([9, 10, 11].map(cursor => sceneAt(cursor, SHOW))).toEqual([
      { kind: 'podium', step: 0 },
      { kind: 'podium', step: 1 },
      { kind: 'podium', step: 2 },
    ])
  })

  it('ends on the full ranking', () => {
    expect(sceneAt(12, SHOW)).toEqual({ kind: 'standings' })
    expect(totalScenes(SHOW)).toBe(13)
  })

  // A tie for second leaves nobody on third, so the podium is shorter and
  // every slide after it moves. The URL has to keep meaning the same thing.
  it('shifts correctly when the podium has fewer steps', () => {
    const shorter = { rooms: 3, podiumSteps: 2 }
    expect(totalScenes(shorter)).toBe(12)
    expect(sceneAt(9, shorter)).toEqual({ kind: 'podium', step: 0 })
    expect(sceneAt(11, shorter)).toEqual({ kind: 'standings' })
  })

  it('handles a game with no room in play at all', () => {
    const empty = { rooms: 0, podiumSteps: 1 }
    expect(totalScenes(empty)).toBe(2)
    expect(sceneAt(0, empty)).toEqual({ kind: 'podium', step: 0 })
    expect(sceneAt(1, empty)).toEqual({ kind: 'standings' })
  })
})

describe('a cursor that makes no sense', () => {
  // Mid-show, a mistyped URL must put the presenter back on a slide rather
  // than on an error page in front of an audience.
  it.each([
    [-1, 0],
    [-999, 0],
    [12, 12],
    [999, 12],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [2.7, 2],
  ])('%o lands on %o', (cursor, expected) => {
    expect(clampCursor(cursor, SHOW)).toBe(expected)
  })
})

describe('French ordinals', () => {
  it.each([[1, '1re'], [2, '2e'], [3, '3e'], [11, '11e']])('%i -> %s', (rank, expected) => {
    expect(ordinal(rank)).toBe(expected)
  })
})
