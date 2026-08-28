import type { GamePhase } from './game'

/**
 * What a route asks of whoever opens it, declared by the route itself.
 *
 * Two independent conditions, and both must hold. `role` is the only one the
 * app has — there are two kinds of people (SPEC §3) and no third is planned.
 *
 * `phase` takes a single value or a set, because the two questions asked of it
 * are genuinely different shapes: `/results` wants one phase exactly
 * (`revealed`), `/guess` wants every phase in which the sheet exists. A set
 * covers both without inventing a "minimum phase" — an order-based rule would
 * read as a floor, and the phases of this game are reversible (SPEC §2), so a
 * floor is exactly the wrong mental model.
 */
export interface PageAccess {
  role?: 'admin'
  phase?: GamePhase | readonly GamePhase[]
}
