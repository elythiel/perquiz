<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { NuxtLink } from '#components'
import { BUTTON_LAYOUT, BUTTON_SIZES, type ButtonSize, buttonStates } from './button'

/**
 * `NuxtLink` as a COMPONENT and never as the string `'NuxtLink'`.
 *
 * `<component :is="'NuxtLink'">` resolves the name at runtime, and nothing
 * registers it there: Nuxt auto-imports components at compile time, so a name
 * that only ever appears inside a quoted string is a name the transform cannot
 * see. `resolveDynamicComponent` then falls through to treating it as an
 * element name — and the page ships a literal `<NuxtLink to="…">` tag, which
 * the browser parses as an unknown element. It renders, it is styled, it looks
 * exactly right, and it navigates nowhere.
 *
 * Found by eye on the dashboard, on a button that had been dead since the
 * primitives were extracted. Importing from `#components` puts the resolution
 * back at build time, where a typo is a build error instead of a dead control.
 */

/**
 * The torch button: one per screen, the answer to what the screen is asking.
 *
 * Renders a link when given a `to`, a button otherwise — the dashboard and the
 * empty sheet navigate, « Ma pièce » opens a file picker, and they are the
 * same button to a reader.
 *
 * The one place in the app where the flat and the frame are the same decision:
 * torch filled, framed in `on-torch`, and cut to the frame's own steps
 * (`frame-fill`) so the flat stops where the line does. The frame rides on this
 * class and not on a utility the caller adds, because a `<button>`'s `border`
 * shorthand anywhere in the cascade would reset `border-image` — the whole
 * frame, gone silently.
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
    :is="to ? NuxtLink : 'button'"
    v-bind="to ? { to } : { type, disabled }"
    class="frame frame-on-torch frame-fill press bg-torch font-bold text-on-torch transition-opacity duration-100 ease-micro"
    :class="[BUTTON_LAYOUT, BUTTON_SIZES[size], buttonStates(Boolean(to), 'hover:opacity-90')]"
  >
    <!-- Beside the label, never instead of it: a project rule, and the reason
         this is a slot rather than an `icon` prop — the caller keeps control of
         the size and the `aria-hidden`. -->
    <slot name="icon" />
    <slot />
  </component>
</template>
