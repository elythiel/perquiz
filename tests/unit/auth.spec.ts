import { describe, expect, it } from 'vitest'
import { tidyDisplayName, uniqueDisplayName } from '../../server/utils/display-name'
import { resolveAccess } from '../../server/utils/oidc'

/**
 * The two decisions a login makes on its own.
 *
 * Everything else in M2 is protocol — openid-client does the handshake, and a
 * round trip against a real provider is the only honest test of it. What is
 * ours is who gets in, and under what name; both are pure, so both are here.
 */

const ROLES = { player: 'player', admin: 'admin' }

describe('who gets in', () => {
  it.each([
    ['a player', ['player'], true, false],
    ['an admin', ['admin'], true, true],
    // SPEC §1: "Admins are also players" — the admin role alone is enough.
    ['both roles', ['player', 'admin'], true, true],
    ['roles from another app', ['billing', 'support'], false, false],
    ['no roles at all', [], false, false],
  ] as const)('%s -> allowed=%s admin=%s', (_label, roles, allowed, isAdmin) => {
    expect(resolveAccess(roles, ROLES)).toEqual({ allowed, isAdmin })
  })

  it('reads the configured names, not the default ones', () => {
    const renamed = { player: 'joueur', admin: 'regie' }
    expect(resolveAccess(['joueur'], renamed)).toEqual({ allowed: true, isAdmin: false })
    expect(resolveAccess(['regie'], renamed)).toEqual({ allowed: true, isAdmin: true })
    // The defaults must not keep working once the deployment renamed them.
    expect(resolveAccess(['player'], renamed)).toEqual({ allowed: false, isAdmin: false })
  })
})

describe('the name a first login lands on', () => {
  const taken = (...names: string[]) => (name: string) => names.includes(name)
  const free = () => false

  it('keeps a free name as it is', () => {
    expect(uniqueDisplayName('Sofia', free)).toBe('Sofia')
  })

  it('counts up until one is free', () => {
    expect(uniqueDisplayName('Sofia', taken('Sofia'))).toBe('Sofia 2')
    expect(uniqueDisplayName('Sofia', taken('Sofia', 'Sofia 2', 'Sofia 3'))).toBe('Sofia 4')
  })

  it.each([
    ['  Sofia  ', 'Sofia'],
    ['Sofia   Marchetti', 'Sofia Marchetti'],
    ['Sofia\tMarchetti\n', 'Sofia Marchetti'],
  ] as const)('tidies %o into %o', (raw, expected) => {
    expect(tidyDisplayName(raw)).toBe(expected)
  })

  // The rename form will refuse anything over 30 characters (PAGES /login), so
  // a JIT name the player could not legally retype would be a trap.
  it('clamps to thirty characters', () => {
    const long = 'Bartholomew Fitzgerald Wellington'
    expect(uniqueDisplayName(long, free)).toHaveLength(30)
  })

  it('shortens the base rather than the suffix', () => {
    const long = 'Bartholomew Fitzgerald Wellington'
    const first = uniqueDisplayName(long, free)
    const second = uniqueDisplayName(long, taken(first))

    expect(second).toHaveLength(30)
    expect(second.endsWith(' 2')).toBe(true)
    expect(second).not.toBe(first)
  })

  it.each(['', ' ', 'a'])('refuses to build on %o', (candidate) => {
    expect(() => uniqueDisplayName(candidate, free)).toThrow(/too short/)
  })
})
