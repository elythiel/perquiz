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
 * A caveat worth knowing, and not a defect of this file: today nothing writes
 * `game:phase` after the server has, so in practice the verdict only moves
 * when the whole app reloads (which is what the admin panel does after a phase
 * change). The day a tab learns about a phase change on its own — a poll, a
 * stream — this is already in place and already correct.
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
