<script setup lang="ts">
import type { ThemeChoice } from '#shared/types/theme'

/**
 * The one place the theme cookie is written.
 *
 * Three states and not a toggle: `auto` is the default and the only one that
 * follows the operating system, so a two-position switch would destroy it
 * silently with no way back.
 *
 * The radios, the fieldset and the keyboard belong to `<RadioGroup>` now — see
 * there for why they are native. What is left here is the setting itself: the
 * three states, their icons, and the sentence under them.
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

/** The labels are translated here: `<RadioGroup>` takes words, not keys. */
const options = computed(() =>
  OPTIONS.map(option => ({ ...option, label: t(`theme.${option.value}`) })))
</script>

<template>
  <!-- The panel surface rides on the class, so the `<fieldset>` inside keeps
       being both the group and the card — as it was before there was a
       component to put it in. -->
  <RadioGroup
    v-model="choice"
    class="rounded-2xl bg-panel px-5 py-4"
    name="theme"
    :legend="t('theme.label')"
    :options="options"
  >
    <p class="text-sm leading-relaxed text-text-muted">
      {{ t('theme.hint') }}
    </p>
  </RadioGroup>
</template>
