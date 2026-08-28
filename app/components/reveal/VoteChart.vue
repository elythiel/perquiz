<script setup lang="ts">
interface Vote {
  displayName: string
  count: number
  isOwner: boolean
}

const props = defineProps<{
  votes: readonly Vote[]
  noAnswer: number
  /** Step 3 lights the owner's bar; step 2 shows the same chart, unresolved. */
  revealed: boolean
  /** False until step 2: the bars sit at zero, ready to grow. */
  shown: boolean
}>()

const { t } = useI18n()

/**
 * Bars drawn by hand rather than by a chart library.
 *
 * There is no axis, no grid, no legend and no tooltip here — a projected slide
 * wants none of them — so what remains is rectangles whose height is a
 * percentage. A charting engine would also have had to colour one bar inside a
 * single series, which they model as a property of the series, not of the bar.
 *
 * The cascade is a transition, not a keyframe: the bars are mounted from the
 * first step at height zero and grow when `shown` turns true, each 60 ms after
 * the last (screens/animation-rules.png). Driving it from state rather than
 * from mounting is what lets the whole room live on one page.
 *
 * Each bar sits in a TRACK of its own — the space the column has left once the
 * count and the name have taken theirs — and its percentage is a percentage of
 * that track. Two reasons, and the second is the one that matters.
 *
 * The visible one: the bars used to be siblings of the two labels inside a
 * `h-full` column, so a bar at 100% asked for the whole column on its own.
 * Flexbox then shrank all three, and the name carries `truncate` — so the text
 * was clipped from below, which is how this was found.
 *
 * The one that would have survived the obvious fix: pinning the labels with
 * `shrink-0` and letting the bar give way instead makes the SHRINKING
 * proportional to the overflow rather than to the votes. A 100% bar would lose
 * the labels' height while a 50% bar lost nothing, so two bars in the ratio 2:1
 * would have been drawn at about 1.5:1. The chart would have stopped telling
 * the truth about the counts, quietly, and nothing would have looked wrong.
 * A track measures every bar against the same height, which is the only version
 * where the percentages mean what they say.
 */
const bars = computed(() => {
  const all = [
    ...props.votes.map(vote => ({ label: vote.displayName, count: vote.count, owner: vote.isOwner, blank: false })),
    ...(props.noAnswer > 0 ? [{ label: t('reveal.noAnswer'), count: props.noAnswer, owner: false, blank: true }] : []),
  ]
  const tallest = Math.max(1, ...all.map(bar => bar.count))
  return all.map(bar => ({ ...bar, share: (bar.count / tallest) * 100 }))
})
</script>

<template>
  <div class="flex h-full items-end justify-center gap-4 sm:gap-6">
    <div
      v-for="(bar, index) in bars"
      :key="bar.label"
      class="flex h-full max-w-32 min-w-0 flex-1 flex-col justify-end gap-3"
    >
      <p
        class="shrink-0 text-center font-mono text-lg tabular-nums transition-[color,opacity] duration-240 ease-deck"
        :class="[revealed && bar.owner ? 'text-torch-ink' : 'text-text-muted', !shown && 'opacity-0']"
        :style="{ transitionDelay: `${index * 60}ms` }"
      >
        {{ bar.count }}
      </p>

      <!--
        The cascade of animation-rules.png: 60 ms between bars, growing from
        the baseline. `motion-reduce` swaps the rise for the 120 ms fade the
        same rules prescribe, which is why it is a second animation rather
        than a disabled transform.
      -->
      <!-- The track: what the column has left, and the height every bar's
           percentage is measured against. The bar is absolutely positioned in
           it rather than laid out as a flex item, so the percentage resolves
           against a box that is definitely there — a flex item's percentage
           height against a `flex-1` parent is the kind of thing engines have
           disagreed about. -->
      <div class="relative min-h-0 flex-1">
        <div
          class="absolute inset-x-0 bottom-0 origin-bottom transition-[height,opacity,background-color] duration-[700ms] ease-deck motion-reduce:transition-[opacity] motion-reduce:duration-120"
          :class="revealed && bar.owner
            ? 'bg-gradient-to-t from-torch/30 to-torch'
            : bar.blank ? 'bg-sunken' : 'bg-panel'"
          :style="{
            height: shown ? `${bar.share}%` : '0%',
            opacity: shown ? 1 : 0,
            transitionDelay: `${index * 60}ms`,
          }"
        />
      </div>

      <p
        class="shrink-0 truncate text-center text-base transition-[color,opacity] duration-240 ease-deck sm:text-lg"
        :class="[revealed && bar.owner ? 'text-torch-ink' : 'text-text-muted', !shown && 'opacity-0']"
        :style="{ transitionDelay: `${index * 60}ms` }"
      >
        {{ bar.label }}
      </p>
    </div>
  </div>
</template>
