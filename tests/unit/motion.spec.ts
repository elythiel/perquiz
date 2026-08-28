import { readFileSync } from 'node:fs'
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
