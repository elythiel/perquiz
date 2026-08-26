/** The whole show in one payload: it is projected, not paged. */
export default defineEventHandler((event) => {
  assertShowIsReady(event)
  return revealShow()
})
