import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { JSON_BODY_CEILING } from '../../server/utils/body'
import { useTestApi } from '../support/api'

/**
 * No route reads a body it has not measured first.
 *
 * `content-length` is a claim, and a chunked request does not even make it — so
 * a ceiling checked on the header sees zero and waves the request through,
 * while the reader downstream buffers everything before anybody can object. The
 * photo upload was closed that way (card 80); these four JSON routes are the
 * rest of it (card 88).
 *
 * They were worse off than the upload on one count: it goes through
 * `serialiseByUser`, so one body per person sat in memory at a time. None of
 * these does, which means concurrent requests each buffered their own.
 *
 * Two halves here, and the second is the one that lasts. The first proves the
 * four routes refuse; the second sweeps `server/api/` so the FIFTH route, added
 * months from now, cannot forget — which is exactly how these four came to
 * exist while the upload was being fixed.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const API = join(ROOT, 'server/api')

let playerCookie: string
let adminCookie: string

beforeEach(async () => {
  const api = await useTestApi()
  api.reset()
  api.setPhase('open')

  playerCookie = await api.signIn(api.createUser('Alice'))
  adminCookie = await api.signIn(api.createUser('Régie', { isAdmin: true }))
})

/**
 * A body sent the way `content-length` cannot describe.
 *
 * A `ReadableStream` is what makes the request chunked: undici cannot know the
 * length ahead of time, so it announces none. `pull` runs only when the server
 * reads, so `sent()` counts what was actually taken rather than what was on
 * offer — the difference between "refused" and "refused after swallowing it".
 *
 * Not the `chunked()` helper from photos.spec.ts, which packs a `FormData`:
 * these routes want JSON.
 */
async function chunkedJson(path: string, cookie: string, bytes: number) {
  const filler = 'a'.repeat(64 * 1024)
  let sent = 0

  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= bytes) return controller.close()
      const slice = filler.slice(0, Math.min(filler.length, bytes - sent))
      controller.enqueue(new TextEncoder().encode(slice))
      sent += slice.length
    },
  })

  const api = await useTestApi()
  const response = await api.fetch(path, {
    method: 'PATCH',
    cookie,
    headers: { 'content-type': 'application/json' },
    body,
    // Required by fetch for a streamed body, and absent from the DOM types.
    duplex: 'half',
  } as RequestInit & { cookie: string })

  return { response, sent: () => sent }
}

describe('a JSON body bigger than its ceiling', () => {
  const OVERSIZED = 40 * 1024 * 1024

  it.each([
    ['/api/guess', () => playerCookie],
    ['/api/my-room/name', () => playerCookie],
    ['/api/my-room/photos', () => playerCookie],
    // The admin gate runs BEFORE the ceiling on this one, so a player would be
    // turned away at 403 and prove nothing about the body.
    ['/api/admin/phase', () => adminCookie],
  ] as const)('is refused with 413 on %s', async (path, cookie) => {
    const { response } = await chunkedJson(path, cookie(), OVERSIZED)
    expect(response.status).toBe(413)
  })

  it('stops reading near the ceiling rather than at the end', async () => {
    const { response, sent } = await chunkedJson('/api/guess', playerCookie, OVERSIZED)

    expect(response.status).toBe(413)
    // The assertion that makes this about memory rather than status codes: the
    // read stopped within a chunk of the ceiling, not forty megabytes later.
    expect(sent()).toBeLessThan(JSON_BODY_CEILING + 128 * 1024)
  })

  it('still accepts the widest legitimate payload', async () => {
    // Ten photo names is the largest body any of these routes takes — 361
    // bytes — and it must pass untouched. It answers 400 here because the names
    // belong to no photograph, which is the route's own business: what matters
    // is that it was READ.
    const api = await useTestApi()
    const order = Array.from({ length: 10 }, (_, index) => String(index).repeat(32))

    const response = await api.fetch('/api/my-room/photos', {
      method: 'PATCH',
      cookie: playerCookie,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ order }),
    })

    expect(response.status).not.toBe(413)
  })
})

/**
 * The half that outlives the four fixes.
 *
 * Nobody wrote the list this runs over: every handler under `server/api/` is
 * discovered, so the failure it catches is the one that actually happens — a
 * new endpoint, months from now, reading a body because that is what the
 * documentation shows.
 */
describe('every route that reads a body', () => {
  /** h3's body readers. `readBodyUnderCap` is not one: it is the measurement. */
  const READERS = ['readBody', 'readValidatedBody', 'readMultipartFormData', 'readRawBody', 'readFormData']

  /**
   * `[<(]` and not a word boundary, because `readBodyUnderCap` starts with
   * `readBody`: only a call counts, and that call is followed by a paren or a
   * type argument.
   */
  const CALL = new RegExp(`\\b(${READERS.join('|')})\\s*[<(]`)

  function handlers(directory = '', found: string[] = []): string[] {
    for (const entry of readdirSync(join(API, directory), { withFileTypes: true })) {
      const relative = directory ? `${directory}/${entry.name}` : entry.name
      if (entry.isDirectory()) handlers(relative, found)
      else if (entry.name.endsWith('.ts')) found.push(relative)
    }
    return found
  }

  const reading = handlers()
    .map(file => ({ file, source: readFileSync(join(API, file), 'utf8') }))
    .filter(({ source }) => CALL.test(source))

  it('has some to sweep', () => {
    // Cheap guard against the regex quietly matching nothing and the sweep
    // below passing over an empty list.
    expect(reading.length).toBeGreaterThan(3)
  })

  it('measures it first', () => {
    /*
     * A handler that reads without a ceiling is the defect this card was: the
     * body is buffered whole before anything can object. If a route ever needs
     * to stream instead, that is a decision — and it should have to be made
     * here too.
     */
    const unmeasured = reading
      .filter(({ source }) => !source.includes('readBodyUnderCap('))
      .map(({ file }) => file)

    expect(unmeasured).toEqual([])
  })

  it('measures it BEFORE reading it, not after', () => {
    // Ordering is the whole point: a ceiling checked after the read is a
    // ceiling that has already been paid for.
    const backwards = reading
      .filter(({ source }) => source.indexOf('readBodyUnderCap(') > CALL.exec(source)!.index)
      .map(({ file }) => file)

    expect(backwards).toEqual([])
  })
})
