<script setup lang="ts">
import type { GamePhase } from '#shared/types/game'
import type { ChipTone } from '../chip'

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
 *
 * Hollow, and since the frame vocabulary landed it is hollow twice over: the
 * colour left the flat for the ink at the HD-2D restyle, and then left the
 * outline for an underline, because a framed block reads as something you can
 * press and this one states a fact. `<BaseChip>` owns that shape now; what
 * stays here is which phase wears which tint, and the dot.
 *
 * Deliberately unlike the nav's current tab, which is a FILLED torch block —
 * « where I am » and « what the game is doing » must not read as the same kind
 * of thing, and the gap between them just widened.
 */
const PRESENTATION = {
  preparation: {
    labelKey: 'phase.preparation',
    tone: 'amber',
    pulse: false,
  },
  open: {
    labelKey: 'phase.open',
    tone: 'torch',
    pulse: true,
  },
  locked: {
    labelKey: 'phase.locked',
    tone: 'edge',
    pulse: false,
  },
  revealed: {
    labelKey: 'phase.revealed',
    tone: 'clue',
    pulse: false,
  },
} as const satisfies Record<GamePhase, { labelKey: string, tone: ChipTone, pulse: boolean }>

const current = computed(() => PRESENTATION[props.phase])
</script>

<template>
  <BaseChip :tone="current.tone">
    <!-- A square dot, not a disc: nothing in this skin is round. -->
    <span
      v-if="current.pulse"
      class="size-1.5 shrink-0 animate-standby bg-current"
      aria-hidden="true"
    />
    {{ t(current.labelKey) }}
  </BaseChip>
</template>
