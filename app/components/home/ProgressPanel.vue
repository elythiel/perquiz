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
  </BaseCard>
</template>
