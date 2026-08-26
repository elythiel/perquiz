import type { SessionUser } from '#shared/types/user'

/**
 * The signed-in user, or `null`.
 *
 * Filled on the server by plugins/session.server.ts and carried to the client
 * in the payload — there is no request to wait for, and no moment where the
 * interface knows less than the server did.
 */
export function useSession() {
  const user = useState<SessionUser | null>('session:user', () => null)

  return { user: readonly(user) }
}
