import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
// Explicit `.ts` specifiers, here and in scripts/: this module is also loaded
// by `yarn seed`, a plain node process whose ESM resolver does not guess
// extensions. Nitro-only modules keep the project's usual extensionless style.
import { APP_STATE_ID, appState } from './schema.ts'
import * as schema from './schema.ts'

/**
 * Opening the database, with no Nitro around.
 *
 * Kept free of `useRuntimeConfig` and of every other auto-import so the seed
 * script — which runs as a plain node process — goes through exactly the same
 * code as the server. `server/utils/database.ts` is the thin Nitro-facing
 * wrapper that supplies the configured directory.
 */

export type PerquizDatabase = ReturnType<typeof drizzle<typeof schema>>

/**
 * The migrations replayed at boot, as SQL files on disk.
 *
 * Resolved from the process's working directory, which is the app root both in
 * development and in the container — hence the Dockerfile copying
 * `server/database/migrations` next to `.output`: the folder is a runtime
 * input, not a build artefact. Bundling the SQL as a Nitro server asset would
 * mean hand-writing a migration runner, and drizzle's own is worth keeping.
 */
const MIGRATIONS_FOLDER = 'server/database/migrations'

/** Everything persistent lives under one directory, so one volume backs it up. */
export function dataDirectories(dataDir: string) {
  const root = resolve(dataDir)
  return { root, photos: join(root, 'photos'), file: join(root, 'app.db') }
}

/**
 * Opens the file, creating the directory tree if it is not there yet — so a
 * fresh clone, a bind mount and a named volume all behave the same, without
 * anyone having to remember a `mkdir`.
 */
export function openDatabase(dataDir: string): PerquizDatabase {
  const { photos, file } = dataDirectories(dataDir)
  mkdirSync(photos, { recursive: true })

  const connection = new Database(file)
  // WAL lets the reveal show read while an upload writes. Foreign keys are OFF
  // by default in SQLite, and every cascade in the schema is inert without it.
  connection.pragma('journal_mode = WAL')
  connection.pragma('foreign_keys = ON')

  return drizzle(connection, { schema })
}

/**
 * Brings the file up to date, then guarantees the singleton game row exists.
 *
 * A brand-new game starts in `preparation`, which is where a game starts: the
 * rooms get filled before the guessing opens. Only the first boot ever writes
 * this row, so an existing game is never moved backwards.
 */
export function migrateDatabase(db: PerquizDatabase): PerquizDatabase {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })

  db.insert(appState)
    .values({ id: APP_STATE_ID, phase: 'preparation' })
    .onConflictDoNothing()
    .run()

  return db
}
