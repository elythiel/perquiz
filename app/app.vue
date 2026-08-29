<script setup lang="ts">
// The theme class and the browser chrome colour both follow the resolved
// theme. Both are set on the server: the first byte already carries the right
// theme, so there is no flash on mount.
const { themeClass, chrome } = useTheme()

// The typeface setting, server-rendered for the same reason and joined to the
// theme class rather than set beside it: `htmlAttrs.class` is one attribute,
// and two `useHead` calls writing it would race. Empty values are dropped so
// the default state leaves `<html>` with no class at all.
const { fontClass } = useFont()

const htmlClass = computed(() =>
  [themeClass.value, fontClass.value].filter(Boolean).join(' '))

// `html lang`, the title and the description follow the locale instead of
// being frozen in nuxt.config.
const { t, locale } = useI18n()

useHead({
  htmlAttrs: { class: htmlClass, lang: locale },
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
    <!--
      The one route transition, in the Micro register: a 120 ms opacity fade,
      `--ease-micro`.

      The art direction names three registers and none of them is "changing
      page", so this borrows the smallest rather than inventing a fourth. The 240 ms
      slid-and-scaled one MEANS "next room in the deck"; spending it on every
      nav click would spend that meaning too.

      Declared here rather than as `app.pageTransition` in nuxt.config, and in
      utility classes rather than a `.page-*` rule: it is the same shape the
      reveal show writes its own <Transition> in, and it sits on the element it
      actually wraps. Only that element moves — <NuxtPage> is inside the layout
      slot, so the glow and the fixed nav bar are not in the transition and do
      not blink. `out-in` keeps the two pages from ever coexisting, which is
      what would make the scroll position jump. No `appear`, so the first paint
      of a fresh load is not a fade in from nothing.

      A pure fade at 120 ms is also already what prefers-reduced-motion reduces
      everything to, so the global block in main.css caps it with nothing left
      to unpick.
    -->
    <NuxtPage
      :transition="{
        mode: 'out-in',
        enterActiveClass: 'transition-opacity duration-120 ease-micro',
        leaveActiveClass: 'transition-opacity duration-120 ease-micro',
        enterFromClass: 'opacity-0',
        leaveToClass: 'opacity-0',
      }"
    />
  </NuxtLayout>
</template>
