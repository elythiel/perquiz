<script setup lang="ts">
defineProps<{
  title: string
  body?: string
  note?: string
  confirmLabel: string
  /** `alert` for anything destructive, `clue` for a change of state. */
  tone?: 'alert' | 'clue'
}>()

const emit = defineEmits<{ confirm: [] }>()

const { t } = useI18n()

/**
 * A native `<dialog>`: the focus trap, Escape and the inert background come
 * with it, and every hand-rolled overlay gets one of the three wrong.
 */
const dialog = useTemplateRef<HTMLDialogElement>('dialog')

defineExpose({ open: () => dialog.value?.showModal() })

function confirm() {
  dialog.value?.close()
  emit('confirm')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto w-full max-w-md rounded-2xl bg-panel p-5 text-text backdrop:bg-night/80 open:flex open:flex-col open:gap-4"
  >
    <h2 class="text-xl leading-tight">
      {{ title }}
    </h2>

    <p
      v-if="body"
      class="rounded-xl px-4 py-3 text-base leading-relaxed"
      :class="tone === 'clue' ? 'bg-clue/15 text-clue-ink' : 'bg-alert/15 text-alert-ink'"
    >
      {{ body }}
    </p>

    <p
      v-if="note"
      class="text-sm leading-relaxed text-text-muted"
    >
      {{ note }}
    </p>

    <div class="flex justify-end gap-3">
      <ButtonSecondary @click="dialog?.close()">
        {{ t('admin.cancel') }}
      </ButtonSecondary>
      <button
        type="button"
        class="rounded-xl px-4 py-2.5 text-base font-bold text-night transition-opacity duration-100 ease-micro hover:opacity-90"
        :class="tone === 'clue' ? 'bg-clue' : 'bg-alert'"
        @click="confirm"
      >
        {{ confirmLabel }}
      </button>
    </div>
  </dialog>
</template>
