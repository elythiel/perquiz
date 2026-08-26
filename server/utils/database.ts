import type { PerquizDatabase } from '../database/client'
import { eq } from 'drizzle-orm'
import { dataDirectories, migrateDatabase, openDatabase } from '../database/client'
import { APP_STATE_ID, appState } from '../database/schema'

/**
 * The single SQLite connection, opened lazily and kept for the process.
 *
 * `better-sqlite3` is synchronous by design: a call blocks the event loop for
 * the microseconds a local file query takes. For a party game read by a dozen
 * phones that is the right trade — no pool, no await, no connection lifecycle
 * to get wrong.
 */
let database: PerquizDatabase | undefined

export function useDatabase(): PerquizDatabase {
  database ??= migrateDatabase(openDatabase(useRuntimeConfig().dataDir))
  return database
}

/** Where the photos live, for the routes that will serve them (M3). */
export function usePhotoDirectory(): string {
  return dataDirectories(useRuntimeConfig().dataDir).photos
}

/** The one row of `app_state`; it exists from the first boot onwards. */
export function useGameState() {
  const row = useDatabase()
    .select()
    .from(appState)
    .where(eq(appState.id, APP_STATE_ID))
    .get()

  if (!row) throw new Error('app_state is empty: the boot migration did not run')
  return row
}
