<script setup lang="ts">
/**
 * My room: the photos other people will be guessing about, and my name.
 *
 * A composition surface — the page owns the requests and the phase, each
 * section owns its own behaviour. Every mutation is refused server-side once
 * the game leaves `open`; `readOnly` here only stops us offering what would be
 * refused (SPEC §2).
 */
const { t } = useI18n()
const { phase } = useGamePhase()

const { data: room, refresh } = await useFetch('/api/my-room')

const readOnly = computed(() => phase.value !== 'open')
const photos = computed(() => room.value?.photos ?? [])
const inPlay = computed(() => photos.value.length > 0)

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
  if (files.length) await uploads.add(files)
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
      <h1 class="text-3xl leading-tight sm:text-4xl">
        {{ t('myRoom.title') }}
      </h1>
      <RoomStatusChip :in-play="inPlay" />
    </header>

    <p class="max-w-measure text-base leading-relaxed text-text-soft">
      {{ inPlay
        ? t('myRoom.summary', { count: photos.length, others: room?.otherPlayers ?? 0 }, photos.length)
        : t('myRoom.summaryEmpty') }}
    </p>

    <p
      v-if="readOnly"
      class="rounded-2xl bg-panel px-5 py-4 text-base leading-relaxed text-text-soft"
    >
      {{ t('myRoom.readOnly') }}
    </p>

    <RoomPhotoGrid
      :photos="photos"
      :uploads="uploads.inFlight.value"
      :read-only="readOnly"
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

    <div class="flex flex-wrap gap-3">
      <button
        type="button"
        class="flex-1 rounded-2xl border border-edge-strong px-5 py-4 text-base text-text transition-colors duration-100 ease-micro hover:border-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
        :disabled="!inPlay"
        @click="preview?.open()"
      >
        {{ t('myRoom.playerPreview') }}
      </button>
      <button
        v-if="!readOnly"
        type="button"
        class="flex-1 rounded-2xl bg-torch px-5 py-4 text-base font-bold text-on-torch transition-opacity duration-100 ease-micro hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
        @click="pick"
      >
        {{ t('myRoom.addPhotos') }}
      </button>
    </div>

    <!-- HEIC is absent on purpose: sharp cannot decode it (server/utils/photos.ts). -->
    <input
      ref="picker"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      class="sr-only"
      tabindex="-1"
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
