import type { FontChoice, FontClass } from '../types/font'

const CHOICES: readonly FontChoice[] = ['pixel', 'readable']

/** A hand-edited cookie must never end up in the `class` attribute as-is. */
export function isFontChoice(value: unknown): value is FontChoice {
  return CHOICES.includes(value as FontChoice)
}

/**
 * The class to set on `<html>`.
 *
 * Deliberately pure, and for the same reason as `resolveThemeClass`: this is
 * where "an unreadable cookie falls back to the default" lives, and it can be
 * tested without booting Nuxt (tests/unit/font.spec.ts).
 *
 * No page override here, and there is no room for one: a page that forced the
 * pixel face on someone who turned it off would be taking back the one setting
 * whose whole purpose is that they can read the screen. The theme had such a
 * mechanism, unused, until vikunja-107 removed it; this one was never to have
 * it in the first place, which is a different argument and worth keeping.
 */
export function resolveFontClass(cookie: unknown): FontClass {
  return isFontChoice(cookie) && cookie === 'readable' ? 'readable' : ''
}
