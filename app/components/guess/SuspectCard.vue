<script setup lang="ts">
/**
 * The answer, shown and not offered — the sheet once it is closed.
 *
 * All that is left of what used to be a card with a « Modifier » button: in
 * `open` the grid IS the answer and the choosing, so this only renders from
 * `locked` onwards, where there is nothing to choose. A grid of six inert
 * tiles would be an invitation to tap.
 *
 * `SaveState` lives here because `useGuessSheet` has always imported it from
 * this file, and moving a type to chase a component's shrinking job is churn.
 */
export type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

defineProps<{ name: string | undefined }>()

const { t } = useI18n()
</script>

<template>
  <div class="frame frame-edge flex items-center gap-3 px-2.5 py-1.5">
    <template v-if="name">
      <GuessSuspectAvatar :display-name="name" />
      <span class="min-w-0 flex-1 truncate text-lg font-bold text-text">{{ name }}</span>
    </template>

    <span
      v-else
      class="flex-1 font-mono text-label tracking-label text-text-muted uppercase"
    >{{ t('guess.unanswered') }}</span>
  </div>
</template>
