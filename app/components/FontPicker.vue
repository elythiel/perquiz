<script setup lang="ts">
import type { IconName } from '#shared/utils/icons'
import type { FontChoice } from '#shared/types/font'

/**
 * The one place the font cookie is written.
 *
 * Two states and not three: `auto` has no meaning here — no browser tells a
 * site that this person would rather not read a pixel face, so the choice is
 * explicit or it is the default.
 *
 * The radios, the fieldset and the keyboard belong to `<RadioGroup>`, for the
 * reasons written there. What is left here is the setting itself.
 */
const { choice } = useFont()
const { t } = useI18n()

/**
 * The icon rides alongside the label, never instead of it — the project's rule,
 * and doubly so here: someone who came to this control because the pixel face
 * is hard to read is exactly the person a pictogram-only option fails.
 */
const OPTIONS: readonly { value: FontChoice, icon: IconName }[] = [
  { value: 'pixel', icon: 'gamepad' },
  { value: 'readable', icon: 'article' },
]

/** The labels are translated here: `<RadioGroup>` takes words, not keys. */
const options = computed(() =>
  OPTIONS.map(option => ({ ...option, label: t(`font.${option.value}`) })))
</script>

<template>
  <RadioGroup
    v-model="choice"
    name="font"
    :legend="t('font.label')"
    :options="options"
  >
    <p class="text-sm leading-relaxed text-text-muted">
      {{ t('font.hint') }}
    </p>
  </RadioGroup>
</template>
