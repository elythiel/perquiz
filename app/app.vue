<script setup lang="ts">
// La classe de thème et la couleur de chrome du navigateur suivent le thème
// résolu. Les deux sont posées côté serveur : le premier octet porte déjà le
// bon thème, donc aucun flash au montage.
const { themeClass, chrome } = useTheme()

useHead({
  htmlAttrs: { class: themeClass },
  meta: computed(() => chrome.value.map((couleur, index) => ({
    // Deux `theme-color` coexistent (une par media query) : sans clés
    // distinctes, unhead n'en garderait qu'une.
    key: `theme-color-${index}`,
    name: 'theme-color',
    media: couleur.media,
    content: couleur.content,
  }))),
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
