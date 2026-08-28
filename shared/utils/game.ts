import type { GamePhase } from '../types/game'

/** The four phases, in the order the admin panel walks them. */
export const GAME_PHASES: readonly GamePhase[] = ['preparation', 'open', 'locked', 'revealed']

/**
 * Shared because three places need it: the query override in development, the
 * admin panel validating what it was asked to switch to, and the schema's own
 * enum. A fourth copy would be the one that forgets a phase.
 */
export function isGamePhase(value: unknown): value is GamePhase {
  return typeof value === 'string' && GAME_PHASES.includes(value as GamePhase)
}

/**
 * Nothing is frozen yet: the rooms are still being built and `locked_at` has
 * no reason to exist.
 *
 * Two phases answer yes, for two different reasons — `preparation` because the
 * game has not started, `open` because photos and answers are deliberately
 * concurrent (SPEC §2) — and four places ask: the room guard, `setPhase()`,
 * the reveal guard, and the read-only screens. Written once so that the day a
 * fifth phase appears, they cannot disagree about it.
 */
export function isBeforeLock(phase: GamePhase): boolean {
  return phase === 'preparation' || phase === 'open'
}
