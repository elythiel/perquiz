/** The whole panel: phase, participation, and the photos to moderate. */
export default defineEventHandler((event) => {
  assertAdmin(event)
  return adminPanel()
})
