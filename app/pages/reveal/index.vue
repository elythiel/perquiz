<script setup lang="ts">
/** The show always starts at the beginning; the cursor lives in the path. */
definePageMeta({ layout: false })

await navigateTo('/reveal/0', { replace: true })
</script>

<template>
  <div />
</template>
