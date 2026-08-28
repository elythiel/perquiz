<script setup lang="ts">
/**
 * One room, one page.
 *
 * Addressed by the room's opaque handle rather than by its position: a
 * position shifts the moment somebody deletes their last photo, and a link
 * that silently starts pointing at a different room is worse than an ugly URL.
 * The handle is per-viewer, so a shared link is useless to anybody else —
 * which is a property, not a side effect.
 */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const sheet = await useGuessSheet()

const token = computed(() => String(route.params.token ?? ''))
const room = computed(() => sheet.rooms.value.find(candidate => candidate.token === token.value))

/**
 * A handle for a room that has left play, or one from somebody else's link.
 *
 * Checked twice on purpose. Once here, awaited, because a `navigateTo` whose
 * promise nobody awaits is ignored during server rendering — the page would
 * answer 200 on a URL that names nothing. And once as a watcher, for the room
 * that vanishes under the reader while they are standing on it.
 */
const stranded = computed(() => sheet.rooms.value.length > 0 && !room.value)

if (stranded.value) {
  await navigateTo('/guess', { replace: true })
}

watch(stranded, async (lost) => {
  if (lost) await navigateTo('/guess', { replace: true })
})

/** The filter rides in the URL, so it survives moving from room to room. */
const onlyUnanswered = computed({
  get: () => route.query.unanswered === '1',
  set: (only) => {
    router.replace({ query: only ? { ...route.query, unanswered: '1' } : { ...route.query, unanswered: undefined } })
  },
})

/**
 * The rooms « précédente » and « suivante » walk through.
 *
 * The room being looked at stays in the walk even once it has an answer:
 * filtering it out from under the reader would make the two buttons jump over
 * the page they are standing on.
 */
const walk = computed(() => onlyUnanswered.value
  ? sheet.rooms.value.filter(candidate => candidate.guess === null || candidate.token === token.value)
  : sheet.rooms.value)

const position = computed(() => walk.value.findIndex(candidate => candidate.token === token.value))

const picker = useTemplateRef<{ open: () => void }>('picker')

/**
 * Which OTHER rooms already carry each name, by their number in the deck.
 *
 * Numbers rather than a count, because "already used" leaves you wondering
 * where — and the answer to that is one tap away on the progress bar. The
 * numbering is the deck's, the same one the progress bar and the heading use.
 *
 * Never counts this room: the answer given here is "your answer", which the
 * picker marks differently.
 */
const usedElsewhere = computed(() => {
  const rooms: Record<number, number[]> = {}
  sheet.rooms.value.forEach((candidate, index) => {
    if (candidate.token === token.value || candidate.guess === null) return
    ;(rooms[candidate.guess] ??= []).push(index + 1)
  })
  return rooms
})

function step(offset: number) {
  const next = walk.value[position.value + offset]
  if (next) navigateTo({ path: `/guess/${next.token}`, query: route.query })
}

async function pick(participantId: number) {
  if (room.value) await sheet.answer(room.value.token, participantId)
}
</script>

<template>
  <section
    v-if="room"
    class="flex flex-col gap-5"
  >
    <h1 class="sr-only">
      {{ t('guess.roomLabel', { position: position + 1, total: walk.length }) }}
    </h1>

    <GuessDeckProgress
      :rooms="sheet.rooms.value.map(candidate => ({ token: candidate.token, answered: candidate.guess !== null }))"
      :current="sheet.rooms.value.findIndex(candidate => candidate.token === token)"
      :done="sheet.answered.value"
      :total="sheet.rooms.value.length"
    />

    <p
      v-if="sheet.readOnly.value"
      class="rounded-2xl bg-panel px-5 py-4 text-base leading-relaxed text-text-soft"
    >
      {{ t('guess.readOnly') }}
    </p>

    <div
      v-else
      class="flex gap-2"
      role="group"
      :aria-label="t('guess.filterAll')"
    >
      <button
        v-for="option in [false, true]"
        :key="String(option)"
        type="button"
        class="tap-target relative rounded-lg px-3 py-1.5 font-mono text-label tracking-label uppercase transition-colors duration-100 ease-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
        :class="onlyUnanswered === option
          ? 'bg-torch/10 text-torch-ink'
          : 'border border-edge-strong text-text-muted hover:text-text-soft'"
        :aria-pressed="onlyUnanswered === option"
        @click="onlyUnanswered = option"
      >
        {{ option ? t('guess.filterUnanswered') : t('guess.filterAll') }}
      </button>
    </div>

    <GuessPhotoGallery :photos="room.photos" />

    <h2 class="text-3xl leading-tight font-bold text-text/60 sm:text-4xl">
      {{ t('guess.question') }}
    </h2>

    <GuessSuspectCard
      :name="sheet.nameOf(room.guess)"
      :state="sheet.stateOf(room.token)"
      :duplicate="sheet.timesNamed(room.guess) > 1"
      :read-only="sheet.readOnly.value"
      @choose="picker?.open()"
    />

    <div class="flex items-center gap-3">
      <button
        type="button"
        class="grid size-14 shrink-0 place-items-center rounded-2xl bg-panel text-text transition-opacity duration-100 ease-micro disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
        :disabled="position <= 0"
        :aria-label="t('guess.previous')"
        @click="step(-1)"
      >
        <Icon
          name="mingcute:arrow-left-line"
          class="block size-6"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        class="flex-1 rounded-2xl bg-text px-5 py-4 text-lg font-bold text-night transition-opacity duration-100 ease-micro disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
        :disabled="position >= walk.length - 1"
        @click="step(1)"
      >
        {{ t('guess.next') }}
      </button>
    </div>

    <p
      v-if="position >= walk.length - 1 && sheet.answered.value === sheet.rooms.value.length"
      class="text-center text-sm leading-relaxed text-text-muted"
    >
      {{ t('guess.allAnswered') }}
    </p>

    <GuessSuspectPicker
      ref="picker"
      :participants="sheet.participants.value"
      :used-elsewhere="usedElsewhere"
      :selected="room.guess"
      @pick="pick"
    />
  </section>
</template>
