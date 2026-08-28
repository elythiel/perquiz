import type { GamePhase } from '#shared/types/game'

/**
 * The names the server-rendered payload and the client agree on.
 *
 * `useState(key)` is the seam between `plugins/session.server.ts`, which fills
 * these on the server, and the composables that read them back after
 * hydration. The agreement is a string and nothing else: mistype one on either
 * side and there is no error, no warning and no type failure — just a second,
 * empty piece of state, and an interface that quietly knows less than the
 * server did. That is the one divergence in this codebase that cannot announce
 * itself, which is why two short strings get a module.
 *
 * In `app/` rather than `shared/`: Nitro never calls `useState`, so these are
 * not shared with the server the way a game rule is. Both readers live here.
 */
export const STATE_KEYS = {
  gamePhase: 'game:phase',
  sessionUser: 'session:user',
} as const

/**
 * What the app assumes about the phase before the server has said anything.
 *
 * Only reached when the payload carries nothing — an anonymous visitor on
 * `/login`, where the middleware resolves no user and therefore no phase, and
 * where no screen asks. Every other page is rendered by a server that knows.
 *
 * Worth knowing: this is NOT the schema's default, which has been
 * `preparation` since the preparation phase landed. Changing it would be a
 * behaviour change rather than a tidy-up, so it stays what it was — but a
 * fallback that disagrees with the database is the kind of thing to decide on
 * purpose rather than inherit.
 */
export const DEFAULT_PHASE: GamePhase = 'open'
