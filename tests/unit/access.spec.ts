import type { PageAccess } from '../../shared/types/access'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { accessVerdict } from '../../shared/utils/access'
import { GAME_PHASES, SHEET_OUT_PHASES } from '../../shared/utils/game'

/**
 * Who a route lets in, decided without a router.
 *
 * The interesting answer is the third one. A guard with two outcomes would
 * have to know it runs before `auth` — global middlewares run alphabetically,
 * and "access" sorts before "auth" — and would send anonymous visitors to `/`
 * instead of to the sign-in screen. `deferred` is how the order stops
 * mattering, so it is what these tests watch hardest.
 *
 * None of this is a security boundary: the locks are `assertAdmin`,
 * `assertSheetIsOut` and the results endpoint. What is asserted here is that
 * an empty shell does not render to somebody who typed a URL.
 */

const PLAYER = { displayName: 'Alice', isAdmin: false } as const
const ADMIN = { displayName: 'Régie', isAdmin: true } as const

/** The phase is irrelevant to a role-only rule; this one stands in for "any". */
const ANY_PHASE = 'open'

describe('a route asking for a role', () => {
  const adminOnly: PageAccess = { role: 'admin' }

  it('turns a player away', () => {
    expect(accessVerdict(adminOnly, PLAYER, ANY_PHASE)).toBe('refused')
  })

  it('lets an admin through', () => {
    expect(accessVerdict(adminOnly, ADMIN, ANY_PHASE)).toBe('granted')
  })
})

describe('a route asking for a phase', () => {
  it('accepts a single value as the whole set', () => {
    const revealedOnly: PageAccess = { phase: 'revealed' }

    expect(accessVerdict(revealedOnly, PLAYER, 'revealed')).toBe('granted')
    for (const phase of GAME_PHASES.filter(candidate => candidate !== 'revealed')) {
      expect(accessVerdict(revealedOnly, PLAYER, phase)).toBe('refused')
    }
  })

  it('accepts a set, which is what the sheet needs', () => {
    const sheetIsOut: PageAccess = { phase: SHEET_OUT_PHASES }

    // The rule `/guess` used to hold in a middleware of its own: the sheet
    // does not exist before the game opens, and the page goes home.
    expect(accessVerdict(sheetIsOut, PLAYER, 'preparation')).toBe('refused')
    for (const phase of SHEET_OUT_PHASES) {
      expect(accessVerdict(sheetIsOut, PLAYER, phase)).toBe('granted')
    }
  })
})

describe('a route asking for both', () => {
  const both: PageAccess = { role: 'admin', phase: 'locked' }

  it('needs both, not either', () => {
    expect(accessVerdict(both, ADMIN, 'locked')).toBe('granted')
    expect(accessVerdict(both, PLAYER, 'locked')).toBe('refused')
    expect(accessVerdict(both, ADMIN, 'open')).toBe('refused')
  })
})

describe('the visitor nobody has signed in', () => {
  it('is deferred, never refused — that redirect belongs to `auth`', () => {
    // Refusing here would send them to `/` before `auth` could send them to
    // `/login`, because this middleware runs first. Every guarded shape has to
    // answer the same way.
    for (const access of [
      { role: 'admin' },
      { phase: 'revealed' },
      { phase: SHEET_OUT_PHASES },
      { role: 'admin', phase: 'locked' },
    ] satisfies PageAccess[]) {
      expect(accessVerdict(access, null, 'preparation')).toBe('deferred')
    }
  })
})

describe('a route asking for nothing', () => {
  it('lets a signed-in visitor through in every phase', () => {
    for (const phase of GAME_PHASES) {
      expect(accessVerdict(undefined, PLAYER, phase)).toBe('granted')
    }
  })
})

describe('the routes that declare a rule', () => {
  const page = (path: string) =>
    readFileSync(fileURLToPath(new URL(`../../app/pages/${path}`, import.meta.url)), 'utf8')

  /**
   * The mapping, spelled out. `/reveal` had no client guard at all before this
   * — not a wrong rule, an absent one — and an absent rule is invisible in a
   * page that otherwise looks finished. Written down here, it becomes a line
   * somebody has to delete on purpose.
   */
  it.each([
    ['admin.vue', 'access: { role: \'admin\' }'],
    ['reveal/[cursor].vue', 'access: { role: \'admin\' }'],
    ['results.vue', 'access: { phase: \'revealed\' }'],
    ['guess/index.vue', 'access: { phase: SHEET_OUT_PHASES }'],
    ['guess/[token].vue', 'access: { phase: SHEET_OUT_PHASES }'],
  ])('%s declares %s', (path, declaration) => {
    expect(page(path)).toContain(declaration)
  })

  it('leaves `/reveal` to the route it redirects onto', () => {
    // The one route with no rule of its own, and the only one that may have
    // none: it renders nothing, ever. A guard there would be a line nobody
    // executes, and the rule that matters is on the step it lands on.
    expect(page('reveal/index.vue')).toContain('redirect: \'/reveal/0\'')
    expect(page('reveal/index.vue')).not.toContain('access:')
    expect(page('reveal/[cursor].vue')).toContain('access: { role: \'admin\' }')
  })

  it('leaves the phase set to the shared constant, on both pages that read it', () => {
    // Two pages, one rule. Spelling the phases out on each is how the rule
    // gets widened on one of them and not the other.
    for (const path of ['guess/index.vue', 'guess/[token].vue']) {
      expect(page(path)).not.toMatch(/phase:\s*\[/)
    }
  })
})
