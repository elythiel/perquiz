import type { GamePhase } from '#shared/types/game'
import type { LocationQuery, RouteLocationNormalized } from 'vue-router'
import { isGamePhase } from '#shared/utils/game'

/**
 * The game's current phase.
 *
 * Read from `app_state` on the server and carried in the payload, so the very
 * first render already knows whether the game is open. In development only,
 * `?phase=preparation` (or `open`, `locked`, `revealed`) still overrides it —
 * the admin panel flips it for real, and the query is how a screen is looked
 * at in another phase without moving the whole game to get there.
 */
export function useGamePhase() {
  const route = useRoute()
  const server = useState<GamePhase>('game:phase', () => 'open')

  const phase = computed<GamePhase>(() => devOverride(route.query) ?? server.value)

  return { phase }
}

/**
 * The phase as it will be on the route being navigated *to*.
 *
 * A route middleware runs before `useRoute()` has moved, so it cannot use the
 * composable above without reading the query of the page it is leaving — and
 * `/guess?phase=locked` would then be judged on the dashboard's query.
 */
export function gamePhaseOn(route: RouteLocationNormalized): GamePhase {
  return devOverride(route.query) ?? useState<GamePhase>('game:phase', () => 'open').value
}

function devOverride(query: LocationQuery): GamePhase | undefined {
  const value = import.meta.dev ? query.phase : undefined
  return isGamePhase(value) ? value : undefined
}
