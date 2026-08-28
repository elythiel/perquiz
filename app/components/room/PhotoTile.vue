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
  <!-- An inventory slot: a framed block, the photograph cut to the frame's own
       steps. One tint for every tile — a colour that rotated would look like it
       meant something about the room. -->
  <figure class="frame-flush frame-azure frame-fill group relative aspect-4/3 overflow-hidden bg-sunken">
    <!-- The first tile is the largest thing painted on this page, so it is
         fetched eagerly and early; the rest of the grid stays lazy. Lighthouse
         called this one out by name (`lcp-lazy-loaded`), 2026-08-28. -->
    <img
      :src="`/api/photos/${name}/thumb`"
      :alt="t('myRoom.photoLabel', { position: label })"
      :loading="position === 0 ? 'eager' : 'lazy'"
      :fetchpriority="position === 0 ? 'high' : undefined"
      decoding="async"
      class="size-full object-cover"
    >

    <span
      class="absolute top-3 left-3 bg-torch px-1.5 font-mono text-on-torch"
      aria-hidden="true"
    >{{ label }}</span>

    <template v-if="!readOnly">
      <button
        type="button"
        class="absolute top-3 right-3 tap-target px-1 py-1 grid place-items-center bg-night/70 text-alert-ink transition-opacity duration-100 ease-micro hover:bg-night focus-ring-alert"
        :aria-label="t('myRoom.deletePhoto', { position: label })"
        @click="$emit('remove')"
      >
        <Icon
          name="pixelarticons:trash"
          class="block size-5"
          aria-hidden="true"
        />
      </button>

      <!-- Two buttons rather than dragging: a drag target is hard to hit on a
           phone and impossible to reach with a keyboard.

           `relative` on each, and it is not decoration: `tap-target` grows the
           hit area with an absolutely positioned pseudo-element sized
           `max(100%, 44px)`, and without a positioned button that `100%`
           resolves against the FIGURE. Both arrows then claimed the whole
           photograph, the later one in the DOM winning every click — so tapping
           anywhere, the left arrow included, moved the photo right. -->
      <div class="absolute inset-x-3 bottom-3 flex justify-between gap-2">
        <button
          type="button"
          class="tap-target px-1 py-1 relative grid place-items-center bg-night/70 text-text-soft transition-opacity duration-100 ease-micro enabled:hover:bg-night disabled:opacity-0"
          :disabled="position === 0"
          :aria-label="t('myRoom.moveEarlier', { position: label })"
          @click="$emit('move', -1)"
        >
          <Icon
            name="pixelarticons:chevron-left"
            class="size-6"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          class="tap-target px-1 py-1 relative grid place-items-center bg-night/70 text-text-soft transition-opacity duration-100 ease-micro enabled:hover:bg-night disabled:opacity-0"
          :disabled="position === count - 1"
          :aria-label="t('myRoom.moveLater', { position: label })"
          @click="$emit('move', 1)"
        >
          <Icon
            name="pixelarticons:chevron-right"
            class="block size-6"
            aria-hidden="true"
          />
        </button>
      </div>
    </template>
  </figure>
</template>
