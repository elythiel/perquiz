<script setup lang="ts">
/**
 * The badge as the guess sheet wears it, at one size for the four screens that
 * draw a suspect: the sheet, the picker, the participation list and the
 * results. Kept as a name rather than dissolved into four copies of
 * `size-12 shrink-0 text-sm`, which is the duplication `<AvatarBadge>` exists
 * to end.
 *
 * 48px and not the 40px it was: the pixel frame costs 18px of the box, and two
 * initials at `text-sm` in the 22px that left were wearing the walls.
 */
defineProps<{ displayName: string }>()
</script>

<template>
  <AvatarBadge
    :name="displayName"
    class="text-sm frame-xs px-1 py-1"
  />
</template>
