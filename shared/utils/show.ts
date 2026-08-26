/**
 * Where the reveal show is standing, from a single number in the URL.
 *
 * The show is driven live in front of an audience, so a laptop that goes to
 * sleep, a browser that reloads or a second screen opened by mistake must all
 * resume on the same slide. That is only true if the position is a value, not
 * a state — hence one integer, in the path, and this pure function to say what
 * it means (PAGES `/reveal`).
 */

export interface ShowLayout {
  rooms: number
  /** Podium steps actually climbed: a tie for second leaves no third. */
  podiumSteps: number
}

export type Scene
  = | { kind: 'room', room: number, step: 1 | 2 | 3 }
    | { kind: 'podium', step: number }
    | { kind: 'standings' }

/** Three steps per room, then the podium, then the whole ranking. */
const STEPS_PER_ROOM = 3

export function totalScenes(layout: ShowLayout): number {
  return layout.rooms * STEPS_PER_ROOM + layout.podiumSteps + 1
}

export function clampCursor(cursor: number, layout: ShowLayout): number {
  if (!Number.isFinite(cursor)) return 0
  return Math.max(0, Math.min(Math.floor(cursor), totalScenes(layout) - 1))
}

/**
 * The slide a cursor lands on.
 *
 * Out-of-range values are clamped rather than refused: a mistyped URL during a
 * live show should put the presenter back on a slide, not on an error.
 */
export function sceneAt(cursor: number, layout: ShowLayout): Scene {
  const at = clampCursor(cursor, layout)
  const rooms = layout.rooms * STEPS_PER_ROOM

  if (at < rooms) {
    return { kind: 'room', room: Math.floor(at / STEPS_PER_ROOM), step: (at % STEPS_PER_ROOM) + 1 as 1 | 2 | 3 }
  }

  const afterRooms = at - rooms
  return afterRooms < layout.podiumSteps
    ? { kind: 'podium', step: afterRooms }
    : { kind: 'standings' }
}

/** "1re", "2e", "3e" — the only two forms French needs. */
export function ordinal(rank: number): string {
  return rank === 1 ? '1re' : `${rank}e`
}
