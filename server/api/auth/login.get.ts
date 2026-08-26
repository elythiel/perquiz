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
  if (session.data.userId) return sendRedirect(event, '/')

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
