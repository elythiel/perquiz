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
 * The shell is `<BaseDialog>`; what is forwarded is its API.
 *
 * Callers hold a ref to THIS component and call `open()` on it, so the two
 * methods have to be handed on rather than inherited — a wrapper that forgets
 * to forward breaks every call site at once, and silently.
 */
const dialog = useTemplateRef<{ open: () => void, close: () => void }>('dialog')

defineExpose({
  open: () => dialog.value?.open(),
  close: () => dialog.value?.close(),
})

function confirm() {
  dialog.value?.close()
  emit('confirm')
}
</script>

<template>
  <!-- The padding and `open:gap-4` are this dialog's, not the shell's: the
       picker has neither, and the width is nobody's default. -->
  <BaseDialog
    ref="dialog"
    class="max-w-md p-3.5 backdrop:bg-night/80 open:gap-4"
  >
    <h2 class="text-xl leading-tight">
      {{ title }}
    </h2>

    <p
      v-if="body"
      class="px-4 py-3 text-base leading-relaxed"
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
        class="frame frame-fill press px-2.5 py-1 text-base font-bold text-night transition-opacity duration-100 ease-micro hover:opacity-90"
        :class="tone === 'clue' ? 'frame-clue bg-clue' : 'frame-alert bg-alert'"
        @click="confirm"
      >
        {{ confirmLabel }}
      </button>
    </div>
  </BaseDialog>
</template>
