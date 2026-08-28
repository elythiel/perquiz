import type { GuessSheet } from '~~/server/utils/sheet'
import { GUESS_SHEET_KEY } from '~/composables/useGuessSheet'

/**
 * Puts the reader on a real room, before the page exists.
 *
 * `/guess` holds no room of its own and hands over to the first one still
 * unanswered; a handle naming no room at all — a stale link, a room whose last
 * photograph just went — has to go the same way. Both used to happen in the
 * page's own `setup`, with an awaited `navigateTo`, and that is what this
 * middleware exists to undo.
 *
 * A `setup` that redirects is a `<Suspense>` that never resolves: the awaited
 * `navigateTo` never settles, so `onResolve` never runs. Wrapped in the page
 * transition (`app.vue`, `mode: 'out-in'`) that leaves the enter class —
 * `opacity-0` — on a page nobody will ever take it off, and the transition's
 * own promise undeleted, so every navigation after it lands invisible too. One
 * trip through `/guess` and the whole app goes blank until a reload.
 *
 * Route middleware runs before the component is created and therefore before
 * the transition has anything to animate, which is the whole of the fix.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const cached = useNuxtData<GuessSheet>(GUESS_SHEET_KEY)

  // Landing on `/guess` re-reads the sheet — rooms appear and vanish as people
  // upload and delete photographs (PAGES `/guess`). Walking from one room to
  // the next does not: the deck order would be re-read while you walk it.
  const read = () => useRequestFetch()<GuessSheet>('/api/guess')
  const sheet: GuessSheet = to.path === '/guess' ? await read() : cached.data.value ?? await read()

  // Seeded, not just read: the page's `useGuessSheet()` reads this same key
  // through `getCachedData`, so filling it here keeps the visit at one request.
  cached.data.value = sheet

  const token = to.params.token
  if (typeof token === 'string' && sheet.rooms.some(room => room.token === token)) return

  // No room at all is `/guess`'s empty state, and a handle pointing nowhere
  // with nothing to point at instead is left where it is — the page renders
  // nothing, exactly as it did before.
  const first = sheet.rooms.find(room => room.guess === null) ?? sheet.rooms[0]
  if (!first || first.token === token) return

  return navigateTo({ path: `/guess/${first.token}`, query: to.query }, { replace: true })
})
