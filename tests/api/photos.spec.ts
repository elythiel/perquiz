import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import sharp from 'sharp'
import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_PHOTOS_PER_ROOM, MAX_UPLOAD_BYTES } from '../../shared/utils/photos'
import { useTestApi } from '../support/api'

/**
 * The last two invariants of SPEC §9: photographs leave the server only through
 * an authenticated route, with their metadata gone, and an upload is judged by
 * its bytes rather than by its name.
 *
 * Both matter more here than they would in most apps. The pictures are of
 * people's homes, so the EXIF a phone attaches — GPS first, but a timestamp
 * narrows a room down too — is the answer key in a sidecar. And "it ends in
 * .jpg" is a claim made by whoever is uploading.
 */

let owner: number
let ownerCookie: string
let neighbour: number
let neighbourCookie: string
let moderator: number
let adminCookie: string

beforeEach(async () => {
  const api = await useTestApi()
  api.reset()

  owner = api.createUser('Alice')
  ownerCookie = await api.signIn(owner)
  neighbour = api.createUser('Bruno')
  neighbourCookie = await api.signIn(neighbour)
  moderator = api.createUser('Régie', { isAdmin: true })
  adminCookie = await api.signIn(moderator)
})

/** A real image, made here rather than committed as a fixture. */
function image(format: 'jpeg' | 'png' | 'webp', options: { exif?: boolean } = {}) {
  const canvas = sharp({
    create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 40, b: 40 } },
  })

  const tagged = options.exif
    ? canvas.withExif({
        IFD0: { Copyright: 'Alice', Software: 'Perquiz test', DateTime: '2026:08:27 21:04:00' },
        // IFD3 is the GPS directory, as libvips names it. Coordinates of the
        // living room being photographed are exactly what must not survive.
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '48/1 51/1 2604/100', GPSLongitudeRef: 'E' },
      })
    : canvas

  return tagged[format]().toBuffer()
}

async function upload(
  bytes: Uint8Array,
  options: { filename?: string, type?: string, cookie?: string } = {},
) {
  const api = await useTestApi()
  const form = new FormData()
  form.append(
    'photo',
    new Blob([bytes as BufferSource], { type: options.type ?? 'image/jpeg' }),
    options.filename ?? 'room.jpg',
  )

  return api.fetch('/api/my-room/photos', {
    method: 'POST',
    cookie: options.cookie ?? ownerCookie,
    body: form,
  })
}

/**
 * The same upload, sent the way a `content-length` header cannot describe.
 *
 * A `ReadableStream` body is what makes the request chunked: undici cannot know
 * the length ahead of time, so it announces none — which is precisely the hole
 * card 80 closed. The multipart bytes are borrowed from a `FormData` that
 * undici serialises for us, then re-emitted by hand, so the parser downstream
 * sees exactly what it would have seen from a browser.
 *
 * `pull` is called only when the server reads, so `sent()` counts what was
 * actually taken off us rather than what we were prepared to give — which is
 * how the test below can tell "refused" from "refused after swallowing it all".
 */
async function chunked(bytes: Uint8Array, options: { repeat?: number } = {}) {
  const form = new FormData()
  form.append('photo', new Blob([bytes as BufferSource], { type: 'image/jpeg' }), 'room.jpg')

  const packed = new Request('http://localhost/pack', { method: 'POST', body: form })
  const contentType = packed.headers.get('content-type')!
  const multipart = new Uint8Array(await packed.arrayBuffer())

  const offered = multipart.byteLength * (options.repeat ?? 1)
  let sent = 0

  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= offered) return controller.close()
      // Sixty-four kilobytes at a time, the way a real sender arrives — and
      // cycling through the payload rather than materialising the whole offer,
      // so the bound measured below is the ceiling and not the chunk size.
      const offset = sent % multipart.byteLength
      const slice = multipart.subarray(offset, Math.min(offset + 64 * 1024, multipart.byteLength))
      controller.enqueue(slice)
      sent += slice.byteLength
    },
  })

  const api = await useTestApi()
  const response = await api.fetch('/api/my-room/photos', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { 'content-type': contentType },
    body,
    // Required by fetch for a streamed request body, and not in the DOM types.
    duplex: 'half',
  } as RequestInit & { cookie: string })

  return { response, sent: () => sent, offered }
}

