// Relative, not `#shared/...`: this file is also compiled by the node project
// that covers tests/, where Nuxt's aliases do not exist.
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN, tidyDisplayName } from '../../shared/utils/display-name'

/**
 * Giving a first-login account a name nobody else has.
 *
 * The rules themselves live in shared/utils/display-name.ts, because the
 * rename form applies the same tidying and a second copy of "collapse the
 * spaces, clamp to thirty" would drift. What is here is the part that needs
 * the database: asking whether a name is already taken.
 */

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
