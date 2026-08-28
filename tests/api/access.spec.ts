import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { isAdminOnly, isPublic, useTestApi } from '../support/api'

/**
 * The first invariant of SPEC §9: no route is reachable without a session, and
 * no admin route without the admin flag.
 *
 * The point of these tests is that nobody wrote the list they run over. Every
 * handler under `server/api/` is discovered and swept, so the failure mode this
 * catches is the one that actually happens: a new endpoint, added months from
 * now, that forgot its guard. A hand-listed suite would pass and prove nothing
 * about it.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

/** Stand-ins for the route parameters; no guard should ever look at them. */
function fill(path: string): string {
  return path
    .replace(':variant', 'web')
    .replace(':name', 'f'.repeat(32))
    .replace(':id', '1')
}

describe('the session gate', () => {
  it('has a route table to sweep', async () => {
    const { routes } = await useTestApi()
    // Cheap guard against the discovery quietly finding nothing and every
    // sweep below passing over an empty list.
    expect(routes.length).toBeGreaterThan(10)
  })

  it('leaves only the sign-in flow open', () => {
    // The three files this asserts are the whole public API surface. Adding a
    // fourth is a decision, and it should have to be made here too.
    expect(readdirSync(join(ROOT, 'server/api/auth')).sort())
      .toEqual(['callback.get.ts', 'login.get.ts', 'logout.post.ts'])
  })

  it('answers 401 on every route, to a stranger', async () => {
    const api = await useTestApi()
    const gated = api.routes.filter(route => !isPublic(route))

    const answers = await Promise.all(gated.map(async route => ({
      route: `${route.method} ${route.path}`,
      status: (await api.fetch(fill(route.path), { method: route.method })).status,
    })))

    expect(answers.filter(answer => answer.status !== 401)).toEqual([])
  })

  it('answers 401 on a session whose user no longer exists', async () => {
    const api = await useTestApi()
    api.reset()

    const id = api.createUser('Removed')
    const cookie = await api.signIn(id)
    expect((await api.fetch('/api/dashboard', { cookie })).status).toBe(200)

    // An admin removed them, or the database was reseeded under their feet.
    api.reset()
    expect((await api.fetch('/api/dashboard', { cookie })).status).toBe(401)
  })

  it('sends a page visitor to the login screen rather than a 401', async () => {
    const api = await useTestApi()
    const response = await api.fetch('/my-room', { redirect: 'manual' })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
  })

  it('lets the icon endpoint through, since it carries no game data', async () => {
    const api = await useTestApi()
    // Not a 401: the component asking for a glyph is not a visitor asking for
    // someone's photographs. It 404s here only because this app mounts no
    // framework routes — what matters is that the middleware did not answer.
    expect((await api.fetch('/api/_nuxt_icon/mingcute.json')).status).toBe(404)
  })
})

describe('the cookie the whole gate rests on', () => {
  it('is httpOnly, secure, same-site and rooted at /', async () => {
    const api = await useTestApi()
    api.reset()
    const header = await api.signInHeader(api.createUser('Alice'))

    // Every route is authenticated by this cookie and nothing else — there is
    // no CSRF token in the app — so `SameSite` is what stops a form on
    // somebody else's page from locking the game. h3 sets the other three by
    // default and not this one, which is why it is asserted here.
    expect(header).toMatch(/HttpOnly/i)
    expect(header).toMatch(/Secure/i)
    expect(header).toMatch(/SameSite=Lax/i)
    expect(header).toMatch(/Path=\//i)
  })

  it('is the only way to present a session', async () => {
    const api = await useTestApi()
    api.reset()
    const cookie = await api.signIn(api.createUser('Alice'))
    const sealed = cookie.split('=').slice(1).join('=')

    // h3 would otherwise read a sealed session out of `x-perquiz-session` and
    // prefer it to the cookie: a second door, which this app never knocks on.
    const response = await api.fetch('/api/dashboard', {
      headers: { 'x-perquiz-session': sealed },
    })

    expect(response.status).toBe(401)
    // …and the same value in the cookie it belongs in still works, so the test
    // above is not passing on a value that was simply invalid.
    expect((await api.fetch('/api/dashboard', { cookie })).status).toBe(200)
  })
})

describe('the admin gate', () => {
  let cookie: string

  beforeAll(async () => {
    const api = await useTestApi()
    api.reset()
    cookie = await api.signIn(api.createUser('Player'))
  })

  it('answers 403 on every admin route, to a signed-in player', async () => {
    const api = await useTestApi()
    const adminRoutes = api.routes.filter(isAdminOnly)
    expect(adminRoutes.length).toBeGreaterThan(3)

    const answers = await Promise.all(adminRoutes.map(async route => ({
      route: `${route.method} ${route.path}`,
      status: (await api.fetch(fill(route.path), { method: route.method, cookie })).status,
    })))

    expect(answers.filter(answer => answer.status !== 403)).toEqual([])
  })

  it('answers 403 on the reveal show too — it is admin-only, in any phase', async () => {
    const api = await useTestApi()

    for (const phase of ['open', 'locked', 'revealed'] as const) {
      api.setPhase(phase)
      expect((await api.fetch('/api/reveal', { cookie })).status).toBe(403)
    }

    api.setPhase('open')
  })

  it('opens the panel to an admin', async () => {
    const api = await useTestApi()
    const adminCookie = await api.signIn(api.createUser('Régie', { isAdmin: true }))

    expect((await api.fetch('/api/admin', { cookie: adminCookie })).status).toBe(200)
  })

  it('follows the flag as it is now, not as it was at sign-in', async () => {
    const api = await useTestApi()
    const id = api.createUser('Promoted')
    const theirCookie = await api.signIn(id)

    expect((await api.fetch('/api/admin', { cookie: theirCookie })).status).toBe(403)

    // `is_admin` is a cache of the provider's role, rewritten at every login
    // (SPEC §1). The session holds a user id and nothing else, which is what
    // makes a revoked role take effect on the next request rather than the
    // next sign-in.
    api.db.run(sql`update users set is_admin = 1 where id = ${id}`)
    expect((await api.fetch('/api/admin', { cookie: theirCookie })).status).toBe(200)

    api.db.run(sql`update users set is_admin = 0 where id = ${id}`)
    expect((await api.fetch('/api/admin', { cookie: theirCookie })).status).toBe(403)
  })
})

/**
 * The way back in, when the session points at nobody.
 *
 * A session outlives the row it points at — a reseeded database, a participant
 * removed from the panel. The middleware says so and treats the visitor as
 * signed out; the sign-in route used to disagree, reading the raw id out of the
 * cookie and sending them to `/`, which sent them back to `/login`, which sent
 * them here again. A loop whose only exit was deleting the cookie by hand,
 * because the button that would have done it sits behind the wall.
 */
describe('starting a sign-in', () => {
  it('sends a stale session to the provider, not home', async () => {
    const api = await useTestApi()
    api.reset()

    const ghost = api.createUser('Disparue')
    const cookie = await api.signIn(ghost)
    api.db.run(sql`delete from users where id = ${ghost}`)

    const response = await api.fetch('/api/auth/login', { cookie })

    // Not `/`: that is the trap. Where it DOES go depends on a provider these
    // tests have none of, so the assertion is about the door it does not take.
    expect(response.headers.get('location')).not.toBe('/')
  })

  it('still sends a signed-in visitor home', async () => {
    const api = await useTestApi()
    api.reset()

    const cookie = await api.signIn(api.createUser('Présente'))
    const response = await api.fetch('/api/auth/login', { cookie })

    expect(response.headers.get('location')).toBe('/')
  })
})
