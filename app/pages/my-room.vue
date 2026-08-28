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
const preview = useTemplateRef<{ open: () => void }>('preview')
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

    <RoomPhotoGrid
      :photos="photos"
      :uploads="uploads.inFlight.value"
      :read-only="readOnly"
      :full="full"
      @pick="pick"
      @remove="askToRemove"
      @move="move"
    />

    <RoomUploadErrors
      v-if="uploads.failures.value.length"
      :failures="uploads.failures.value"
      :some-succeeded="uploads.anyStored.value"
      @dismiss="uploads.dismissFailures"
    />

    <RoomDisplayNameField
      ref="nameField"
      :name="room?.displayName ?? ''"
      :read-only="readOnly"
      @save="rename"
    />

    <!--
      Next to the display name, as M0 intended. Deliberately NOT tied to
      `readOnly`: the theme is how you see the app, not something the game
      freezes when the admin locks it.
    -->
    <ThemePicker />

    <div class="flex flex-wrap gap-3">
      <!-- Icon beside the label, never instead of it: these two buttons sit
           side by side and do very different things. -->
      <ButtonSecondary
        class="flex-1"
        size="lg"
        :disabled="!inPlay"
        @click="preview?.open()"
      >
        <template #icon>
          <Icon
            name="pixelarticons:eye"
            class="block size-5 shrink-0"
            aria-hidden="true"
          />
        </template>
        {{ t('myRoom.playerPreview') }}
      </ButtonSecondary>
      <ButtonPrimary
        v-if="!readOnly"
        class="flex-1"
        :disabled="full"
        @click="pick"
      >
        <template #icon>
          <Icon
            name="pixelarticons:image"
            class="block size-5 shrink-0"
            aria-hidden="true"
          />
        </template>
        {{ t('myRoom.addPhotos') }}
      </ButtonPrimary>
    </div>

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

    <RoomPlayerPreview
      ref="preview"
      :photos="photos"
    />
    <RoomDeletePhotoDialog
      ref="deleteDialog"
      :is-last="photos.length === 1"
      :guesses-on-my-room="room?.guessesOnMyRoom ?? 0"
      @confirm="remove"
    />
  </section>
</template>
