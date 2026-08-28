/** Everything the page needs in one request: photos, name, and the audience. */
export default defineEventHandler((event) => {
  return roomState(requireUser(event))
})
