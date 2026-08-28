<script setup lang="ts">
import type { Upload } from '~/composables/useRoomUploads'

const props = defineProps<{ upload: Upload }>()

const { t } = useI18n()

/**
 * Two honest states, where the mockup showed one.
 *
 * The percentage is real only while the bytes are in flight. Once they have
 * left, sharp is decoding and re-encoding and reports nothing at all — so the
 * bar goes indeterminate rather than inventing a number.
 */
const label = computed(() => props.upload.status === 'processing'
  ? t('myRoom.processing')
  : t('myRoom.sending', { percent: props.upload.percent }))
</script>

<template>
  <div class="frame frame-torch frame-fill flex aspect-4/3 flex-col justify-center gap-3 bg-sunken px-3.5">
    <p class="font-mono text-label tracking-label text-torch-ink uppercase">
      {{ label }}
    </p>

    <div
      class="h-1.5 overflow-hidden bg-edge"
      role="progressbar"
      :aria-valuenow="upload.status === 'sending' ? upload.percent : undefined"
      :aria-valuemin="0"
      :aria-valuemax="100"
      :aria-label="upload.fileName"
    >
      <div
        class="h-full bg-torch transition-[width] duration-200 ease-micro"
        :class="upload.status === 'processing' && 'animate-standby'"
        :style="{ width: upload.status === 'processing' ? '100%' : `${upload.percent}%` }"
      />
    </div>
  </div>
</template>
