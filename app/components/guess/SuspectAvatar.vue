<script setup lang="ts">
/**
 * The badge as the guess sheet wears it, at one size for the four screens that
 * draw a suspect: the sheet, the picker, the participation list and the
 * results. Kept as a name rather than dissolved into four copies of
 * `size-12 shrink-0 text-sm`, which is the duplication `<AvatarBadge>` exists
 * to end.
 *
 * The size is the badge's own now. It used to carry `frame-xs px-1 py-1` to
 * claw back some of what a full band cost it — two initials at `text-sm` in the
 * 22px a 9px band left were wearing the walls. `<AvatarBadge>` is `frame-xs`
 * for every caller since the frame vocabulary landed, and it pads itself, so
 * this is down to the one thing that is genuinely this component's: the type
 * size the four screens drawing a suspect agreed on.
 */
defineProps<{ displayName: string }>()
</script>

<template>
  <AvatarBadge
    :name="displayName"
    class="text-sm"
  />
</template>
