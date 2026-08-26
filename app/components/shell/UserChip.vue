<script setup lang="ts">
interface Props {
  displayName: string
}

const props = defineProps<Props>()

/** Les cinq accents « identités » du design system. */
const ACCENTS = [
  'bg-torche/20 text-torche-texte',
  'bg-indice/20 text-indice-texte',
  'bg-alerte/20 text-alerte-texte',
  'bg-ambre/20 text-ambre-texte',
  'bg-azur/20 text-azur-texte',
]

const initials = computed(() => {
  const parts = props.displayName.split(/[\s-]+/).filter(Boolean)
  // Toujours deux lettres : « Claire Dupont » -> CD, « Sofia » -> SO.
  const letters = parts.length > 1
    ? parts.slice(0, 2).map(part => part.slice(0, 1))
    : [(parts[0] ?? '').slice(0, 2)]
  return letters.join('').toLocaleUpperCase('fr-FR') || '?'
})

/** Accent stable pour un nom donné : la même personne garde sa couleur. */
const accent = computed(() => {
  const sum = [...props.displayName].reduce((total, char) => total + char.charCodeAt(0), 0)
  return ACCENTS[sum % ACCENTS.length] ?? ''
})
</script>

<template>
  <span class="flex shrink-0 items-center gap-2.5">
    <span class="sr-only text-sm font-medium text-texte-doux sm:not-sr-only">{{ displayName }}</span>
    <span
      class="grid size-8 place-items-center rounded-full text-xs font-bold"
      :class="accent"
      aria-hidden="true"
    >{{ initials }}</span>
  </span>
</template>
