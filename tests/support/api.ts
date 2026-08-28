import type { App } from 'h3'
import type { GamePhase } from '#shared/types/game'
import { randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as h3 from 'h3'
import { sql } from 'drizzle-orm'
import { migrateDatabase, openDatabase } from '../../server/database/client'
import { guesses, photos, users } from '../../server/database/schema'
// Every server/utils module: Nitro auto-imports their exports, so the tests
// have to put them where the handlers expect to find them — see `expose()`.
import * as adminUtils from '../../server/utils/admin'
import * as dashboardUtils from '../../server/utils/dashboard'
import * as databaseUtils from '../../server/utils/database'
import * as displayNameUtils from '../../server/utils/display-name'
import * as guessingUtils from '../../server/utils/guessing'
import * as oidcUtils from '../../server/utils/oidc'
import * as photoUtils from '../../server/utils/photos'
import * as provisioningUtils from '../../server/utils/provisioning'
import * as resultsUtils from '../../server/utils/results'
import * as revealUtils from '../../server/utils/reveal'
import * as roomUtils from '../../server/utils/room'
import * as scoringUtils from '../../server/utils/scoring'
import * as sessionUtils from '../../server/utils/session'
import * as sheetUtils from '../../server/utils/sheet'
import * as uploadQueueUtils from '../../server/utils/upload-queue'

/**
 * The API, booted without Nuxt.
 *
 * These are endpoint tests, so they have to go through the middleware: "every
 * route requires a session" is enforced in exactly one place, and a test that
 * called handlers directly would prove nothing about it. What they must NOT do
 * is need a build — the invariants of SPEC §9 are worth checking on every
 * `yarn test`, not on a five-minute one.
 *
 * So the routes are mounted on a plain h3 app, in the same order Nitro mounts
 * them, and driven through `toWebHandler` — real requests, real cookies, real
 * status codes, no server socket and no bundler.
 *
 * Two things stand in for the framework:
 *
 *  - the auto-imports, replaced by globals (`expose()`). This is the one place
 *    that has to know Nitro's magic, and it fails loudly rather than silently:
 *    a missing name is a `ReferenceError` in the first test that runs.
 *  - the route table, DISCOVERED from `server/api/` rather than written out
 *    here. A hand-written list would be the thing that rots — a new endpoint
 *    would simply not be tested, which is the exact shape of the bug the
 *    session sweep in tests/api/access.spec.ts exists to catch.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const API_ROOT = join(ROOT, 'server/api')

/** Long enough for iron-webcrypto, and the HMAC key behind every room token. */
const TEST_SESSION_PASSWORD = 'test-session-password-of-thirty-two-plus'

const METHODS = ['get', 'post', 'patch', 'put', 'delete'] as const
type Method = typeof METHODS[number]

export interface ApiRoute {
  /** Uppercase, as a request carries it. */
  method: Uppercase<Method>
  /** The routed path, with `[id]` turned into `:id`. */
  path: string
  /** Relative to `server/api/`, for test names and for the public-surface check. */
  file: string
}

/** `admin/participants/[id].delete.ts` → DELETE /api/admin/participants/:id */
function routeOf(file: string): ApiRoute | undefined {
  const withoutExtension = file.replace(/\.ts$/, '')
  const method = METHODS.find(candidate => withoutExtension.endsWith(`.${candidate}`))
  if (!method) return undefined

  const path = withoutExtension
    .slice(0, -(method.length + 1))
    .replace(/(^|\/)index$/, '')
    .replace(/\[(\w+)\]/g, ':$1')

  return {
    method: method.toUpperCase() as Uppercase<Method>,
    path: `/api/${path}`.replace(/\/$/, ''),
    file,
  }
}

function handlerFiles(directory = '', found: string[] = []): string[] {
  for (const entry of readdirSync(join(API_ROOT, directory), { withFileTypes: true })) {
    const relative = directory ? `${directory}/${entry.name}` : entry.name
    if (entry.isDirectory()) handlerFiles(relative, found)
    else if (entry.name.endsWith('.ts')) found.push(relative)
  }
  return found
}

export function discoverRoutes(): ApiRoute[] {
  return handlerFiles()
    .map(routeOf)
    .filter((route): route is ApiRoute => route !== undefined)
    .sort((left, right) => left.path.localeCompare(right.path) || left.method.localeCompare(right.method))
}

/** The sign-in flow, and nothing else, is allowed through unauthenticated. */
export const PUBLIC_PREFIX = '/api/auth/'

export function isPublic(route: ApiRoute): boolean {
  return route.path.startsWith(PUBLIC_PREFIX)
}

export function isAdminOnly(route: ApiRoute): boolean {
  return route.path.startsWith('/api/admin')
}

/**
 * The handlers reach for Nitro's auto-imports; these are them.
 *
 * Only what `server/` actually uses, so that a handler reaching for something
 * new fails here instead of quietly picking up a look-alike from the test.
 */
function expose(config: Record<string, unknown>) {
  const globals = globalThis as Record<string, unknown>

  for (const name of [
    'defineEventHandler', 'createError', 'getRouterParam', 'getQuery', 'readBody',
    'readMultipartFormData', 'getRequestURL', 'getRequestHeader', 'sendRedirect',
    'sendStream', 'setResponseHeaders', 'setResponseStatus',
  ] as const) {
    globals[name] = h3[name]
  }

  globals.useRuntimeConfig = () => config

  for (const module of [
    adminUtils, dashboardUtils, databaseUtils, displayNameUtils, guessingUtils,
    oidcUtils, photoUtils, provisioningUtils, resultsUtils, revealUtils, roomUtils,
    scoringUtils, sessionUtils, sheetUtils, uploadQueueUtils,
  ]) {
    for (const [name, value] of Object.entries(module)) globals[name] = value
  }
}

export interface TestApi {
  /** A request against the app, through the real middleware chain. */
  fetch: (path: string, options?: RequestInit & { cookie?: string }) => Promise<Response>
  /** The sealed session cookie for a user id — minted by h3, like a real login. */
  signIn: (userId: number) => Promise<string>
  /** The same, as the whole `set-cookie` header: attributes included. */
  signInHeader: (userId: number) => Promise<string>
  db: ReturnType<typeof openDatabase>
  photoDirectory: string
  sessionPassword: string
  routes: ApiRoute[]
  /** Empties the game tables between tests; the schema stays. */
  reset: () => void
  createUser: (displayName: string, options?: { isAdmin?: boolean }) => number
  /** Adds a photo row AND the two files behind it, so it can also be served. */
  addPhoto: (userId: number, options?: { name?: string, bytes?: Uint8Array }) => string
  addGuess: (guesserId: number, roomUserId: number, guessedUserId: number) => void
  setPhase: (phase: GamePhase) => void
}

let booted: Promise<TestApi> | undefined

export function useTestApi(): Promise<TestApi> {
  booted ??= boot()
  return booted
}

async function boot(): Promise<TestApi> {
  const dataDir = mkdtempSync(join(tmpdir(), 'perquiz-api-'))
  const photoDirectory = join(dataDir, 'photos')
  mkdirSync(photoDirectory, { recursive: true })

  const config = {
    dataDir,
    sessionPassword: TEST_SESSION_PASSWORD,
    oidc: {
      issuer: '',
      clientId: '',
      clientSecret: '',
      providerId: 'test',
      rolesClaim: 'roles',
      rolePlayer: 'player',
      roleAdmin: 'admin',
      scopes: 'openid profile email',
    },
    baseUrl: 'http://localhost:3000',
  }

  expose(config)

  const db = migrateDatabase(openDatabase(dataDir))

  const app: App = h3.createApp()

  /*
   * A test-only door, mounted BEFORE the middleware so it is not gated by it.
   *
   * It seals the cookie with h3's own `useSession`, the way the OIDC callback
   * does — a hand-rolled cookie would be testing the test's crypto, and a real
   * round trip would need a live provider.
   */
  app.use('/test/sign-in', h3.defineEventHandler(async (event) => {
    const session = await sessionUtils.usePerquizSession(event)
    await session!.update({ userId: Number(h3.getQuery(event).user) })
    return { ok: true }
  }))

  const middleware = await import('../../server/middleware/auth')
  app.use(middleware.default)

  const router = h3.createRouter()
  const routes = discoverRoutes()
  for (const route of routes) {
    // The sign-in flow needs a live provider to do anything; the tests only
    // ever assert that the middleware lets it past, which needs no handler.
    if (isPublic(route)) continue

    const module = await import(pathToFileURL(join(API_ROOT, route.file)).href)
    router.add(route.path, module.default, route.method.toLowerCase() as Method)
  }
  app.use(router)

  const handler = h3.toWebHandler(app)

  const fetchIt: TestApi['fetch'] = (path, options = {}) => {
    const { cookie, headers, ...rest } = options
    return handler(new Request(`http://localhost:3000${path}`, {
      ...rest,
      headers: { ...(cookie ? { cookie } : {}), ...(headers as Record<string, string>) },
    }))
  }

  const signInHeader: TestApi['signInHeader'] = async (userId) => {
    const response = await fetchIt(`/test/sign-in?user=${userId}`)
    const cookie = response.headers.getSetCookie().at(0)
    if (!cookie) throw new Error('the test door minted no session cookie')
    return cookie
  }

  const signIn: TestApi['signIn'] = async userId =>
    (await signInHeader(userId)).split(';').at(0)!

  return {
    fetch: fetchIt,
    signIn,
    signInHeader,
    db,
    photoDirectory,
    sessionPassword: TEST_SESSION_PASSWORD,
    routes,

    reset() {
      // `users` cascades to identities, photos and guesses; app_state is the
      // singleton and only its phase is worth putting back.
      db.delete(users).run()
      db.run(sql`update app_state set phase = 'open', locked_at = null, reveal_seed = null`)
    },

    createUser(displayName, options = {}) {
      return db.insert(users)
        .values({ displayName, isAdmin: options.isAdmin ?? false })
        .returning({ id: users.id })
        .get().id
    },

    addPhoto(userId, options = {}) {
      const name = options.name ?? randomPhotoName()
      const position = db.all<{ count: number }>(
        sql`select count(*) as count from photos where user_id = ${userId}`,
      )[0]!.count

      db.insert(photos).values({ userId, filename: name, position }).run()

      // Bytes, so the serving route has something to stream. Their content is
      // beside the point everywhere except the upload tests, which write their
      // own through sharp.
      const bytes = options.bytes ?? Uint8Array.from([0x52, 0x49, 0x46, 0x46])
      for (const variant of ['web', 'thumb'] as const) {
        writeFileSync(join(photoDirectory, `${name}-${variant}.webp`), bytes)
      }

      return name
    },

    addGuess(guesserId, roomUserId, guessedUserId) {
      db.insert(guesses).values({ guesserId, roomUserId, guessedUserId }).run()
    },

    setPhase(phase) {
      db.run(sql`update app_state set phase = ${phase}`)
    },
  }
}

/** The same shape the real thing mints: 32 hex characters, meaning nothing. */
export function randomPhotoName(): string {
  return randomBytes(16).toString('hex')
}
