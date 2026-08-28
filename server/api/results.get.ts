/** Everyone's leaderboard, and this reader's own sheet, side by side. */
export default defineEventHandler((event) => {
  assertResultsAreOut()
  return personalResults(requireUser(event))
})
