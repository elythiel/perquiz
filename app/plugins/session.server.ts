import type { SessionUser } from '#shared/types/user'

/**
 * Hands the signed-in user from the request to the app, once, on the server.
 *
 * The state is serialised into the payload, so the client starts hydrated and
 * `useSession()` never has to fetch anything. Only what the interface shows
 * travels: the internal user id stays on the server.
 */
export default defineNuxtPlugin(() => {
  const user = useRequestEvent()?.context.user

  useState<SessionUser | null>('session:user', () =>
    user ? { displayName: user.displayName, isAdmin: user.isAdmin } : null)
})
