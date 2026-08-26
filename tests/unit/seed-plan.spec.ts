import { describe, expect, it } from 'vitest'
import { buildSeedPlan, PEOPLE } from '../../scripts/seed-plan'

/**
 * The seed's acceptance criterion is "enough to exercise every later screen
 * without real players" — a claim about the shape of the data. These tests are
 * that claim, written down: each one names the screen it keeps testable.
 *
 * They also guard the rules the database enforces (SPEC §4), so a broken plan
 * fails here in milliseconds instead of failing at the first INSERT.
 */

const plan = buildSeedPlan()

const sheetOf = (guesser: number) => plan.guesses.filter(guess => guess.guesser === guesser)

describe('the game the seed builds', () => {
  it('gives every player the score they were meant to have', () => {
    expect(plan.scores).toEqual(PEOPLE.map(person => person.score))
  })

  // SPEC §5: ties share a rank, the next one skips. Podium 7/6/5 is clean,
  // the ties sit below it.
  it('ranks with shared places and gaps (M7 podium, M8 leaderboard)', () => {
    expect(plan.ranks).toEqual([4, 6, 2, 3, 4, 1, 8, 7, 8, 10])
  })

  it('leaves one room out of play (M3 empty state, M5 warning)', () => {
    const empty = PEOPLE.filter(person => person.photos === 0)
    expect(empty).toHaveLength(1)
    expect(plan.roomsInPlay).toHaveLength(PEOPLE.length - 1)
  })

  it('still lets the roomless player guess, on one room more than anyone else', () => {
    const roomless = PEOPLE.findIndex(person => person.photos === 0)
    const possible = plan.roomsInPlay.filter(room => room !== roomless)
    expect(possible).toHaveLength(plan.roomsInPlay.length)
  })
})

describe('the guess sheets', () => {
  it('holds a full one and an empty one (M6 participation, M4 progress)', () => {
    const sizes = PEOPLE.map((_, index) => sheetOf(index).length)
    expect(Math.min(...sizes)).toBe(0)
    expect(sizes).toContain(plan.roomsInPlay.length - 1)
  })

  it('leaves rooms unanswered, so the reveal shows « sans réponse » (M7)', () => {
    const answersPerRoom = plan.roomsInPlay.map(room =>
      plan.guesses.filter(guess => guess.room === room).length)
    const guessersPerRoom = PEOPLE.length - 1
    expect(Math.min(...answersPerRoom)).toBeLessThan(guessersPerRoom)
  })

  it('spreads the votes, so the reveal has a chart to draw (M7)', () => {
    const namesPerRoom = plan.roomsInPlay.map(room =>
      new Set(plan.guesses.filter(guess => guess.room === room).map(guess => guess.guessed)).size)
    // Two bars — the owner and one wrong suspect — would not be a distribution.
    expect(Math.max(...namesPerRoom)).toBeGreaterThanOrEqual(3)
  })

  it('names the same suspect twice on one sheet (M4 duplicate warning)', () => {
    const hasDuplicate = PEOPLE.some((_, index) => {
      const named = sheetOf(index).map(guess => guess.guessed)
      return new Set(named).size < named.length
    })
    expect(hasDuplicate).toBe(true)
  })
})

describe('the rules the database will not let us break', () => {
  it('never puts a guesser on their own room', () => {
    expect(plan.guesses.filter(guess => guess.guesser === guess.room)).toEqual([])
  })

  it('never lets anyone name themselves', () => {
    expect(plan.guesses.filter(guess => guess.guessed === guess.guesser)).toEqual([])
  })

  it('never asks about a room that is not in play', () => {
    const outOfPlay = plan.guesses.filter(guess => !plan.roomsInPlay.includes(guess.room))
    expect(outOfPlay).toEqual([])
  })

  it('answers each room at most once per guesser', () => {
    const keys = plan.guesses.map(guess => `${guess.guesser}:${guess.room}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('reproducibility', () => {
  it('builds the same game twice', () => {
    expect(buildSeedPlan()).toEqual(buildSeedPlan())
  })
})
