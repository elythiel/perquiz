<script setup lang="ts">
interface Props {
  /** The screen's title, in plain words. */
  title: string
  /** The milestone that will ship this screen, e.g. "M4 — Feuille de devinettes". */
  milestone: string
  /** One sentence on what the screen will do. */
  description: string
}

defineProps<Props>()
</script>

<template>
  <section class="flex flex-col gap-4">
    <p class="font-mono text-label tracking-eyebrow text-text-muted uppercase">
      {{ milestone }}
    </p>
    <h1 class="text-3xl leading-tight sm:text-4xl">
      {{ title }}
    </h1>
    <p class="max-w-measure text-base leading-relaxed text-text-soft">
      {{ description }}
    </p>
  </section>
</template>
