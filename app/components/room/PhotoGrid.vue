<script setup lang="ts">
import type { Upload } from '~/composables/useRoomUploads'

defineProps<{
  photos: readonly { name: string }[]
  uploads: readonly Upload[]
  readOnly: boolean
}>()

defineEmits<{ remove: [name: string], move: [name: string, offset: number], pick: [] }>()

const { t } = useI18n()
</script>

<template>
  <ul class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
    <li
      v-for="(photo, index) in photos"
      :key="photo.name"
    >
      <RoomPhotoTile
        :name="photo.name"
        :position="index"
        :count="photos.length"
        :read-only="readOnly"
        @remove="$emit('remove', photo.name)"
        @move="offset => $emit('move', photo.name, offset)"
      />
    </li>

    <li
      v-for="upload in uploads"
      :key="upload.id"
    >
      <RoomUploadTile :upload="upload" />
    </li>

    <li v-if="!readOnly">
      <button
        type="button"
        class="flex aspect-4/3 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-edge-strong text-text-soft transition-colors duration-100 ease-micro hover:border-torch-ink hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
        @click="$emit('pick')"
      >
        <span
          class="text-2xl text-torch-ink"
          aria-hidden="true"
        >+</span>
        {{ t('myRoom.add') }}
      </button>
    </li>
  </ul>
</template>
