/** The whole panel: phase, participation, and the photos to moderate. */
export default defineEventHandler((event) => {
  return adminPanel(assertAdmin(event))
})
