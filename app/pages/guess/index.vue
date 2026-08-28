<script setup lang="ts">
import { SHEET_OUT_PHASES } from '#shared/utils/game'

/**
 * The way in to the sheet: it holds no room of its own.
 *
 * Landing here re-reads the sheet — rooms appear and vanish as people upload
 * and delete photos (PAGES `/guess`) — and then hands over to the first room
 * still unanswered, which is where anyone opening « Deviner » wants to be.
 */
definePageMeta({ access: { phase: SHEET_OUT_PHASES } })

const { t } = useI18n()
const sheet = await useGuessSheet()
const route = useRoute()

await sheet.refresh()

const first = computed(() => sheet.rooms.value.find(room => room.guess === null) ?? sheet.rooms.value[0])

if (first.value) {
  await navigateTo({ path: `/guess/${first.value.token}`, query: route.query }, { replace: true })
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-3xl leading-tight sm:text-4xl">
      {{ t('guess.emptyTitle') }}
    </h1>
    <p class="max-w-measure text-base leading-relaxed text-text-soft">
      {{ t('guess.emptyBody') }}
    </p>
    <ButtonPrimary
      to="/my-room"
      class="self-start"
    >
      {{ t('guess.emptyAction') }}
    </ButtonPrimary>
  </section>
</template>
