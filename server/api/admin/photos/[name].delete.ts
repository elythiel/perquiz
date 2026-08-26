import { removePhotoFiles } from '../../../utils/photos'

/**
 * Moderation. Allowed in every phase on purpose: a photograph that should not
 * be there should not be there once the game is locked either (SPEC §3).
 *
 * The response says how many photos are left in that room and how many answers
 * were discarded, but never whose room it was.
 */
export default defineEventHandler(async (event) => {
  assertAdmin(event)

  const name = getRouterParam(event, 'name')
  if (!isPhotoName(name)) {
    throw createError({ statusCode: 400, statusMessage: 'Not a photo name' })
  }

  const result = deleteAnyPhoto(name)
  await removePhotoFiles(name)
  return result
})
