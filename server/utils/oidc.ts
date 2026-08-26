/**
 * Reading the claims of an OIDC token.
 *
 * Perquiz is the client of a **generic OIDC provider able to assert roles**,
 * described entirely by configuration (see `.env.example`). Discovery, code +
 * PKCE, `sub`, the redirect and post-logout URIs and the `identities` table are
 * plain OIDC and need no knowledge of who issued the token.
 *
 * Two things are not plain OIDC, and both live in this file:
 *
 * - **where the roles sit and what shape they take.** Every provider invented
 *   its own. The claim *name* is configuration; the three *shapes* below are
 *   code, because a name alone cannot describe them.
 * - **which claim carries a human-readable name.** Not every provider sends
 *   `name`, and the JIT provisioning of M2 needs something to write down.
 *
 * Nothing else in the codebase reads a token. An IdP whose shapes are not
 * covered here means changing this file, and only this file.
 *
 * Honest label: this is **tested against Zitadel** — the homelab instance, and
 * the values shipped as configuration defaults. The other shapes are written
 * from the providers' documented claims, not proven against a live instance.
 */

/** A UUID's first block: recognisable, and short enough to be renamed over. */
const SUB_PREFIX_LENGTH = 8

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Reads `path` out of the claims, following dots (`realm_access.roles`).
 *
 * The whole path is tried as a literal key FIRST: a claim name may legitimately
 * contain dots, and Zitadel's does contain colons — assuming a path everywhere
 * would make such names unreachable. `Object.hasOwn` keeps `constructor` and
 * `__proto__` from resolving to something inherited.
 */
function readClaim(claims: unknown, path: string): unknown {
  if (!isRecord(claims) || path === '') return undefined
  if (Object.hasOwn(claims, path)) return claims[path]

  let node: unknown = claims
  for (const segment of path.split('.')) {
    if (!isRecord(node) || !Object.hasOwn(node, segment)) return undefined
    node = node[segment]
  }
  return node
}

/** Keeps the strings, trims them, drops the blanks, keeps the first of equals. */
function toRoleList(values: readonly unknown[]): string[] {
  const roles = values
    .filter(value => typeof value === 'string')
    .map(value => value.trim())
    .filter(value => value !== '')
  return [...new Set(roles)]
}

/**
 * The roles the token asserts, in whichever of the three shapes it uses.
 *
 * Returns an empty list for anything it cannot read — an absent claim, a null,
 * a number, a hand-crafted token. A user with no role belongs on the "not on
 * the guest list" screen (PAGES `/login`); a malformed token must never be a
 * 500, so this function has no failure mode.
 */
export function extractRoles(claims: unknown, rolesClaim: string): string[] {
  const value = readClaim(claims, rolesClaim)

  // An array of strings: Keycloak `realm_access.roles`, Authentik/Authelia
  // `groups` — the shape most providers settled on.
  if (Array.isArray(value)) return toRoleList(value)

  // An object whose KEYS are the roles, the values being org metadata: Zitadel.
  if (isRecord(value)) return toRoleList(Object.keys(value))

  // A space-separated list, written like a scope string.
  if (typeof value === 'string') return toRoleList(value.split(/\s+/))

  return []
}

/**
 * A name to greet the user with on their very first login.
 *
 * `name` is optional in OIDC and plenty of providers omit it, so this walks
 * down to progressively less human fallbacks rather than leaving the account
 * nameless. Whatever comes out is a *default*: the display name is editable in
 * « Ma pièce », and M2 appends a suffix on collision.
 *
 * Empty only when the claims carry no usable string at all, `sub` included —
 * which an ID token cannot legally do. The caller decides what that means.
 */
export function extractDisplayName(claims: unknown): string {
  if (!isRecord(claims)) return ''

  const text = (claim: string): string => {
    const value = claims[claim]
    return typeof value === 'string' ? value.trim() : ''
  }

  return text('name')
    || text('preferred_username')
    || text('email').split('@')[0]!.trim()
    || text('sub').slice(0, SUB_PREFIX_LENGTH)
}

/** The two role names the deployment configures (`NUXT_OIDC_ROLE_*`). */
export interface RoleNames {
  player: string
  admin: string
}

/**
 * Whether these roles get someone into the game, and with what powers.
 *
 * Admins are players too (SPEC §1), so holding only the admin role is enough
 * to get in. Everything else — no roles, unknown roles, a token this file
 * could not read — is refused, and refusing is a redirect to "you're not on
 * the guest list", never an error page.
 */
export function resolveAccess(roles: readonly string[], names: RoleNames) {
  const isAdmin = roles.includes(names.admin)
  return { allowed: isAdmin || roles.includes(names.player), isAdmin }
}
