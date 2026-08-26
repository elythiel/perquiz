<script setup lang="ts">
import type { GamePhase } from '#shared/types/game'

interface Props {
  phase: GamePhase
}

const props = defineProps<Props>()

/** Puce de phase du design system : couleur par phase, pastille qui veille sur `open`. */
const PRESENTATION = {
  open: {
    label: 'Partie en cours',
    chip: 'bg-torche/10 text-torche-texte',
    pulse: true,
  },
  locked: {
    label: 'Partie verrouillée',
    chip: 'border border-trait-fort bg-panneau text-texte-estompe',
    pulse: false,
  },
  revealed: {
    label: 'Résultats révélés',
    chip: 'bg-indice/15 text-indice-texte',
    pulse: false,
  },
} as const satisfies Record<GamePhase, { label: string, chip: string, pulse: boolean }>

const current = computed(() => PRESENTATION[props.phase])
</script>

<template>
  <p
    class="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-etiquette tracking-etiquette uppercase"
    :class="current.chip"
  >
    <span
      v-if="current.pulse"
      class="size-1.5 shrink-0 animate-veille rounded-full bg-current"
      aria-hidden="true"
    />
    {{ current.label }}
  </p>
</template>
