/**
 * The game's global phase, driven by the admin (docs/SPEC.md §2).
 * - `preparation`: people fill their room; the guess sheet is not open yet
 * - `open`     : people upload photos and fill in their guess sheet
 * - `locked`   : everything is frozen, waiting for the reveal show
 * - `revealed` : scores and leaderboard visible to everyone
 */
export type GamePhase = 'preparation' | 'open' | 'locked' | 'revealed'
