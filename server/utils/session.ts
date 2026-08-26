import type { H3Event } from 'h3'
// Imported rather than auto-imported, and renamed: `useSession` is also the
// name of the app-side composable, and a server file reaching for the wrong
// one would be a subtle way to lose a session.
import { useSession as useH3Session } from 'h3'

/**
 * The app's own session: an encrypted, httpOnly cookie holding a user id.
 *
 * The provider's tokens are used once, at the callback, and dropped. Roles
 * live in the database (`users.is_admin`), refreshed at every login — so a
 * session cannot outlive a revoked role by more than one sign-in, and nothing
 * bearer-shaped sits in a cookie.
 */

const SESSION_NAME = 'perquiz'

/** iron-webcrypto's floor, and h3 refuses anything shorter. */
const MINIMUM_PASSWORD_LENGTH = 32

export interface PerquizSession {
  userId?: number
  /** Only alive between /api/auth/login and /api/auth/callback. */
  codeVerifier?: string
  state?: string
}

/**
 * The session, or `undefined` when `NUXT_SESSION_PASSWORD` is unusable.
 *
 * Failing closed rather than throwing: an unconfigured deployment lets nobody
 * in and says so on the login screen, instead of returning 500 on every page —
 * and, more importantly, instead of quietly letting everybody through.
 */
export async function usePerquizSession(event: H3Event) {
  const password = useRuntimeConfig().sessionPassword
  if (password.length < MINIMUM_PASSWORD_LENGTH) return undefined

  return useH3Session<PerquizSession>(event, { name: SESSION_NAME, password })
}
