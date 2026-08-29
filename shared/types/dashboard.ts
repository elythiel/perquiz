import type { GamePhase } from './game'

/**
 * What `GET /api/dashboard` answers with.
 *
 * No score and no rank: SPEC §5 keeps both out of every response until the
 * game is `revealed`, and this shape is where that promise is legible.
 */
export interface DashboardState {
  phase: GamePhase
  /** My own photos, in order — the thumbnails on the room panel. */
  myPhotos: string[]
  /** Rooms with at least one photo, mine included: the state of the game. */
  roomsInPlay: number
  participants: number
  /** Rooms I can answer, and how many I have. */
  answered: number
  total: number
  /**
   * Rooms that came into play since I last looked, mine excluded.
   *
   * Zero on a first visit, which reads as "nothing new" rather than "all of
   * it is new" — the second would be true and useless.
   */
  newRooms: number
}
