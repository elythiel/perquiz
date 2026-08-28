<script setup lang="ts">
/**
 * The panel surface, and the eyebrow heading that usually sits on top of it.
 *
 * `Base` rather than a bare `Card`: the linter wants two words, and the plan
 * already names its siblings that way (`<BaseDialog>` is the next one).
 *
 * Two shapes, one component. With a heading it is a `<section>` — a titled
 * region of the page. Without one it is a `<div>`, because a `<section>` with
 * no accessible name is a section in name only, and the untitled cards are
 * single sentences: "the game is locked", "no photograph yet".
 *
 * The heading comes three ways because the screens need three: a plain string
 * (`title`), markup when the heading IS a label for a field below it
 * (`#title`), and a value shown opposite it (`#aside`). All three land in the
 * same baseline-aligned row, so the eyebrow is styled once here rather than
 * copied onto every `<h2>`.
 */
/**
 * `align` exists for one reason and covers both of its cases: an `#aside` that
 * is text sits on the heading's baseline, one that is a chip sits centred on
 * it. Two sites, two answers, and neither is a preference.
 */
const { title, align = 'baseline' } = defineProps<{
  title?: string
  align?: 'baseline' | 'center'
}>()

const slots = useSlots()
const titled = computed(() => Boolean(title) || Boolean(slots.title))
</script>

<template>
  <component
    :is="titled ? 'section' : 'div'"
    class="flex flex-col gap-3 rounded-2xl bg-panel px-5 py-4"
  >
    <div
      v-if="titled"
      class="flex justify-between gap-4"
      :class="align === 'center' ? 'items-center' : 'items-baseline'"
    >
      <h2 class="font-mono text-label tracking-eyebrow text-text-muted uppercase">
        <slot name="title">
          {{ title }}
        </slot>
      </h2>
      <slot name="aside" />
    </div>

    <slot />
  </component>
</template>
