<script setup lang="ts">
/**
 * The show always starts at the beginning; the cursor lives in the path.
 *
 * A route-record redirect, not an awaited `navigateTo` in a setup body: the
 * router resolves it before any component is created, so the page transition
 * never gets a page that leaves during its own entrance. That pattern — the
 * one this file used to follow — is what left `opacity-0` on a page nobody
 * would ever take it off (see `middleware/deck.ts`).
 *
 * No `access` guard here, and none needed: nobody ever lands on this route.
 * `/reveal/0` carries the admin rule, and a player redirected onto it is sent
 * home from there.
 */
definePageMeta({ layout: false, redirect: '/reveal/0' })
</script>
