/**
 * What the two button components share, and what they deliberately do not.
 *
 * The survey behind this file found something worth writing down: the button
 * GEOMETRIES in this app are nearly all unique — seven buttons, six paddings,
 * each tuned to what it stands next to. What is copied from screen to screen
 * is the TONE: `bg-torch text-on-torch` five times, `border-edge-strong
 * text-text-soft` four. So the components own the tone, the icon slot, the
 * link-or-button question and the disabled state, and `size` is a short list
 * of the geometries the screens actually use rather than a scale invented for
 * the occasion.
 *
 * No focus ring here: `@layer base` in main.css already rings every
 * `:focus-visible` element, and both `<button>` and `<a>` are among them.
 */

/**
 * The four geometries in use, each named for where it earns its keep.
 *
 * No radius any more: the corners are cut by the frame, three pixels at a
 * time, and a `rounded-*` underneath one would only fight it. The paddings are
 * unchanged, so each button keeps the size it was tuned to next to whatever it
 * stands beside — the frame eats into it from the inside, equally everywhere.
 */
export const BUTTON_SIZES = {
  /** Dialog actions, side by side under a short question. */
  sm: 'px-3 py-1.5 text-base',
  /** Beside a text input, whose height it has to match. */
  md: 'px-3 py-2 text-base',
  /** A page's actions, thumb-sized. */
  lg: 'px-5 py-4 text-base',
  /** The one call to action of a screen: the same box, a bigger voice. */
  xl: 'px-5 py-4 text-lg',
} as const

export type ButtonSize = keyof typeof BUTTON_SIZES

/** Layout is shared; the icon sits BESIDE the label, which is why there is a gap. */
export const BUTTON_LAYOUT = 'flex items-center justify-center gap-2'

/**
 * `:enabled` matches form controls and nothing else, so a link styled with
 * `enabled:hover:…` would quietly have no hover at all. The two elements
 * therefore get two different state strings, and neither component may write
 * one that assumes the other.
 */
export function buttonStates(isLink: boolean, hover: string): string {
  return isLink ? hover : `enabled:${hover} disabled:opacity-40`
}
