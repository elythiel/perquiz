<script setup lang="ts">
interface Props {
  /** Titre de l'écran, en clair. */
  title: string
  /** Jalon qui livrera cet écran, p. ex. « M4 — Feuille de devinettes ». */
  milestone: string
  /** Une phrase sur ce que l'écran fera. */
  description: string
}

defineProps<Props>()
</script>

<template>
  <section class="flex flex-col gap-4">
    <p class="font-mono text-etiquette tracking-surtitre text-texte-estompe uppercase">
      {{ milestone }}
    </p>
    <h1 class="text-3xl leading-tight sm:text-4xl">
      {{ title }}
    </h1>
    <p class="max-w-mesure text-base leading-relaxed text-texte-doux">
      {{ description }}
    </p>
  </section>
</template>
