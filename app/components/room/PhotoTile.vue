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
  <!-- A photograph is CUT, not framed, and this tile is where that rule was
       first needed. It used to draw an azure line (`frame-flush frame-azure`),
       which was fine while it stood on the page and stopped being fine when
       vikunja-94 moved the grid inside a titled region — `<BaseCard>` is azure
       too, so the same colour was saying "this is a photograph" inside
       something saying "this is a section of the page", and neither read as
       anything. The answer is not a sixth tint, it is no line at all: what
       tells a photograph from the region holding it is that it has no outline.

       `frame-fill` stays and does all of the remaining work — it is
       self-contained, writing its own `mask-border` and its own width, so the
       corners are cut to exactly the same steps as before. Only the line is
       gone. Note that the band those steps follow is 6px and not the 9 the
       utility defaults to: `--frame-band` is a custom property and therefore
       INHERITED, and `<BaseCard>` sets it to `frame-sm` two levels up. That was
       already true before this change and is unaffected by it — which is
       precisely why the shape does not move.

       `frame-none` would have been the wrong way to say it: it blanks the tint
       but leaves `frame-flush`'s `::after` in the box drawing nothing. A
       utility you never write costs less than one you cancel.

       Not the two tiles that are not photographs — the add slot in
       `<RoomPhotoGrid>` and `<RoomUploadTile>` keep their torch line, and that
       is now what tells an action and a state apart from a picture. -->
  <figure class="frame-fill group relative aspect-4/3 overflow-hidden bg-sunken">
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
        icon="trash"
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
        icon="search"
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
          icon="chevron-left"
          :label="t('myRoom.moveEarlier', { position: label })"
          class="order-first text-text-soft disabled:opacity-0"
          :disabled="position === 0"
          @click="$emit('move', -1)"
        />
        <RoomPhotoTileButton
          icon="chevron-right"
          :label="t('myRoom.moveLater', { position: label })"
          class="order-last text-text-soft disabled:opacity-0"
          :disabled="position === count - 1"
          @click="$emit('move', 1)"
        />
      </template>
    </div>
  </figure>
</template>
