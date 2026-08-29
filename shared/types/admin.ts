/**
 * What `GET /api/admin/participants/:id` answers with: the confirmation the
 * panel shows before a removal.
 *
 * Deliberately NOT `Removal`, which the server computes and which carries the
 * photo FILENAMES. The route sends their count and nothing else — a moderator
 * confirming a deletion has no business receiving the list of files, and the
 * panel is built so that nobody reading it learns whose room is whose (SPEC
 * §7). The narrowing is the point, so it has a name of its own.
 */
export interface RemovalPreview {
  displayName: string
  /** How many, never which. */
  photos: number
  /** Answers they wrote themselves. */
  guessesMade: number
  /** Answers other people wrote that this deletion destroys. */
  guessesLost: number
}
