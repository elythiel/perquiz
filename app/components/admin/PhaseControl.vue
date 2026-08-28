<script setup lang="ts">
import type { GamePhase } from '#shared/types/game'
import { GAME_PHASES } from '#shared/utils/game'

const props = defineProps<{ phase: GamePhase }>()
const emit = defineEmits<{ change: [phase: GamePhase] }>()

const { t } = useI18n()

const LABELS: Record<GamePhase, string> = {
  preparation: 'admin.phasePreparation',
  open: 'admin.phaseOpen',
  locked: 'admin.phaseLocked',
  revealed: 'admin.phaseRevealed',
}

/**
 * One icon per phase, beside its label rather than instead of it.
 *
 * A trophy for `revealed` and not an eye: an eye already means "preview my
 * room as others see it" elsewhere, and one shape meaning two things is the
 * drift an icon set exists to prevent. A trophy also says what `revealed`
 * actually is — the scores are out.
 *
 * A crate for `preparation`, for the same reason in reverse: the obvious pick
 * would be a picture, and a picture already means "add a photo". A crate is
 * what the phase is for — filling something before it goes out.
 */
const ICONS: Record<GamePhase, string> = {
  preparation: 'mingcute:box-line',
  open: 'mingcute:play-line',
  locked: 'mingcute:lock-line',
  revealed: 'mingcute:trophy-line',
}

/** What the button under the cursor would actually do, in one sentence. */
const CONSEQUENCES: Record<GamePhase, string> = {
  preparation: 'admin.toPreparation',
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
  <BaseCard :title="t('admin.phaseLabel')">
    <!-- Two by two on a phone, four across from `sm`: four labels of this
         length in one row would either overflow or have to be abbreviated,
         and « Préparation » abbreviated is a word nobody reads. -->
    <div
      class="grid grid-cols-2 gap-1 rounded-xl bg-night p-1 sm:grid-cols-4"
      role="group"
      :aria-label="t('admin.phaseLabel')"
    >
      <button
        v-for="option in GAME_PHASES"
        :key="option"
        type="button"
        class="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 font-mono text-label tracking-label uppercase transition-colors duration-100 ease-micro focus-ring-inset"
        :class="option === phase ? 'bg-torch/15 text-torch-ink' : 'text-text-muted hover:text-text-soft'"
        :aria-pressed="option === phase"
        @click="ask(option)"
      >
        <Icon
          :name="ICONS[option]"
          class="block size-4 shrink-0"
          aria-hidden="true"
        />
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
  </BaseCard>
</template>
