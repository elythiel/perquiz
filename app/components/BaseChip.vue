<script setup lang="ts">
import { CHIP_TONES, type ChipTone } from './chip'

/**
 * A text pill: two or three words that state a fact about the screen.
 *
 * Three of them were written by hand before this existed — the room's status,
 * the game's phase, and the « Régie » badge on `/admin` — in three different
 * band widths (9, 6 and 3px) for the same object, with the same text geometry
 * copied onto each. Like `<BaseMessage>`, this decides the whole of the form
 * and leaves the call site the tint and the words.
 *
 * NO FRAME, A BOTTOM BORDER. That is the vocabulary's rule for this family and
 * the reason the component exists: a framed block reads as something you can
 * press, and none of these three can be. The tint moves from the outline to an
 * underline, so the meaning survives the change — `torch` still says "in play",
 * `edge` still says "nothing is happening here" — while the affordance does
 * not. See the vocabulary at the top of the frame utilities in main.css.
 *
 * `border-b-3` and never `border-b-2`. The whole skin is drawn in cells of
 * three pixels — a 24px raster over an 8px viewBox — so a two-pixel line would
 * be the first thing in this interface off that grid, for nothing.
 *
 * THE GEOMETRY: `py-2`, and no horizontal padding at all. Read that as the
 * shape it now is rather than as a frame with the band subtracted. A pill in a
 * box is padded away from four edges; an underlined label has one edge, and
 * side padding would only stretch the line past the word it underlines. So the
 * whole of the space goes where it does something — eight pixels above the
 * text and eight between the text and its line, which is more than the six the
 * old band held in its gap, because a line directly under a word needs the
 * room a line around it never did. Settled by eye on the three screens rather
 * than computed from what the frame used to cost.
 *
 * The slot is the label, and it takes markup because one caller puts a pulsing
 * dot in front of its own: that dot means "live" and belongs to the phase, not
 * to every pill that will ever exist.
 */

defineProps<{
  /** Stated at every call site: what a pill says is never a default. */
  tone: ChipTone
}>()
</script>

<template>
  <p
    class="inline-flex items-center gap-2 border-b-3 py-2 font-mono text-label tracking-label whitespace-nowrap uppercase"
    :class="CHIP_TONES[tone]"
  >
    <slot />
  </p>
</template>
