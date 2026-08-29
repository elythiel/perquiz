/**
 * The theme setting a person chose. `auto` follows the operating system.
 * Not a game rule, so docs/SPEC.md says nothing about it — it is a display
 * preference.
 */
export type ThemeChoice = 'auto' | 'light' | 'dark'

/**
 * The class set on `<html>`, and the only thing the rest of the app ever sees
 * of the theme. The empty string means `auto`: no class, and the media query
 * in `main.css` decides — it alone knows `prefers-color-scheme`.
 */
export type ThemeClass = '' | 'light' | 'dark'
