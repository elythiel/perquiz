<script setup lang="ts">
import { ordinal } from '#shared/utils/show'

/**
 * The debrief: what I scored, where that puts me, and what I got wrong.
 *
 * Reachable only once the admin has flipped the game to `revealed` — before
 * that the answers are still secret, so this page sends you home rather than
 * explaining itself, and the dashboard says which phase the game is in
 * (PAGES `/results`).
 */
definePageMeta({ access: { phase: 'revealed' } })

const { t } = useI18n()

const { data } = await useFetch('/api/results')

const me = computed(() => data.value?.me)
const rooms = computed(() => data.value?.rooms ?? [])
const zoom = useTemplateRef<{ open: (index: number) => void }>('zoom')
const opened = ref<readonly string[]>([])

function openRoom(photos: readonly string[]) {
  if (!photos.length) return
  opened.value = photos
  nextTick(() => zoom.value?.open(0))
}
</script>

<template>
  <section
    v-if="data && me"
    class="flex flex-col gap-6"
  >
    <h1 class="self-start rounded-lg bg-clue/15 px-3 py-1.5 font-mono text-label tracking-label text-clue-ink uppercase">
      {{ t('results.title') }}
    </h1>

    <!-- The score first and biggest: it is what the page is opened for. -->
    <p class="flex flex-wrap items-baseline gap-x-3">
      <span class="text-6xl leading-none font-bold tabular-nums sm:text-7xl">{{ me.score }}</span>
      <span class="text-xl text-text-muted sm:text-2xl">
        {{ t('results.found', { total: me.total }, me.total) }}
      </span>
    </p>

    <p class="font-mono text-label tracking-eyebrow text-torch-ink uppercase">
      {{ t('results.place', { place: ordinal(me.rank) }) }}
      <template v-if="data.tiedWith.length">
        — {{ t('results.tiedWith', { names: data.tiedWith.join(', ') }) }}
      </template>
    </p>

    <ol class="flex flex-col gap-2">
      <li
        v-for="player in data.standings"
        :key="player.id"
        class="flex items-center gap-3 rounded-2xl px-4 py-3"
        :class="[
          player.rank === 1 ? 'bg-gradient-to-r from-torch/20 to-transparent' : 'bg-panel',
          player.id === me.id && 'ring-1 ring-torch-ink',
        ]"
        :aria-current="player.id === me.id ? 'true' : undefined"
      >
        <!-- Shared ranks repeat the number rather than counting rows: that is
             what "1, 2, 2, 4" means, and the leaderboard has to show it. -->
        <span
          class="w-6 shrink-0 font-mono text-label tabular-nums"
          :class="player.rank === 1 ? 'text-torch-ink' : 'text-text-muted'"
        >{{ player.rank }}</span>

        <GuessSuspectAvatar :display-name="player.displayName" />

        <span class="min-w-0 flex-1 truncate text-lg">
          {{ player.displayName }}
          <span
            v-if="player.id === me.id"
            class="text-text-muted"
          >{{ t('results.you') }}</span>
        </span>

        <span class="shrink-0 text-xl font-bold tabular-nums">{{ player.score }}</span>
      </li>
    </ol>

    <h2 class="font-mono text-label tracking-eyebrow text-text-muted uppercase">
      {{ t('results.detail') }}
    </h2>

    <ul
      v-if="rooms.length"
      class="flex flex-col gap-2"
    >
      <li
        v-for="(room, index) in rooms"
        :key="index"
        class="flex items-center gap-4 rounded-2xl bg-panel p-3"
      >
        <button
          type="button"
          class="size-20 shrink-0 overflow-hidden rounded-xl bg-sunken"
          :aria-label="t('photoZoom.gallery')"
          @click="openRoom(room.photos)"
        >
          <img
            v-if="room.photos[0]"
            :src="`/api/photos/${room.photos[0]}/thumb`"
            alt=""
            loading="lazy"
            class="size-full object-cover"
          >
        </button>

        <span class="flex min-w-0 flex-col gap-1">
          <span
            v-if="room.guessName"
            class="truncate text-base text-text-soft"
          >{{ t('results.yourAnswer', { name: room.guessName }) }}</span>

          <!-- Three verdicts, because a blank sheet is a valid one and saying
               "faux" about a room nobody answered would be wrong. -->
          <span
            v-if="room.correct"
            class="text-base text-torch-ink"
          >
            <Icon
              name="mingcute:check-line"
              class="block size-4"
              aria-hidden="true"
            />
            {{ t('results.correct') }}
          </span>
          <span
            v-else-if="room.guessName"
            class="text-base text-alert-ink"
          >
            <Icon
              name="mingcute:close-line"
              class="block size-4"
              aria-hidden="true"
            />
            {{ t('results.wrong', { name: room.ownerName }) }}
          </span>
          <span
            v-else
            class="text-base text-text-muted"
          >{{ t('results.unanswered', { name: room.ownerName }) }}</span>
        </span>
      </li>
    </ul>

    <BaseCard v-else>
      <p class="text-base text-text-muted">
        {{ t('results.noRooms') }}
      </p>
    </BaseCard>

    <PhotoZoom
      ref="zoom"
      :photos="opened"
    />
  </section>
</template>
