import { describe, expect, it } from 'vitest'
import { podium, standings } from '../../server/utils/scoring'

/**
 * The leaderboard — the one number in this game people will argue about.
 *
 * SPEC §5 is two sentences: the score is the count of correct guesses, and
 * ties share a rank with the next place skipped. Both are easy to get subtly
 * wrong, and both are read on two screens (the reveal podium and the results
 * page), so they live in one tested function rather than in each of them.
 */

const PLAYERS = [
  { id: 1, displayName: 'Camille' },
  { id: 2, displayName: 'Léna' },
  { id: 3, displayName: 'Théo' },
  { id: 4, displayName: 'Zoé' },
]

const IN_PLAY = new Set([1, 2, 3, 4])

/** `guesser answered room with guessed`. */
const guess = (guesser: number, room: number, guessed: number) =>
  ({ guesserId: guesser, roomUserId: room, guessedUserId: guessed })

describe('what counts as a point', () => {
  it('is a guess that names the room’s owner', () => {
    const table = standings(PLAYERS, [guess(1, 2, 2)], IN_PLAY)
    expect(table.find(player => player.id === 1)?.score).toBe(1)
  })

  it('is not a guess that names somebody else', () => {
    const table = standings(PLAYERS, [guess(1, 2, 3)], IN_PLAY)
    expect(table.find(player => player.id === 1)?.score).toBe(0)
  })

  // A room that left the game takes its answers with it; awarding points for
  // it would score a room nobody can be shown.
  it('is not a right answer about a room that has left play', () => {
    const table = standings(PLAYERS, [guess(1, 2, 2)], new Set([1, 3, 4]))
    expect(table.find(player => player.id === 1)?.score).toBe(0)
  })

  it('gives everyone a score, including those who never answered', () => {
    expect(standings(PLAYERS, [], IN_PLAY).map(player => player.score)).toEqual([0, 0, 0, 0])
  })
})

describe('ranking, when scores are equal', () => {
  const table = (scores: Record<number, number>) => standings(
    PLAYERS,
    Object.entries(scores).flatMap(([id, score]) =>
      // `score` right answers, taken from rooms that are not the guesser's own.
      [1, 2, 3, 4].filter(room => room !== Number(id)).slice(0, score).map(room => guess(Number(id), room, room))),
    IN_PLAY,
  )

  it('shares the rank and skips the next place (SPEC §5)', () => {
    // 3, 3, 2, 1 -> ranks 1, 1, 3, 4
    const ranks = table({ 1: 3, 2: 3, 3: 2, 4: 1 })
    expect(ranks.map(player => [player.score, player.rank])).toEqual([[3, 1], [3, 1], [2, 3], [1, 4]])
  })

  it('orders equals by name, not by id', () => {
    const ranks = table({ 3: 2, 1: 2 })
    expect(ranks.slice(0, 2).map(player => player.displayName)).toEqual(['Camille', 'Théo'])
  })

  it('puts everybody first when nobody scored', () => {
    expect(standings(PLAYERS, [], IN_PLAY).map(player => player.rank)).toEqual([1, 1, 1, 1])
  })
})

describe('the podium the show climbs', () => {
  const build = (scores: number[]) => scores.map((score, index) => ({
    id: index + 1,
    displayName: PLAYERS[index]!.displayName,
    score,
    rank: 1 + scores.filter(other => other > score).length,
  }))

  it('climbs third, then second, then first', () => {
    expect(podium(build([3, 2, 1, 0])).map(step => step.rank)).toEqual([3, 2, 1])
  })

  it('shows a tie as one step, both names together', () => {
    const steps = podium(build([3, 2, 2, 1]))
    expect(steps.map(step => step.rank)).toEqual([2, 1])
    expect(steps[0]!.players.map(player => player.displayName)).toEqual(['Léna', 'Théo'])
  })

  // Two seconds leave no third at all: the podium has two steps rather than
  // inventing one out of the fourth player.
  it('skips a step nobody stands on', () => {
    expect(podium(build([3, 2, 2, 1])).some(step => step.rank === 3)).toBe(false)
  })

  it('leaves the rest to the full ranking', () => {
    const steps = podium(build([4, 3, 2, 1]))
    expect(steps.flatMap(step => step.players).map(player => player.rank)).toEqual([3, 2, 1])
  })

  it('is one single step when everybody is first', () => {
    const steps = podium(build([0, 0, 0, 0]))
    expect(steps).toHaveLength(1)
    expect(steps[0]!.players).toHaveLength(4)
  })
})
