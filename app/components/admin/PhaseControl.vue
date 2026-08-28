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
 * An archive box for `preparation`, for the same reason in reverse: the obvious
 * pick would be a picture, and a picture already means "add a photo". A box is
 * what the phase is for — filling something before it goes out.
 */
const ICONS: Record<GamePhase, string> = {
  preparation: 'pixelarticons:archive',
  open: 'pixelarticons:play',
  locked: 'pixelarticons:lock',
  revealed: 'pixelarticons:trophy',
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
         and « Préparation » abbreviated is a word nobody reads. The layout is
         the caller's; `segment-group` is only the box it sits in. -->
    <div
      class="segment-group grid grid-cols-2 sm:grid-cols-4"
      role="group"
      :aria-label="t('admin.phaseLabel')"
    >
      <!--
        The theme picker's chrome, and not its controls. These stay buttons
        with `aria-pressed` because a phase is confirmed before it applies: a
        radio would announce `aria-checked` on a state nothing has reached, and
        flicker back when the dialog is dismissed. Shared look, separate
        control — see `@utility segment` in main.css.
      -->
      <button
        v-for="option in GAME_PHASES"
        :key="option"
        type="button"
        class="segment focus-ring-inset"
        :class="option === phase ? 'frame-on-torch frame-fill bg-torch font-bold text-on-torch' : 'frame-none text-text-muted hover:text-text-soft'"
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
