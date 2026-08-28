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

      A segmented game gauge now, framed and dug into the night, rather than a
      smooth torch-to-clue ribbon: the cells count, which is the same thing the
      number beside it does.
    -->
    <div
      class="frame frame-sm frame-edge frame-fill h-9 overflow-hidden bg-night p-1"
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
