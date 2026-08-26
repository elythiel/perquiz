import type { ThemeChoice, ThemeOverride } from '#shared/types/theme'
import { isThemeChoice, resolveThemeClass } from '#shared/utils/theme'

/**
 * The theme a page forces, whatever the person's setting. `/reveal` is
 * video-projected in a dark room, so it will declare
 * `definePageMeta({ theme: 'dark' })`.
 *
 * Both augmentations are needed, for different reasons: `PageMeta` constrains
 * the write side (`definePageMeta`), which would otherwise accept anything
 * thanks to its `[key: string]: unknown` index signature; `RouteMeta` types the
 * read side (`route.meta.theme`). Nuxt augments `PageMeta` from `nuxt/app`
 * itself — see `.nuxt/types/middleware.d.ts`.
 */
declare module 'nuxt/app' {
  interface PageMeta {
    theme?: ThemeOverride
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    theme?: ThemeOverride
  }
}

/**
 * A cookie and not `localStorage`: Perquiz renders on the server, and the
 * server has to know the theme to write it into the first byte. With
 * `localStorage` we would need a blocking inline `<script>` in the `<head>` to
 * set the class before the first paint (what `@nuxtjs/color-mode` does) — one
 * more script to allow in the CSP that M9 will put in place.
 */
const COOKIE = 'perquiz-theme'

/** One year: a theme choice has no reason to expire sooner. */
const MAX_AGE = 60 * 60 * 24 * 365

/** The browser chrome colour: each theme's `night` background. */
const CHROME = {
  light: '#f1f3f8',
  dark: '#0a0b12',
} as const

/** One `theme-color` value and the media query it applies under. */
export interface ChromeColor {
  media: string
  content: string
}

/**
 * The interface theme.
 *
 * This composable is only a reactive wrapper: the whole decision lives in
 * `resolveThemeClass` (pure, tested), and the values live in
 * `app/assets/css/main.css` under the same token names. No component needs to
 * know which theme is active.
 *
 * The cookie is written by `ThemePicker`, which sits next to the display name
 * in « Ma pièce ». Writing it is all a picker has to do: the class on `<html>`,
 * the browser chrome colour and the server-rendered first byte all follow from
 * the same computed values.
 */
export function useTheme() {
  const route = useRoute()

  const cookie = useCookie<string | null>(COOKIE, {
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  })

  /**
   * The setting, readable and writable.
   *
   * A cookie can be hand-edited, so reading it goes through the same guard as
   * the class does and an unreadable value reads as `auto` rather than
   * appearing in the control as a fourth, nameless option.
   */
  const choice = computed<ThemeChoice>({
    get: () => isThemeChoice(cookie.value) ? cookie.value : 'auto',
    set: (value) => {
      cookie.value = value
    },
  })

  const themeClass = computed(() => resolveThemeClass({
    cookie: cookie.value,
    meta: route.meta.theme,
    path: route.path,
  }))

  /**
   * `theme-color` has to swap with no JS and no flash. On `auto` we emit both
   * values, each under its media query, and let the browser pick. Once the
   * theme is resolved, the winning value moves to `all` and the other to
   * `not all`, which never matches.
   */
  const chrome = computed<ChromeColor[]>(() => {
    if (themeClass.value === 'light') {
      return [
        { media: 'all', content: CHROME.light },
        { media: 'not all', content: CHROME.dark },
      ]
    }
    if (themeClass.value === 'dark') {
      return [
        { media: 'not all', content: CHROME.light },
        { media: 'all', content: CHROME.dark },
      ]
    }
    return [
      { media: '(prefers-color-scheme: light)', content: CHROME.light },
      { media: '(prefers-color-scheme: dark)', content: CHROME.dark },
    ]
  })

  return { choice, themeClass, chrome }
}
