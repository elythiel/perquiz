<script setup lang="ts">
const props = defineProps<{ isLast: boolean, guessesOnMyRoom: number }>()
const emit = defineEmits<{ confirm: [] }>()

const { t } = useI18n()

const dialog = useTemplateRef<{ open: () => void, close: () => void }>('dialog')

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
  <BaseDialog
    ref="dialog"
    class="max-w-md p-3.5 backdrop:bg-night/80 open:gap-4"
  >
    <h2 class="text-xl leading-tight">
      {{ t('myRoom.confirmDelete') }}
    </h2>

    <BaseMessage
      v-if="consequence"
      tone="alert"
    >
      <p>{{ consequence }}</p>
    </BaseMessage>

    <div class="flex justify-end gap-3">
      <ButtonSecondary @click="dialog?.close()">
        {{ t('myRoom.cancel') }}
      </ButtonSecondary>
      <button
        type="button"
        class="frame frame-alert frame-fill press bg-alert px-2.5 py-1 text-base font-bold text-night transition-opacity duration-100 ease-micro hover:opacity-90 focus-ring-alert"
        @click="confirm"
      >
        {{ t('myRoom.confirm') }}
      </button>
    </div>
  </BaseDialog>
</template>
