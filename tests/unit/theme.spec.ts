import { describe, expect, it } from 'vitest'
import { resolveThemeClass } from '../../shared/utils/theme'

/**
 * Theme resolution: which class ends up on `<html>`.
 *
 * One input, the cookie, for three possible outputs. It is very little code,
 * but it is still worth pinning for the reason `font.spec.ts` gives about its
 * own: the failure mode is silent. A cookie that stopped resolving would leave
 * everyone on `auto` with a control that appears to do nothing.
 *
 * It took two more inputs until vikunja-107 — the theme a page forced on
 * itself, and the path — and two thirds of this file exercised a branch no
 * page ever reached. What is left is what the app actually runs.
 */

describe('the setting a person chose', () => {
  it.each([
    ['no cookie', null, ''],
    ['auto', 'auto', ''],
    ['light', 'light', 'light'],
    ['dark', 'dark', 'dark'],
  ] as const)('%s -> class="%s"', (_label, cookie, expected) => {
    expect(resolveThemeClass(cookie)).toBe(expected)
  })

  // A cookie can be edited from the console: its value must never end up in
  // the `class` attribute as-is.
  it.each(['nonsense', '', 'clair', 'sombre', '<script>x</script>', 42, null, undefined, {}])(
    'an unreadable cookie (%o) falls back to auto silently',
    (cookie) => {
      expect(resolveThemeClass(cookie)).toBe('')
    },
  )
})
