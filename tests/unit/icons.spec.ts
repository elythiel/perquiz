import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import lucide from '@iconify-json/lucide/icons.json' with { type: 'json' }
import pixelarticons from '@iconify-json/pixelarticons/icons.json' with { type: 'json' }
import { describe, expect, it } from 'vitest'
import { ICON_SETS, ICONS, iconBundle, iconFor } from '#shared/utils/icons'

/**
 * The two icon sets, and the one thing that can go wrong quietly.
 *
 * `<BaseIcon>` builds its icon name at render time, so `clientBundle.scan`
 * cannot see it and `provider: 'none'` means nothing fetches it either. A name
 * that is wrong, or missing from the bundle, does not throw and does not warn
 * — the glyph simply is not there. None of that shows up in a component test,
 * so it is checked here, against the collections themselves.
 */

const COLLECTIONS = { pixelarticons, lucide } as Record<string, { icons: Record<string, unknown>, aliases?: Record<string, unknown> }>

/** A collection lists some names under `aliases`; both draw something. */
function has(collection: string, name: string): boolean {
  const set = COLLECTIONS[collection]!
  return name in set.icons || Boolean(set.aliases && name in set.aliases)
}

describe('the icon table', () => {
  it('names a glyph that exists, in both sets', () => {
    // The failure this catches is a typo in the table: `circle-help` misspelt
    // is not an error anywhere, it is one screen with a gap in it.
    const missing = Object.keys(ICONS).flatMap(name =>
      (Object.keys(ICON_SETS) as (keyof typeof ICON_SETS)[])
        .map(choice => iconFor(name as keyof typeof ICONS, choice))
        .filter(full => !has(full.split(':')[0]!, full.split(':')[1]!)))

    expect(missing).toEqual([])
  })

  it('covers every name the app asks for', () => {
    /*
     * The inventory, taken from the templates rather than trusted.
     *
     * This is the check that would have caught the defect this card nearly
     * shipped: the first pass through the sources read `name="…"` and missed
     * the four call sites passing an icon as a prop called `icon`, so `search`
     * — the magnifier vikunja-99 added — was left out of the table. It would
     * have rendered nothing on « Ma pièce », silently.
     */
    const asked = new Set<string>()
    const walk = (dir: string) => {
      for (const entry of readdirSync(fileURLToPath(new URL(dir, ROOT)))) {
        const path = join(dir, entry)
        if (statSync(fileURLToPath(new URL(path, ROOT))).isDirectory()) walk(path)
        else if (entry.endsWith('.vue')) {
          const source = readFileSync(fileURLToPath(new URL(path, ROOT)), 'utf8')
          for (const [, name] of source.matchAll(/(?:name|icon)[=:]\s*["']([a-z][a-z-]*)["']/g)) asked.add(name!)
        }
      }
    }
    walk('app')

    // Only the ones that are icons: the same sweep sees `name="phase"` on a
    // radio group. An icon name the table knows is the definition of one.
    const iconish = [...asked].filter(name => name in ICONS)
    expect(iconish.length).toBeGreaterThan(15)

    const unknown = [...asked].filter(name => /^(archive|arrow-left|article|check|checklist|chevron-|circle-|close|gamepad|image|laptop|lock|logout|moon|play|plus|projector|search|sun|trash|trophy)/.test(name) && !(name in ICONS))
    expect(unknown).toEqual([])
  })
})

const ROOT = new URL('../..', import.meta.url)

describe('the bundle declaration', () => {
  it('lists both sets for every name, and nothing else', () => {
    const bundle = iconBundle()
    expect(bundle).toHaveLength(Object.keys(ICONS).length * Object.keys(ICON_SETS).length)
    expect(new Set(bundle).size).toBe(bundle.length)
  })

  it('is what nuxt.config declares, derived and not copied', () => {
    // A literal list in the config would drift from the table on the first
    // icon anybody adds, and drift without saying so.
    const config = readFileSync(fileURLToPath(new URL('nuxt.config.ts', ROOT)), 'utf8')
    expect(config).toContain('icons: iconBundle()')
    expect(config).not.toMatch(/icons:\s*\[/)
  })
})

describe('the collection prefixes', () => {
  it('are written in one file and nowhere else', () => {
    /*
     * The rule `<BaseIcon>` exists to enforce. A template that spells
     * `pixelarticons:` again is a call site the typeface setting cannot reach
     * — which is exactly the defect this card fixed, and it would come back
     * looking like a perfectly ordinary icon.
     */
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(fileURLToPath(new URL(dir, ROOT)))) {
        const path = join(dir, entry)
        if (statSync(fileURLToPath(new URL(path, ROOT))).isDirectory()) walk(path)
        else if (entry.endsWith('.vue')) {
          const source = readFileSync(fileURLToPath(new URL(path, ROOT)), 'utf8')
          const template = /<template>([\s\S]*)<\/template>/.exec(source)?.[1] ?? ''
          for (const prefix of Object.values(ICON_SETS)) {
            if (template.includes(`${prefix}:`)) offenders.push(`${path}: ${prefix}`)
          }
        }
      }
    }
    walk('app')

    expect(offenders).toEqual([])
  })
})
