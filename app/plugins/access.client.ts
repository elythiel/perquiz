import { accessVerdict } from '#shared/utils/access'

/**
 * The same rule, watching instead of being asked.
 *
 * `middleware/access.global.ts` answers "may you come in", once, on the way
 * in. It cannot answer "may you still be here" — a middleware runs on
 * navigation and nothing else, so a phase flipped under a reader who is
 * standing still would leave them on a page they no longer have the right to.
 * This watches the answer rather than the inputs: one watcher for the route,
 * the phase and the session, firing only when the verdict itself changes.
 *
 * Both call the same pure function, which is the reason the decision does not
 * live inside the middleware. Two guards with two copies of the rule would be
 * a rule to widen twice.
 *
 * Client only: on the server there is one render and nothing changes during
 * it. No `immediate` either — the middleware has already ruled on the page
 * being loaded, and re-ruling here would only race it.
 *
 * Live since vikunja-109: the admin panel now writes `game:phase` directly
 * after flipping it, where it used to reload the whole app — so this watcher
 * fires for real in the tab that made the change, instead of being a net
 * waiting for a poll or a stream to exist. Nothing follows from it today, and
 * that is by design: `/admin` is gated on the ADMIN ROLE and not on a phase,
 * so no phase an admin can reach refuses them the page they are standing on.
 * The day one does, this sends them home rather than leaving them on a screen
 * they no longer have the right to.
 */
export default defineNuxtPlugin(() => {
  const route = useRoute()
  const { user } = useSession()
  const { phase } = useGamePhase()

  watch(
    () => accessVerdict(route.meta.access, user.value, phase.value),
    (verdict) => {
      if (verdict === 'refused') navigateTo('/', { replace: true })
    },
  )
})