describe('serving a photograph', () => {
  it('hands the bytes to any signed-in player, with no shared cache and no name', async () => {
    const api = await useTestApi()
    const name = api.addPhoto(owner, { bytes: await image('webp') })

    // Every participant needs to see every room: that is the game. What the
    // response must not carry is anything about whose room it is.
    const response = await api.fetch(`/api/photos/${name}/web`, { cookie: neighbourCookie })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(response.headers.get('cache-control')).toBe('private, max-age=31536000, immutable')
    expect(response.headers.get('content-disposition')).toBeNull()
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0)
  })

  it.each([
    ['a name that is not one', 'nope'],
    ['a traversal', '..%2F..%2F..%2Fetc%2Fpasswd'],
    ['a shorter hex string', 'abcdef'],
    ['a name that is not in the database', 'a'.repeat(32)],
  ])('answers 404 to %s', async (_label, name) => {
    const api = await useTestApi()
    api.addPhoto(owner)

    const response = await api.fetch(`/api/photos/${name}/web`, { cookie: ownerCookie })
    expect(response.status).toBe(404)
  })

  it('answers 404 to a variant that does not exist', async () => {
    const api = await useTestApi()
    const name = api.addPhoto(owner)

    // `original` is the one nobody may ask for: it is never written to disk.
    for (const variant of ['original', 'full', '']) {
      expect((await api.fetch(`/api/photos/${name}/${variant}`, { cookie: ownerCookie })).status)
        .toBe(404)
    }
  })

  it('answers 404 when the row outlived its file', async () => {
    const api = await useTestApi()
    const name = api.addPhoto(owner)
    const { unlinkSync } = await import('node:fs')
    unlinkSync(join(api.photoDirectory, `${name}-web.webp`))

    expect((await api.fetch(`/api/photos/${name}/web`, { cookie: ownerCookie })).status).toBe(404)
  })
})

describe('what an upload is judged on', () => {
  it.each(['jpeg', 'png', 'webp'] as const)('accepts a real %s', async (format) => {
    const response = await upload(await image(format), { filename: 'whatever.txt', type: 'text/plain' })

    // The extension and the browser's content-type are both a stranger's word;
    // only the header decides.
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ position: 0 })
  })

  it('refuses text dressed up as a photograph', async () => {
    const response = await upload(new TextEncoder().encode('GIF89a is not one either'), {
      filename: 'room.jpg',
      type: 'image/jpeg',
    })

    expect(response.status).toBe(415)
  })

  it('refuses a HEIC by name, since it can say what to do about it', async () => {
    // An ISO base-media header with a HEIF brand: recognised on purpose, so the
    // person is told "this is a HEIC" rather than "unsupported file".
    const heic = new Uint8Array(32)
    heic.set([0x00, 0x00, 0x00, 0x18], 0)
    heic.set([...'ftypheic'].map(char => char.charCodeAt(0)), 4)

    const response = await upload(heic, { filename: 'IMG_0001.HEIC' })
    expect(response.status).toBe(415)
    expect((await response.json()).statusMessage ?? (await response.text())).toMatch(/heic/i)
  })

  it('refuses an image header with a body sharp cannot read', async () => {
    const broken = new Uint8Array(64)
    broken.set([0xFF, 0xD8, 0xFF, 0xE0], 0)

    expect((await upload(broken)).status).toBe(422)
  })

  it('refuses a request that announces more than the ceiling', async () => {
    const tooBig = new Uint8Array(MAX_UPLOAD_BYTES + 1_000_000)
    tooBig.set([0xFF, 0xD8, 0xFF], 0)

    // Refused on the announced length, before the body is buffered.
    expect((await upload(tooBig)).status).toBe(413)
  })

  it('refuses a request carrying no file at all', async () => {
    const api = await useTestApi()
    const form = new FormData()
    form.append('note', 'no photo here')

    const response = await api.fetch('/api/my-room/photos', {
      method: 'POST',
      cookie: ownerCookie,
      body: form,
    })

    expect(response.status).toBe(400)
  })

  it('stops at ten photographs in a room', async () => {
    const api = await useTestApi()
    for (let index = 0; index < MAX_PHOTOS_PER_ROOM; index++) api.addPhoto(owner)

    expect((await upload(await image('jpeg'))).status).toBe(409)
  })

  it('is closed once the game is locked', async () => {
    const api = await useTestApi()
    api.setPhase('locked')

    expect((await upload(await image('jpeg'))).status).toBe(409)
  })
})

