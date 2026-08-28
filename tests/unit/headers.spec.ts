import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The security headers, read off `nuxt.config.ts`.
 *
 * A config test, and deliberately so. These headers are a Nitro feature, so the
 * endpoint harness in tests/support/api.ts — which mounts a bare h3 app on
 * purpose, to stay fast — cannot see them; the browser run that proved they
 * work (Lighthouse, 2026-08-28) is not something `yarn test` can repeat.
 *
 * What is left is worth pinning anyway: this is the same trick
 * tests/unit/contrast.spec.ts uses on the CSS, and the same reason
 * tests/unit/auth.spec.ts asserts a *filename*. The invariant lives in a
 * declaration, so the test reads the declaration.
 */

// The directives are single-quoted strings inside a single-quoted TS literal,
// so the source spells them `\'self\'`. Dropping the backslashes lets the
// assertions below read like the header a browser actually receives.
const CONFIG = readFileSync(fileURLToPath(new URL('../../nuxt.config.ts', import.meta.url)), 'utf8')
  .replaceAll('\\', '')

/** The `content-security-policy` value, as one string. */
const CSP = CONFIG
  .slice(CONFIG.indexOf('\'content-security-policy\''), CONFIG.indexOf('\'x-content-type-options\''))
  .replaceAll(/\/\/[^\n]*/g, '')

describe('the headers on every response', () => {
  it.each([
    'x-content-type-options',
    'referrer-policy',
    'permissions-policy',
    'content-security-policy',
  ])('declares %s', (header) => {
    expect(CONFIG).toContain(`'${header}':`)
  })

  it.each([
    ['default-src', '\'self\''],
    // Closed completely: nothing in this app frames itself, rewrites its base,
    // loads a plugin, or posts a form anywhere but here.
    ['base-uri', '\'none\''],
    ['object-src', '\'none\''],
    ['frame-ancestors', '\'none\''],
    ['form-action', '\'self\''],
    // No CDN, no analytics, fonts self-hosted, icons embedded at build time:
    // the policy the project follows by hand, enforced.
    ['img-src', '\'self\' data:'],
    ['font-src', '\'self\''],
    ['connect-src', '\'self\''],
  ])('pins %s to %s', (directive, value) => {
    expect(CSP).toContain(`${directive} ${value}`)
  })

  /**
   * The exception, kept where it is.
   *
   * A hydrated Nuxt page carries an inline `window.__NUXT__.config` block that
   * no setting removes, and Vue writes `style="…"` attributes no nonce can
   * cover — so those two directives need `'unsafe-inline'` and the others must
   * never acquire it. Lighthouse's own `csp-xss` audit calls this out as High
   * severity, which is correct and is why a nonce is written down as the
   * upgrade rather than forgotten.
   */
  it('allows inline scripts and styles, and nothing else', () => {
    const relaxed = [...CSP.matchAll(/'([\w-]+-src[\w-]*)'?[^,]*'unsafe-inline'/g)].map(match => match[1])
    expect(relaxed.sort()).toEqual(['script-src', 'style-src'])
  })

  it('never allows eval', () => {
    expect(CSP).not.toContain('unsafe-eval')
  })

  /**
   * `data:` belongs to images and to nothing else.
   *
   * The design system's pixel frames are inline SVGs, so `img-src` has to name
   * the scheme — see the comment beside it in nuxt.config.ts, and note that
   * taking it away does not soften the skin but hides every block wearing
   * `frame-fill`, a blocked mask being an empty one.
   *
   * The risk that allowance carries is that it spreads. An image cannot
   * execute; a `data:` script can, and `data:` in `script-src` is one of the
   * bypasses CSP exists to close. So the scheme is pinned to exactly one
   * directive, here, rather than trusted to stay put.
   */
  it('allows data: URLs for images, and for nothing else', () => {
    const directives = [...CSP.matchAll(/'([\w-]+-src[\w-]*)'?[^,]*\bdata:/g)].map(match => match[1])
    expect(directives).toEqual(['img-src'])
  })
})
