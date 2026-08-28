import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The route transition, measured against the rules it claims to follow.
 *
 * `docs/screens/animation-rules.png` names three registers and none of them is
 * "changing page", so the page fade borrows the smallest — Micro, 120ms,
 * opacity only. That is a decision worth holding: the temptation, the day
 * somebody wants the navigation to feel richer, is to reach for the 240ms slide
 * that MEANS "next room in the deck", or to slip a `translate` into the fade.
 * Both are caught here rather than in review.
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
  it('wraps NuxtPage, and is sequenced', () => {
    // On the element it actually wraps, not in nuxt.config: the same shape the
    // reveal show writes its own <Transition> in.
    expect(app).toMatch(/<NuxtPage\s+:transition=/)
    // `out-in` and not the default: overlapping the two pages is what makes
    // the scroll position jump.
    expect(hook('mode')).toBe('out-in')
  })

  it('animates opacity and nothing else', () => {
    for (const active of ['enterActiveClass', 'leaveActiveClass']) {
      expect(hook(active)).toContain('transition-opacity')
      // A transform would survive the global reduced-motion block, which only
      // cuts keyframes and caps durations. "No translation" is a rule of the
      // animation spec, so the fade may not smuggle one in.
      expect(hook(active)).not.toMatch(/translate|scale|rotate/)
    }

    expect(hook('enterFromClass')).toBe('opacity-0')
    expect(hook('leaveToClass')).toBe('opacity-0')
  })

  it('stays inside the Micro register', () => {
    for (const active of ['enterActiveClass', 'leaveActiveClass']) {
      const [, ms] = /\bduration-(\d+)\b/.exec(hook(active)) ?? []

      expect(Number(ms)).toBeLessThanOrEqual(120)
      // `ease-deck` is the deck's curve and carries the deck's meaning.
      expect(hook(active)).toContain('ease-micro')
    }
  })

  it('leaves the design-system sheet to the design system', () => {
    // A hand-written `.page-*` rule would work and would be the one place
    // nobody thinks to look when the transition misbehaves.
    expect(read('app/assets/css/main.css')).not.toMatch(/\.page-(enter|leave)/)
    expect(read('nuxt.config.ts')).not.toContain('pageTransition')
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

/**
 * The rule the transition imposes on every page, learned the hard way.
 *
 * A `<script setup>` that awaits `navigateTo` is a `<Suspense>` that never
 * resolves: the promise never settles, so Nuxt's `onResolve` never runs.
 * Wrapped in the page transition that is fine right up until it is not — the
 * enter class stays on a page nobody will take it off, and every navigation
 * after it lands invisible too. One trip through `/guess` used to blank the
 * whole app until a reload.
 *
 * Forwarding therefore belongs to a middleware or a route record, which the
 * router resolves before a component exists. Callbacks are untouched: a
 * watcher redirecting a reader who is already standing on the page runs
 * outside any transition, and that is a different thing entirely.
 */
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
