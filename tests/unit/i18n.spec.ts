import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import { UPLOAD_FAILURES } from '../../shared/utils/photos'

// The locale file is the only place a player-facing string may live. These
// tests read it off disk — no Nuxt runtime, same trick as the contrast audit.
const ROOT = fileURLToPath(new URL('../..', import.meta.url))

/**
 * One namespace per screen or shared element, then strings — with one level of
 * grouping allowed where the sub-keys are looked up dynamically, as
 * `myRoom.errors.<reason>` is from the slug a failed request answers with.
 */
interface Messages { [key: string]: string | Messages }

const messages: Messages = JSON.parse(readFileSync(join(ROOT, 'i18n/locales/fr.json'), 'utf8'))

const i18n = createI18n({ legacy: false, locale: 'fr', messages: { fr: messages } })
const { t, te } = i18n.global

/** Every `.vue` and `.ts` file under `app/`, concatenated. */
function appSource(): string {
  const parts: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (/\.(vue|ts)$/.test(entry.name)) parts.push(readFileSync(path, 'utf8'))
    }
  }
  walk(join(ROOT, 'app'))
  return parts.join('\n')
}

const source = appSource()

/** Every key the app asks for, harvested from `t('…')` and `$t('…')` calls. */
function usedKeys(): string[] {
  // `\bt(` alone would also match `split(` or `.at(`: the lookbehind rejects
  // anything word-ish (or a `$`) right before the `t`.
  const found = [...source.matchAll(/(?<![\w$])\$?t\(\s*'([^']+)'/g)].map(([, key]) => key!)

  return [...new Set(found)].sort()
}

describe('the French locale', () => {
  it('answers every key the app asks for', () => {
    const keys = usedKeys()
    // Guards the harvest itself: a broken regex would otherwise pass silently.
    expect(keys.length).toBeGreaterThan(10)
    expect(keys.filter(key => !te(key))).toEqual([])
  })

  /**
   * Scaffolding copy is a thing that ships.
   *
   * `myRoom.milestone` read "M3 — Ma pièce" and fed a placeholder screen that
   * no page rendered any more; the harvest above cannot see it, because it only
   * checks that the keys the app ASKS for exist. This looks the other way.
   */
  it('names no milestone', () => {
    const milestoneLabels = (node: Messages, path = ''): string[] =>
      Object.entries(node).flatMap(([key, value]) => {
        const here = path ? `${path}.${key}` : key
        if (typeof value !== 'string') return milestoneLabels(value, here)
        return /\bM\d+\b/.test(value) ? [`${here}: ${value}`] : []
      })

    expect(milestoneLabels(messages)).toEqual([])
  })

  /**
   * The other direction, and the general case.
   *
   * The harvest above proves the file answers what the app asks; it cannot see
   * a key the app stopped asking for. Six had outlived their screens by
   * vikunja-107 — a photo counter, a room description, two empty states — and
   * nothing ever turned red. `names no milestone` looks this way already, but
   * only for one particular smell; this looks for the smell itself.
   */
  it('carries no key the app never asks for', () => {
    /*
     * Deliberately looser than the harvest above, which only sees a key inside
     * a `t('…')` call. Plenty are written somewhere else and are perfectly
     * alive: `PhaseChip` and `PhaseControl` keep theirs in a lookup table,
     * `login.vue` in a map from an error slug, `DeckProgress` picks between two
     * in a ternary. Asking whether the name appears in `app/` AT ALL is the
     * question that has no false positives — a locale key is distinctive
     * enough that a chance match is not a realistic worry.
     */
    const dynamic = ['theme.', 'font.', 'myRoom.errors.']

    const leaves = (node: Messages, path = ''): string[] =>
      Object.entries(node).flatMap(([key, value]) => {
        const here = path ? `${path}.${key}` : key
        return typeof value === 'string' ? [here] : leaves(value, here)
      })

    const orphans = leaves(messages).filter(key =>
      !source.includes(key) && !dynamic.some(prefix => key.startsWith(prefix)),
    )

    expect(orphans).toEqual([])
  })

  /**
   * The upload contract, from both ends.
   *
   * `myRoom.errors.*` is looked up from a slug the server chose, so it is
   * exempt from the orphan check above and the two halves could drift apart
   * unnoticed in either direction. A slug with no sentence reaches the screen
   * as its own key — which is how « The rooms are no longer editable » got
   * there — and a sentence with no slug is copy nobody will ever read.
   */
  it('has a sentence for every upload failure, and no spare ones', () => {
    // `failed` is the browser's own fallback rather than a slug the server
    // sends, and the two name errors belong to the rename form, not to an
    // upload. Both are named here so the list stays a closed set.
    const expected = [...UPLOAD_FAILURES, 'failed', 'name-taken', 'name-invalid'].sort()
    const written = Object.keys((messages.myRoom as Messages).errors as Messages).sort()

    expect(written).toEqual(expected)
  })

  it('uses typographic apostrophes', () => {
    const straight = (node: Messages, path = ''): string[] =>
      Object.entries(node).flatMap(([key, value]) => {
        const here = path ? `${path}.${key}` : key
        if (typeof value !== 'string') return straight(value, here)
        return value.includes('\'') ? [`${here}: ${value}`] : []
      })

    // French copy set with a typewriter apostrophe is the tell of a string
    // nobody proofread; it is also the one that breaks the type of the rest.
    expect(straight(messages)).toEqual([])
  })

  it('has no empty string', () => {
    const empty = (node: Messages, path = ''): string[] =>
      Object.entries(node).flatMap(([key, value]) => {
        const here = path ? `${path}.${key}` : key
        if (typeof value !== 'string') return empty(value, here)
        return value.trim() === '' ? [here] : []
      })

    expect(empty(messages)).toEqual([])
  })
})

describe('the message format', () => {
  // Exercised now, before the real screens land: a locale file that cannot
  // pluralise or interpolate is a thing you want to discover on day one.
  it('pluralises and interpolates in one go (docs/SPEC.md §4)', () => {
    /*
     * `guess.progress` carried this until vikunja-107. The deck kept the bare
     * fraction (`guess.counter`) and the worded version stopped shipping, so
     * the assertion had outlived its message: a string alive only because a
     * test named it is the smell the two checks above exist to catch.
     *
     * Same section, same shape, on copy the sheet really renders —
     * `SuspectGrid.vue` naming the rooms a suspect is already down for.
     */
    const used = (rooms: readonly string[]) =>
      t('guess.suspectUsed', { rooms: rooms.join(' et ') }, rooms.length)

    /*
     * The message carries three forms because vue-i18n indexes zero, one and
     * many separately in French, and the first two agree. Only the two the
     * sheet can reach are asserted: it never names a suspect used in no room.
     */
    expect(used(['2'])).toBe('Déjà désigné pour la pièce 2')
    expect(used(['2', '5'])).toBe('Déjà désigné pour les pièces 2 et 5')
  })
})

/**
 * Sentences carrying two numbers.
 *
 * vue-i18n pluralises a message on ONE count, so a second number in the same
 * sentence never agrees: a two-player party read "1 participants", a room with
 * one photo read "Ses 1 photos". The fix is one message per number, composed
 * through a carrier that keeps the word order here rather than in a component —
 * and the boundary worth pinning is 1, which is where every one of them broke.
 */
describe('two numbers in one sentence', () => {
  /** The same composition the pages do, kept next to what it asserts. */
  const fragment = (key: string, count: number) => t(key, { count }, count)

  it('agrees on both halves of the dashboard tally', () => {
    const tally = (rooms: number, players: number) => t('home.tally', {
      rooms: fragment('home.tallyRooms', rooms),
      players: fragment('home.tallyPlayers', players),
    })

    expect(tally(1, 2)).toBe('1 pièce en jeu, 2 participants')
    expect(tally(9, 10)).toBe('9 pièces en jeu, 10 participants')
    // The party of two, which is what this test exists for.
    expect(tally(1, 1)).toBe('1 pièce en jeu, 1 participant')
  })

  it('names the audience of one as a person, not as a count', () => {
    /*
     * The photo count left this sentence with vikunja-100 — the region's
     * heading carries it now — but the plural did not: it is what makes the
     * verb and the possessive agree. So the message still takes a count to
     * choose its form and no longer interpolates one, which is the shape
     * `my-room.vue` calls it with.
     */
    const summary = (photos: number, others: number) => t('myRoom.summary', {
      others: fragment('myRoom.summaryOthers', others),
    }, photos)

    expect(summary(1, 1)).toBe('Votre photo apparaît sur la grille de l’autre joueur. Aucun nom n’est attaché.')
    expect(summary(3, 9)).toBe('Vos photos apparaissent sur la grille des 9 autres joueurs. Aucun nom n’est attaché.')
  })

  it('counts a removal without saying "1 photos"', () => {
    const body = (photos: number, made: number) => t('admin.confirmRemoveBody', {
      photos: fragment('admin.removalPhotos', photos),
      made: fragment('admin.removalMade', made),
    })

    expect(body(1, 1)).toBe('Sa photo, sa pièce et sa réponse seront supprimées.')
    expect(body(4, 8)).toBe('Ses 4 photos, sa pièce et ses 8 réponses seront supprimées.')
    // No photos is a real state — a participant who never uploaded.
    expect(body(0, 2)).toBe('Ses photos, sa pièce et ses 2 réponses seront supprimées.')
  })

  it('agrees on a podium score of one', () => {
    const score = (found: number, total: number) =>
      t('reveal.roomsOutOf', { score: found, total }, found)

    expect(score(1, 9)).toBe('1 pièce sur 9')
    expect(score(7, 9)).toBe('7 pièces sur 9')
  })
})
