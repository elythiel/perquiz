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
 *
 * Hollow, in the HD-2D skin: the colour moved from a tinted flat to the frame
 * and the ink, so the glow passes through the chip. Deliberately different
 * from the nav's current tab, which is a FILLED torch block — « where I am »
 * and « what the game is doing » must not read as the same kind of thing.
 */
const PRESENTATION = {
  preparation: {
    labelKey: 'phase.preparation',
    chip: 'frame-amber text-amber-ink',
    pulse: false,
  },
  open: {
    labelKey: 'phase.open',
    chip: 'frame-torch text-torch-ink',
    pulse: true,
  },
  locked: {
    labelKey: 'phase.locked',
    chip: 'frame-edge text-text-muted',
    pulse: false,
  },
  revealed: {
    labelKey: 'phase.revealed',
    chip: 'frame-clue text-clue-ink',
    pulse: false,
  },
} as const satisfies Record<GamePhase, { labelKey: string, chip: string, pulse: boolean }>

const current = computed(() => PRESENTATION[props.phase])
</script>

<template>
  <p
    class="frame frame-sm inline-flex items-center gap-2 px-1.5 font-mono text-label tracking-label uppercase"
    :class="current.chip"
  >
    <!-- A square dot, not a disc: nothing in this skin is round. -->
    <span
      v-if="current.pulse"
      class="size-1.5 shrink-0 animate-standby bg-current"
      aria-hidden="true"
    />
    {{ t(current.labelKey) }}
  </p>
</template>