describe('what gets stored', () => {
  it('keeps no metadata, and no original', async () => {
    const api = await useTestApi()
    const tagged = await image('jpeg', { exif: true })

    // Proving there was something to strip: without this the test would pass
    // just as happily against a fixture that never carried EXIF.
    expect((await sharp(tagged).metadata()).exif).toBeDefined()

    const response = await upload(tagged)
    expect(response.status).toBe(201)

    const { name } = await response.json()
    const files = ['web', 'thumb'].map(variant => join(api.photoDirectory, `${name}-${variant}.webp`))

    for (const file of files) {
      expect(existsSync(file)).toBe(true)
      const metadata = await sharp(readFileSync(file)).metadata()

      expect(metadata.format).toBe('webp')
      // Not a step in the pipeline — a consequence of never keeping the file
      // that arrived. Both are asserted because either one coming back would
      // mean the re-encode started carrying metadata over.
      expect(metadata.exif).toBeUndefined()
      expect(metadata.orientation).toBeUndefined()
    }

    // The bytes that arrived are nowhere on disk: two variants, no third file.
    const { readdirSync } = await import('node:fs')
    expect(readdirSync(api.photoDirectory).filter(entry => entry.startsWith(name)))
      .toHaveLength(2)
  })

  it('names the file after nothing at all', async () => {
    /*
     * The invariant is SPEC §9: nothing in a photograph's name may point back
     * at whose room it is. What is hard is saying so without asking the
     * question of a coin.
     *
     * This used to search one random name for the owner's id as a substring,
     * which tested the dice rather than the code: a 32-character hex string
     * contains a given two-digit number about 11% of the time, so the suite
     * went red roughly one run in nine. Worse, the odds were an accident of
     * how many accounts happened to exist before it ran — a single-digit id
     * would have failed 87% of the time, a four-digit one never.
     *
     * So the question is asked of the code instead. A name derived from the
     * owner — hashed, prefixed, however — is the same name twice for the same
     * owner; a name derived from the bytes is the same name for the same
     * image. Both collide, and a random one never does. No dice, and it
     * catches the two ways this could actually be got wrong.
     */
    const same = await image('png')

    const mine = await (await upload(same)).json()
    const again = await (await upload(same)).json()
    const theirs = await (await upload(same, { cookie: neighbourCookie })).json()

    for (const { name } of [mine, again, theirs]) {
      expect(name).toMatch(/^[0-9a-f]{32}$/)
    }

    // Same owner, same bytes, twice: nothing about either was reused.
    expect(again.name).not.toBe(mine.name)
    expect(theirs.name).not.toBe(mine.name)
  })

  it('resizes the long edge down to the web variant', async () => {
    const api = await useTestApi()
    const wide = await sharp({
      create: { width: 3000, height: 1000, channels: 3, background: 'blue' },
    }).jpeg().toBuffer()

    const { name } = await (await upload(wide)).json()
    const web = await sharp(readFileSync(join(api.photoDirectory, `${name}-web.webp`))).metadata()
    const thumb = await sharp(readFileSync(join(api.photoDirectory, `${name}-thumb.webp`))).metadata()

    expect(web.width).toBe(1600)
    expect(thumb.width).toBe(400)
  })
})

