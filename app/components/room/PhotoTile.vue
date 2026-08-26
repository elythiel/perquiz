<script setup lang="ts">
interface Props {
  name: string
  position: number
  count: number
  readOnly: boolean
}

const props = defineProps<Props>()
defineEmits<{ remove: [], move: [offset: number] }>()

const { t } = useI18n()

/** 1-based on screen: the badge is for a human counting their own photos. */
const label = computed(() => props.position + 1)
</script>

<template>
  <figure class="group relative aspect-4/3 overflow-hidden rounded-2xl bg-sunken">
    <img
      :src="`/api/photos/${name}/thumb`"
      :alt="t('myRoom.photoLabel', { position: label })"
      loading="lazy"
      class="size-full object-cover"
    >

    <span
      class="absolute top-2 left-2 grid size-7 place-items-center rounded-lg bg-night/70 font-mono text-label text-text"
      aria-hidden="true"
    >{{ label }}</span>

    <template v-if="!readOnly">
      <button
        type="button"
        class="absolute top-2 right-2 grid size-7 place-items-center rounded-lg bg-night/70 text-alert-ink transition-opacity duration-100 ease-micro hover:bg-night focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alert-ink"
        :aria-label="t('myRoom.deletePhoto', { position: label })"
        @click="$emit('remove')"
      >
        <svg
          viewBox="0 0 16 16"
          class="size-3.5"
          aria-hidden="true"
        >
          <path
            d="M3 3l10 10M13 3L3 13"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>

      <!-- Two buttons rather than dragging: a drag target is hard to hit on a
           phone and impossible to reach with a keyboard. -->
      <div class="absolute inset-x-2 bottom-2 flex justify-between gap-2">
        <button
          type="button"
          class="grid size-7 place-items-center rounded-lg bg-night/70 text-text-soft transition-opacity duration-100 ease-micro enabled:hover:bg-night disabled:opacity-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
          :disabled="position === 0"
          :aria-label="t('myRoom.moveEarlier', { position: label })"
          @click="$emit('move', -1)"
        >
          &lsaquo;
        </button>
        <button
          type="button"
          class="grid size-7 place-items-center rounded-lg bg-night/70 text-text-soft transition-opacity duration-100 ease-micro enabled:hover:bg-night disabled:opacity-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
          :disabled="position === count - 1"
          :aria-label="t('myRoom.moveLater', { position: label })"
          @click="$emit('move', 1)"
        >
          &rsaquo;
        </button>
      </div>
    </template>
  </figure>
</template>
