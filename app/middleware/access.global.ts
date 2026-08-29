import type { PageAccess } from '#shared/types/access'
import { accessVerdict } from '#shared/utils/access'

/**
 * Who may be on a route, asked of the route rather than of the page.
 *
 * Four mechanisms did this before — two inline `if`s in a page body, one named
 * middleware two pages subscribed to, and, on `/reveal`, nothing at all. One
 * declaration replaces them: what a route requires is now part of what a route
 * *is*, and a page that forgets to guard itself is a page missing a line
 * anyone can see, rather than a page that looks finished.
 *
 * This is cosmetic, and deliberately so. The locks are the server's
 * (`assertAdmin`, `assertSheetIsOut`, the results endpoint refusing before
 * `revealed`); all this prevents is an empty shell rendering to somebody who
 * typed a URL. Nothing here may ever be a reason to relax one of those.
 *
 * Both augmentations are needed, for different reasons: `PageMeta` constrains
 * the write side (`definePageMeta`), which would otherwise accept anything
 * through its index signature; `RouteMeta` types the read side
 * (`to.meta.access`). Nuxt augments `PageMeta` from `nuxt/app` itself — see
 * `.nuxt/types/middleware.d.ts`. The theme had the same pair until
 * vikunja-107 removed it unused, so this is now the one worked example of the
 * pattern in the app.
 */
declare module 'nuxt/app' {
  interface PageMeta {
    access?: PageAccess
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    access?: PageAccess
  }
}

export default defineNuxtRouteMiddleware((to) => {
  const { user } = useSession()

  // `gamePhaseOn(to)` and not `useGamePhase()`: a route middleware runs before
  // `useRoute()` has moved, so the composable would judge `/guess?phase=locked`
  // on the query of the page being left.
  const verdict = accessVerdict(to.meta.access, user.value, gamePhaseOn(to))

  // Only a refusal is ours. `deferred` is the anonymous visitor, whom
  // `auth.global` sends to `/login` — see the note on `AccessVerdict`.
  if (verdict === 'refused') return navigateTo('/', { replace: true })
})
