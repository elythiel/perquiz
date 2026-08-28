<script setup lang="ts">
import { isBeforeLock } from '#shared/utils/game'

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
 * Two numbers, two agreements, one sentence.
 *
 * vue-i18n pluralises a message on ONE count, so "{rooms} pièces, {players}
 * participants" could only ever agree with one of them — a two-player party
 * read "1 participants". Each half is its own message, pluralised on its own
 * number, and the carrier keeps the word order in the locale file rather than
 * in this component.
 */
const tally = computed(() => {
  const rooms = data.value?.roomsInPlay ?? 0
  const players = data.value?.participants ?? 0

  return t('home.tally', {
    rooms: t('home.tallyRooms', { count: rooms }, rooms),
    players: t('home.tallyPlayers', { count: players }, players),
  })
})

/**
 * One call to action, picked by what is missing.
 *
 * An empty room comes first: it costs the owner nothing to fix and it is the
 * only thing blocking everyone else's sheet from growing (PAGES `/`).
 *
 * In `preparation` it is also the last one. The sheet is closed, so every
 * road to `/guess` is a road to a read-only screen — the button has to stop
 * at the room, whether that room is empty or already three photos deep.
 */
const action = computed(() => {
  if (phase.value === 'revealed') {
    return { to: '/results', label: t('home.seeResults'), icon: 'mingcute:trophy-line' }
  }
  if (phase.value === 'locked') return undefined
  if (photos.value.length === 0) {
    return { to: '/my-room', label: t('home.addPhotos'), icon: 'mingcute:pic-line' }
  }
  if (phase.value === 'preparation') {
    return { to: '/my-room', label: t('home.fillRoom'), icon: 'mingcute:box-line' }
  }
  if (remaining.value > 0) {
    return {
      to: '/guess',
      label: answered.value === 0 ? t('home.startGuessing') : t('home.keepGuessing'),
      // A person with a question mark, which is the game's whole question —
      // not "what is this?" but "who is this?".
      icon: 'mingcute:user-question-line',
    }
  }
  return { to: '/guess', label: t('home.reviewAnswers'), icon: 'mingcute:list-check-line' }
})

const headline = computed(() => {
  if (phase.value === 'revealed') return t('home.revealedTitle')
  if (phase.value === 'locked') return t('home.lockedTitle')
  if (phase.value === 'preparation') return t('home.preparationTitle')
  if (total.value === 0) return t('home.nothingYet')
  if (remaining.value === 0) return t('home.allAnswered')
  return t('home.awaiting', { count: remaining.value }, remaining.value)
})

/**
 * The sentence under the headline, for the three phases that need explaining.
 *
 * `preparation` gets its own rather than borrowing the locked one: "not yet"
 * and "no longer" are opposite pieces of news, and the second would read as
 * "you missed it" to someone who has missed nothing.
 */
const note = computed(() => {
  if (phase.value === 'preparation') return t('home.preparationBody')
  if (phase.value === 'locked') return t('home.lockedBody')
  if (phase.value === 'revealed') return t('home.revealedBody')
  return undefined
})
</script>

<template>
  <section class="flex flex-col gap-5">
    <h1 class="max-w-measure text-3xl leading-tight font-bold sm:text-4xl">
      {{ headline }}
    </h1>

    <p
      v-if="note"
      class="max-w-measure text-base leading-relaxed text-text-soft"
    >
      {{ note }}
    </p>

    <!-- No answer count in `preparation`: the sheet is not open, so "0 / 3"
         would be a score against something nobody could have played yet. -->
    <HomeProgressPanel
      v-if="phase !== 'preparation'"
      :answered="answered"
      :total="total"
      :new-rooms="phase === 'open' ? (data?.newRooms ?? 0) : 0"
    />

    <HomeRoomPanel
      :photos="photos"
      :read-only="!isBeforeLock(phase)"
    />

    <!-- One button, one icon slot: both follow the same decision, so the icon
         cannot go missing when the label changes. -->
    <ButtonPrimary
      v-if="action"
      :to="action.to"
      size="xl"
    >
      <template #icon>
        <Icon
          :name="action.icon"
          class="block size-5 shrink-0"
          aria-hidden="true"
        />
      </template>
      {{ action.label }}
    </ButtonPrimary>

    <!-- The state of the game, small: it is context, not a call to anything.
         Shown in `preparation` too, where watching the room count climb is
         precisely what tells you the party is filling up. -->
    <p
      v-if="isBeforeLock(phase)"
      class="font-mono text-label tracking-label text-text-muted uppercase"
    >
      {{ tally }}
    </p>
  </section>
</template>
