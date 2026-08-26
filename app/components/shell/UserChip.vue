<script setup lang="ts">
interface Props {
  displayName: string
}

const props = defineProps<Props>()

/** The design system's five "identity" accents. */
const ACCENTS = [
  'bg-torch/20 text-torch-ink',
  'bg-clue/20 text-clue-ink',
  'bg-alert/20 text-alert-ink',
  'bg-amber/20 text-amber-ink',
  'bg-azure/20 text-azure-ink',
]

const initials = computed(() => {
  const parts = props.displayName.split(/[\s-]+/).filter(Boolean)
  // Always two letters: "Claire Dupont" -> CD, "Sofia" -> SO.
  const letters = parts.length > 1
    ? parts.slice(0, 2).map(part => part.slice(0, 1))
    : [(parts[0] ?? '').slice(0, 2)]
  return letters.join('').toLocaleUpperCase('fr-FR') || '?'
})

/** A stable accent per name: the same person keeps the same colour. */
const accent = computed(() => {
  const sum = [...props.displayName].reduce((total, char) => total + char.charCodeAt(0), 0)
  return ACCENTS[sum % ACCENTS.length] ?? ''
})
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
