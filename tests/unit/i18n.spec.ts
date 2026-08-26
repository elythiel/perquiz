import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

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

/** Every key the app asks for, harvested from `t('…')` and `$t('…')` calls. */
function usedKeys(): string[] {
  const found = new Set<string>()
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(path)
      }
      else if (/\.(vue|ts)$/.test(entry.name)) {
        // `\bt(` alone would also match `split(` or `.at(`: the lookbehind
        // rejects anything word-ish (or a `$`) right before the `t`.
        for (const [, key] of readFileSync(path, 'utf8').matchAll(/(?<![\w$])\$?t\(\s*'([^']+)'/g)) {
          found.add(key!)
        }
      }
    }
  }
  walk(join(ROOT, 'app'))
  return [...found].sort()
}

describe('the French locale', () => {
  it('answers every key the app asks for', () => {
    const keys = usedKeys()
    // Guards the harvest itself: a broken regex would otherwise pass silently.
    expect(keys.length).toBeGreaterThan(10)
    expect(keys.filter(key => !te(key))).toEqual([])
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
    const progress = (done: number, total: number) =>
      t('guess.progress', { done, total }, done)

    // French keeps the singular at zero, hence the three forms in the file.
    expect(progress(0, 8)).toBe('0 / 8 pièce devinée')
    expect(progress(1, 8)).toBe('1 / 8 pièce devinée')
    expect(progress(3, 8)).toBe('3 / 8 pièces devinées')
  })

  it('pluralises tied ranks (docs/SPEC.md §5)', () => {
    expect(t('results.tie', { count: 1 }, 1)).toBe('1 joueur ex æquo')
    expect(t('results.tie', { count: 3 }, 3)).toBe('3 joueurs ex æquo')
  })
})
