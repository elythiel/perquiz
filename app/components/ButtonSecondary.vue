<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { NuxtLink } from '#components'
import { BUTTON_LAYOUT, BUTTON_SIZES, type ButtonSize, buttonStates } from './button'

/** The string-vs-component trap is written up in `ButtonPrimary.vue`. */

/**
 * The bordered button: the other thing you may do, said quietly.
 *
 * Same polymorphism as its torch counterpart. Hollow, framed in `edge`: the
 * frame carries the shape and the text carries the state, so the hover
 * brightens the label rather than the outline — one behaviour for all four
 * sites, where they used to have two.
 */
const { to, size = 'sm', type = 'button', disabled = false } = defineProps<{
  to?: RouteLocationRaw
  size?: ButtonSize
  type?: 'button' | 'submit'
  disabled?: boolean
}>()
</script>

<template>
  <component
    :is="to ? NuxtLink : 'button'"
    v-bind="to ? { to } : { type, disabled }"
    class="frame frame-edge press text-text-soft transition-colors duration-100 ease-micro"
    :class="[BUTTON_LAYOUT, BUTTON_SIZES[size], buttonStates(Boolean(to), 'hover:text-text')]"
  >
    <slot name="icon" />
    <slot />
  </component>
</template>
