<script setup lang="ts">
import type { GamePhase } from '#shared/types/game'

interface Props {
  phase: GamePhase
  isAdmin: boolean
}

interface NavItem {
  to: string
  label: string
}

const props = defineProps<Props>()

const { t } = useI18n()

const route = useRoute()

/**
 * Which tab you are on, which is not the same as which link you clicked.
 *
 * A tab stays lit inside its own subtree: the sheet lives at `/guess/<room>`,
 * and « Deviner » is still where you are. `exact-active-class` alone said
 * otherwise — it only ever lit the handful of routes that are their own leaf,
 * so walking into a room turned the tab off.
 *
 * « Accueil » is the exception, and the reason the exact match was reached for
 * in the first place: `/` is a prefix of every path in the app, so an inclusive
 * match there would light it on every screen.
 *
 * Written here rather than left to `active-class` because the class is only
 * half of it — `aria-current="page"` is set by the router on the exact match
 * too, so a reader using a screen reader would have been told they were
 * nowhere. One predicate now answers both.
 */
function isCurrent(to: string): boolean {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}

const items = computed<NavItem[]>(() => [
  { to: '/', label: t('nav.home') },
  { to: '/my-room', label: t('nav.myRoom') },
  // « Deviner » appears when the sheet does — never in `preparation`, where the
  // page redirects home and a tab pointing at it would be a promise it breaks.
  ...(props.phase === 'preparation' ? [] : [{ to: '/guess', label: t('nav.guess') }]),
  // "Résultats" only exists once the answers are revealed (docs/PAGES.md).
  ...(props.phase === 'revealed' ? [{ to: '/results', label: t('nav.results') }] : []),
  ...(props.isAdmin ? [{ to: '/admin', label: t('nav.admin') }] : []),
])
</script>

<template>
  <nav :aria-label="t('nav.label')">
    <ul class="flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5 sm:gap-x-2">
      <li
        v-for="item in items"
        :key="item.to"
      >
        <NuxtLink
          :to="item.to"
          class="tap-target relative block rounded-lg py-1.5 font-mono text-label tracking-widest whitespace-nowrap text-text-muted uppercase transition-colors duration-100 ease-micro hover:text-text-soft sm:px-2"
          :class="isCurrent(item.to) && 'text-torch-ink'"
          :aria-current="isCurrent(item.to) ? 'page' : undefined"
        >
          {{ item.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
