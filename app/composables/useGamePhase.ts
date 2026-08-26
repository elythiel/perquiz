import type { GamePhase } from '#shared/types/game'

const PHASES: GamePhase[] = ['open', 'locked', 'revealed']

function isGamePhase(value: unknown): value is GamePhase {
  return PHASES.includes(value as GamePhase)
}

/**
 * Phase courante de la partie.
 *
 * PLACEHOLDER M0 : la phase vaut toujours `open`. En développement seulement,
 * `?phase=locked` (ou `revealed`) permet de voir les trois états de la
 * coquille. M6 (régie) branchera la vraie valeur d'`app_state`.
 */
export function useGamePhase() {
  const route = useRoute()

  const phase = computed<GamePhase>(() => {
    const override = import.meta.dev ? route.query.phase : undefined
    return isGamePhase(override) ? override : 'open'
  })

  return { phase }
}
