/**
 * The game's global phase, driven by the admin (docs/SPEC.md §2).
 * - `open`     : people upload photos and fill in their guess sheet
 * - `locked`   : everything is frozen, waiting for the reveal show
 * - `revealed` : scores and leaderboard visible to everyone
 */
export type GamePhase = 'open' | 'locked' | 'revealed'