describe('who may remove a photograph', () => {
  it('lets an owner remove their own, and takes the files with it', async () => {
    const api = await useTestApi()
    const name = api.addPhoto(owner)

    const response = await api.fetch(`/api/my-room/photos/${name}`, {
      method: 'DELETE',
      cookie: ownerCookie,
    })

    expect(response.status).toBe(200)
    expect(existsSync(join(api.photoDirectory, `${name}-web.webp`))).toBe(false)
    expect(existsSync(join(api.photoDirectory, `${name}-thumb.webp`))).toBe(false)
  })

  it('refuses to let a player reach into someone else’s room', async () => {
    const api = await useTestApi()
    const name = api.addPhoto(owner)

    const response = await api.fetch(`/api/my-room/photos/${name}`, {
      method: 'DELETE',
      cookie: neighbourCookie,
    })

    expect(response.status).toBe(404)
    // Still there: the scope is the owner, so nothing was touched.
    expect(existsSync(join(api.photoDirectory, `${name}-web.webp`))).toBe(true)
    expect(api.db.all<{ count: number }>(sql`select count(*) as count from photos`)[0]!.count).toBe(1)
  })

  it('lets a moderator reach into any room, and says nothing about whose it was', async () => {
    const api = await useTestApi()
    const name = api.addPhoto(owner)
    api.addPhoto(owner)
    api.addGuess(neighbour, owner, moderator)

    const response = await api.fetch(`/api/admin/photos/${name}`, {
      method: 'DELETE',
      cookie: adminCookie,
    })

    expect(response.status).toBe(200)
    // A count of what is left in that room, and nothing that names it.
    expect(await response.json()).toEqual({ remaining: 1, discardedGuesses: 0 })
  })

  it('discards the answers about a room that has just left play', async () => {
    const api = await useTestApi()
    const name = api.addPhoto(owner)
    api.addGuess(neighbour, owner, moderator)

    const response = await api.fetch(`/api/my-room/photos/${name}`, {
      method: 'DELETE',
      cookie: ownerCookie,
    })

    // The last photograph: the room leaves everyone's sheet, so the answers
    // written about it go with it rather than scoring against a room nobody
    // can see any more.
    expect(await response.json()).toEqual({ remaining: 0, discardedGuesses: 1 })
    expect(api.db.all<{ count: number }>(sql`select count(*) as count from guesses`)[0]!.count).toBe(0)
  })
})
/**
 * The ceiling, when the request declines to say how heavy it is.
 *
 * `content-length` is a claim, and a chunked request does not even make it. The
 * check that read the header therefore saw zero and waved the request through,
 * and `readMultipartFormData` buffered the whole body before anything could be
 * measured — an authenticated player could spend the process's memory (card
 * 80). The ceiling now counts while reading.
 */
describe('an upload that announces no length', () => {
  it('goes through when it stays under the ceiling', async () => {
    // First of all a guard on the test itself: if a streamed body did not work
    // at all, the refusal below would prove nothing about the ceiling.
    const { response, sent } = await chunked(await image('jpeg'))

    expect(response.status).toBe(201)
    expect(sent()).toBeGreaterThan(0)
  })

  it('is refused at the ceiling, without the whole body being read', async () => {
    // Sixteen copies of a file already at the limit: ~240MB offered, and the
    // process has no business holding any of it.
    const atTheLimit = new Uint8Array(MAX_UPLOAD_BYTES)
    atTheLimit.set([0xFF, 0xD8, 0xFF], 0)

    const { response, sent, offered } = await chunked(atTheLimit, { repeat: 16 })

    expect(response.status).toBe(413)

    // The assertion that makes this test about memory rather than about status
    // codes: the read stopped near the ceiling instead of at the end.
    expect(offered).toBeGreaterThan(MAX_UPLOAD_BYTES * 10)
    // A tight bound on purpose: the ceiling plus one queued slice, not the
    // ceiling plus whatever the chunk size happened to be.
    expect(sent()).toBeLessThan(MAX_UPLOAD_BYTES * 1.1)
  })

  it('does not leave the room holding a photograph it refused', async () => {
    const api = await useTestApi()
    const atTheLimit = new Uint8Array(MAX_UPLOAD_BYTES)
    atTheLimit.set([0xFF, 0xD8, 0xFF], 0)

    await chunked(atTheLimit, { repeat: 16 })

    const held = api.db.all<{ count: number }>(
      sql`select count(*) as count from photos where user_id = ${owner}`,
    )[0]!.count

    expect(held).toBe(0)
  })
})
