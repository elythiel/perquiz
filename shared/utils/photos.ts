/**
 * The two limits an upload has to respect, written once.
 *
 * Both sides apply them: the server refuses, and the form stops offering what
 * would be refused. A second copy of either number is a copy that eventually
 * disagrees — the interface promising "15 Mo max" while the server allows
 * something else is exactly the kind of lie nobody notices until a photo
 * bounces.
 */

/**
 * Decimal megabytes, not binary: the screen says "15 Mo max", and a limit that
 * quietly accepts 15.7 would make that sentence false.
 */
export const MAX_UPLOAD_BYTES = 15_000_000

/**
 * Photos one room may hold (SPEC §3).
 *
 * A room is told in a handful of pictures, and ten leaves room to be generous
 * without turning a guess into a slideshow. The number is a product call, not
 * a technical one — the disk would not notice either way (a stored photo is
 * ~76 Ko across both variants). What it really guards is the guess sheet and
 * the reveal show, which show a room one screen at a time.
 *
 * A room that already holds more keeps them: the cap refuses additions, it
 * never deletes.
 */
export const MAX_PHOTOS_PER_ROOM = 10

/**
 * Why an upload was refused, as the locale file knows it.
 *
 * The server answers `statusMessage` with one of these slugs and the browser
 * looks the sentence up under `myRoom.errors.*`. Written here because it is a
 * contract between the two halves, and a slug thrown on one side with no
 * sentence on the other reaches the screen as its own key.
 *
 * Which is exactly what happened until vikunja-108. The browser used to take
 * any `statusMessage` under forty characters for a slug — a guess, and a wrong
 * one the day a route answered « The rooms are no longer editable », thirty-two
 * characters of English that went straight into the page. A list cannot guess:
 * anything absent from it is `failed`, which is the honest thing to say about
 * a refusal the interface has no words for.
 *
 * `no-file` is deliberately NOT here. It means the browser sent no file part,
 * which is a bug in this code rather than something a person did, and there is
 * no sentence to write for it that would help them.
 */
export const UPLOAD_FAILURES = [
  'too-large',
  'too-many',
  'unsupported-type',
  'heic',
  'unreadable',
  'locked',
] as const

/** A slug above, or the catch-all the browser falls back to. */
export type UploadFailure = typeof UPLOAD_FAILURES[number] | 'failed'

export function isUploadFailure(value: unknown): value is UploadFailure {
  return UPLOAD_FAILURES.includes(value as typeof UPLOAD_FAILURES[number])
}
