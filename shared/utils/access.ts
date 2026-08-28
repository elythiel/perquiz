import type { PageAccess } from '../types/access'
import type { GamePhase } from '../types/game'
import type { SessionUser } from '../types/user'

/**
 * Three answers, and the third is the point.
 *
 * `deferred` is what makes the order of the global middlewares stop mattering.
 * They run alphabetically, so `access` runs before `auth`; left to itself it
 * would send an anonymous visitor to `/` before `auth` ever got the chance to
 * send them to `/login`. So it says nothing at all about the anonymous — that
 * case belongs to `auth`, which runs next and owns it. Each middleware keeps
 * one case, and neither has to know it is second.
 */
export type AccessVerdict = 'granted' | 'refused' | 'deferred'

/**
 * The whole decision, with no router and no session around it.
 *
 * Kept a pure function rather than living inside the middleware so that the
 * rule can be read — and tested — without a Nuxt app to boot. The middleware
 * that calls it is four lines, and none of them is a decision.
 */
export function accessVerdict(
  access: PageAccess | undefined,
  viewer: Readonly<SessionUser> | null,
  phase: GamePhase,
): AccessVerdict {
  if (!viewer) return 'deferred'
  if (!access) return 'granted'

  if (access.role === 'admin' && !viewer.isAdmin) return 'refused'

  if (access.phase !== undefined) {
    const allowed = typeof access.phase === 'string' ? [access.phase] : access.phase
    if (!allowed.includes(phase)) return 'refused'
  }

  return 'granted'
}
