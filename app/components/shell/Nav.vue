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

const items = computed<NavItem[]>(() => [
  { to: '/', label: 'Accueil' },
  { to: '/ma-piece', label: 'Ma pièce' },
  { to: '/deviner', label: 'Deviner' },
  // « Résultats » n'existe qu'une fois les réponses révélées (docs/PAGES.md).
  ...(props.phase === 'revealed' ? [{ to: '/resultats', label: 'Résultats' }] : []),
  ...(props.isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
])
</script>

<template>
  <nav aria-label="Navigation principale">
    <ul class="flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5 sm:gap-x-2">
      <li
        v-for="item in items"
        :key="item.to"
      >
        <NuxtLink
          :to="item.to"
          class="block rounded-lg py-1.5 font-mono text-etiquette tracking-widest whitespace-nowrap text-texte-estompe uppercase transition-colors duration-100 ease-micro hover:text-texte-doux sm:px-2"
          exact-active-class="text-torche-texte"
        >
          {{ item.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
