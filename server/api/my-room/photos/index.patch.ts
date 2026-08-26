/** The new order, as the full list of names the owner now wants, in order. */
export default defineEventHandler(async (event) => {
  assertPhaseIsOpen()

  const body = await readBody<{ order?: unknown }>(event)
  const order = body?.order
  if (!Array.isArray(order) || !order.every(isPhotoName)) {
    throw createError({ statusCode: 400, statusMessage: 'The order must be a list of photo names' })
  }

  return { photos: reorderRoomPhotos(event.context.user!.id, order) }
})
