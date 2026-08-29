import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { sql } from 'drizzle-orm'
import sharp from 'sharp'
import { dataDirectories, migrateDatabase, openDatabase } from '../server/database/client.ts'
import { appState, guesses, identities, photos, users } from '../server/database/schema.ts'
import { buildSeedPlan, PHOTO_IDS } from './seed-plan.ts'

/**
 * Fills a development database with a game nobody had to play.
 *
 * Destructive and deliberate: it empties every game table and the photo
 * directory, then rewrites them from `seed-plan.ts`. Re-running it produces
 * byte-identical output, so two developers comparing a screen are looking at
 * the same game.
 *
 * The rooms are real photographs now, fetched once from Lorem Picsum by the
 * fixed ids in `seed-plan.ts` and kept in a local cache. The FIRST run needs
 * the network; every run after it does not, because the cache survives the
 * wipe. Rectangles with a number in them were enough to prove the data had the
 * right shape, and useless for what this seed is actually for — looking at the
 * podium, the standings, the show and the thumbnails, and judging them.
 *
 *   yarn seed
 */

if (process.env.NODE_ENV === 'production') {
  console.error('seed: refusing to run with NODE_ENV=production — this wipes the database.')
  process.exit(1)
}

/** What Picsum is asked for: the widest variant the pipeline produces. */
const SOURCE_WIDTH = 1600
const SOURCE_HEIGHT = 1200

/** Matches the pipeline in server/utils/photos.ts: web ~1600px, thumb ~400px. */
const VARIANTS = [{ suffix: 'web', edge: 1600 }, { suffix: 'thumb', edge: 400 }]

const dataDir = process.env.NUXT_DATA_DIR ?? './data'
const { root, photos: photoDir } = dataDirectories(dataDir)

/**
 * Downloaded originals, kept between runs.
 *
 * Inside `photos/` and starting with a dot, which is not a detail: `clearPhotos()`
 * below wipes that directory on every seed and spares dotfiles — so the cache
 * lives through the wipe without that function needing to know it exists, and
 * the existing `.gitignore` rule for `data/` already covers it.
 */
const cacheDir = join(photoDir, '.source')

/**
 * One photograph, from the cache or from Picsum.
 *
 * The cache is what makes this bearable to the free service on the other end:
 * 29 requests once, then none. It is also what keeps the seed working on a
 * train — everything below only runs on a cold cache.
 *
 * FAILS RATHER THAN FALLS BACK, which is the same decision as everywhere else
 * in this file. A placeholder quietly standing in for a photograph would make
 * one developer's seed differ from another's for good, since the cache would
 * then hold the stand-in: the promise of a shared game, broken silently, which
 * is worse than a script that stops and says what happened.
 */
