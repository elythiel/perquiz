<script setup lang="ts">
/**
 * The way in to the sheet: it holds no room of its own.
 *
 * Landing here re-reads the sheet — rooms appear and vanish as people upload
 * and delete photos (PAGES `/guess`) — and then hands over to the first room
 * still unanswered, which is where anyone opening « Deviner » wants to be.
 */
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
    <NuxtLink
      to="/my-room"
      class="self-start rounded-2xl bg-torch px-5 py-3 text-base font-bold text-on-torch transition-opacity duration-100 ease-micro hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
    >
      {{ t('guess.emptyAction') }}
    </NuxtLink>
  </section>
</template>
