/**
 * The typeface a person reads the game in. `pixel` is the art direction;
 * `readable` is the way out of it.
 *
 * Not a game rule, so docs/SPEC.md says nothing about it — a display
 * preference, like the theme it sits next to (shared/types/theme.ts).
 *
 * Two values and not three: there is no `auto`, because nothing in the browser
 * says "this person would rather not read pixels". `prefers-reduced-motion` has
 * an equivalent for movement and `prefers-contrast` for contrast; type has
 * none, so the choice is explicit or it is the default.
 */
export type FontChoice = 'pixel' | 'readable'

/**
 * The class set on `<html>`, and the only thing the rest of the app sees of the
 * setting. The empty string means `pixel`: no class, and the tokens declared in
 * main.css apply as they are — the pixel face is the ground state, the readable
 * one is the override.
 */
export type FontClass = '' | 'readable'
