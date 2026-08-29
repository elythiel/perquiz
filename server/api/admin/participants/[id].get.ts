import type { RemovalPreview } from '#shared/types/admin'

/** What deleting this participant would take with it — for the confirmation. */
export default defineEventHandler((event): RemovalPreview => {
  assertAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid-participant' })
  }

  const { displayName, photos, guessesMade, guessesLost } = removalPreview(id)
  return { displayName, photos: photos.length, guessesMade, guessesLost }
})
