<script setup lang="ts">
const props = defineProps<{
  owner: { displayName: string }
  votes: readonly { displayName: string, count: number, isOwner: boolean }[]
  /** Mounted from the first step, revealed on the third. */
  shown: boolean
}>()

const { t } = useI18n()

/**
 * The line before the name — the presenter's set-up.
 *
 * Three cases, because a room nobody answered and a room everyone split on
 * both happen, and "la majorité pariait sur …" would be a lie in either
 * (PAGES `/reveal`).
 */
const leadIn = computed(() => {
  const [first, second] = props.votes
  if (!first) return t('reveal.nobodyVoted')
  if (second && second.count === first.count) return t('reveal.tieVote')
  return t('reveal.majority', { name: first.displayName })
})
</script>

<template>
  <!--
    Present from the start, hidden until its moment. Nothing is mounted or
    destroyed as the presenter advances, so every change on this page is a
    block moving rather than a screen being replaced.
  -->
  <div
    class="flex flex-col gap-8 transition-[opacity,transform] duration-600 ease-deck motion-reduce:transition-opacity motion-reduce:duration-120"
    :class="shown ? 'opacity-100' : 'translate-y-4 opacity-0'"
    :aria-hidden="!shown"
  >
    <p class="max-w-measure text-2xl leading-tight text-text-muted sm:text-3xl">
      {{ leadIn }}
    </p>

    <div class="flex items-center gap-6">
      <!-- The halo of animation-rules.png: it widens once, then holds. -->
      <AvatarBadge
        :name="owner.displayName"
        class="size-20 shrink-0 text-2xl transition-transform duration-900 ease-deck motion-reduce:transition-none sm:size-28 sm:text-3xl"
        :class="shown ? 'scale-100' : 'scale-40'"
      />

      <span class="flex min-w-0 flex-col">
        <span class="font-mono text-label tracking-eyebrow text-torch-ink uppercase">
          {{ t('reveal.itsAt') }}
        </span>
        <!-- Barely lit, like the mockup: the name arrives out of the dark. -->
        <span class="truncate text-6xl leading-none font-bold text-text/25 sm:text-8xl">
          {{ owner.displayName }}
        </span>
      </span>
    </div>
  </div>
</template>
