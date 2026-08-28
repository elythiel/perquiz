<script setup lang="ts">
import { accentOf, initialsOf } from '#shared/utils/identity'

/**
 * Two letters and a colour, standing in for a person.
 *
 * The logic was already shared (`shared/utils/identity.ts`); the five lines of
 * markup around it were not, and were copied onto five screens. This is those
 * five lines.
 *
 * No `size` prop. The five badges are 8, 9, 10, 16→20 and 20→28, and two of
 * them also carry a position or an animation — the podium overlaps its
 * neighbour, the reveal grows into place. A prop would have to enumerate all
 * of that, or force the sizes to agree, and making them agree is a design
 * decision rather than this refactor. So geometry falls through on the class:
 * one root element, no `inheritAttrs: false`, and every caller keeps its own
 * pixels.
 */
const { name } = defineProps<{ name: string }>()

const initials = computed(() => initialsOf(name))
const accent = computed(() => accentOf(name))
</script>

<template>
  <span
    class="grid place-items-center rounded-full font-bold"
    :class="accent"
    aria-hidden="true"
  >{{ initials }}</span>
</template>
