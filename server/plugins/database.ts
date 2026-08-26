/**
 * Opens the database and replays the migrations before the first request.
 *
 * Running them at boot rather than from a deploy step keeps a single command
 * to start the app — `node .output/server/index.mjs` — and makes a fresh clone
 * and a fresh container behave identically. The process is single, so there is
 * no second instance to race with.
 */
export default defineNitroPlugin(() => {
  useDatabase()
})