async function photograph(id: number): Promise<Buffer> {
  const cached = join(cacheDir, `${id}.jpg`)
  if (existsSync(cached)) return readFileSync(cached)

  const url = `https://picsum.photos/id/${id}/${SOURCE_WIDTH}/${SOURCE_HEIGHT}`
  let response: Response
  try {
    response = await fetch(url)
  }
  catch (cause) {
    throw new Error(
      `seed: cannot reach picsum.photos for photo ${id}.\n`
      + '       The first seed needs the network; later ones do not, because the\n'
      + `       downloads are kept in ${cacheDir}.`,
      { cause },
    )
  }

  if (!response.ok) {
    throw new Error(
      `seed: picsum.photos answered ${response.status} for photo ${id}.\n`
      + '       If that id is gone, replace it in PHOTO_IDS (scripts/seed-plan.ts)\n'
      + '       rather than letting the seed pick something else — two developers\n'
      + '       would stop looking at the same game without noticing.',
    )
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(cached, bytes)
  return bytes
}

function photoName(room: number, index: number): string {
  return createHash('sha256').update(`perquiz-seed:${room}:${index}`).digest('hex').slice(0, 32)
}

/**
 * Empties the photo directory without removing it.
 *
 * A blunt `rm -rf` would take `.gitkeep` with it, and that file is what keeps
 * `data/photos/` present on a fresh clone (see .gitignore). Dotfiles stay.
 */
function clearPhotos() {
  mkdirSync(photoDir, { recursive: true })
  for (const entry of readdirSync(photoDir)) {
    if (!entry.startsWith('.')) rmSync(join(photoDir, entry), { recursive: true, force: true })
  }
}

const plan = buildSeedPlan()
const db = migrateDatabase(openDatabase(dataDir))

const before = db.select().from(users).all().length
console.log(`seed: ${root}`)
console.log(`seed: wiping ${before} user(s), their photos, identities and guesses`)

// Order matters only for readability: the cascades would do it anyway.
db.delete(guesses).run()
db.delete(photos).run()
db.delete(identities).run()
db.delete(users).run()
// `open`, not the fresh-database default: the seed writes guesses, and a
// sheet shown closed over pre-filled answers is a screen that cannot happen.
db.update(appState).set({ phase: 'open', lockedAt: null }).run()
clearPhotos()

/*
 * The counters, back to zero — what makes two runs produce the same game down
 * to the ids, and a deliberate cost rather than a free one.
 *
 * The tables are AUTOINCREMENT precisely so ids are never reused. This line
 * suspends that: after it, the next `users` row is a DIFFERENT person at a
 * number somebody else held a minute ago. So nothing may key on a row number
 * to mean a person across a re-seed — a live session cookie included, which is
 * why it names `identities.provider` + `identities.subject` instead (card 79).
 * A cookie from a real provider stops resolving here; a seeded player's keeps
 * working, because `seed:<name>` below rewrites the same identity, which is the
 * same person.
 */
db.run(sql`delete from sqlite_sequence where name in ('users', 'identities', 'photos')`)

const provider = process.env.NUXT_OIDC_PROVIDER_ID ?? 'zitadel'

const ids = plan.people.map((person) => {
  const row = db.insert(users)
    .values({ displayName: person.name, isAdmin: person.isAdmin })
    .returning({ id: users.id })
    .get()

  db.insert(identities)
    .values({ userId: row.id, provider, subject: `seed:${person.name.toLowerCase()}` })
    .run()

  return row.id
})

/*
 * The list has to cover the plan, and saying so here costs three lines.
 *
 * Without it, adding a person to `seed-plan.ts` without extending `PHOTO_IDS`
 * hands sharp an `undefined` and fails somewhere far from the cause. The plan
 * is the thing people edit; the list is the thing they forget.
 */
const wanted = plan.people.reduce((total, person) => total + person.photos, 0)
if (PHOTO_IDS.length < wanted) {
  console.error(`seed: the plan wants ${wanted} photographs and PHOTO_IDS holds ${PHOTO_IDS.length}.`)
  console.error('       Add ids to PHOTO_IDS in scripts/seed-plan.ts — picsum.photos/images lists them.')
  process.exit(1)
}

let written = 0
let taken = 0
for (const [room, person] of plan.people.entries()) {
  for (let index = 0; index < person.photos; index++) {
    const name = photoName(room, index)
    // One id per photograph, in plan order: room 0 takes the first ones, and a
    // person with no photos consumes none, so the mapping is stable as long as
    // the plan is.
    const source = sharp(await photograph(PHOTO_IDS[taken++]!))
    for (const { suffix, edge } of VARIANTS) {
      await source.clone()
        .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(join(photoDir, `${name}-${suffix}.webp`))
    }

    db.insert(photos)
      .values({ userId: ids[room]!, filename: name, position: index })
      .run()
    written++
  }
}

for (const guess of plan.guesses) {
  db.insert(guesses)
    .values({
      guesserId: ids[guess.guesser]!,
      roomUserId: ids[guess.room]!,
      guessedUserId: ids[guess.guessed]!,
    })
    .run()
}

console.log(`seed: ${plan.people.length} players, ${plan.roomsInPlay.length} rooms in play, `
  + `${written} photos, ${plan.guesses.length} guesses`)
console.log(`seed: phase is "open" — a seeded game is one already being played, not one being set up\n`)

const plural = (count: number, one: string, many = `${one}s`) => count === 1 ? one : many

const order = plan.people.map((_, index) => index).sort((a, b) => plan.ranks[a]! - plan.ranks[b]!)
for (const index of order) {
  const person = plan.people[index]!
  const sheet = plan.guesses.filter(guess => guess.guesser === index).length
  const room = person.photos === 0 ? 'no room' : `${person.photos} ${plural(person.photos, 'photo')}`
  console.log([
    `  #${String(plan.ranks[index]).padStart(2)}`,
    person.name.padEnd(9),
    `${plan.scores[index]} ${plural(plan.scores[index]!, 'pt')}`.padEnd(7),
    `${sheet} ${plural(sheet, 'answer')}`.padEnd(10),
    room,
    person.isAdmin ? '(admin)' : '',
  ].join(' ').trimEnd())
}
