/**
 * Back from the provider: check the roles, then let them in.
 *
 * Three outcomes, and only three. A valid token with a role signs in. A valid
 * token without one lands on "you're not on the guest list" and creates
 * nothing. Anything else is an provider error — never a stack trace on screen.
 */
export default defineEventHandler(async (event) => {
  const session = await usePerquizSession(event)
  if (!session) return sendRedirect(event, '/login?error=provider')

  const { codeVerifier, state } = session.data
  // One shot: consumed before the exchange, so a replayed callback URL cannot
  // be completed a second time.
  await session.update({ codeVerifier: undefined, state: undefined })

  if (!codeVerifier || !state) {
    return sendRedirect(event, '/login?error=provider')
  }

  const settings = oidcSettings()

  try {
    const claims = await claimsFromCallback(getRequestURL(event), { codeVerifier, state })

    const roles = extractRoles(claims, settings.rolesClaim)
    const access = resolveAccess(roles, { player: settings.rolePlayer, admin: settings.roleAdmin })
    if (!access.allowed) {
      return sendRedirect(event, '/login?error=not-invited')
    }

    const displayName = extractDisplayName(claims)
    if (!claims?.sub || !displayName) {
      // An ID token always carries `sub`, and `sub` alone is enough for a name.
      // Getting here means the token is not one.
      throw new Error('the token carries neither a usable name nor a subject')
    }

    const identity = { provider: settings.providerId, subject: claims.sub }

    // Before the cookie is written, and not only for tidiness: the session
    // names this identity, so the row it resolves through has to exist first.
    provisionUser({ ...identity, displayName, isAdmin: access.isAdmin })

    // The identity, not a `users.id`: the cookie has to name something the
    // provider owns, so a rebuilt `users` table cannot re-point it (card 79).
    await session.update(identity)
    return sendRedirect(event, '/')
  }
  catch (error) {
    console.error('[auth] the callback failed:', error)
    return sendRedirect(event, '/login?error=provider')
  }
})
