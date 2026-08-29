import type { Standing } from '../utils/scoring'

/**
 * What `GET /api/reveal` answers with: the projected show, room by room.
 *
 * The one payload in this app that carries the room → owner mapping on
 * purpose. It is on the boundary for the same reason as the guess sheet — the
 * page that draws it has to be able to name it — and for one more: a shape
 * this sensitive is easier to audit where both halves can see it.
 */
export interface RevealVote {
  displayName: string
  count: number
  /** The room's owner: the bar the reveal lands on. */
  isOwner: boolean
}

export interface RevealRoom {
  owner: { id: number, displayName: string }
  photos: string[]
  /** Every name that got a vote, most voted first. */
  votes: RevealVote[]
  /** Players who left this room blank — part of the story (PAGES `/reveal`). */
  noAnswer: number
}

export interface RevealShow {
  rooms: RevealRoom[]
  standings: Standing[]
}
