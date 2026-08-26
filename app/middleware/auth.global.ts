/**
 * The client-side half of the gate.
 *
 * The server middleware already refuses an anonymous request; this one keeps
 * client-side navigation honest, so a link followed inside the app behaves
 * exactly like a page loaded fresh — and sends a signed-in visitor away from
 * the login screen (PAGES `/login`).
 */
export default defineNuxtRouteMiddleware((to) => {
  const { user } = useSession()

  if (to.path === '/login') {
    return user.value ? navigateTo('/') : undefined
  }

  if (!user.value) return navigateTo('/login')
})
