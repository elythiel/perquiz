<script setup lang="ts">
import { SHEET_OUT_PHASES } from '#shared/utils/game'

/**
 * The way in to the sheet, and what is left of it when there is nothing to
 * guess: this page is the empty state.
 *
 * It holds no room of its own. The hand-over to the first unanswered room —
 * which is where anyone tapping « Deviner » wants to be, and the only thing the
 * nav and the dashboard can link to, since a room's handle is per-reader and
 * changes as rooms come and go — is `middleware/deck.ts`. It used to be an
 * awaited `navigateTo` in this setup body, and that is what broke the page
 * transition for the whole app.
 *
 * So the route stays and the redirect leaves. What renders here now renders
 * only when the middleware found no room to send anyone to.
 */
definePageMeta({ middleware: 'deck', access: { phase: SHEET_OUT_PHASES } })

const { t } = useI18n()
</script>

<template>
  <section class="flex flex-col gap-4">
    <ShellPageTitle>
      {{ t('guess.emptyTitle') }}
    </ShellPageTitle>
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
