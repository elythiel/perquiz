<script setup lang="ts">
import { accentOf, initialsOf } from '#shared/utils/identity'

interface Props {
  displayName: string
}

const props = defineProps<Props>()

// The initials and the colour live in shared/utils/identity.ts: the suspect
// card on the guess sheet draws the same people, and "the blue one" has to
// mean the same person on both screens.
const initials = computed(() => initialsOf(props.displayName))
const accent = computed(() => accentOf(props.displayName))
</script>

<template>
  <span class="flex shrink-0 items-center gap-2.5">
    <span class="sr-only text-sm font-medium text-text-soft sm:not-sr-only">{{ displayName }}</span>
    <span
      class="grid size-8 place-items-center rounded-full text-xs font-bold"
      :class="accent"
      aria-hidden="true"
    >{{ initials }}</span>
  </span>
</template>
