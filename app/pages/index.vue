<script setup lang="ts">
/**
 * The dashboard: where you stand, and the one thing to do next.
 *
 * The headline is the whole point of the screen — it says what is left, not
 * what exists. Everything under it is evidence for that sentence, and the
 * single filled button is the answer to it, chosen by what is missing rather
 * than by what is available (PAGES `/`).
 */
const { t } = useI18n()

const { data } = await useFetch('/api/dashboard')

const phase = computed(() => data.value?.phase ?? 'open')
const photos = computed(() => data.value?.myPhotos ?? [])
const answered = computed(() => data.value?.answered ?? 0)
const total = computed(() => data.value?.total ?? 0)
const remaining = computed(() => Math.max(0, total.value - answered.value))

/**
 * One call to action, picked by what is missing.
 *
 * An empty room comes first: it costs the owner nothing to fix and it is the
 * only thing blocking everyone else's sheet from growing (PAGES `/`).
 */
const action = computed(() => {
  if (phase.value === 'revealed') return { to: '/results', label: t('home.seeResults') }
  if (phase.value === 'locked') return undefined
  if (photos.value.length === 0) return { to: '/my-room', label: t('home.addPhotos') }
  if (remaining.value > 0) {
    return { to: '/guess', label: answered.value === 0 ? t('home.startGuessing') : t('home.keepGuessing') }
  }
  return { to: '/guess', label: t('home.reviewAnswers') }
})

const headline = computed(() => {
  if (phase.value === 'revealed') return t('home.revealedTitle')
  if (phase.value === 'locked') return t('home.lockedTitle')
  if (total.value === 0) return t('home.nothingYet')
  if (remaining.value === 0) return t('home.allAnswered')
  return t('home.awaiting', { count: remaining.value }, remaining.value)
})
</script>

<template>
  <section class="flex flex-col gap-5">
    <h1 class="max-w-measure text-3xl leading-tight font-bold sm:text-4xl">
      {{ headline }}
    </h1>

    <p
      v-if="phase !== 'open'"
      class="max-w-measure text-base leading-relaxed text-text-soft"
    >
      {{ phase === 'locked' ? t('home.lockedBody') : t('home.revealedBody') }}
    </p>

    <HomeProgressPanel
      :answered="answered"
      :total="total"
      :new-rooms="phase === 'open' ? (data?.newRooms ?? 0) : 0"
    />

    <HomeRoomPanel
      :photos="photos"
      :read-only="phase !== 'open'"
    />

    <NuxtLink
      v-if="action"
      :to="action.to"
      class="rounded-2xl bg-torch px-5 py-4 text-center text-lg font-bold text-on-torch transition-opacity duration-100 ease-micro hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
    >
      {{ action.label }}
    </NuxtLink>

    <!-- The state of the game, small: it is context, not a call to anything. -->
    <p
      v-if="phase === 'open'"
      class="font-mono text-label tracking-label text-text-muted uppercase"
    >
      {{ t('home.tally', { rooms: data?.roomsInPlay ?? 0, players: data?.participants ?? 0 }, data?.roomsInPlay ?? 0) }}
    </p>
  </section>
</template>
