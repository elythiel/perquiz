<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { BUTTON_LAYOUT, BUTTON_SIZES, type ButtonSize, buttonStates } from './button'

/**
 * The torch button: one per screen, the answer to what the screen is asking.
 *
 * Renders a link when given a `to`, a button otherwise — the dashboard and the
 * empty sheet navigate, « Ma pièce » opens a file picker, and they are the
 * same button to a reader.
 */
const { to, size = 'lg', type = 'button', disabled = false } = defineProps<{
  to?: RouteLocationRaw
  size?: ButtonSize
  type?: 'button' | 'submit'
  disabled?: boolean
}>()
</script>

<template>
  <component
    :is="to ? 'NuxtLink' : 'button'"
    v-bind="to ? { to } : { type, disabled }"
    class="bg-torch font-bold text-on-torch transition-opacity duration-100 ease-micro"
    :class="[BUTTON_LAYOUT, BUTTON_SIZES[size], buttonStates(Boolean(to), 'hover:opacity-90')]"
  >
    <!-- Beside the label, never instead of it: a project rule, and the reason
         this is a slot rather than an `icon` prop — the caller keeps control of
         the size and the `aria-hidden`. -->
    <slot name="icon" />
    <slot />
  </component>
</template>
