import { createHmac } from 'node:crypto'

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

/** A subkey, so the session secret is not used raw for a second purpose. */
function key(secret: string): Buffer {
  return createHmac('sha256', secret).update('perquiz:guess-room-token').digest()
}

/** Stable for one viewer, meaningless to anyone else. */
export function roomToken(viewerId: number, roomUserId: number, secret: string): string {
  return createHmac('sha256', key(secret))
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
