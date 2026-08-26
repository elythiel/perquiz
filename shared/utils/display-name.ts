/**
 * The rules a display name obeys, shared by the two places that apply them.
 *
 * The server decides — it owns the uniqueness index and the JIT suffix — but
 * the rename form needs the same tidying to know whether anything actually
 * changed, and a second copy of "collapse the spaces, clamp to thirty" would
 * drift the day one of them is edited.
 */

/** PAGES `/login`: display names run from 2 to 30 characters. */
export const DISPLAY_NAME_MIN = 2
export const DISPLAY_NAME_MAX = 30

/** Collapses the whitespace a provider or a keyboard may have left in. */
export function tidyDisplayName(candidate: string, limit: number = DISPLAY_NAME_MAX): string {
  return candidate.replace(/\s+/gu, ' ').trim().slice(0, limit).trim()
}
