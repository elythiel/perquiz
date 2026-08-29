import type { GamePhase } from './game'

/**
 * What `GET /api/guess` answers with: the guess sheet, as the browser sees it.
 *
 * On the boundary rather than beside the query that builds it. The route is a
 * contract between two halves of the app, and the half that reads it needs to
 * name the shape — `middleware/deck.ts` did, by importing out of
 * `server/utils/`, which worked only for as long as the import stayed
 * type-only (vikunja-108).
 */
export interface SheetRoom {
  /** Opaque, per-viewer. See server/utils/guessing.ts. */
  token: string
  photos: string[]
  /** The viewer's own answer: a participant id, or null. Their own to know. */
  guess: number | null
  /**
   * The names this room offers, in the same alphabetical order as
   * `participants` — never in the order they were derived in, which would put
   * the owner first.
   */
  suspects: number[]
}

export interface SheetParticipant {
  id: number
  displayName: string
}

export interface GuessSheet {
  phase: GamePhase
  rooms: SheetRoom[]
  participants: SheetParticipant[]
  answered: number
  total: number
}

/** What `PATCH /api/guess` answers with, once an answer is written. */
export interface SheetCounts {
  answered: number
  total: number
}
