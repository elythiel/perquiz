/**
 * Ends the app session. The provider's own session is left alone: single
 * logout is out of scope for v1 (SPEC §1), so signing back in is one click —
 * which is why `/login` says so when it is reached from here.
 *
 * POST, and only POST. A `GET` route that destroys a session is triggered by
 * anything that can name a URL: an `<img src>` on a third-party page, a link
 * preview, an over-eager prefetcher. The damage is small — the visitor signs
 * back in — but it is an effect nobody asked for, and the fix costs one
 * filename now that a button exists to provide the method.
 */
export default defineEventHandler(async (event) => {
  const session = await usePerquizSession(event)
  await session?.clear()

  // 303 rather than 302: it is the status that *mandates* a GET on the next
  // hop. Browsers turn a 302 into a GET after a POST anyway, but only by
  // convention — 303 is the one that says it.
  return sendRedirect(event, '/login?bye', 303)
})
