<script setup lang="ts">
import type { ThemeChoice } from '#shared/types/theme'

/**
 * The one place the theme cookie is written.
 *
 * Three states and not a toggle: `auto` is the default and the only one that
 * follows the operating system, so a two-position switch would destroy it
 * silently with no way back.
 *
 * Native radios rather than buttons with `role="radiogroup"`: the browser
 * already gives a radio group arrow-key navigation, a single tab stop and the
 * "3 of 3" announcement, and a hand-rolled one has to reimplement all three.
 * The inputs are visually hidden; the labels are what you see.
 */
const { choice } = useTheme()
const { t } = useI18n()

/**
 * The icon rides alongside the label, never instead of it.
 *
 * The art direction's mono uppercase micro-labels are its signature, and a
 * setting whose three states differ only by a pictogram would make people
 * guess. `auto` gets a screen rather than a half-sun: it is not a brightness
 * between the other two, it is "whatever this device says".
 */
const OPTIONS: readonly { value: ThemeChoice, icon: string }[] = [
  { value: 'auto', icon: 'mingcute:computer-line' },
  { value: 'light', icon: 'mingcute:sun-line' },
  { value: 'dark', icon: 'mingcute:moon-line' },
]
</script>

<template>
  <fieldset class="flex flex-col gap-3 rounded-2xl bg-panel px-5 py-4">
    <legend class="font-mono text-label tracking-eyebrow text-text-muted uppercase">
      {{ t('theme.label') }}
    </legend>

    <div class="flex gap-1 rounded-xl bg-night p-1">
      <label
        v-for="option in OPTIONS"
        :key="option.value"
        class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 font-mono text-label tracking-label uppercase transition-colors duration-100 ease-micro has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-torch-ink"
        :class="choice === option.value ? 'bg-torch/10 text-torch-ink' : 'text-text-muted hover:text-text-soft'"
      >
        <input
          v-model="choice"
          type="radio"
          name="theme"
          :value="option.value"
          class="sr-only"
        >
        <Icon
          :name="option.icon"
          class="block size-4 shrink-0"
          aria-hidden="true"
        />
        {{ t(`theme.${option.value}`) }}
      </label>
    </div>

    <p class="text-sm leading-relaxed text-text-muted">
      {{ t('theme.hint') }}
    </p>
  </fieldset>
</template>
