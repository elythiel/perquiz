import type { FontChoice } from '#shared/types/font'
import { isFontChoice, resolveFontClass } from '#shared/utils/font'

/**
 * A cookie and not `localStorage`, for the reason the theme gives at length in
 * `useTheme.ts`: Perquiz renders on the server, and the server has to know the
 * setting to write it into the first byte. With `localStorage` the page would
 * paint in pixels and then swap — and a face that appears and disappears on
 * every load is worse than no setting at all, particularly for the people this
 * setting exists for.
 */
const COOKIE = 'perquiz-font'

/** One year, like the theme: a typeface choice has no reason to expire sooner. */
const MAX_AGE = 60 * 60 * 24 * 365

/**
 * The typeface setting.
 *
 * A reactive wrapper and nothing more: the decision is `resolveFontClass`
 * (pure, tested), and the faces themselves live in `app/assets/css/main.css`
 * under `--font-sans` and `--font-mono`. No component needs to know which face
 * is active — that is the point of routing everything through two tokens.
 *
 * The cookie is written by `FontPicker`, which sits next to `ThemePicker` in
 * « Ma pièce ».
 */
export function useFont() {
  const cookie = useCookie<string | null>(COOKIE, {
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  })

  /**
   * The setting, readable and writable.
   *
   * A cookie can be hand-edited, so reading it goes through the same guard as
   * the class does: anything unreadable reads as `pixel` rather than appearing
   * in the control as a third, nameless option.
   */
  const choice = computed<FontChoice>({
    get: () => isFontChoice(cookie.value) ? cookie.value : 'pixel',
    set: (value) => {
      cookie.value = value
    },
  })

  const fontClass = computed(() => resolveFontClass(cookie.value))

  return { choice, fontClass }
}
