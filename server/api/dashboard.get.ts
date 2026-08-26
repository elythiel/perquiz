/** Everything the dashboard shows, and the visit stamp that comes with it. */
export default defineEventHandler(event => dashboardState(event.context.user!.id))
