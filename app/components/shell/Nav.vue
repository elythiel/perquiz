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

const items = computed<NavItem[]>(() => [
  { to: '/', label: t('nav.home') },
  { to: '/my-room', label: t('nav.myRoom') },
  { to: '/guess', label: t('nav.guess') },
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
          class="block rounded-lg py-1.5 font-mono text-label tracking-widest whitespace-nowrap text-text-muted uppercase transition-colors duration-100 ease-micro hover:text-text-soft sm:px-2"
          exact-active-class="text-torch-ink"
        >
          {{ item.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
