<script setup lang="ts">
import { type IconName, iconFor } from '#shared/utils/icons'

/**
 * An icon named by what it means, drawn in whichever set the reader chose.
 *
 * The typeface setting (vikunja-93) used to stop at the text: somebody who
 * turned the pixel face off kept pixel pictograms, so the setting kept half of
 * its promise. A typeface is two CSS tokens, and one class on `<html>` swaps
 * them; an icon carries its name in the markup, and no class can rewrite that.
 * Something has to translate the name at render time. This is that something.
 *
 * ONE COMPONENT AND NOT A TABLE READ AT EVERY CALL SITE, and the reason is not
 * taste: no set on Iconify carries pixelarticons' twenty-two names as they
 * stand, so a translation table is unavoidable either way. Given that, the only
 * question left was how many files know there are two sets. The answer is this
 * one, plus `nuxt.config.ts` — and a test keeps it that way.
 *
 * `useFontChoice()` and never `useFont()`, which is not a detail at this scale.
 * `useCookie` hands back a new ref per call, kept in step by a
 * `BroadcastChannel` each — fine for the two readers this setting had, wasteful
 * for the thirty icons a page draws. The shared read is one `useState`, filled
 * once per request from the cookie and carried in the payload, so the value is
 * identical on the server and on the client and nothing swaps after hydration —
 * the flicker vikunja-93 refused.
 *
 * Deliberately NOT a `size` prop. The twenty-seven call sites size themselves
 * with `size-*` and half of them also set `block`, `shrink-0` or a colour;
 * attributes fall through to the `<svg>`, so every caller keeps exactly the
 * geometry it had. A line set has a different optical weight from a pixel one
 * and it will be tempting to correct a few of those numbers — that is a
 * separate decision, not this component's business.
 */
const { name } = defineProps<{ name: IconName }>()

const choice = useFontChoice()

const resolved = computed(() => iconFor(name, choice.value))
</script>

<template>
  <Icon :name="resolved" />
</template>
