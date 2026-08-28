import { createHmac } from 'node:crypto'

/**
 * Deriving a key from the session password, one purpose at a time.
 *
 * The rule was set in M4 (SPEC §9) and is now kept in three places: the session
 * password is never used raw for a second job. Each purpose takes an HMAC of it
 * under its own label, so a value produced for one cannot be computed from
 * another — a room handle cannot be turned into a suspect ranking, and neither
 * can be turned back into the password.
 *
 * The labels live here rather than at each call site because they ARE the
 * separation: two purposes sharing a string share a key, silently and with no
 * symptom. A registry is what makes a collision something you have to write on
 * purpose.
 *
 * Their exact values are load-bearing. A room handle is short-lived — re-derived
 * on every read of the sheet — but changing its label mid-party regenerates
 * every handle at once and breaks a `/guess/<token>` URL somebody already has
 * open. Renaming a label is a data change wearing a refactor's clothes.
 */
export const SUBKEYS = {
  /** The opaque, per-viewer handle a room travels as (server/utils/guessing.ts). */
  guessRoomToken: 'perquiz:guess-room-token',
  /** The shuffle the moderation grid is dealt in (server/utils/admin.ts). */
  moderationOrder: 'perquiz:moderation-order',
  /** The ranking that picks a room's five decoys (server/utils/guessing.ts). */
  guessSuspects: 'perquiz:guess-suspects',
} as const

export type SubkeyLabel = typeof SUBKEYS[keyof typeof SUBKEYS]

/**
 * Not for the reveal seed. That one is already its own persisted secret, and
 * what it hashes (`room:<id>`) is the data being ranked rather than a purpose —
 * folding it in here would cross two sources of key and change what the code
 * means.
 */
export function subkey(secret: string, label: SubkeyLabel): Buffer {
  return createHmac('sha256', secret).update(label).digest()
}

/**
 * The one read of the session password by anything that derives from it.
 *
 * Three call sites had it inline — `sheet.ts` behind a local helper of the same
 * shape, `admin.ts` and `results.ts` raw — which is three places to visit if
 * the password ever comes from somewhere else, and three chances to miss one.
 * It sits here because everything that reads it reads it to feed `subkey()`.
 *
 * `usePerquizSession` is deliberately NOT a caller: it uses the password AS the
 * cookie's seal rather than as key material, and it has its own length check to
 * fail closed on. Routing it through here would merge two different jobs behind
 * one name.
 */
export function sessionSecret(): string {
  return useRuntimeConfig().sessionPassword
}
