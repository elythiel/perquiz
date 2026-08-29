import type { ThemeChoice, ThemeClass } from '../types/theme'

const CHOICES: readonly ThemeChoice[] = ['auto', 'light', 'dark']

/** A hand-edited cookie must never end up in the `class` attribute as-is. */
export function isThemeChoice(value: unknown): value is ThemeChoice {
  return CHOICES.includes(value as ThemeChoice)
}

/**
 * The class to set on `<html>`.
 *
 * The setting decides, and nothing else does. `auto` sets nothing — the server
 * never receives `prefers-color-scheme`, so the media query decides, in the
 * browser and before the first paint.
 *
 * A page used to be able to force its own theme, through
 * `definePageMeta({ theme })` and a list of pinned paths. M0 pinned `/reveal`
 * on the assumption that a projected page must be dark; M7 built that show and
 * decided it follows the setting like every other screen. The list stayed
 * empty and no page ever declared a theme, so vikunja-107 took the mechanism
 * out rather than keep a branch the data never reaches. Bringing it back is
 * one `definePageMeta` plus the pair of augmentations `access.global.ts` still
 * demonstrates, on a route meta that is genuinely used.
 *
 * Deliberately pure, and for the same reason as `resolveFontClass`: this is
 * where "an unreadable cookie falls back to the default" lives, and it can be
 * tested without booting Nuxt (tests/unit/theme.spec.ts).
 */
export function resolveThemeClass(cookie: unknown): ThemeClass {
  switch (isThemeChoice(cookie) ? cookie : 'auto') {
    case 'light': return 'light'
    case 'dark': return 'dark'
    default: return ''
  }
}
