<script setup lang="ts">
import type { Upload } from '~/composables/useRoomUploads'
import { MAX_PHOTOS_PER_ROOM } from '#shared/utils/photos'

defineProps<{
  photos: readonly { name: string }[]
  uploads: readonly Upload[]
  readOnly: boolean
  /** At the cap: the tile stops inviting and starts explaining. */
  full: boolean
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
      <!-- Full: the same tile, saying why rather than disappearing. A slot
           that vanishes leaves people wondering what they did wrong. -->
      <p
        v-if="full"
        class="frame frame-edge flex aspect-4/3 w-full flex-col items-center justify-center gap-1 text-center"
      >
        <span class="font-mono text-label tracking-label text-text tabular-nums">
          {{ t('myRoom.photoCount', { count: photos.length, max: MAX_PHOTOS_PER_ROOM }) }}
        </span>
        <span class="font-mono text-label tracking-label text-text-muted uppercase">
          {{ t('myRoom.full') }}
        </span>
      </p>

      <button
        v-else
        type="button"
        class="frame frame-torch press flex aspect-4/3 w-full flex-col items-center justify-center gap-2 text-text-soft transition-colors duration-100 ease-micro hover:text-text"
        @click="$emit('pick')"
      >
        <Icon
          name="pixelarticons:plus"
          class="block size-6 text-torch-ink"
          aria-hidden="true"
        />
        {{ t('myRoom.add') }}
      </button>
    </li>
  </ul>
</template>
