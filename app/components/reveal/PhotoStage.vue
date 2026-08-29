<script setup lang="ts">
defineProps<{
  photos: readonly string[]
  /** From step 2 the photographs step aside: same elements, less room. */
  compact: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <!--
    `TransitionGroup` and not a swap: when the container shrinks, Vue measures
    where each photograph was and where it lands, and animates the difference
    itself (FLIP). The elements are never destroyed, so the photographs glide
    from the full stage into the strip instead of disappearing and reappearing
    somewhere else — which is the whole point of keeping one page.
  -->
  <TransitionGroup
    v-if="photos.length"
    tag="ul"
    move-class="transition-transform duration-600 ease-deck motion-reduce:transition-none"
    class="flex h-full min-h-0 gap-3 max-w-full overflow-x-auto"
    :class="compact ? 'justify-start' : 'flex-wrap content-center justify-center'"
  >
    <!-- Cut and not framed, like every other photograph in the app since
         vikunja-101 and vikunja-97. This one held out longest because it
         collides with nothing — it is projected on a wall with nothing around
         it — but a rule that stops at the most visible screen in the game is
         not a rule. `frame-fill` is self-contained, so the corners are cut to
         exactly the steps they were and only the azure line is gone. -->
    <li
      v-for="photo in photos"
      :key="photo"
      class="frame-fill relative min-h-0 overflow-hidden bg-sunken transition-[width,height] duration-600 ease-deck motion-reduce:transition-none"
      :class="compact ? 'h-full w-28 shrink-0 sm:w-40' : 'h-full min-w-64 flex-1'"
    >
      <img
        :src="`/api/photos/${photo}/web`"
        alt=""
        class="size-full object-cover"
      >
    </li>
  </TransitionGroup>

  <p
    v-else
    class="text-2xl text-text-muted"
  >
    {{ t('reveal.emptyBody') }}
  </p>
</template>
