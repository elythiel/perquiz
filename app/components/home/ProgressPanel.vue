<script setup lang="ts">
const props = defineProps<{ answered: number, total: number, newRooms: number }>()

const { t } = useI18n()

const share = computed(() => props.total === 0 ? 0 : (props.answered / props.total) * 100)
</script>

<template>
  <section class="flex flex-col gap-3 rounded-2xl bg-panel px-5 py-4">
    <div class="flex items-baseline justify-between gap-4">
      <h2 class="font-mono text-label tracking-eyebrow text-text-muted uppercase">
        {{ t('home.answersLabel') }}
      </h2>
      <p class="text-xl font-bold tabular-nums">
        {{ t('guess.counter', { done: answered, total }) }}
      </p>
    </div>

    <!--
      The bar is decoration on top of the count beside it, so it is hidden from
      assistive tech rather than announced twice.
    -->
    <div
      class="h-2 overflow-hidden rounded-full bg-edge"
      aria-hidden="true"
    >
      <div
        class="h-full rounded-full bg-gradient-to-r from-torch to-clue transition-[width] duration-240 ease-deck"
        :style="{ width: `${share}%` }"
      />
    </div>

    <p
      v-if="newRooms > 0"
      class="text-base text-text-soft"
    >
      {{ t('home.newRooms', { count: newRooms }, newRooms) }}
    </p>
  </section>
</template>
