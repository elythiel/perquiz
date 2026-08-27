import type { GamePhase } from '#shared/types/game'
import type { SignedInUser } from '../utils/provisioning'

declare module 'h3' {
  interface H3EventContext {
    /** The signed-in user, resolved once per request by this middleware. */
    user?: SignedInUser
    /** The game's phase, read once here so no handler has to fetch it again. */
    phase?: GamePhase
  }
}

/**
 * No anonymous access (SPEC §1).
 *
 * A single gate in front of everything, rather than a check remembered on each
 * new route — the invariant is "every page and API route requires a session",
 * and an invariant enforced route by route is one someone forgets.
 *
 * The user is resolved even on the public paths, so `/login` can send an
 * already signed-in visitor home.
 */

/** The only pages a stranger may see. */
const PUBLIC_PATHS = new Set(['/login'])

/** …and the only API surface, which is the sign-in flow itself. */
const PUBLIC_PREFIXES = ['/api/auth/']

/**
 * Framework and static routes, which never carry game data: the bundle, the
 * dev-tools, HMR, the favicon, the icon endpoint. Reserving the `_` prefix is
 * a Nuxt convention, so no application route will ever collide with this —
 * and it holds under `/api/` too, which is where `/api/_nuxt_icon` lives.
 *
 * That one is not hypothetical: without it the icon component asks for a
 * glyph, gets a 401 from this very middleware, and reports "failed to load
 * icon" — which is how it was found.
 */
function isFrameworkRoute(path: string): boolean {
  return path.startsWith('/_')
    || path.startsWith('/api/_')
    || path === '/favicon.ico'
    || path === '/robots.txt'
}

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (isFrameworkRoute(path)) return

  const session = await usePerquizSession(event)
  const userId = session?.data.userId
  // A session can outlive the row it points at — an admin removing a
  // participant, a reseeded database. Treat it as signed out.
  const user = userId ? findUserById(userId) : undefined
  if (user) {
    event.context.user = user
    // The phase decides what every screen may offer, so it travels with the
    // request rather than being fetched again by whoever needs it.
    event.context.phase = useGameState().phase
    return
  }
  if (PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some(prefix => path.startsWith(prefix))) return

  if (path.startsWith('/api/')) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  return sendRedirect(event, '/login')
})
