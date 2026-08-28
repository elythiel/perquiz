<script setup lang="ts">
/**
 * The badge as the guess sheet wears it, at one size for the four screens that
 * draw a suspect: the sheet, the picker, the participation list and the
 * results. Kept as a name rather than dissolved into four copies of
 * `size-10 shrink-0 text-sm`, which is the duplication `<AvatarBadge>` exists
 * to end.
 */
defineProps<{ displayName: string }>()
</script>

<template>
  <AvatarBadge
    :name="displayName"
    class="size-10 shrink-0 text-sm"
  />
</template>
