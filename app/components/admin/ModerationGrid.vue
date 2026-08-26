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
      <li
        v-for="photo in photos"
        :key="photo"
        class="relative"
      >
        <img
          :src="`/api/photos/${photo}/thumb`"
          alt=""
          loading="lazy"
          class="aspect-square w-full rounded-xl bg-sunken object-cover"
        >
        <button
          type="button"
          class="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-lg bg-night/70 text-alert-ink transition-colors duration-100 ease-micro hover:bg-night focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alert-ink"
          :aria-label="t('admin.deletePhoto')"
          @click="emit('remove', photo)"
        >
          &times;
        </button>
      </li>
    </ul>

    <p
      v-else
      class="rounded-2xl bg-panel px-5 py-4 text-base text-text-muted"
    >
      {{ t('admin.moderationEmpty') }}
    </p>
  </section>
</template>
