import { describe, expect, it } from 'vitest'
import { resolveThemeClass, themeOverride } from '../../shared/utils/theme'

/**
 * Theme resolution: which class ends up on `<html>`.
 *
 * Three inputs (the cookie, the `theme` a page declares, the path) for three
 * possible outputs. It is very little code, but it is where the "/reveal stays
 * dark whatever the setting" invariant lives — and a regression there would be
 * invisible to the eye, the theme staying broadly correct.
 */

const NO_META = undefined
const HOME = '/'

describe('the person\'s choice, with no page forcing anything', () => {
  it.each([
    ['no cookie', null, ''],
    ['auto', 'auto', ''],
    ['light', 'light', 'light'],
    ['dark', 'dark', 'dark'],
  ] as const)('%s -> class="%s"', (_label, cookie, expected) => {
    expect(resolveThemeClass({ cookie, meta: NO_META, path: HOME })).toBe(expected)
  })

  // A cookie can be edited from the console: its value must never end up in
  // the `class` attribute as-is.
  it.each(['nonsense', '', 'clair', 'sombre', '<script>x</script>', 42, null, undefined, {}])(
    'an unreadable cookie (%o) falls back to auto silently',
    (cookie) => {
      expect(resolveThemeClass({ cookie, meta: NO_META, path: HOME })).toBe('')
    },
  )
})

describe('a page forcing its theme wins over the setting', () => {
  it.each([
    ['dark', 'light', 'dark'],
    ['dark', 'auto', 'dark'],
    ['dark', null, 'dark'],
    ['light', 'dark', 'light'],
    ['light', 'auto', 'light'],
  ] as const)('page=%s, cookie=%s -> class="%s"', (meta, cookie, expected) => {
    expect(resolveThemeClass({ cookie, meta, path: HOME })).toBe(expected)
  })

  it.each(['auto', 'nonsense', '', 'sombre', 42, {}])(
    'an unreadable page `theme` (%o) is ignored, the setting takes over again',
    (meta) => {
      expect(resolveThemeClass({ cookie: 'light', meta, path: HOME })).toBe('light')
    },
  )
})

describe('the reveal show stays dark even without a declaration', () => {
  // Safety net: if M7 forgets its `definePageMeta`, these paths stay dark.
  it.each(['/reveal', '/reveal/3', '/reveal/12/podium'])(
    '%s is dark despite a light cookie',
    (path) => {
      expect(resolveThemeClass({ cookie: 'light', meta: NO_META, path })).toBe('dark')
    },
  )

  // The net matches path segments, not string prefixes: a future page whose
  // name merely starts with "reveal" must not turn dark by accident.
  it.each(['/revelation', '/reveals', '/reveal-show', '/results', '/'])(
    '%s is not affected',
    (path) => {
      expect(resolveThemeClass({ cookie: 'light', meta: NO_META, path })).toBe('light')
    },
  )

  it('a page can also contradict the net and go light again', () => {
    expect(themeOverride('light', '/reveal')).toBe('light')
    expect(resolveThemeClass({ cookie: 'dark', meta: 'light', path: '/reveal' })).toBe('light')
  })
})
