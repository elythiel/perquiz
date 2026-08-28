/** One answer. The response carries a count and nothing that could be an answer. */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ room?: unknown, participant?: unknown }>(event)
  return recordGuess(requireUser(event), body?.room, body?.participant)
})
