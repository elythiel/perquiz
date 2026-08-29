<script setup lang="ts">
/**
 * The panel surface, and the eyebrow heading that always sits on top of it.
 *
 * `Base` rather than a bare `Card`: the linter wants two words, and the plan
 * already names its siblings that way (`<BaseDialog>` is the next one).
 *
 * ALWAYS a `<section>`, and therefore always titled. It used to be two shapes
 * — a `<div>` with an `edge` frame when it had no heading, because a
 * `<section>` with no accessible name is a section in name only. Those
 * untitled cards were single sentences: "the game is locked", "no photograph
 * yet". They were messages, and `<BaseMessage>` is where a message lives now,
 * so the second shape has no call sites left and the `title` is required. A
 * card is a titled region of the page; anything else is something else.
 *
 * The heading comes two ways because the screens need two: a plain string, and
 * a value shown opposite it (`#aside`). Both land in the same baseline-aligned
 * row, so the eyebrow is styled once here rather than copied onto every `<h2>`.
 *
 * Hollow since the HD-2D skin. The `panel` flat is gone — it was barely a
 * shade above the night, and dropping it lets the glow pass through the cards
 * it used to sit under. What replaces it is the pixel frame, `azure` for every
 * card now that they are all titled regions. A tint prop would be a second way
 * to ask a question the element already answers.
 */
/**
 * `align` exists for one reason and covers both of its cases: an `#aside` that
 * is text sits on the heading's baseline, one that is a chip sits centred on
 * it. Two sites, two answers, and neither is a preference.
 */
const { title, align = 'baseline' } = defineProps<{
  title: string
  align?: 'baseline' | 'center'
}>()
</script>

<template>
  <section class="frame frame-sm frame-azure flex flex-col gap-3 px-3.5 py-2.5">
    <div
      class="flex justify-between gap-4"
      :class="align === 'center' ? 'items-center' : 'items-baseline'"
    >
      <h2 class="font-mono text-label tracking-eyebrow text-text-muted uppercase">
        {{ title }}
      </h2>
      <slot name="aside" />
    </div>

    <slot />
  </section>
</template>
