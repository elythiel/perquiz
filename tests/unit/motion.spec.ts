import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * What the page transition is allowed to be, and where a redirect may live.
 *
 * The duration and the easing used to be pinned here, against
 * `docs/screens/animation-rules.png`. They are gone: a skin is allowed to
 * change how long a fade lasts, and a test that says otherwise is red at every
 * legitimate change and has never caught one.
 *
 * Two rules survive because neither is about taste. The transition may not
 * translate — `prefers-reduced-motion` says "no translation", and the global
 * block only cuts keyframes and caps durations, so a `translate` would sail
 * through it. And no page may await a redirect in its setup body, which is not
 * a style rule at all: it is the bug that turned every page blank.
 *
 * Read off disk, no bundler and no DOM — the same trick as the contrast audit.
 */

const ROOT = new URL('../..', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, ROOT), 'utf8')

const app = read('app/app.vue')

/** The classes the transition hands to each of its four hooks. */
function hook(name: string): string {
  const match = new RegExp(`${name}:\\s*'([^']*)'`).exec(app)
  if (!match) throw new Error(`<NuxtPage :transition> declares no ${name}`)
  return match[1]!
}

describe('the page transition', () => {
  it('is sequenced, so the two pages never coexist', () => {
    // `out-in` and not the default: overlapping them is what makes the scroll
    // position jump, which is a defect rather than a preference.
    expect(hook('mode')).toBe('out-in')
  })

  it('moves nothing, which is what reduced motion asks of it', () => {
    // A transform would survive the global reduced-motion block, which only
    // cuts keyframes and caps durations. "No translation" is a rule of the
    // animation spec, so the transition may not smuggle one in.
    for (const active of ['enterActiveClass', 'leaveActiveClass']) {
      expect(hook(active)).not.toMatch(/translate|scale|rotate/)
    }
  })
})

describe('the motion budget', () => {
  it('carries no animation library', () => {
    const { dependencies, devDependencies } = JSON.parse(read('package.json'))
    const installed = Object.keys({ ...dependencies, ...devDependencies })

    // PLAN.md: the motion is state to state, which is what CSS transitions do,
    // and the one hard part — FLIP — is already in Vue's <TransitionGroup>.
    expect(installed.filter(name => /motion|gsap|anime|animejs|framer|popmotion|tween/i.test(name)))
      .toEqual([])
  })
})

describe('redirects, and where they may live', () => {
  const PAGES = fileURLToPath(new URL('app/pages', ROOT))

  /** Every page's `<script setup>`, comments stripped. */
  function scripts(): { path: string, code: string }[] {
    const found: { path: string, code: string }[] = []
    const walk = (dir: string, prefix: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full, `${prefix}${entry}/`)
        else if (entry.endsWith('.vue')) {
          const script = /<script setup[^>]*>([\s\S]*?)<\/script>/.exec(readFileSync(full, 'utf8'))?.[1] ?? ''
          found.push({
            path: prefix + entry,
            code: script.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''),
          })
        }
      }
    }
    walk(PAGES, '')
    return found
  }

  /** Where `await navigateTo` sits, by how many parentheses are open around it. */
  function awaitedRedirects(code: string): number[] {
    const depths: number[] = []
    let depth = 0
    for (let i = 0; i < code.length; i++) {
      if (code[i] === '(') depth++
      else if (code[i] === ')') depth--
      else if (code.startsWith('await navigateTo', i)) depths.push(depth)
    }
    return depths
  }

  it('has pages to sweep', () => {
    expect(scripts().length).toBeGreaterThan(5)
  })

  it('never awaits one in a setup body', () => {
    // Depth 0 is the setup body itself. Anything deeper is inside a call —
    // `watch(...)`, an event handler — and is somebody else's moment.
    const offenders = scripts()
      .filter(page => awaitedRedirects(page.code).includes(0))
      .map(page => page.path)

    expect(offenders).toEqual([])
  })

  it('sends the two forwarding routes through the router instead', () => {
    const page = (path: string) => scripts().find(candidate => candidate.path === path)!.code

    // `/guess` holds no room of its own; `/reveal` no step of its own.
    expect(page('guess/index.vue')).toContain('middleware: \'deck\'')
    expect(page('guess/[token].vue')).toContain('middleware: \'deck\'')
    expect(page('reveal/index.vue')).toContain('redirect: \'/reveal/0\'')
  })
})
