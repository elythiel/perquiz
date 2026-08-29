<script lang="ts" setup>
import type { IconName } from '#shared/utils/icons'

/**
 * The chrome every control laid over a photograph shares: the dark plate, the
 * 44px hit area, and the `relative` that makes it safe.
 *
 * `relative` is the whole reason this is one component rather than four sets of
 * classes. `tap-target` sizes its pseudo-element `max(100%, 44px)` against the
 * nearest POSITIONED ancestor, so a static control here would claim the entire
 * figure and swallow its neighbours' clicks — which shipped once (vikunja-74).
 *
 * What it deliberately does NOT decide: the ink and the focus ring. The bin is
 * `alert` because it destroys something; an arrow and a magnifier are not, and
 * a red ring around them would promise a danger they do not carry. Those come
 * from the call site, and Vue merges them onto the class below.
 *
 * `enabled:hover:` and not `hover:`: a disabled arrow must not light up under
 * the cursor. `:enabled` matches form controls, which every caller here is.
 */
defineProps<{
  icon: IconName
  label: string
}>()
</script>

<template>
  <button
    type="button"
    class="relative tap-target grid place-items-center bg-night/70 px-1 py-1 transition-opacity duration-100 ease-micro enabled:hover:bg-night"
    :aria-label="label"
  >
    <BaseIcon
      :name="icon"
      class="block size-6"
      aria-hidden="true"
    />
  </button>
</template>
