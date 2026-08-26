import type { GamePhase } from '../types/game'

/** The three phases, in the order the admin panel walks them. */
export const GAME_PHASES: readonly GamePhase[] = ['open', 'locked', 'revealed']

/**
 * Shared because three places need it: the query override in development, the
 * admin panel validating what it was asked to switch to, and the schema's own
 * enum. A fourth copy would be the one that forgets a phase.
 */
export function isGamePhase(value: unknown): value is GamePhase {
  return typeof value === 'string' && GAME_PHASES.includes(value as GamePhase)
}
