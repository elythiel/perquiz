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

      The bar stays 4px tall; the padding on the link is negative-margined
      away, so the tap target is 28px without the row growing.
    -->
    <ol class="flex flex-1 gap-1">
      <li
        v-for="(room, index) in rooms"
        :key="room.token"
        class="flex-1"
      >
        <NuxtLink
          :to="{ path: `/guess/${room.token}`, query: route.query }"
          class="-my-3 block py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
          :aria-label="t(room.answered ? 'guess.roomAnswered' : 'guess.roomUnanswered', { position: index + 1 })"
          :aria-current="index === current ? 'page' : undefined"
        >
          <span
            class="block h-1 rounded-full transition-colors duration-100 ease-micro"
            :class="[
              room.answered ? 'bg-torch' : 'bg-edge',
              index === current && 'ring-2 ring-torch-ink ring-offset-2 ring-offset-night',
            ]"
          />
        </NuxtLink>
      </li>
    </ol>

    <p class="shrink-0 font-mono text-label tracking-label text-text-muted tabular-nums">
      {{ t('guess.counter', { done, total }) }}
    </p>
  </div>
</template>
