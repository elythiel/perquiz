import { removePhotoFiles } from '../../../utils/photos'

export default defineEventHandler(async (event) => {
  assertRoomsEditable()

  const name = getRouterParam(event, 'name')
  if (!isPhotoName(name)) {
    throw createError({ statusCode: 400, statusMessage: 'Not a photo name' })
  }

  // The row first: it is what makes the photo visible. An orphan file on disk
  // is litter; a row pointing at a missing file is a broken image on a screen.
  const result = deleteRoomPhoto(event.context.user!.id, name)
  await removePhotoFiles(name)

  return result
})
