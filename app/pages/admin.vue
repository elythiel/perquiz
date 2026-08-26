<script setup lang="ts">
import type { GamePhase } from '#shared/types/game'

/**
 * The control room — and the screen that must never become the answer key.
 *
 * Everything here is counts and photographs. Who answered what is neither
 * shown nor sent, because admins play too (SPEC §7): a panel that leaked the
 * mapping would hand the game to the one person who runs it.
 */
const { t } = useI18n()
const { user } = useSession()

// The API refuses non-admins on its own; this keeps the page from rendering an
// empty shell to somebody who typed the URL.
if (!user.value?.isAdmin) {
  await navigateTo('/', { replace: true })
}

const { data, refresh } = await useFetch('/api/admin')

const pendingPhoto = ref<string>()
/**
 * Nitro types a route that can throw as partially optional, so the shape is
 * declared the way it actually arrives and the template supplies the floors.
 */
const pendingPerson = ref<{
  id: number
  displayName?: string
  photos?: number
  guessesMade?: number
  guessesLost?: number
}>()

const photoDialog = useTemplateRef<{ open: () => void }>('photoDialog')
const personDialog = useTemplateRef<{ open: () => void }>('personDialog')

async function changePhase(phase: GamePhase) {
  await $fetch('/api/admin/phase', { method: 'PATCH', body: { phase } })
  await refresh()
  // The layout's phase chip reads the payload written at request time, so the
  // whole shell has to be told, not just this page.
  await reloadNuxtApp({ persistState: false })
}

function askPhoto(name: string) {
  pendingPhoto.value = name
  photoDialog.value?.open()
}

async function removePhoto() {
  if (!pendingPhoto.value) return
  await $fetch(`/api/admin/photos/${pendingPhoto.value}`, { method: 'DELETE' })
  pendingPhoto.value = undefined
  await refresh()
}

/** The consequences are fetched, not guessed: the dialog states real numbers. */
async function askPerson(id: number) {
  pendingPerson.value = { id, ...(await $fetch(`/api/admin/participants/${id}`)) }
  personDialog.value?.open()
}

async function removePerson() {
  if (!pendingPerson.value) return
  await $fetch(`/api/admin/participants/${pendingPerson.value.id}`, { method: 'DELETE' })
  pendingPerson.value = undefined
  await refresh()
}
</script>

<template>
  <section
    v-if="data"
    class="flex flex-col gap-6"
  >
    <header class="flex items-center justify-between gap-4">
      <h1 class="text-3xl leading-tight sm:text-4xl">
        {{ t('admin.title') }}
      </h1>
      <p class="rounded-lg bg-clue/15 px-3 py-1.5 font-mono text-label tracking-label text-clue-ink uppercase">
        {{ t('admin.badge') }}
      </p>
    </header>

    <AdminPhaseControl
      :phase="data.phase"
      @change="changePhase"
    />

    <AdminParticipationList
      :participants="data.participants"
      :ready="data.ready"
      @remove="askPerson"
    />

    <AdminModerationGrid
      :photos="data.moderation"
      @remove="askPhoto"
    />

    <ConfirmDialog
      ref="photoDialog"
      :title="t('admin.confirmPhotoTitle')"
      :body="t('admin.confirmPhotoBody')"
      :confirm-label="t('admin.remove')"
      @confirm="removePhoto"
    />

    <ConfirmDialog
      ref="personDialog"
      :title="t('admin.confirmRemoveTitle', { name: pendingPerson?.displayName ?? '' })"
      :body="t('admin.confirmRemoveBody', {
        photos: pendingPerson?.photos ?? 0,
        made: pendingPerson?.guessesMade ?? 0,
        lost: pendingPerson?.guessesLost ?? 0,
      })"
      :note="t('admin.confirmRemoveAccess')"
      :confirm-label="t('admin.remove')"
      @confirm="removePerson"
    />
  </section>
</template>
