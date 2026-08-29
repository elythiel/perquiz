<script setup lang="ts">
import { isBeforeLock } from '#shared/utils/game'
import { MAX_PHOTOS_PER_ROOM } from '#shared/utils/photos'

/**
 * My room: the photos other people will be guessing about, and my name.
 *
 * A composition surface — the page owns the requests and the phase, each
 * section owns its own behaviour. Every mutation is refused server-side once
 * the game is locked; `readOnly` here only stops us offering what would be
 * refused (SPEC §2).
 *
 * `preparation` is not read-only, and that is the whole point of the phase:
 * this is the screen it exists for. The test mirrors the server's own guard
 * (`assertRoomsEditable`), which is why both read the same predicate.
 */
const { t } = useI18n()
const { phase } = useGamePhase()

const { data: room, refresh } = await useFetch('/api/my-room')

const readOnly = computed(() => !isBeforeLock(phase.value))
const photos = computed(() => room.value?.photos ?? [])
const inPlay = computed(() => photos.value.length > 0)
const full = computed(() => photos.value.length >= MAX_PHOTOS_PER_ROOM)

/**
 * "Vos 3 photos apparaissent sur la grille des 9 autres joueurs."
 *
 * Two numbers, and vue-i18n only agrees with one — so the audience half is its
 * own message, carrying its own preposition and article. That is what makes
 * "de l’autre joueur" possible at one, where a bare count would have said
 * "des 1 autres joueurs".
 */
const summary = computed(() => {
  const others = room.value?.otherPlayers ?? 0

  return t(
    'myRoom.summary',
    {
      count: photos.value.length,
      others: t('myRoom.summaryOthers', { count: others }, others),
    },
    photos.value.length,
  )
})

const uploads = useRoomUploads(refresh)

const picker = useTemplateRef<HTMLInputElement>('picker')
const zoom = useTemplateRef<{ open: (index: number) => void }>('zoom')
const deleteDialog = useTemplateRef<{ open: () => void }>('deleteDialog')
const nameField = useTemplateRef<{ fail: (reason: string) => void, succeed: () => void }>('nameField')

const pendingDeletion = ref<string>()

function pick() {
  picker.value?.click()
}

async function onPicked(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  // Reset first: picking the same file twice in a row must fire again.
  input.value = ''
  if (files.length) await uploads.add(files, { held: photos.value.length, max: MAX_PHOTOS_PER_ROOM })
}

function askToRemove(name: string) {
  pendingDeletion.value = name
  deleteDialog.value?.open()
}

async function remove() {
  if (!pendingDeletion.value) return
  await $fetch(`/api/my-room/photos/${pendingDeletion.value}`, { method: 'DELETE' })
  pendingDeletion.value = undefined
  await refresh()
}

async function move(name: string, offset: number) {
  const order = photos.value.map(photo => photo.name)
  const from = order.indexOf(name)
  const to = from + offset
  if (from < 0 || to < 0 || to >= order.length) return

  const reordered = [...order]
  ;[reordered[from], reordered[to]] = [reordered[to]!, reordered[from]!]

  // Moved on screen straight away, then persisted: a photo that jumps back
  // for the length of a round trip reads like a bug.
  const previous = room.value
  if (room.value) {
    room.value = { ...room.value, photos: reordered.map((photoName, position) => ({ name: photoName, position })) }
  }

  try {
    await $fetch('/api/my-room/photos', { method: 'PATCH', body: { order: reordered } })
  }
  catch {
    room.value = previous
  }
}

async function rename(displayName: string) {
  try {
    await $fetch('/api/my-room/name', { method: 'PATCH', body: { displayName } })
    nameField.value?.succeed()
    await refresh()
  }
  catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    nameField.value?.fail(status === 409 ? 'name-taken' : 'name-invalid')
  }
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <ShellPageTitle>
        {{ t('myRoom.title') }}
      </ShellPageTitle>
      <RoomStatusChip :in-play="inPlay" />
    </header>

    <p class="max-w-measure text-base leading-relaxed text-text-soft">
      {{ inPlay ? summary : t('myRoom.summaryEmpty') }}
    </p>

    <BaseCard v-if="readOnly">
      <p class="text-base leading-relaxed text-text-soft">
        {{ t('myRoom.readOnly') }}
      </p>
    </BaseCard>

    <!--
      One region for the room: the photographs, the name they are found under,
      and the way to see both as everyone else does. Three blocks that describe
      the same thing — what the others will see — where the page used to stack
      them at the same level as a setting that has nothing to do with the game.

      Its title is not « Ma pièce », which the page heading already says two
      lines above. It names what the region is FOR, which is also what tells it
      apart from the display settings below.
    -->
    <BaseCard :title="t('myRoom.visibleLabel')">
      <!-- `gap-6` on an inner wrapper rather than on the card: `<BaseCard>`
           writes `gap-3`, and two gap utilities on one element are a race
           arbitrated by the order Tailwind emits them in, not by the order they
           are written. The 24px here is the rhythm the page itself used before
           these blocks moved inside — they are big enough to want it. -->
      <div class="flex flex-col gap-6">
        <RoomPhotoGrid
          :photos="photos"
          :uploads="uploads.inFlight.value"
          :read-only="readOnly"
          :full="full"
          @pick="pick"
          @remove="askToRemove"
          @move="move"
          @zoom="index => zoom?.open(index)"
        />

        <RoomDisplayNameField
          ref="nameField"
          :name="room?.displayName ?? ''"
          :read-only="readOnly"
          @save="rename"
        />
      </div>
    </BaseCard>

    <!-- Outside the region on purpose: upload failures come and go, and a
         titled section that empties itself leaves a heading over nothing. -->
    <RoomUploadErrors
      v-if="uploads.failures.value.length"
      :failures="uploads.failures.value"
      :some-succeeded="uploads.anyStored.value"
      @dismiss="uploads.dismissFailures"
    />

    <!--
      Next to the room, as M0 intended, but no longer mixed into it: how you
      see the app is not part of what the others see. Deliberately NOT tied to
      `readOnly` either — the game freezes the room, never the reading.
    -->
    <DisplaySettings />

    <!-- HEIC is absent on purpose: sharp cannot decode it (server/utils/photos.ts). -->
    <input
      ref="picker"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      @change="onPicked"
    >

    <!--
      The same zoom the guess sheet and the results use, on the same photos.
      That is the whole point of the change: what you check here is what the
      others will be shown, in the shape they will be shown it — where the
      preview dialog it replaces paged through them one at a time, which the
      guess sheet has never done (vikunja-99).

      It takes names, the grid takes objects; the map is here rather than in a
      computed, since this is its only reader.
    -->
    <PhotoZoom
      ref="zoom"
      :photos="photos.map(photo => photo.name)"
    />
    <RoomDeletePhotoDialog
      ref="deleteDialog"
      :is-last="photos.length === 1"
      :guesses-on-my-room="room?.guessesOnMyRoom ?? 0"
      @confirm="remove"
    />
  </section>
</template>
