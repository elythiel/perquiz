<script setup lang="ts">
import type { GamePhase } from '#shared/types/game'

interface Props {
  phase: GamePhase
}

const props = defineProps<Props>()

/** The design system's phase chip: one colour per phase, a dot pulsing on `open`. */
const PRESENTATION = {
  open: {
    label: 'Partie en cours',
    chip: 'bg-torch/10 text-torch-ink',
    pulse: true,
  },
  locked: {
    label: 'Partie verrouillée',
    chip: 'border border-edge-strong bg-panel text-text-muted',
    pulse: false,
  },
  revealed: {
    label: 'Résultats révélés',
    chip: 'bg-clue/15 text-clue-ink',
    pulse: false,
  },
} as const satisfies Record<GamePhase, { label: string, chip: string, pulse: boolean }>

const current = computed(() => PRESENTATION[props.phase])
</script>

<template>
  <p
    class="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-label tracking-label uppercase"
    :class="current.chip"
  >
    <span
      v-if="current.pulse"
      class="size-1.5 shrink-0 animate-standby rounded-full bg-current"
      aria-hidden="true"
    />
    {{ current.label }}
  </p>
</template>
