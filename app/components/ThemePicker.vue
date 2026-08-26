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

const OPTIONS: readonly ThemeChoice[] = ['auto', 'light', 'dark']
</script>

<template>
  <fieldset class="flex flex-col gap-3 rounded-2xl bg-panel px-5 py-4">
    <legend class="font-mono text-label tracking-eyebrow text-text-muted uppercase">
      {{ t('theme.label') }}
    </legend>

    <div class="flex gap-1 rounded-xl bg-night p-1">
      <label
        v-for="option in OPTIONS"
        :key="option"
        class="flex-1 cursor-pointer rounded-lg px-3 py-2.5 text-center font-mono text-label tracking-label uppercase transition-colors duration-100 ease-micro has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-torch-ink"
        :class="choice === option ? 'bg-torch/10 text-torch-ink' : 'text-text-muted hover:text-text-soft'"
      >
        <input
          v-model="choice"
          type="radio"
          name="theme"
          :value="option"
          class="sr-only"
        >
        {{ t(`theme.${option}`) }}
      </label>
    </div>

    <p class="text-sm leading-relaxed text-text-muted">
      {{ t('theme.hint') }}
    </p>
  </fieldset>
</template>
