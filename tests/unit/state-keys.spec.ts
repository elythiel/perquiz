import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The two strings the payload is held together by.
 *
 * `useState(key)` is the seam between the server plugin that fills these and
 * the composables that read them back after hydration, and the agreement is a
 * string. Mistype one and nothing complains: no error, no warning, no type
 * failure — just a second, empty piece of state and an interface that knows
 * less than the server did. It is the only divergence in this codebase that
 * cannot announce itself, so it gets a test that can.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const KEYS = ['game:phase', 'session:user'] as const

/** Every `.ts`/`.vue` under `app/`, with its repo-relative path. */
function sources(): { path: string, code: string }[] {
  const found: { path: string, code: string }[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(ROOT, dir))) {
      const path = join(dir, entry)
      if (statSync(join(ROOT, path)).isDirectory()) walk(path)
      else if (/\.(ts|vue)$/.test(entry)) found.push({ path, code: readFileSync(join(ROOT, path), 'utf8') })
    }
  }
  walk('app')
  return found
}

describe('the useState keys', () => {
  it('has app sources to sweep', () => {
    expect(sources().length).toBeGreaterThan(20)
  })

  it('are spelled out in one module and nowhere else', () => {
    for (const key of KEYS) {
      const spelling = sources()
        .filter(file => file.code.includes(`'${key}'`))
        .map(file => file.path)

      expect(spelling, key).toEqual(['app/utils/state.ts'])
    }
  })

  it('are what the module actually holds', () => {
    // The sweep above only proves nobody else writes them; this proves the one
    // that does still writes the strings the payload was built on. Renaming a
    // key is not a tidy-up — it silently splits the state in two.
    const module = readFileSync(join(ROOT, 'app/utils/state.ts'), 'utf8')
    for (const key of KEYS) expect(module).toContain(`'${key}'`)
  })
})
