<script setup lang="ts">
/**
 * A message: a block of text that says something the page has to notice.
 *
 * Ten of them were written by hand before this existed — five carrying a
 * severity as a tinted flat, five grey, in four tints and five geometries.
 * Nobody had ever decided what a message looks like; each was written where it
 * was needed, with the padding of whatever stood next to it. So this component
 * decides the whole of the form — the geometry, the frame, the flat and the
 * ink — and the call site decides only the tint and what the message says.
 *
 * THE GEOMETRY, and why this one. The five that existed were `px-4 py-3` (the
 * two inside dialogs), `px-3.5 py-2.5` (`<BaseCard>`, `<UploadErrors>` and the
 * two on the login page), `px-2.5 py-1` (the duplicate-name warning) and the
 * `gap` that came with each. `px-3.5 py-2.5` on a full 9px band wins on a
 * count of blocks and on a count of reasons: it is what the two richest
 * messages already wore, it is `<BaseCard>`'s own padding so a message and a
 * card sitting in the same column line up, and the band is the one the skin
 * gives a block that holds sentences rather than a single word. The two it
 * replaces were each right for something this is not — `px-4 py-3` was a block
 * with no band to pay for, `px-2.5 py-1` is a button's padding on a paragraph.
 *
 * THE ACCESSIBLE NAME is the other decision, and it has only two honest
 * answers. With a `title` this is a `<section>` named by its own heading; with
 * none it is a `<div>`, because a `<section>` nobody can name is a landmark
 * that shows up in the list as "region" and tells a screen reader nothing.
 * `hideTitle` is for the one message that has a name but shows no heading —
 * the upload failures, whose `aria-label` did this job before — and it keeps
 * the heading in the document outline instead of flattening it into an
 * attribute.
 *
 * NO ICON, NO ACTIONS, NO DISMISS PROP. None of the ten had an icon, one has a
 * button to dismiss it, and that button is `<UploadErrors>`'s own affordance
 * with its own label and its own emit — it belongs in the slot, not in a prop
 * this component would carry for a single caller.
 */

/**
 * The three tints, each a flat, a frame and the ink that goes on it — one
 * decision in three places rather than three that can drift.
 *
 * There is no untinted message, and that is the decision rather than an
 * omission. Five of the ten were grey: three empty states and two notices that
 * the game is locked. Those two say what `clue` says everywhere else in the
 * app — "nothing went wrong, a state changed", as the login page puts it — and
 * an empty state is the same sentence at the other end, a room saying what it
 * is currently holding. A message is a block the page wants noticed; a grey
 * one asks to be noticed and then declines to say in what register.
 *
 * Every tint therefore paints a flat, and every one is cut to the frame's own
 * steps: `frame-fill` is not optional on any of them, because a flat that is
 * not the page's own ground would otherwise sit as a square of colour outside
 * an octagonal frame.
 */
const MESSAGE_TONES = {
  alert: 'frame-alert frame-fill bg-alert/15 text-alert-ink',
  clue: 'frame-clue frame-fill bg-clue/15 text-clue-ink',
  amber: 'frame-amber frame-fill bg-amber/15 text-amber-ink',
} as const

const { title, hideTitle = false } = defineProps<{
  /** Stated at every call site: a message's severity is never a default. */
  tone: keyof typeof MESSAGE_TONES
  title?: string
  /** Names the region without showing the heading. One caller, and it is the
   *  only message whose name was already invisible. */
  hideTitle?: boolean
}>()

/**
 * `aria-labelledby` and not `aria-label`: the heading is real text that gets
 * translated, and naming the region from the element itself keeps the two from
 * ever drifting apart.
 */
const headingId = useId()
</script>

<template>
  <component
    :is="title ? 'section' : 'div'"
    class="frame flex flex-col gap-2 px-3.5 py-2.5 text-base leading-relaxed"
    :class="MESSAGE_TONES[tone]"
    :aria-labelledby="title ? headingId : undefined"
  >
    <h2
      v-if="title"
      :id="headingId"
      class="font-mono text-label tracking-label uppercase"
      :class="{ 'sr-only': hideTitle }"
    >
      {{ title }}
    </h2>

    <!-- The ink comes from the tint above and is inherited, so the slot holds
         plain sentences: a paragraph that restates the colour is a paragraph
         that will one day restate the wrong one. -->
    <slot />
  </component>
</template>
