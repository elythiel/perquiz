/**
 * The name a player is known by, derived once at their first login.
 *
 * It is the name everyone else picks from when guessing, so it has to be
 * unique — and the provider knows nothing about that. Whatever the token
 * suggested gets tidied here, then given a suffix until it is free. It is a
 * *starting point*: the player renames themselves in « Ma pièce » (M3).
 */

/** PAGES `/login`: display names run from 2 to 30 characters. */
export const DISPLAY_NAME_MIN = 2
export const DISPLAY_NAME_MAX = 30

/** Collapses the whitespace a provider may have left in, and clamps the length. */
export function tidyDisplayName(candidate: string, limit = DISPLAY_NAME_MAX): string {
  return candidate.replace(/\s+/gu, ' ').trim().slice(0, limit).trim()
}

/**
 * `desired`, or the first free `desired 2`, `desired 3`… variant.
 *
 * The base is shortened, not the suffix, so the result always fits the 30
 * characters the rename form will later enforce — a JIT name the player cannot
 * legally retype would be an odd thing to hand them.
 */
export function uniqueDisplayName(
  desired: string,
  isTaken: (name: string) => boolean,
  limit = DISPLAY_NAME_MAX,
): string {
  const base = tidyDisplayName(desired, limit)
  if (base.length < DISPLAY_NAME_MIN) {
    throw new Error(`display name "${desired}" is too short to build on`)
  }
  if (!isTaken(base)) return base

  for (let counter = 2; counter < 10_000; counter++) {
    const suffix = ` ${counter}`
    const candidate = `${tidyDisplayName(base, limit - suffix.length)}${suffix}`
    if (!isTaken(candidate)) return candidate
  }

  throw new Error(`no free display name left around "${base}"`)
}
