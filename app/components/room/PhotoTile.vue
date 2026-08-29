<script setup lang="ts">
interface Props {
  name: string
  position: number
  count: number
  readOnly: boolean
}

const props = defineProps<Props>()
defineEmits<{ remove: [], move: [offset: number], zoom: [] }>()

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

    <div class="absolute top-0 w-full p-3 flex items-start justify-between">
      <span
        class="bg-torch px-1.5 font-mono text-on-torch"
        aria-hidden="true"
      >{{ label }}</span>

      <RoomPhotoTileButton
        v-if="!readOnly"
        icon="pixelarticons:trash"
        :label="t('myRoom.deletePhoto', { position: label })"
        class="text-alert-ink focus-ring-alert"
        @click="$emit('remove')"
      />
    </div>

    <div class="absolute bottom-0 w-full p-3 flex items-center">
      <!--
        Outside the `readOnly` block on purpose: the arrows and the bin go when
        the game locks, and looking at your own photograph is the one gesture
        that still makes sense then.

        `mx-auto` and not `justify-center`: the auto margins centre it between
        the two arrows when they are there, and in the middle of the row when
        they are not — one rule for both states, so the control never moves.
      -->
      <RoomPhotoTileButton
        icon="pixelarticons:search"
        :label="t('myRoom.zoomPhoto', { position: label })"
        class="mx-auto text-text-soft"
        @click="$emit('zoom')"
      />

      <!-- Two buttons rather than dragging: a drag target is hard to hit on a
           phone and impossible to reach with a keyboard.

           `disabled:opacity-0` rather than a `v-if`: the first photo has no
           « earlier » and the last no « later », and a control that vanishes
           from the row would slide the other two sideways at every reorder.
           The positioning that keeps their hit areas apart now lives in
           `<RoomPhotoTileButton>`, which explains it. -->
      <template v-if="!readOnly">
        <RoomPhotoTileButton
          icon="pixelarticons:chevron-left"
          :label="t('myRoom.moveEarlier', { position: label })"
          class="order-first text-text-soft disabled:opacity-0"
          :disabled="position === 0"
          @click="$emit('move', -1)"
        />
        <RoomPhotoTileButton
          icon="pixelarticons:chevron-right"
          :label="t('myRoom.moveLater', { position: label })"
          class="order-last text-text-soft disabled:opacity-0"
          :disabled="position === count - 1"
          @click="$emit('move', 1)"
        />
      </template>
    </div>
  </figure>
</template>
