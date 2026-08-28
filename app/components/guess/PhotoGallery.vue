<script setup lang="ts">
defineProps<{ photos: readonly string[] }>()

const { t } = useI18n()

const zoom = useTemplateRef<{ open: (index: number) => void }>('zoom')
</script>

<template>
  <div>
    <ul
      v-if="photos.length"
      class="grid grid-cols-2 gap-2 sm:grid-cols-3"
      :aria-label="t('guess.gallery')"
    >
      <li
        v-for="(photo, index) in photos"
        :key="photo"
      >
        <!--
          Every photo at once, none of them privileged: a room is read by
          sweeping over it, not by paging through it one shot at a time. The
          thumbnail is the 400px variant; the zoom fetches the big one.
        -->
        <button
          type="button"
          class="block w-full overflow-hidden rounded-xl bg-sunken transition-opacity duration-100 ease-micro hover:opacity-90"
          :aria-label="t('guess.zoomOpen', { position: index + 1 })"
          @click="zoom?.open(index)"
        >
          <!-- Same as the room grid: the first thumbnail is this page's LCP
               element, the others are below the fold. -->
          <img
            :src="`/api/photos/${photo}/thumb`"
            :alt="t('guess.photoOf', { position: index + 1, total: photos.length })"
            :loading="index === 0 ? 'eager' : 'lazy'"
            :fetchpriority="index === 0 ? 'high' : undefined"
            decoding="async"
            class="aspect-4/3 w-full object-cover"
          >
        </button>
      </li>
    </ul>

    <BaseCard v-else>
      <p class="text-base text-text-muted">
        {{ t('guess.noPhotos') }}
      </p>
    </BaseCard>

    <PhotoZoom
      ref="zoom"
      :photos="photos"
    />
  </div>
</template>
