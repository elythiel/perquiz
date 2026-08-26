<script setup lang="ts">
import type { GamePhase } from '#shared/types/game'
import { GAME_PHASES } from '#shared/utils/game'

const props = defineProps<{ phase: GamePhase }>()
const emit = defineEmits<{ change: [phase: GamePhase] }>()

const { t } = useI18n()

const LABELS: Record<GamePhase, string> = {
  open: 'admin.phaseOpen',
  locked: 'admin.phaseLocked',
  revealed: 'admin.phaseRevealed',
}

/** What the button under the cursor would actually do, in one sentence. */
const CONSEQUENCES: Record<GamePhase, string> = {
  open: 'admin.toOpen',
  locked: 'admin.toLocked',
  revealed: 'admin.toRevealed',
}

const pending = ref<GamePhase>()
const dialog = useTemplateRef<{ open: () => void }>('dialog')

function ask(phase: GamePhase) {
  if (phase === props.phase) return
  pending.value = phase
  dialog.value?.open()
}

/**
 * The consequence shown is that of the phase you are hovering towards, or —
 * when nothing is pending — of the next one along, which is what an admin is
 * about to do nine times out of ten.
 */
const nextAlong = computed<GamePhase>(() =>
  GAME_PHASES[(GAME_PHASES.indexOf(props.phase) + 1) % GAME_PHASES.length]!)
</script>

<template>
  <section class="flex flex-col gap-3 rounded-2xl bg-panel px-5 py-4">
    <h2 class="font-mono text-label tracking-eyebrow text-text-muted uppercase">
      {{ t('admin.phaseLabel') }}
    </h2>

    <div
      class="flex gap-1 rounded-xl bg-night p-1"
      role="group"
      :aria-label="t('admin.phaseLabel')"
    >
      <button
        v-for="option in GAME_PHASES"
        :key="option"
        type="button"
        class="flex-1 rounded-lg px-3 py-2.5 font-mono text-label tracking-label uppercase transition-colors duration-100 ease-micro focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-torch-ink"
        :class="option === phase ? 'bg-torch/15 text-torch-ink' : 'text-text-muted hover:text-text-soft'"
        :aria-pressed="option === phase"
        @click="ask(option)"
      >
        {{ t(LABELS[option]) }}
      </button>
    </div>

    <p class="text-base leading-relaxed text-text-soft">
      {{ t(CONSEQUENCES[nextAlong]) }}
    </p>

    <ConfirmDialog
      ref="dialog"
      :title="t('admin.confirmPhase')"
      :body="pending ? t(CONSEQUENCES[pending]) : undefined"
      :confirm-label="t('admin.confirm')"
      tone="clue"
      @confirm="pending && emit('change', pending)"
    />
  </section>
</template>
