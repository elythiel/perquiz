/**
 * One photo processed at a time, per person.
 *
 * A count limit bounds the disk; it does nothing for the processor, because
 * deleting and re-uploading in a loop is unbounded work. What has to be
 * bounded is the work happening at once — and `sharp` decoding a 15 Mo JPEG
 * and re-encoding it twice is the expensive part of this application.
 *
 * Per person rather than globally: twenty-five phones uploading at the same
 * time is the normal case of a party game and must stay fast. One phone
 * uploading twenty-five times at once is the case worth slowing down.
 *
 * It also removes a race for free. Counting a room's photos and inserting the
 * next one are two statements; serialised, they cannot interleave, so the cap
 * cannot be stepped over by two requests arriving together.
 */

/** The tail of each person's chain, while they have one. */
const tails = new Map<number, Promise<unknown>>()

export function serialiseByUser<T>(userId: number, work: () => Promise<T>): Promise<T> {
  const previous = tails.get(userId) ?? Promise.resolve()

  // `then(work, work)`: a failed upload must not wedge the queue behind it.
  const mine = previous.then(work, work)
  const tail = mine.then(() => undefined, () => undefined)

  tails.set(userId, tail)
  void tail.then(() => {
    // Only if nobody queued behind us in the meantime, or we would drop a
    // link that is still holding somebody's turn.
    if (tails.get(userId) === tail) tails.delete(userId)
  })

  return mine
}

/** How many people currently have work queued — for tests and for nothing else. */
export function queuedUsers(): number {
  return tails.size
}
