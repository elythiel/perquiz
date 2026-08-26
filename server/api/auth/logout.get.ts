/**
 * Ends the app session. The provider's own session is left alone: single
 * logout is out of scope for v1 (SPEC §1), so signing back in is one click.
 */
export default defineEventHandler(async (event) => {
  const session = await usePerquizSession(event)
  await session?.clear()
  return sendRedirect(event, '/login')
})
