import type { GamePhase } from '#shared/types/game'
import { isGamePhase } from '#shared/utils/game'

/**
 * The game's current phase.
 *
 * Read from `app_state` on the server and carried in the payload, so the very
 * first render already knows whether the game is open. In development only,
 * `?phase=locked` (or `revealed`) still overrides it — the admin panel that
 * flips it for real is M6, and until then that query is the only way to see
 * the other two states.
 */
export function useGamePhase() {
  const route = useRoute()
  const server = useState<GamePhase>('game:phase', () => 'open')

  const phase = computed<GamePhase>(() => {
    const override = import.meta.dev ? route.query.phase : undefined
    return isGamePhase(override) ? override : server.value
  })

  return { phase }
}
