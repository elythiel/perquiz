import type { FontChoice } from '../types/font'

/**
 * The one place that knows there are two icon sets.
 *
 * Every icon in the app is named by what it MEANS — `trash`, `logout`,
 * `projector` — and this table says which glyph draws that meaning in each set.
 * `<BaseIcon>` reads it at render time; `nuxt.config.ts` reads it at build time
 * to declare what has to be bundled. Nothing else should ever spell a
 * collection prefix.
 *
 * Here rather than beside the component, and pure for the same reason
 * `resolveFontClass` is: `nuxt.config.ts` imports it by relative path, which it
 * cannot do with anything that reaches for a Nuxt alias or a composable — and
 * it makes the whole thing testable without booting Nuxt.
 *
 * THE NAMES DIFFER MORE THAN THEY LOOK. Eighteen of the twenty-three match,
 * and the five that do not are not synonyms a fallback could guess: lucide has
 * no `article`, no `checklist`, no `close` and no `logout` at all. Which is
 * also the answer to "why a table rather than a prefix swap" — there is no set
 * on Iconify carrying pixelarticons' names as they stand.
 */
export const ICONS = {
  'archive': { pixel: 'archive', readable: 'archive' },
  'arrow-left': { pixel: 'arrow-left', readable: 'arrow-left' },
  /** The guess sheet. `newspaper` is lucide's nearest: a written page. */
  'article': { pixel: 'article', readable: 'newspaper' },
  'check': { pixel: 'check', readable: 'check' },
  'checklist': { pixel: 'checklist', readable: 'list-checks' },
  'chevron-down': { pixel: 'chevron-down', readable: 'chevron-down' },
  'chevron-left': { pixel: 'chevron-left', readable: 'chevron-left' },
  'chevron-right': { pixel: 'chevron-right', readable: 'chevron-right' },
  /** lucide renamed its question mark to `circle-help` — same glyph, new name. */
  'circle-question': { pixel: 'circle-question', readable: 'circle-help' },
  'close': { pixel: 'close', readable: 'x' },
  'gamepad': { pixel: 'gamepad', readable: 'gamepad' },
  'image': { pixel: 'image', readable: 'image' },
  'laptop': { pixel: 'laptop', readable: 'laptop' },
  'lock': { pixel: 'lock', readable: 'lock' },
  'logout': { pixel: 'logout', readable: 'log-out' },
  'moon': { pixel: 'moon', readable: 'moon' },
  'play': { pixel: 'play', readable: 'play' },
  'plus': { pixel: 'plus', readable: 'plus' },
  'projector': { pixel: 'projector', readable: 'projector' },
  'search': { pixel: 'search', readable: 'search' },
  'sun': { pixel: 'sun', readable: 'sun' },
  'trash': { pixel: 'trash', readable: 'trash' },
  'trophy': { pixel: 'trophy', readable: 'trophy' },
} as const satisfies Record<string, Record<FontChoice, string>>

/** What a caller asks for: a meaning, never a glyph. */
export type IconName = keyof typeof ICONS

/** The collection each setting draws from. Prefixes live here and nowhere else. */
export const ICON_SETS = { pixel: 'pixelarticons', readable: 'lucide' } as const satisfies Record<FontChoice, string>

/** `pixelarticons:trash`, `lucide:log-out` — the string `<Icon>` wants. */
export function iconFor(name: IconName, choice: FontChoice): string {
  return `${ICON_SETS[choice]}:${ICONS[name][choice]}`
}

/**
 * Every icon this app can render, both sets, for `clientBundle.icons`.
 *
 * DERIVED AND NEVER TYPED OUT, which is the whole reason this function exists.
 * `clientBundle.scan` collects icon names written LITERALLY in the source, and
 * `<BaseIcon>` builds its name at runtime — so the scan sees nothing, and with
 * `provider: 'none'` and `fallbackToApi: false` a name that missed the bundle
 * is not a request to a third party, it is a hole: no glyph, no build error,
 * no runtime warning. A hand-copied list would drift from this table on the
 * first icon anybody adds, and drift silently.
 */
export function iconBundle(): string[] {
  return Object.keys(ICONS).flatMap(name =>
    (Object.keys(ICON_SETS) as FontChoice[]).map(choice => iconFor(name as IconName, choice)))
}
