import { removePhotoFiles } from '../../../utils/photos'

export default defineEventHandler(async (event) => {
  const adminId = assertAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid-participant' })
  }

  // Deleting yourself would sign you out mid-action and take the panel with
  // you. Nothing in SPEC asks for it, and it is almost certainly a misclick.
  if (id === adminId) {
    throw createError({ statusCode: 422, statusMessage: 'not-yourself' })
  }

  const removed = removeParticipant(id)
  await Promise.all(removed.photos.map(removePhotoFiles))

  return { displayName: removed.displayName, photos: removed.photos.length }
})
