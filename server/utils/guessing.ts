import { SUSPECTS_PER_ROOM } from '#shared/utils/guessing'
import { createHmac } from 'node:crypto'
import { SUBKEYS, subkey } from './subkey'

/**
 * Handing someone a guess sheet without handing them the answers.
 *
 * The room → owner mapping is *the* secret of this game (SPEC §9), and the
 * obvious way to build this endpoint gives it away: a room identified by its
 * owner's user id, next to a list of participants carrying those same ids, is
 * a payload where every answer can be read straight out of devtools.
 *
 * So a room travels as an opaque handle — an HMAC of the owner's id, keyed by
 * a server secret AND by who is looking. Two consequences worth having: the
 * handle cannot be compared with anything else in the payload, and two players
 * comparing screens see different handles for the same room, so they cannot
 * even pool what they know.
 *
 * The handles are also what the deck is ordered by, which shuffles it per
 * viewer for free: position in the list stops correlating with user id.
 */

/** Stable for one viewer, meaningless to anyone else. */
export function roomToken(viewerId: number, roomUserId: number, secret: string): string {
  return createHmac('sha256', subkey(secret, SUBKEYS.guessRoomToken))
    .update(`${viewerId}:${roomUserId}`)
    .digest('hex')
    .slice(0, 32)
}

/**
 * The room a handle stands for, or `undefined`.
 *
 * Recomputed over the rooms this viewer is allowed to answer, rather than
 * reversed — an HMAC does not reverse, and the candidate list is a dozen rows.
 * A handle for a room that has left play, or one minted for somebody else,
 * simply matches nothing.
 */
export function resolveRoomToken(
  token: unknown,
  viewerId: number,
  candidates: readonly number[],
  secret: string,
): number | undefined {
  if (typeof token !== 'string') return undefined
  return candidates.find(roomUserId => roomToken(viewerId, roomUserId, secret) === token)
}

/**
 * The order the deck is dealt in: by handle, which is a per-viewer shuffle.
 *
 * Without it the deck would come out in `users.id` order, and position in the
 * list would line up with position in the participant list — the mapping
 * again, spelled differently.
 */
export function deckOrder(
  roomUserIds: readonly number[],
  viewerId: number,
  secret: string,
): number[] {
  return [...roomUserIds].sort((left, right) =>
    roomToken(viewerId, left, secret).localeCompare(roomToken(viewerId, right, secret)))
}

/**
 * The short list of names a room offers: its owner, and five decoys.
 *
 * Derived from THE ROOM and never from the reader — the opposite of
 * `roomToken()` above, and the one thing to get right in this file.
 *
 * Per-reader decoys would give the answer away. Photograph filenames are
 * global: `/api/photos/<name>/thumb` is the same string on everybody's screen,
 * so two players can line up the same room across two sheets even though their
 * handles differ — by the filename, or just by looking at the picture. If each
 * of them had their own five decoys, the intersection of the two lists would
 * be the owner. So the signature takes no viewer, and a developer copying the
 * function above will notice the difference before adding one by reflex.
 *
 * It also has to hold still while the party grows. Two readings of one room at
 * two moments intersect, and both contain the owner; a list that changed in
 * between would point at him. Hence a derived order rather than a draw: rank
 * every candidate by `HMAC(subkey, "room:candidate")` and keep the five
 * smallest. The property that saves it is that being among the five smallest
 * of a set implies being among the five smallest of any subset containing you
 * — so a new sign-up can only ever displace the fifth, and every past list
 * contains the present one. The intersection never drops below six. A table in
 * the database would do the same work, with a migration and an invariant to
 * hold; this needs neither.
 *
 * Returns a `Set`, not an array: no derivation order can then escape by
 * accident, and the caller has to choose an order of its own.
 */
export function suspectsFor(
  roomUserId: number,
  roster: readonly number[],
  secret: string,
): Set<number> {
  const rank = (candidate: number) =>
    createHmac('sha256', subkey(secret, SUBKEYS.guessSuspects)).update(`${roomUserId}:${candidate}`).digest('hex')

  const decoys = roster
    .filter(candidate => candidate !== roomUserId)
    .sort((left, right) => rank(left).localeCompare(rank(right)))
    .slice(0, SUSPECTS_PER_ROOM - 1)

  return new Set([roomUserId, ...decoys])
}
