<script setup lang="ts">
import type { Upload } from '~/composables/useRoomUploads'

defineProps<{
  photos: readonly { name: string }[]
  uploads: readonly Upload[]
  readOnly: boolean
  /** At the cap the add tile goes; the region's heading counter says why. */
  full: boolean
}>()

defineEmits<{ remove: [name: string], move: [name: string, offset: number], pick: [], zoom: [index: number] }>()

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
        @zoom="$emit('zoom', index)"
      />
    </li>

    <li
      v-for="upload in uploads"
      :key="upload.id"
    >
      <RoomUploadTile :upload="upload" />
    </li>

    <!-- At the cap the slot simply goes. It used to hold a tile explaining
         why, on the grounds that "a slot that vanishes leaves people wondering
         what they did wrong" — which was right, and is now answered earlier
         and better by the counter in the region's heading: it has been
         counting down since the first photograph (vikunja-100). -->
    <li v-if="!readOnly && !full">
      <button
        type="button"
        class="frame frame-torch press flex aspect-4/3 w-full flex-col items-center justify-center gap-2 text-text-soft transition-colors duration-100 ease-micro hover:text-text"
        @click="$emit('pick')"
      >
        <BaseIcon
          name="plus"
          class="block size-6 text-torch-ink"
          aria-hidden="true"
        />
        {{ t('myRoom.add') }}
      </button>
    </li>
  </ul>
</template>
