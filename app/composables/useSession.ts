import type { SessionUser } from '#shared/types/user'

/**
 * Utilisateur connecté.
 *
 * PLACEHOLDER M0 : la valeur est figée le temps de bâtir la coquille. M2
 * (authentification Zitadel) remplacera le contenu de ce composable par la
 * session réelle ; les appelants (chip utilisateur, nav) n'ont pas à bouger.
 */
const PLACEHOLDER: SessionUser = { displayName: 'Sofia', isAdmin: true }

export function useSession() {
  const user = useState<SessionUser | null>('session:user', () => PLACEHOLDER)

  return { user: readonly(user) }
}
