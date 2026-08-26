import * as client from 'openid-client'

/**
 * The OIDC handshake itself: discovery, then code + PKCE.
 *
 * Deliberately separate from server/utils/oidc.ts, which reads what a token
 * *says*. This file only knows the protocol, and the protocol is the same
 * everywhere — there is not one provider name in it.
 *
 * Every endpoint comes from `<issuer>/.well-known/openid-configuration`, so
 * changing provider is changing `NUXT_OIDC_ISSUER`.
 */

export interface OidcSettings {
  issuer: string
  clientId: string
  clientSecret: string
  providerId: string
  rolesClaim: string
  rolePlayer: string
  roleAdmin: string
  scopes: string
  redirectUri: string
}

export function oidcSettings(): OidcSettings {
  const config = useRuntimeConfig()
  return {
    ...config.oidc,
    // Built from the public base URL, so the value registered at the provider
    // and the value sent in the request cannot drift apart.
    redirectUri: new URL('/api/auth/callback', config.public.baseUrl).toString(),
  }
}

let discovered: Promise<client.Configuration> | undefined

/**
 * The discovery document, fetched once per process.
 *
 * A failed discovery is NOT remembered: an provider that was down for one
 * request would otherwise stay down for the lifetime of the server.
 */
export function useOidcConfiguration(): Promise<client.Configuration> {
  discovered ??= discover().catch((error: unknown) => {
    discovered = undefined
    throw error
  })
  return discovered
}

async function discover(): Promise<client.Configuration> {
  const { issuer, clientId, clientSecret } = oidcSettings()
  if (!issuer || !clientId) {
    throw new Error('OIDC is not configured: set NUXT_OIDC_ISSUER and NUXT_OIDC_CLIENT_ID')
  }
  return client.discovery(new URL(issuer), clientId, clientSecret || undefined)
}

/** The URL to send the browser to, and the verifier to keep until it comes back. */
export async function startAuthorization() {
  const settings = oidcSettings()
  const configuration = await useOidcConfiguration()

  const codeVerifier = client.randomPKCECodeVerifier()
  const state = client.randomState()

  const url = client.buildAuthorizationUrl(configuration, {
    redirect_uri: settings.redirectUri,
    scope: settings.scopes,
    code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
    code_challenge_method: 'S256',
    state,
  })

  return { url: url.href, codeVerifier, state }
}

/**
 * Trades the authorization code for tokens and returns the ID token's claims.
 *
 * The tokens are not returned and nowhere stored: the roles they carry are
 * copied into the database at this instant, and the session that follows holds
 * a user id and nothing else.
 */
export async function claimsFromCallback(
  currentUrl: URL,
  expected: { codeVerifier: string, state: string },
) {
  const configuration = await useOidcConfiguration()
  const tokens = await client.authorizationCodeGrant(configuration, currentUrl, {
    pkceCodeVerifier: expected.codeVerifier,
    expectedState: expected.state,
  })
  return tokens.claims()
}
