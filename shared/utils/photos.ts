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
