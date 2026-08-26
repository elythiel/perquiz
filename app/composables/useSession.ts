import type { SessionUser } from '#shared/types/user'

/**
 * The signed-in user.
 *
 * M0 PLACEHOLDER: the value is hard-coded while the shell is being built. M2
 * (OIDC authentication) will replace the body of this composable with the real
 * session; its callers (user chip, nav) will not have to move.
 */
const PLACEHOLDER: SessionUser = { displayName: 'Sofia', isAdmin: true }

export function useSession() {
  const user = useState<SessionUser | null>('session:user', () => PLACEHOLDER)

  return { user: readonly(user) }
}
