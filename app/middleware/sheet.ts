/**
 * `/guess` does not exist before the game opens.
 *
 * The sheet is not shown closed in `preparation` — there is nothing on it to
 * close. Like `/results` before `revealed`, the page sends you home rather
 * than explaining itself, and the dashboard is where the explanation lives
 * (PAGES `/guess`). The server refuses the route that feeds it in the same
 * phase (`assertSheetIsOut`), so a direct URL cannot get further than this.
 *
 * Named rather than global, and named rather than inlined in both pages: two
 * routes share the rule, and a rule written twice is one that gets widened
 * once.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (gamePhaseOn(to) === 'preparation') return navigateTo('/', { replace: true })
})
