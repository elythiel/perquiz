<script setup lang="ts" generic="T extends string">
import type { IconName } from '#shared/utils/icons'

interface Option {
  value: T
  label: string
  /** Beside the label, never instead of it — the project's rule. */
  icon?: IconName
}

/**
 * A single choice, made of native radios.
 *
 * No `role="radiogroup"` and no keyboard handling: the browser already gives a
 * radio group its arrow keys, its single tab stop and its « 2 sur 3 »
 * announcement, and every hand-rolled version has to reimplement all three and
 * gets one of them wrong. The inputs are visually hidden; the labels are what
 * you see, which is why the focus ring lands on the label.
 *
 * A `<fieldset>` and not a `<BaseCard>`: it is `<fieldset>`/`<legend>` that
 * gives the group its accessible name and tells assistive tech these options
 * belong together. A card renders a `<section>` and would lose both.
 *
 * Only for choices that APPLY when you make them. A control that asks for
 * confirmation first must not be radios — `aria-checked` would announce a
 * state nothing has reached yet, and a refusal would flicker it back. That is
 * why the phase control keeps its buttons and borrows only the chrome.
 */
const { options, legend, layout = 'row', name } = defineProps<{
  options: readonly Option[]
  /** The group's accessible name. Visible, in the eyebrow style. */
  legend: string
  /**
   * `row`: the options share one line, each taking its part of it.
   * `grid`: two columns, for labels too long to sit four abreast.
   */
  layout?: 'row' | 'grid'
  /** The radios' shared `name`; must be unique on the page. */
  name: string
}>()

const choice = defineModel<T>({ required: true })
</script>

<template>
  <fieldset class="flex flex-col gap-3">
    <!-- The margin is not a duplicate of the `gap` above: a `<legend>` does not
         participate in its fieldset's flex layout — the browser lays it out on
         the border box itself — so the gap applies between the options and the
         hint below them, and never between the legend and the options. Hence a
         margin, matched to the gap so the three rows sit evenly. -->
    <legend class="mb-3 font-mono text-label tracking-eyebrow text-text-muted uppercase">
      {{ legend }}
    </legend>

    <div
      class="segment-group"
      :class="layout === 'grid' ? 'grid grid-cols-2' : 'flex'"
    >
      <!-- Chosen: a filled torch block, framed in `on-torch` and cut to it.
           Not chosen: a bare label — `frame-none` keeps the three pixels and
           spends them on nothing, so choosing an option never resizes it.

           `frame-fill` is on the label ALWAYS, and that is a fix rather than a
           simplification (vikunja-95). MEASURED: the first time an element
           applies the mask, its corners are painted square for one or two
           frames — 8 and 16 ms in, cut from 33 ms — because the mask has to be
           rastered for that element before it can cut anything. Acquired on
           click, that happens under the eye and reads as a square flash;
           applied at first paint, it happens with everything else and is never
           seen. On an unchosen option there is no flat to cut, so a permanent
           mask shows nothing — the same reasoning that has `frame-none` keep
           the band and spend it on nothing. -->
      <label
        v-for="option in options"
        :key="option.value"
        class="segment frame-fill cursor-pointer focus-ring-within"
        :class="[
          layout === 'row' && 'flex-1',
          choice === option.value
            ? 'frame-on-torch bg-torch font-bold text-on-torch'
            : 'frame-none text-text-muted hover:text-text-soft',
        ]"
      >
        <input
          v-model="choice"
          type="radio"
          :name="name"
          :value="option.value"
          class="sr-only"
        >
        <BaseIcon
          v-if="option.icon"
          :name="option.icon"
          class="block size-6 shrink-0"
          aria-hidden="true"
        />
        {{ option.label }}
      </label>
    </div>

    <slot />
  </fieldset>
</template>
