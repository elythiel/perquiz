/**
 * Sends the browser to the provider, keeping the PKCE verifier behind.
 *
 * The verifier and the state ride in the app's own encrypted session rather
 * than in cookies of their own: one cookie, one secret, and the callback can
 * only be completed by the browser that started the exchange.
 */
export default defineEventHandler(async (event) => {
  const session = await usePerquizSession(event)

  if (!session) return sendRedirect(event, '/login?error=provider')

  /*
   * `context.user`, not `session.data.userId`: the question is "are you signed
   * in", and the cookie only answers "do you carry an id".
   *
   * A session outlives the row it points at — a reseeded database, a
   * participant removed from the panel — and the middleware upstream already
   * says so, resolving the user to nothing and letting this public route
   * through. Reading the raw id instead sent that visitor to `/`, which sent
   * them back to `/login`, which sent them here again: a loop with no way out,
   * since the button that would clear the cookie is behind the wall.
   */
  if (event.context.user) return sendRedirect(event, '/')

  try {
    const { url, codeVerifier, state } = await startAuthorization()
    await session.update({ codeVerifier, state })
    return sendRedirect(event, url)
  }
  catch (error) {
    // An unreachable provider, a missing issuer, a discovery document that is
    // not one: all the same story to the person waiting — "we could not start".
    console.error('[auth] could not start the authorization flow:', error)
    return sendRedirect(event, '/login?error=provider')
  }
})
