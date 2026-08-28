<script setup lang="ts">
import type { Upload } from '~/composables/useRoomUploads'
import { MAX_PHOTOS_PER_ROOM, MAX_UPLOAD_BYTES } from '#shared/utils/photos'

const props = defineProps<{ failures: Upload[], someSucceeded: boolean }>()
defineEmits<{ dismiss: [] }>()

const { t } = useI18n()

/** Decimal megabytes, matching the limit the message quotes. */
function megabytes(bytes: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(bytes / 1e6)} Mo`
}

const lines = computed(() => props.failures.map(failure => ({
  id: failure.id,
  text: t(`myRoom.errors.${failure.reason ?? 'failed'}`, {
    file: failure.fileName,
    size: megabytes(failure.size),
    max: failure.reason === 'too-many' ? String(MAX_PHOTOS_PER_ROOM) : megabytes(MAX_UPLOAD_BYTES),
  }),
})))
</script>

<template>
  <section
    class="flex flex-col gap-2 rounded-2xl bg-alert/15 px-5 py-4"
    :aria-label="t('myRoom.errorHeading')"
  >
    <ul class="flex flex-col gap-1.5">
      <li
        v-for="line in lines"
        :key="line.id"
        class="text-base leading-relaxed text-alert-ink"
      >
        {{ line.text }}
      </li>
    </ul>

    <p
      v-if="someSucceeded"
      class="text-sm text-text-soft"
    >
      {{ t('myRoom.errorOthersSent') }}
    </p>

    <button
      type="button"
      class="self-start font-mono text-label tracking-label text-text-muted uppercase transition-colors duration-100 ease-micro hover:text-text-soft"
      @click="$emit('dismiss')"
    >
      {{ t('myRoom.cancel') }}
    </button>
  </section>
</template>
