<script setup lang="ts">
const props = defineProps<{ answered: number, total: number, newRooms: number }>()

const { t } = useI18n()

const share = computed(() => props.total === 0 ? 0 : (props.answered / props.total) * 100)
</script>

<template>
  <BaseCard :title="t('home.answersLabel')">
    <template #aside>
      <p class="text-xl font-bold tabular-nums">
        {{ t('guess.counter', { done: answered, total }) }}
      </p>
    </template>

    <!--
      The bar is decoration on top of the count beside it, so it is hidden from
      assistive tech rather than announced twice.

      A segmented game gauge, dug into the night rather than a smooth
      torch-to-clue ribbon: the cells count, which is the same thing the number
      beside it does.

      A SQUARE border since the frame vocabulary, with the podium and for the
      same reason — it is an object apart, and objects apart are the one place
      this skin keeps right angles (vikunja-74, vikunja-105). It costs something
      here that it does not cost the podium, and the cost is deliberate: this
      block paints an opaque `bg-night`, and `frame-fill`'s own comment explains
      that the page's ground is not a flat colour — it carries the grain
      everywhere and the glow across the top-left — so uncut corners on an
      opaque `night` block read as darker, un-grained squares. Which is exactly
      what a monument's corners are supposed to look like here.

      `p-1` is unchanged and was never the band's doing: it is one of the two
      paddings `@utility frame` names as exceptions, the gap between a frame and
      something that is not text. The band it sat on was 6px and the line is now
      3, so the bar inside gains those six pixels of height while the gauge
      keeps the `h-9` the row was built around.
    -->
    <div
      class="h-9 overflow-hidden border-3 border-edge-strong bg-night p-1"
      aria-hidden="true"
    >
      <div
        class="gauge-fill h-full transition-[width] duration-240 ease-deck"
        :style="{ width: `${share}%` }"
      />
    </div>

    <p
      v-if="newRooms > 0"
      class="text-base text-text-soft"
    >
      {{ t('home.newRooms', { count: newRooms }, newRooms) }}
    </p>
  </BaseCard>
</template>
