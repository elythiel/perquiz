import { MAX_PHOTOS_PER_ROOM, MAX_UPLOAD_BYTES } from '#shared/utils/photos'
import { eq, sql } from 'drizzle-orm'
import { photos } from '../../../database/schema'
import { sniffImageType, storePhoto } from '../../../utils/photos'

/**
 * One photo per request, and one request at a time per person.
 *
 * Not a batch: the browser reports progress per request, and a file that is
 * refused has to leave the others alone (PAGES `/my-room`). One request per
 * file gives both for free, and a failure is just this request's status.
 *
 * The queue is what bounds the work. Everything expensive happens inside it —
 * counting the room, reading the body, decoding and re-encoding — so a burst
 * of requests from one phone becomes a line rather than a pile, and counting
 * then inserting cannot interleave with another request doing the same.
 */
export default defineEventHandler(async (event) => {
  assertPhaseIsOpen()
  const userId = event.context.user!.id

  // Refuse before reading: the body is buffered to hash and decode it, so the
  // ceiling has to be checked on the announced length, not after the fact.
  const announced = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (announced > MAX_UPLOAD_BYTES * 1.05) {
    throw createError({ statusCode: 413, statusMessage: 'too-large' })
  }

  return serialiseByUser(userId, async () => {
    const db = useDatabase()
    const held = db.select({ count: sql<number>`count(*)` }).from(photos)
      .where(eq(photos.userId, userId)).get()?.count ?? 0

    // Checked before the body is read: a full room costs nothing to refuse.
    if (held >= MAX_PHOTOS_PER_ROOM) {
      throw createError({ statusCode: 409, statusMessage: 'too-many' })
    }

    const parts = await readMultipartFormData(event)
    const file = parts?.find(part => part.name === 'photo' && part.filename)
    if (!file) throw createError({ statusCode: 400, statusMessage: 'no-file' })

    if (file.data.byteLength > MAX_UPLOAD_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'too-large' })
    }

    // The extension and the browser's content-type are both a stranger's word.
    const kind = sniffImageType(file.data)
    if (kind === 'image/heic') {
      // Detected, named, and refused: see the note in server/utils/photos.ts.
      throw createError({ statusCode: 415, statusMessage: 'heic' })
    }
    if (!kind) {
      throw createError({ statusCode: 415, statusMessage: 'unsupported-type' })
    }

    let stored
    try {
      stored = await storePhoto(file.data)
    }
    catch (error) {
      // A real image header with a broken body, or a codec this build cannot
      // read. The person needs "this file did not work", not a stack trace.
      console.error('[photos] could not process an upload:', error)
      throw createError({ statusCode: 422, statusMessage: 'unreadable' })
    }

    db.insert(photos)
      .values({ userId, filename: stored.name, position: held })
      .run()

    setResponseStatus(event, 201)
    return { name: stored.name, position: held }
  })
})
