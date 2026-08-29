<script setup lang="ts">
import type { GamePhase } from '#shared/types/game'
import { isBeforeLock } from '#shared/utils/game'

/**
 * The control room — and the screen that must never become the answer key.
 *
 * Everything here is counts and photographs. Who answered what is neither
 * shown nor sent, because admins play too (SPEC §7): a panel that leaked the
 * mapping would hand the game to the one person who runs it.
 */
// The API refuses non-admins on its own; this keeps the page from rendering an
// empty shell to somebody who typed the URL (middleware/access.global.ts).
definePageMeta({ access: { role: 'admin' } })

const { t } = useI18n()

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

/**
 * What a removal destroys, in numbers that agree.
 *
 * Three counts in one paragraph, and vue-i18n pluralises on one: at a single
 * photo the old copy read "Ses 1 photos". Each count is now its own message,
 * and the collateral sentence — the answers OTHER people wrote — is skipped
 * rather than printed as "0 réponses", because a confirmation that lists
 * nothing is noise in front of a destructive button.
 */
const removalBody = computed(() => {
  const photos = pendingPerson.value?.photos ?? 0
  const made = pendingPerson.value?.guessesMade ?? 0
  const lost = pendingPerson.value?.guessesLost ?? 0

  const mine = t('admin.confirmRemoveBody', {
    photos: t('admin.removalPhotos', { count: photos }, photos),
    made: t('admin.removalMade', { count: made }, made),
  })

  return lost > 0
    ? `${mine} ${t('admin.confirmRemoveLost', { count: lost }, lost)}`
    : mine
})

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
      <ShellPageTitle>
        {{ t('admin.title') }}
      </ShellPageTitle>
      <BaseChip tone="clue">
        {{ t('admin.badge') }}
      </BaseChip>
    </header>

    <AdminPhaseControl
      :phase="data.phase"
      @change="changePhase"
    />

    <!--
      Nothing else in the app links to the show, and a screen nobody can reach
      is not delivered. Offered only once the game is frozen, which is also the
      only phase the reveal API will answer in — the same predicate as the
      guard, so the link cannot outlive the door it opens.

      `<ButtonPrimary>` and not a link with its own skin. It used to wear
      `frame-clue frame-fill bg-clue/15 text-clue-ink`, which is word for word
      the `clue` tint of `<BaseMessage>` — so a control looked exactly like a
      block of text you cannot press, on the one screen that also shows a `clue`
      message when the moderation grid is empty. Two identical blocks, one
      clickable. This button is what the screen is asking for once the game is
      frozen, which is the one thing `<ButtonPrimary>` is for, and it is the
      only one on the page.
    -->
    <ButtonPrimary
      v-if="!isBeforeLock(data.phase)"
      to="/reveal"
      size="xl"
    >
      <!-- A projector, and not a play arrow: what this opens is a screen shown
           to a room off a wall, which is the same word the reveal stage uses
           about itself. A play arrow would promise a video. -->
      <template #icon>
        <BaseIcon
          name="projector"
          class="block size-5 shrink-0"
          aria-hidden="true"
        />
      </template>
      {{ t('reveal.open') }}
    </ButtonPrimary>

    <AdminParticipationList
      :participants="data.participants"
      :ready="data.ready"
      :me="data.me"
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
      :body="removalBody"
      :note="t('admin.confirmRemoveAccess')"
      :confirm-label="t('admin.remove')"
      @confirm="removePerson"
    />
  </section>
</template>
