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
/**
 * The setting, read-only and SHARED — what every reader should call.
 *
 * `useCookie` returns a NEW ref on each call. Instances stay in step through a
 * `BroadcastChannel` per ref, which works and is fine for two readers; since
 * vikunja-96 every `<BaseIcon>` on the page is a reader, and a page carries
 * about thirty of them. Thirty refs, thirty channels and thirty parses of
 * `document.cookie` to answer one question is not a reactivity bug, it is a
 * design that invites one.
 *
 * `useState` is the project's answer to "many readers, one truth" (see
 * `STATE_KEYS`): the initialiser runs ONCE per request, so the cookie is read
 * once, and the value is serialised into the payload so the client hydrates
 * with what the server rendered. A hand-edited cookie is guarded here, exactly
 * as it was before — anything unreadable reads as `pixel` rather than showing
 * up as a third, nameless option in the control.
 */
export function useFontChoice() {
  return useState<FontChoice>(STATE_KEYS.fontChoice, () => {
    const cookie = useCookie<string | null>(COOKIE)
    return isFontChoice(cookie.value) ? cookie.value : 'pixel'
  })
}

/**
 * The setting, readable and WRITABLE — for the picker and for `app.vue`.
 *
 * This is the only place that touches the cookie ref, and therefore the only
 * place that pays for one. Setting writes both: the cookie, so the next request
 * is server-rendered correctly, and the shared state, so every reader on the
 * page follows in the same tick rather than whenever a broadcast lands.
 */
export function useFont() {
  const cookie = useCookie<string | null>(COOKIE, {
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  })

  const shared = useFontChoice()

  const choice = computed<FontChoice>({
    get: () => shared.value,
    set: (value) => {
      shared.value = value
      cookie.value = value
    },
  })

  const fontClass = computed(() => resolveFontClass(shared.value))

  return { choice, fontClass }
}
