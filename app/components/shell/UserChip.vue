<script setup lang="ts">
interface Props {
  displayName: string
}

defineProps<Props>()
</script>

<template>
  <span class="flex shrink-0 items-center gap-2.5">
    <span class="sr-only text-sm font-medium text-text-soft sm:not-sr-only">{{ displayName }}</span>
    <AvatarBadge
      :name="displayName"
      class="size-8 text-xs"
    />
  </span>
</template>
