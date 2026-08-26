import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { sql } from 'drizzle-orm'
import sharp from 'sharp'
import { dataDirectories, migrateDatabase, openDatabase } from '../server/database/client.ts'
import { appState, guesses, identities, photos, users } from '../server/database/schema.ts'
import { buildSeedPlan } from './seed-plan.ts'

/**
 * Fills a development database with a game nobody had to play.
 *
 * Destructive and deliberate: it empties every game table and the photo
 * directory, then rewrites them from `seed-plan.ts`. Re-running it produces
 * byte-identical output, so two developers comparing a screen are looking at
 * the same game.
 *
 *   yarn seed
 */

if (process.env.NODE_ENV === 'production') {
  console.error('seed: refusing to run with NODE_ENV=production — this wipes the database.')
  process.exit(1)
}

const WIDTH = 1600
const HEIGHT = 1200

/** The design system's five accents: one per room, so rooms read apart. */
const ACCENTS = ['#4fe3c1', '#8b7bff', '#ff6b8a', '#ffc45a', '#78b4ff']

const dataDir = process.env.NUXT_DATA_DIR ?? './data'
const { root, photos: photoDir } = dataDirectories(dataDir)

/**
 * A placeholder that never names its owner.
 *
 * The room number is fine — the room → owner mapping is the secret (SPEC §3),
 * and a dev who needs it can read the database. The stripes shift with the
 * photo index so a carousel visibly moves even where no font is installed.
 */
function placeholderSvg(room: number, index: number): string {
  const accent = ACCENTS[room % ACCENTS.length]!
  const stripes = Array.from({ length: 5 }, (_, i) => {
    const y = ((index * 90) + (i * 240)) % HEIGHT
    return `<rect x="0" y="${y}" width="${WIDTH}" height="46" fill="${accent}" opacity="0.16"/>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#12141f"/>
    ${stripes}
    <circle cx="${260 + (index * 130) % 1100}" cy="820" r="150" fill="${accent}" opacity="0.28"/>
    <text x="50%" y="46%" text-anchor="middle" font-family="sans-serif"
          font-size="360" font-weight="700" fill="${accent}">${room + 1}</text>
    <text x="50%" y="58%" text-anchor="middle" font-family="sans-serif"
          font-size="64" fill="#f1f3f8" opacity="0.7">pièce ${room + 1} · photo ${index + 1}</text>
  </svg>`
}

/** Deterministic, and shaped like the random ids M3 will mint for real. */
function photoFilename(room: number, index: number): string {
  return `${createHash('sha256').update(`perquiz-seed:${room}:${index}`).digest('hex').slice(0, 16)}.webp`
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
db.update(appState).set({ phase: 'open', lockedAt: null }).run()
clearPhotos()

// The tables are AUTOINCREMENT — ids are never reused, so a deleted player's
// id can never be handed to someone else and make a stale link point at the
// wrong person. That guarantee also means a re-seed would keep counting from
// where the last one stopped; resetting the counters is what makes two runs
// produce the same game down to the ids.
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

let written = 0
for (const [room, person] of plan.people.entries()) {
  for (let index = 0; index < person.photos; index++) {
    const filename = photoFilename(room, index)
    await sharp(Buffer.from(placeholderSvg(room, index)))
      .webp({ quality: 82 })
      .toFile(join(photoDir, filename))

    db.insert(photos)
      .values({ userId: ids[room]!, filename, position: index })
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
console.log(`seed: phase is "open" — until M6 lands, ?phase=locked and ?phase=revealed switch it in dev\n`)

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
