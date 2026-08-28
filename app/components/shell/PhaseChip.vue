<script setup lang="ts">
import type { GamePhase } from '#shared/types/game'

interface Props {
  phase: GamePhase
}

const props = defineProps<Props>()

const { t } = useI18n()

/**
 * The design system's phase chip: one colour per phase, a dot pulsing on `open`.
 *
 * Amber for `preparation` and not another neutral: it is a phase where
 * something is expected of you, and reading it as a duller `locked` would say
 * the opposite. The pulse stays exclusive to `open` — it means "live".
 */
const PRESENTATION = {
  preparation: {
    labelKey: 'phase.preparation',
    chip: 'bg-amber/15 text-amber-ink',
    pulse: false,
  },
  open: {
    labelKey: 'phase.open',
    chip: 'bg-torch/10 text-torch-ink',
    pulse: true,
  },
  locked: {
    labelKey: 'phase.locked',
    chip: 'border border-edge-strong bg-panel text-text-muted',
    pulse: false,
  },
  revealed: {
    labelKey: 'phase.revealed',
    chip: 'bg-clue/15 text-clue-ink',
    pulse: false,
  },
} as const satisfies Record<GamePhase, { labelKey: string, chip: string, pulse: boolean }>

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
    {{ t(current.labelKey) }}
  </p>
</template>
