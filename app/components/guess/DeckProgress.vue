<script setup lang="ts">
defineProps<{
  /** Every room of the sheet, in deck order. */
  rooms: readonly { token: string, answered: boolean }[]
  current: number
  done: number
  total: number
}>()

const { t } = useI18n()
const route = useRoute()
</script>

<template>
  <div class="flex items-center gap-4">
    <!--
      One segment per room rather than a single bar: the sheet is revisable in
      any order, so "how far along" is a set of answered rooms, not a distance
      travelled. Each segment is also the way to that room — which is what
      makes a room number, quoted in the suspect picker, worth anything.

      Eight-pixel cells since the HD-2D skin — a fill, the room you are on
      ringed from the inside, the rest hollow.
    -->
    <ol class="flex flex-1 gap-1">
      <li
        v-for="(room, index) in rooms"
        :key="room.token"
        class="flex-1 border"
        :class="[
          room.answered ? 'bg-torch' : 'bg-sunken',
          index === current && 'ring-2 ring-torch-ink',
          room.answered || index === current ? 'border-transparent' : 'opacity-50',
        ]"
      >
        <NuxtLink
          :to="{ path: `/guess/${room.token}`, query: route.query }"
          class="block h-2"
          :aria-label="t(room.answered ? 'guess.roomAnswered' : 'guess.roomUnanswered', { position: index + 1 })"
          :aria-current="index === current ? 'page' : undefined"
        />
      </li>
    </ol>

    <p class="shrink-0 font-mono text-label tracking-label text-text-muted tabular-nums">
      {{ t('guess.counter', { done, total }) }}
    </p>
  </div>
</template>
