<script setup lang="ts">
const props = defineProps<{ isLast: boolean, guessesOnMyRoom: number }>()
const emit = defineEmits<{ confirm: [] }>()

const { t } = useI18n()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')

/**
 * The warning PAGES `/my-room` asks for, said in full.
 *
 * Removing the last photo takes the room off everyone's sheet, and the answers
 * already written about it go with it. That is not a detail to discover
 * afterwards, so the count of answers about to be thrown away is named.
 */
const consequence = computed(() => {
  if (!props.isLast) return undefined
  if (props.guessesOnMyRoom === 0) return t('myRoom.confirmDeleteLast')
  return `${t('myRoom.confirmDeleteLast')} ${t('myRoom.confirmDeleteLastGuesses', { count: props.guessesOnMyRoom }, props.guessesOnMyRoom)}`
})

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
      {{ t('myRoom.confirmDelete') }}
    </h2>

    <p
      v-if="consequence"
      class="rounded-xl bg-alert/15 px-4 py-3 text-base leading-relaxed text-alert-ink"
    >
      {{ consequence }}
    </p>

    <div class="flex justify-end gap-3">
      <button
        type="button"
        class="rounded-xl border border-edge-strong px-4 py-2.5 text-base text-text-soft transition-colors duration-100 ease-micro hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
        @click="dialog?.close()"
      >
        {{ t('myRoom.cancel') }}
      </button>
      <button
        type="button"
        class="rounded-xl bg-alert px-4 py-2.5 text-base font-bold text-night transition-opacity duration-100 ease-micro hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alert-ink"
        @click="confirm"
      >
        {{ t('myRoom.confirm') }}
      </button>
    </div>
  </dialog>
</template>
