<script setup lang="ts">
import { accentOf, initialsOf } from '#shared/utils/identity'

const props = defineProps<{ displayName: string }>()

// Same initials and same colour as the header chip — see shared/utils/identity.
const initials = computed(() => initialsOf(props.displayName))
const accent = computed(() => accentOf(props.displayName))
</script>

<template>
  <span
    class="grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold"
    :class="accent"
    aria-hidden="true"
  >{{ initials }}</span>
</template>
