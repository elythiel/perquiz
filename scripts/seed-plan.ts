/**
 * What the development seed contains, decided before a single row is written.
 *
 * The milestone's promise is "enough to exercise every later screen without
 * real players", which is a claim about the *shape* of the data, not about its
 * volume. So the shape is built here, as a pure function, and asserted in
 * tests/unit/seed-plan.spec.ts: a room with no photos, an empty sheet, a full
 * sheet, unanswered rooms, someone named twice on the same sheet, and a
 * leaderboard with a clean podium AND ties below it.
 *
 * Deterministic on purpose: `yarn seed` twice gives the same game, so a
 * screenshot, a bug report and a test all talk about the same state.
 */

export interface SeedPerson {
  name: string
  isAdmin: boolean
  /** Photos in their room. 0 means the room is not in play (SPEC §4). */
  photos: number
  /** Rooms they get right — their final score. */
  score: number
  /** Rooms they answer at all; the rest stay blank ("sans réponse"). */
  answered: number
}

/** Indices into `PEOPLE`, never database ids: the plan knows nothing of SQL. */
export interface SeedGuess {
  guesser: number
  room: number
  guessed: number
}

export interface SeedPlan {
  people: readonly SeedPerson[]
  /** Indices of the people whose room has at least one photo. */
  roomsInPlay: number[]
  guesses: SeedGuess[]
  /** Counted back from `guesses`, never copied from `score`. */
  scores: number[]
  /** Standard competition ranking: 1, 2, 2, 4… (SPEC §5). */
  ranks: number[]
}

/**
 * Ten players, one of them an admin — Sofia, so the M0 placeholder session
 * (`useSession`) points at a real seeded admin.
 *
 * The scores are chosen, not rolled: 7 / 6 / 5 gives the reveal show a podium
 * with three distinct steps, and the ties sit just below it (4 / 4 and 1 / 1)
 * so shared ranks are exercised without hiding the nominal case.
 */
/**
 * The photographs the rooms are made of, as Lorem Picsum identifiers.
 *
 * `picsum.photos/id/{id}/{w}/{h}` is a stable URL: the same id gives the same
 * photograph, today and next year, which is what lets `yarn seed` keep its
 * promise of producing the same game twice. The images come from Unsplash,
 * whose licence covers downloading, copying and storing them locally, with
 * attribution appreciated rather than required (unsplash.com/license, read
 * 2026-08-29).
 *
 * WRITTEN OUT, never computed. The catalogue has holes — 394 does not exist —
 * so an id derived by arithmetic would eventually land on nothing, at somebody
 * else's first seed rather than here.
 *
 * They are ordinary photographs and not interiors, which the game would have
 * preferred. MEASURED before giving up on it: the 993-photo catalogue was
 * inventoried and a quarter of it looked at, for three usable interiors — a
 * fonds of landscapes, cities and objects. Nine coherent sets, one of them six
 * views of a single home, are not in there, and an API key would not put them
 * there. What the seed needs is photographs that tell rooms apart, and that it
 * gets: one id every 33 across the whole catalogue, starting past the first
 * ten, which are ten desk shots by the same photographer.
 */
export const PHOTO_IDS: readonly number[] = [
  33, 66, 101, 135, 171, 204, 241, 277, 314, 350,
  384, 419, 454, 491, 524, 558, 598, 634, 670, 705,
  764, 799, 834, 870, 906, 942, 978, 1012, 1049,
]

export const PEOPLE: readonly SeedPerson[] = [
  { name: 'Sofia', isAdmin: true, photos: 4, score: 4, answered: 8 },
  { name: 'Camille', isAdmin: false, photos: 3, score: 3, answered: 6 },
  { name: 'Théo', isAdmin: false, photos: 5, score: 6, answered: 7 },
  { name: 'Inès', isAdmin: false, photos: 2, score: 5, answered: 8 },
  { name: 'Noah', isAdmin: false, photos: 3, score: 4, answered: 5 },
  { name: 'Léna', isAdmin: false, photos: 6, score: 7, answered: 8 },
  { name: 'Hugo', isAdmin: false, photos: 1, score: 1, answered: 3 },
  { name: 'Zoé', isAdmin: false, photos: 3, score: 2, answered: 4 },
  // No photos: their room never appears on a sheet, but they still guess.
  { name: 'Malo', isAdmin: false, photos: 0, score: 1, answered: 2 },
  // Never opened their sheet: the empty case for the participation dashboard.
  { name: 'Anaïs', isAdmin: false, photos: 2, score: 0, answered: 0 },
]

const SEED = 0x5E5E17

/** mulberry32 — small, fast, and identical on every machine. */
function randomFrom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6D2B79F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

/** The first person from `preferred` onwards who is neither the guesser nor the owner. */
function eligible(preferred: number, guesser: number, room: number, total: number): number {
  for (let step = 0; step < total; step++) {
    const person = (preferred + step) % total
    if (person !== guesser && person !== room) return person
  }
  throw new Error('a game with fewer than three players has nothing to guess')
}

export function buildSeedPlan(people: readonly SeedPerson[] = PEOPLE): SeedPlan {
  const random = randomFrom(SEED)
  const everyone = people.map((_, index) => index)
  const roomsInPlay = everyone.filter(index => people[index]!.photos > 0)

  const guesses: SeedGuess[] = []

  for (const guesser of everyone) {
    // A sheet covers every room in play except the guesser's own (SPEC §4).
    const sheet = shuffled(roomsInPlay.filter(room => room !== guesser), random)
    const { score, answered } = people[guesser]!

    sheet.slice(0, answered).forEach((room, rank) => {
      if (rank < score) {
        // The right answer is simply the room's owner.
        guesses.push({ guesser, room, guessed: room })
        return
      }

      // Wrong answers alternate between two habits, because each one keeps a
      // different screen honest. Every other one names the guesser's "usual
      // suspect", so a sheet ends up naming the same person twice — the
      // duplicate M4 warns about. The others fan out from the room itself, so
      // a room collects several different names and M7 has a bar chart to
      // draw rather than a single bar next to « sans réponse ».
      const wrongRank = rank - score
      const preferred = wrongRank % 2 === 0 ? 0 : room + wrongRank
      guesses.push({ guesser, room, guessed: eligible(preferred, guesser, room, people.length) })
    })
  }

  const scores = everyone.map(person =>
    guesses.filter(guess => guess.guesser === person && guess.guessed === guess.room).length)

  const ranks = scores.map(score => 1 + scores.filter(other => other > score).length)

  return { people, roomsInPlay, guesses, scores, ranks }
}
