<script setup lang="ts">
export type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

defineProps<{
  name: string | undefined
  state: SaveState
  duplicate: boolean
  readOnly: boolean
}>()

defineEmits<{ choose: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-3 rounded-2xl bg-panel px-4 py-3">
      <template v-if="name">
        <GuessSuspectAvatar :display-name="name" />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-lg font-bold text-text">{{ name }}</span>
          <span
            class="font-mono text-label tracking-label uppercase"
            :class="{
              'text-torch-ink': state === 'saved',
              'text-text-muted': state === 'saving' || state === 'idle',
              'text-alert-ink': state === 'failed',
            }"
            role="status"
          >
            <template v-if="state === 'saving'">{{ t('guess.saving') }}</template>
            <template v-else-if="state === 'failed'">{{ t('guess.retry') }}</template>
            <template v-else-if="state === 'saved'">✓ {{ t('guess.saved') }}</template>
          </span>
        </span>
      </template>

      <span
        v-else
        class="flex-1 font-mono text-label tracking-label text-text-muted uppercase"
      >{{ t('guess.unanswered') }}</span>

      <button
        v-if="!readOnly"
        type="button"
        class="shrink-0 rounded-lg px-2 py-1 font-mono text-label tracking-label whitespace-nowrap text-clue-ink uppercase transition-opacity duration-100 ease-micro hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
        @click="$emit('choose')"
      >
        {{ name ? t('guess.change') : t('guess.choose') }}
      </button>
    </div>

    <!-- Soft, on purpose: SPEC §4 allows the same name twice, it just makes it
         very unlikely to be right. -->
    <p
      v-if="duplicate && name"
      class="rounded-xl bg-amber/15 px-4 py-2.5 text-sm leading-relaxed text-amber-ink"
    >
      {{ t('guess.duplicate', { name }) }}
    </p>
  </div>
</template>
