import type { ThemeChoice, ThemeClass, ThemeOverride } from '../types/theme'

const CHOICES: readonly ThemeChoice[] = ['auto', 'light', 'dark']
const OVERRIDES: readonly ThemeOverride[] = ['light', 'dark']

/**
 * Paths pinned to the dark theme whatever the person chose.
 *
 * Empty, and deliberately still here. M0 put `/reveal` in this list on the
 * assumption that a projected page must be dark; M7 built the show and the
 * decision went the other way — the reveal follows the setting like every
 * other screen, and is built from tokens so it holds up in both. Pinning a
 * page is still one `definePageMeta({ theme })` away, and this net stays for
 * the page that turns out to need it without remembering to declare it.
 */
export const ALWAYS_DARK: readonly string[] = []

/** A hand-edited cookie must never end up in the `class` attribute as-is. */
export function isThemeChoice(value: unknown): value is ThemeChoice {
  return CHOICES.includes(value as ThemeChoice)
}

export function isThemeOverride(value: unknown): value is ThemeOverride {
  return OVERRIDES.includes(value as ThemeOverride)
}

/** The theme a page forces, or `undefined` if it defers to the setting. */
export function themeOverride(meta: unknown, path: string): ThemeOverride | undefined {
  if (isThemeOverride(meta)) return meta

  const projected = ALWAYS_DARK.some(
    base => path === base || path.startsWith(`${base}/`),
  )

  return projected ? 'dark' : undefined
}

/**
 * The class to set on `<html>`.
 *
 * Precedence: what the page forces, then what the person chose. `auto` sets
 * nothing — the server never receives `prefers-color-scheme`, so the media
 * query decides, in the browser and before the first paint.
 *
 * Deliberately pure: this is the "/reveal stays dark no matter what" invariant,
 * and it can be tested without booting Nuxt (tests/unit/theme.spec.ts).
 */
export function resolveThemeClass(input: {
  cookie: unknown
  meta: unknown
  path: string
}): ThemeClass {
  const override = themeOverride(input.meta, input.path)
  const choice = isThemeChoice(input.cookie) ? input.cookie : 'auto'

  switch (override ?? choice) {
    case 'light': return 'light'
    case 'dark': return 'dark'
    default: return ''
  }
}
