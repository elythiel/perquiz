<script setup lang="ts">
// The theme class and the browser chrome colour both follow the resolved
// theme. Both are set on the server: the first byte already carries the right
// theme, so there is no flash on mount.
const { themeClass, chrome } = useTheme()

// `html lang`, the title and the description follow the locale instead of
// being frozen in nuxt.config.
const { t, locale } = useI18n()

useHead({
  htmlAttrs: { class: themeClass, lang: locale },
  title: computed(() => t('app.name')),
  meta: computed(() => [
    { name: 'description', content: t('app.description') },
    ...chrome.value.map((colour, index) => ({
      // Two `theme-color` tags coexist (one per media query): without distinct
      // keys, unhead would keep only one of them.
      key: `theme-color-${index}`,
      name: 'theme-color',
      media: colour.media,
      content: colour.content,
    })),
  ]),
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
