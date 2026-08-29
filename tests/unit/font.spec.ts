import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isFontChoice, resolveFontClass } from '../../shared/utils/font'

/**
 * The typeface setting: which class ends up on `<html>`, and what that class is
 * allowed to change.
 *
 * The resolution is three lines, and it is still worth pinning for the reason
 * `theme.spec.ts` gives about its own: the failure mode is silent. A cookie
 * that stopped resolving would leave everyone on the pixel face with a control
 * that appears to do nothing.
 *
 * The second half is a config test — the trick `headers.spec.ts` uses on the
 * headers and `contrast.spec.ts` on the palette. What this setting promises is
 * not expressible in TypeScript: that `.readable` swaps the faces AND NOTHING
 * ELSE, and that a licence which requires attribution keeps it.
 */

const ROOT = new URL('../..', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, ROOT), 'utf8')

/**
 * The CSS with its comments removed — what the browser is told, not what the
 * file explains, the same precaution `design-primitives.spec.ts` takes and for
 * the same reason: main.css is more prose than declaration, and a property
 * named in a comment to say why it is NOT written is the first thing a regex
 * over the raw file finds. This one caught it on its first run.
 */
const css = read('app/assets/css/main.css').replace(/\/\*[\s\S]*?\*\//g, '')

/** The `.readable` block, on its own. */
const readable = css.slice(css.indexOf('  .readable {'), css.indexOf('}', css.indexOf('  .readable {')))

describe('the setting a person chose', () => {
  it.each([
    ['no cookie', null, ''],
    ['pixel', 'pixel', ''],
    ['readable', 'readable', 'readable'],
  ] as const)('%s -> class="%s"', (_label, cookie, expected) => {
    expect(resolveFontClass(cookie)).toBe(expected)
  })

  // A cookie can be edited from the console: its value must never end up in
  // the `class` attribute as-is.
  it.each(['nonsense', '', 'lisible', 'PIXEL', '<script>x</script>', 42, null, undefined, {}])(
    'an unreadable cookie (%o) falls back to the pixel face silently',
    (cookie) => {
      expect(resolveFontClass(cookie)).toBe('')
    },
  )

  it('accepts the two values and nothing else', () => {
    expect(isFontChoice('pixel')).toBe(true)
    expect(isFontChoice('readable')).toBe(true)
    expect(isFontChoice('auto')).toBe(false)
  })
})

describe('what the readable state swaps', () => {
  it('swaps BOTH faces, not just the one that carries paragraphs', () => {
    /*
     * `--font-mono` carries the counters, the phases and every uppercase
     * micro-label. Left on the pixel face, someone who turned the pixel face
     * off would still be reading pixels on a third of the screen — and would
     * reasonably conclude the setting is broken.
     */
    expect(readable).toContain('--font-sans: "Luciole"')
    expect(readable).toContain('--font-mono: "IBM Plex Mono"')
  })

  it('swaps NOTHING else, so both states share one layout', () => {
    /*
     * The invariant that makes the way out usable: every size, weight, spacing
     * and colour is shared. A `--text-*` or a `--tracking-*` redefined here
     * would give the readable state a geometry of its own, and a layout that
     * holds in one state and breaks in the other turns the escape hatch into a
     * trap — for the people least able to work around it.
     */
    const declarations = [...readable.matchAll(/^\s*(--[\w-]+):/gm)].map(match => match[1]!)
    expect(declarations).toEqual(['--font-sans', '--font-mono'])
  })
})

describe('the faces themselves', () => {
  it.each([
    'pixel-operator-400.woff2',
    'pixel-operator-700.woff2',
    'pixel-operator-mono-400.woff2',
    'pixel-operator-mono-700.woff2',
    'luciole-400.woff2',
    'luciole-700.woff2',
  ])('ships %s under public/fonts, because neither family is on Fontsource', (file) => {
    expect(existsSync(new URL(`public/fonts/${file}`, ROOT))).toBe(true)
    expect(css).toContain(`url("/fonts/${file}")`)
  })

  it('declares a real bold for the pixel face rather than faking one', () => {
    // The app writes `font-bold` on every heading, wordmark and score. Pixel
    // Operator has a drawn 700 — which is why nothing here needs
    // `font-synthesis`, and why a future swap to a single-weight pixel face
    // would need that decision made again, not inherited.
    expect(css).toMatch(/font-family: "Pixel Operator";[\s\S]*?font-weight: 700;/)
    expect(css).not.toContain('font-synthesis')
  })

  it('normalises the two x-heights, so the setting does not resize the app', () => {
    /*
     * The type scale was drawn against Space Grotesk (x-height 0.486 em).
     * Pixel Operator sits at 0.438 and Luciole at 0.545, so without this the
     * pixel face reads 10% small, the readable one 12% large, and switching
     * between them changes the apparent size of every screen.
     *
     * Pinned on `body` and nowhere else on purpose: one declaration covers both
     * states, where a per-state value would put the two faces back on different
     * scales — the very thing the `.readable` block above refuses to do.
     */
    expect(css).toContain('font-size-adjust: 0.486')
    expect(readable).not.toContain('font-size-adjust')
  })

  it('credits Luciole, because its licence requires it', () => {
    // CC BY 4.0: attribution is a condition of use, not a courtesy. Removing
    // this from the README is a licence breach rather than a tidy-up, so it is
    // pinned here where a tidy-up would turn red.
    const readme = read('README.md')
    expect(readme).toContain('Luciole')
    expect(readme).toContain('Laurent Bourcellier & Jonathan Perez')
    expect(readme).toContain('creativecommons.org/licenses/by/4.0/')
  })
})
