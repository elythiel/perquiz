<script setup lang="ts">
import { accentOf, initialsOf } from '#shared/utils/identity'

/**
 * Two letters and a colour, standing in for a person.
 *
 * The logic was already shared (`shared/utils/identity.ts`); the five lines of
 * markup around it were not, and were copied onto five screens. This is those
 * five lines.
 *
 * Square and framed, no longer a disc: the HD-2D skin has no round shapes in
 * it, and the badge is one of the four blocks whose flat carries meaning — so
 * it is filled AND cut to the frame's steps. The frame's tint comes from
 * `accentOf` with the rest of the accent, so the line and the letters cannot
 * drift apart.
 *
 * `frame-xs` and not the full band: a face is neither a section nor a control,
 * and the vocabulary gives this family the finest line the grid can draw — a
 * texture on the badge rather than a claim about it.
 *
 * `p-1.5` IS THE BAND IT GAVE UP, and that is why not one caller had to be
 * resized. A full band is 9px on each side, three of line and six of gap; the
 * fine one is 3px, one of line and two of gap. Six pixels of padding put back
 * exactly what the six lost pixels of band were doing, so a `size-16` badge
 * still holds the same letters at the same size and an unsized one still comes
 * out the same width. What changes is the line, from three pixels to one.
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
    class="frame frame-xs frame-fill grid place-items-center p-1.5 font-bold"
    :class="accent"
    aria-hidden="true"
  >{{ initials }}</span>
</template>
