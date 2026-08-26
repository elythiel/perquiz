import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { eq } from 'drizzle-orm'
import { photos } from '../../../database/schema'
import { isPhotoVariant, photoPath } from '../../../utils/photos'

/**
 * Serving a photo, to anyone signed in and to nobody else.
 *
 * Every participant needs to see every room — that is the game — so there is
 * no owner check here. What there is instead: the file never leaves the data
 * directory by any path but this one, the name says nothing about who took it,
 * and the response carries no header that would (SPEC §3).
 */
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')
  const variant = getRouterParam(event, 'variant')

  if (!isPhotoName(name) || !isPhotoVariant(variant)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  // Through the database, never straight to disk: an unknown name must be a
  // 404 and not a filesystem probe.
  const known = useDatabase().select({ id: photos.id }).from(photos)
    .where(eq(photos.filename, name)).get()
  if (!known) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const path = photoPath(name, variant)
  const file = await stat(path).catch(() => undefined)
  if (!file) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  setResponseHeaders(event, {
    'content-type': 'image/webp',
    'content-length': file.size,
    // The bytes never change under a name, but they are only for signed-in
    // people: private, so a shared cache never holds one.
    'cache-control': 'private, max-age=31536000, immutable',
  })

  return sendStream(event, createReadStream(path))
})
