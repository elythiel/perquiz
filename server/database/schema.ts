// Relative, not `#shared/...`: this file is also compiled by the node
// project that covers scripts/, where Nuxt's aliases do not exist.
import type { GamePhase } from '../../shared/types/game'
import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * The database, as specified in docs/SPEC.md §9.
 *
 * Two things this schema deliberately does NOT hold. Scores: they are counted
 * from `guesses` at read time, so there is no row to keep in sync with the
 * truth. And anything provider-shaped: `identities` stores the configured
 * provider id and the OIDC `sub`, and the game tables only ever join on
 * `users.id` (see server/utils/oidc.ts).
 */

/** Every timestamp is stored as unix seconds, defaulted by SQLite itself. */
const createdAt = () => integer('created_at', { mode: 'timestamp' })
  .notNull()
  .default(sql`(unixepoch())`)

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  displayName: text('display_name').notNull(),
  /** A cache of the provider's `admin` role, refreshed at every login. */
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  /**
   * When the dashboard last told this person what had changed.
   *
   * Not a login timestamp and not an activity log: it exists so "3 new rooms
   * since your last visit" can be true, and it is stamped by the dashboard
   * itself. Null until the first visit, which reads as "nothing is new yet"
   * rather than "everything is".
   */
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }),
  createdAt: createdAt(),
}, table => [
  // The name others pick when guessing, so it has to be unique — and unique
  // case-insensitively, or "Sofia" and "sofia" become two different suspects.
  //
  // CAVEAT: SQLite's `lower()` is ASCII-only, exactly like `COLLATE NOCASE`.
  // "Élodie" and "élodie" would both get in. The realistic collision is a
  // plain-ASCII one and this catches it; M2 owns the collision suffix and can
  // tighten this with a folded column if it turns out to matter.
  uniqueIndex('users_display_name_ci_unique').on(sql`lower(${table.displayName})`),
])

export const identities = sqliteTable('identities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** `NUXT_OIDC_PROVIDER_ID` — the deployment's provider, `zitadel` by default. */
  provider: text('provider').notNull(),
  /** The OIDC `sub` claim. */
  subject: text('subject').notNull(),
  /** Reserved for a future local provider; always null while v1 is OIDC-only. */
  secretHash: text('secret_hash'),
  createdAt: createdAt(),
}, table => [
  uniqueIndex('identities_provider_subject_unique').on(table.provider, table.subject),
  index('identities_user_idx').on(table.userId),
])

export const photos = sqliteTable('photos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** A random name under `<dataDir>/photos/`, never derived from the owner. */
  filename: text('filename').notNull(),
  /** 0-based, owner-defined order. */
  position: integer('position').notNull(),
  createdAt: createdAt(),
}, table => [
  // Every read is "this owner's photos, in order".
  index('photos_user_position_idx').on(table.userId, table.position),
  uniqueIndex('photos_filename_unique').on(table.filename),
])

export const guesses = sqliteTable('guesses', {
  guesserId: integer('guesser_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** The room being guessed about — identified by its owner. */
  roomUserId: integer('room_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** Who the guesser thinks lives there. */
  guessedUserId: integer('guessed_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, table => [
  // One answer per room per guesser; revising overwrites it.
  primaryKey({ columns: [table.guesserId, table.roomUserId] }),
  // The two rules of SPEC §4, enforced here rather than trusted to the API:
  // a sheet skips its owner's room, and the guesser is not in their own
  // options. Naming yourself for someone else's room is not a mistake anyone
  // can make, and naming your own room is not a guess.
  check('guesses_not_own_room', sql`${table.guesserId} <> ${table.roomUserId}`),
  check('guesses_not_self', sql`${table.guessedUserId} <> ${table.guesserId}`),
  index('guesses_room_idx').on(table.roomUserId),
])

const PHASES = ['open', 'locked', 'revealed'] as const satisfies readonly GamePhase[]

export const appState = sqliteTable('app_state', {
  /** Singleton: there is one game, and the CHECK below keeps it that way. */
  id: integer('id').primaryKey(),
  phase: text('phase', { enum: PHASES }).notNull().default('open'),
  lockedAt: integer('locked_at', { mode: 'timestamp' }),
}, table => [
  check('app_state_singleton', sql`${table.id} = 1`),
])

export const APP_STATE_ID = 1
