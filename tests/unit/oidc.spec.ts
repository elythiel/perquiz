import { describe, expect, it } from 'vitest'
import { extractDisplayName, extractRoles } from '../../server/utils/oidc'

/**
 * Reading OIDC claims — the one place in the codebase that knows what a given
 * IdP's tokens look like.
 *
 * Two invariants are worth locking down. First, the three role shapes really
 * are handled, so swapping provider is configuration and not a code change.
 * Second, nothing here throws: the claims come from outside, and a token this
 * module cannot read must produce "no roles" — which the login flow turns into
 * the "not on the guest list" screen — never a 500.
 */

const ZITADEL_CLAIM = 'urn:zitadel:iam:org:project:roles'

describe('the role shapes providers actually use', () => {
  it('reads an object whose keys are the roles (Zitadel)', () => {
    const claims = {
      [ZITADEL_CLAIM]: {
        player: { '312...': 'perquiz.example.tld' },
        admin: { '312...': 'perquiz.example.tld' },
      },
    }
    expect(extractRoles(claims, ZITADEL_CLAIM)).toEqual(['player', 'admin'])
  })

  it('reads an array of strings behind a dotted path (Keycloak)', () => {
    const claims = { realm_access: { roles: ['player', 'offline_access'] } }
    expect(extractRoles(claims, 'realm_access.roles')).toEqual(['player', 'offline_access'])
  })

  it('reads a flat array of strings (Authentik, Authelia)', () => {
    expect(extractRoles({ groups: ['admin', 'player'] }, 'groups')).toEqual(['admin', 'player'])
  })

  it('reads a space-separated string', () => {
    expect(extractRoles({ roles: 'player  admin' }, 'roles')).toEqual(['player', 'admin'])
  })
})

describe('a claim it cannot make sense of yields no role', () => {
  // No throw, no partial result: every one of these lands the user on the
  // "not on the guest list" screen.
  it.each([
    ['the claim is absent', { sub: 'abc' }, ZITADEL_CLAIM],
    ['the claim is null', { roles: null }, 'roles'],
    ['the claim is a number', { roles: 42 }, 'roles'],
    ['the claim is a boolean', { roles: true }, 'roles'],
    ['the claim is an empty object', { roles: {} }, 'roles'],
    ['the claim is an empty array', { roles: [] }, 'roles'],
    ['the claim is an empty string', { roles: '   ' }, 'roles'],
    ['the array holds no string', { roles: [1, null, {}] }, 'roles'],
    ['the claims are not an object', 'not-a-token', 'roles'],
    ['the claims are null', null, 'roles'],
    ['the claims are an array', ['player'], 'roles'],
    ['the configured claim name is empty', { roles: ['player'] }, ''],
    ['the path runs through a leaf', { realm_access: 'x' }, 'realm_access.roles'],
    ['the path runs past the end', { roles: ['player'] }, 'roles.nested'],
  ] as const)('%s', (_label, claims, claimPath) => {
    expect(extractRoles(claims, claimPath)).toEqual([])
  })

  // A hand-crafted token must not reach `Object.prototype`.
  it.each(['__proto__', 'constructor', 'toString'])(
    'inherited property %o resolves to nothing',
    (claimPath) => {
      expect(extractRoles({ sub: 'abc' }, claimPath)).toEqual([])
    },
  )
})

describe('the shape of the roles that come out', () => {
  it('trims and drops the blanks', () => {
    expect(extractRoles({ roles: [' player ', '', '  ', 'admin'] }, 'roles')).toEqual(['player', 'admin'])
  })

  it('keeps a repeated role once', () => {
    expect(extractRoles({ roles: 'player admin player' }, 'roles')).toEqual(['player', 'admin'])
  })

  // A claim name may contain dots; the literal key wins over the path.
  it('prefers a literal claim name over the dotted path', () => {
    const claims = { 'a.b': ['literal'], 'a': { b: ['traversed'] } }
    expect(extractRoles(claims, 'a.b')).toEqual(['literal'])
  })
})

describe('the display name', () => {
  it.each([
    ['name wins', { name: 'Sofia Marchetti', preferred_username: 'sofia', email: 'sofia@example.tld', sub: '9f2c1b7a-…' }, 'Sofia Marchetti'],
    ['then preferred_username', { preferred_username: 'sofia', email: 'sofia.m@example.tld', sub: '9f2c1b7a-…' }, 'sofia'],
    ['then the local part of email', { email: 'sofia.m@example.tld', sub: '9f2c1b7a-…' }, 'sofia.m'],
    ['then a prefix of sub', { sub: '9f2c1b7a-4d3e-4c2b-9a1f-0e8d7c6b5a40' }, '9f2c1b7a'],
  ] as const)('%s', (_label, claims, expected) => {
    expect(extractDisplayName(claims)).toBe(expected)
  })

  it.each([
    ['a blank claim is skipped', { name: '   ', preferred_username: 'sofia' }, 'sofia'],
    ['a non-string claim is skipped', { name: 42, preferred_username: 'sofia' }, 'sofia'],
    ['an email with no local part is skipped', { email: '@example.tld', sub: 'abcdef123456' }, 'abcdef12'],
    ['a claim is trimmed', { name: '  Sofia  ' }, 'Sofia'],
  ] as const)('%s', (_label, claims, expected) => {
    expect(extractDisplayName(claims)).toBe(expected)
  })

  it.each([{}, null, undefined, 'not-a-token', ['name'], { name: 42 }])(
    'nothing usable in %o yields an empty string',
    (claims) => {
      expect(extractDisplayName(claims)).toBe('')
    },
  )
})
