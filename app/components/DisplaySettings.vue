<script setup lang="ts">
/**
 * The two settings that decide how the app looks, in one titled region.
 *
 * They were a card each, which read as two unrelated features stacked; they are
 * one scope — how you see the game — and the theme is no more a separate object
 * than the typeface is. Grouping them also says something true to assistive
 * tech: a `<section>` with a name, holding two `<fieldset>`s that each keep
 * theirs.
 *
 * A composition surface and nothing else. Each picker still owns its own cookie
 * and its own copy: this component knows neither, which is what lets a third
 * display setting arrive here without touching the two that exist.
 */
const { t } = useI18n()
</script>

<template>
  <BaseCard :title="t('display.label')">
    <div class="flex flex-col gap-5">
      <ThemePicker />
      <FontPicker />
    </div>
  </BaseCard>
</template>
