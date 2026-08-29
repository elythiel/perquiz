/**
 * Turning answers into a leaderboard.
 *
 * Pure on purpose: it is the one piece of this game whose correctness is worth
 * arguing about, and an argument is easier to settle with a test than with a
 * database. The reveal show needs it for its podium (M7) and the results page
 * will need exactly the same numbers (M8) — one implementation, or two that
 * eventually disagree.
 */

export interface ScoredGuess {
  guesserId: number
  roomUserId: number
  guessedUserId: number
}

export interface Standing {
  id: number
  displayName: string
  /** Correct guesses, and nothing else — no speed bonus (SPEC §5). */
  score: number
  /** Standard competition ranking: 1, 2, 2, 4… */
  rank: number
}

export interface Player {
  id: number
  displayName: string
}

/**
 * Everyone, best first, with ties sharing a rank and the next place skipped.
 *
 * Only answers about rooms still in play count. A room that left the game
 * takes its answers with it, so counting them would award points for a room
 * nobody can be shown.
 *
 * Equal scores are ordered by name, so two people on the same rank appear in
 * a stable, human order rather than by database id.
 */
export function standings(
  players: readonly Player[],
  guesses: readonly ScoredGuess[],
  roomsInPlay: ReadonlySet<number>,
): Standing[] {
  const correct = new Map<number, number>()
  for (const guess of guesses) {
    if (!roomsInPlay.has(guess.roomUserId)) continue
    if (guess.guessedUserId !== guess.roomUserId) continue
    correct.set(guess.guesserId, (correct.get(guess.guesserId) ?? 0) + 1)
  }

  const scored = players
    .map(player => ({ ...player, score: correct.get(player.id) ?? 0 }))
    .sort((left, right) =>
      right.score - left.score || left.displayName.localeCompare(right.displayName, 'fr'))

  return scored.map(player => ({
    ...player,
    rank: 1 + scored.filter(other => other.score > player.score).length,
  }))
}

export interface PodiumStep {
  rank: number
  /** Everyone on that rank — a tie is one step, shown together (SPEC §5). */
  players: Standing[]
}

/**
 * The three steps the show climbs, in suspense order: third, second, first.
 *
 * Ranks, not places: a tie for second leaves no third at all, and the podium
 * then has two steps rather than inventing one. Ranks below the first three
 * are the full standings' business, not the podium's.
 */
export function podium(all: readonly Standing[]): PodiumStep[] {
  const steps: PodiumStep[] = []
  for (const rank of [3, 2, 1]) {
    const players = all.filter(player => player.rank === rank)
    if (players.length > 0) steps.push({ rank, players })
  }
  return steps
}
