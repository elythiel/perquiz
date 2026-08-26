/** The whole sheet in one request; it is small, and it changes every visit. */
export default defineEventHandler(event => guessSheet(event.context.user!.id))
