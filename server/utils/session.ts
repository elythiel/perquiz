import type { H3Event } from 'h3'
// Imported rather than auto-imported, and renamed: `useSession` is also the
// name of the app-side composable, and a server file reaching for the wrong
// one would be a subtle way to lose a session.
import { useSession as useH3Session } from 'h3'

/**
 * The app's own session: an encrypted, httpOnly cookie naming an identity.
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
  /**
   * Who the cookie belongs to: `identities.provider` + `identities.subject`,
   * the pair the provider itself owns — and NOT `users.id`.
   *
   * A row number is not an identity. `users.id` is local, mutable, and handed
   * out again the moment the table is rebuilt with its counter reset: a
   * restored backup, a hand-repaired table, `yarn seed`. A cookie holding one
   * does not stop resolving when that happens — it resolves to whoever now
   * sits at that number, privileges included, without a trip through the
   * provider. Naming the identity instead means a rebuilt `users` can make a
   * session resolve to nobody, never to somebody else.
   *
   * Both or neither: a session carrying one half of the pair names no
   * identity, so `resolveSessionIdentity` treats it as signed out.
   */
  provider?: string
  subject?: string
  /** Only alive between /api/auth/login and /api/auth/callback. */
  codeVerifier?: string
  state?: string
}

/** The pair, when the session carries a whole one. */
export interface SessionIdentity {
  provider: string
  subject: string
}

/**
 * The identity a session names, or `undefined` when it names none.
 *
 * Next to the shape it reads, rather than spelled out at the one call site:
 * "a session names somebody" is the question a second reader would answer
 * again, slightly differently — which is how `/api/auth/login` came to read
 * the cookie itself and disagree with the middleware (card 71).
 */
export function resolveSessionIdentity(session: PerquizSession | undefined): SessionIdentity | undefined {
  const { provider, subject } = session ?? {}
  return provider && subject ? { provider, subject } : undefined
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

  return useH3Session<PerquizSession>(event, {
    name: SESSION_NAME,
    password,
    /*
     * `httpOnly` and `secure` are h3's defaults; `sameSite` is not, and it is
     * the one that matters here.
     *
     * Every route is authenticated by this cookie and by nothing else — there
     * is no CSRF token anywhere in the app. Without an explicit SameSite, that
     * defence is whatever the visitor's browser happens to default to, which
     * is Lax in most of them and not a promise in any of them. Written down,
     * a form on someone else's page cannot lock the game, delete a
     * participant, or empty a room.
     *
     * `secure` is kept in development too: browsers treat http://localhost as
     * a secure context, so the cookie is set there all the same.
     */
    cookie: { sameSite: 'lax' },
    /*
     * By default h3 also accepts a sealed session in an `x-perquiz-session`
     * request header, and prefers it over the cookie. Nothing in this app ever
     * sends one: it is a second way in, exercised by nobody, audited by
     * nobody. Closed.
     */
    sessionHeader: false,
  })
}
