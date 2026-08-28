<script setup lang="ts" generic="T extends string">
interface Option {
  value: T
  label: string
  /** Beside the label, never instead of it — the project's rule. */
  icon?: string
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
    <legend class="font-mono text-label tracking-eyebrow text-text-muted uppercase">
      {{ legend }}
    </legend>

    <div
      class="segment-group"
      :class="layout === 'grid' ? 'grid grid-cols-2' : 'flex'"
    >
      <label
        v-for="option in options"
        :key="option.value"
        class="segment cursor-pointer focus-ring-within"
        :class="[
          layout === 'row' && 'flex-1',
          choice === option.value ? 'bg-torch/10 text-torch-ink' : 'text-text-muted hover:text-text-soft',
        ]"
      >
        <input
          v-model="choice"
          type="radio"
          :name="name"
          :value="option.value"
          class="sr-only"
        >
        <Icon
          v-if="option.icon"
          :name="option.icon"
          class="block size-4 shrink-0"
          aria-hidden="true"
        />
        {{ option.label }}
      </label>
    </div>

    <slot />
  </fieldset>
</template>
