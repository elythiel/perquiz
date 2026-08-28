<script setup lang="ts">
defineProps<{ photos: readonly string[], readOnly: boolean }>()

const { t } = useI18n()

/** Enough to recognise the room at a glance; « Ma pièce » holds the rest. */
const SHOWN = 4
</script>

<template>
  <BaseCard
    :title="t('home.roomLabel')"
    align="center"
  >
    <template #aside>
      <RoomStatusChip :in-play="photos.length > 0" />
    </template>

    <ul
      v-if="photos.length"
      class="grid grid-cols-4 gap-2"
    >
      <li
        v-for="(photo, index) in photos.slice(0, SHOWN)"
        :key="photo"
      >
        <NuxtLink
          to="/my-room"
          class="block overflow-hidden rounded-xl bg-sunken"
        >
          <!-- Named, not decorative: the link takes its accessible name from
               this alt, and without one a screen reader announces four links
               called nothing at all. -->
          <img
            :src="`/api/photos/${photo}/thumb`"
            :alt="t('home.photoAlt', { position: index + 1 })"
            loading="lazy"
            class="aspect-square w-full object-cover"
          >
        </NuxtLink>
      </li>

      <li v-if="!readOnly && photos.length <= SHOWN">
        <NuxtLink
          to="/my-room"
          class="grid aspect-square w-full place-items-center rounded-xl border border-dashed border-edge-strong text-2xl text-torch-ink transition-colors duration-100 ease-micro hover:border-torch-ink"
          :aria-label="t('home.addPhotos')"
        >
          <Icon
            name="mingcute:add-line"
            class="block size-6"
            aria-hidden="true"
          />
        </NuxtLink>
      </li>
    </ul>

    <p
      v-else
      class="max-w-measure text-base leading-relaxed text-text-soft"
    >
      {{ t('home.roomEmpty') }}
    </p>
  </BaseCard>
</template>
