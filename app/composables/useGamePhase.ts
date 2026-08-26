import type { GamePhase } from '#shared/types/game'

const PHASES: GamePhase[] = ['open', 'locked', 'revealed']

function isGamePhase(value: unknown): value is GamePhase {
  return PHASES.includes(value as GamePhase)
}

/**
 * The game's current phase.
 *
 * M0 PLACEHOLDER: the phase is always `open`. In development only,
 * `?phase=locked` (or `revealed`) shows the shell's three states. M6 (the admin
 * panel) will wire the real value from `app_state`.
 */
export function useGamePhase() {
  const route = useRoute()

  const phase = computed<GamePhase>(() => {
    const override = import.meta.dev ? route.query.phase : undefined
    return isGamePhase(override) ? override : 'open'
  })

  return { phase }
}
