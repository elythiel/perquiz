<script setup lang="ts">
defineProps<{ photos: readonly string[] }>()
const emit = defineEmits<{ remove: [name: string] }>()

const { t } = useI18n()
</script>

<template>
  <section class="flex flex-col gap-3">
    <h2 class="font-mono text-label tracking-eyebrow text-text-muted uppercase">
      {{ t('admin.moderation') }}
    </h2>
    <p class="max-w-measure text-sm leading-relaxed text-text-muted">
      {{ t('admin.moderationHint') }}
    </p>

    <ul
      v-if="photos.length"
      class="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
    >
      <!-- The frame rides on the `<li>` and not on the `<img>`: a replaced
           element has no `::after` to draw a ring with, and the list item was
           already the positioned one. -->
      <li
        v-for="photo in photos"
        :key="photo"
        class="frame-sm frame-fill relative aspect-square overflow-hidden bg-sunken"
      >
        <img
          :src="`/api/photos/${photo}/thumb`"
          alt=""
          loading="lazy"
          class="size-full object-cover"
        >
        <button
          type="button"
          class="absolute top-3 right-3 grid size-7 place-items-center bg-night/70 text-alert-ink transition-colors duration-100 ease-micro hover:bg-night focus-ring-alert"
          :aria-label="t('admin.deletePhoto')"
          @click="emit('remove', photo)"
        >
          <Icon
            name="pixelarticons:trash"
            class="block size-4"
            aria-hidden="true"
          />
        </button>
      </li>
    </ul>

    <BaseCard v-else>
      <p class="text-base text-text-muted">
        {{ t('admin.moderationEmpty') }}
      </p>
    </BaseCard>
  </section>
</template>
