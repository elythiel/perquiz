<script setup lang="ts">
import type { PodiumStep } from '#shared/utils/scoring'
import { ordinal } from '#shared/utils/show'

const props = defineProps<{
  steps: readonly PodiumStep[]
  /** How many steps have been climbed: the show reveals third, then second, then first. */
  revealed: number
  total: number
}>()

const { t } = useI18n()

/**
 * The three columns, in the order they stand on a podium — second, first,
 * third — rather than the order they are revealed in.
 *
 * A step nobody stands on is simply absent: a tie for second leaves no third,
 * and inventing one out of the fourth player would be a lie in front of the
 * whole room.
 */
const COLUMNS = [2, 1, 3]

const shown = computed(() => COLUMNS.map((rank) => {
  const step = props.steps.find(candidate => candidate.rank === rank)
  if (!step) return undefined
  // Steps are climbed 3, 2, 1 — so a step is out once the show has passed it.
  const order = props.steps.findIndex(candidate => candidate.rank === rank)
  return order < props.revealed ? step : undefined
}))

/** First place stands tallest, third lowest; the middle column is the winner. */
const HEIGHTS: Record<number, string> = { 1: 'h-56 sm:h-72', 2: 'h-40 sm:h-52', 3: 'h-32 sm:h-40' }
</script>

<template>
  <div class="flex items-end justify-center gap-4 sm:gap-8">
    <div
      v-for="(step, index) in shown"
      :key="COLUMNS[index]"
      class="flex w-full max-w-xs flex-col items-center justify-end gap-4"
    >
      <template v-if="step">
        <!-- Overlapping avatars when a rank is shared, as the mockup shows. -->
        <span class="flex animate-step-up items-center motion-reduce:animate-soft-fade">
          <AvatarBadge
            v-for="(player, seat) in step.players"
            :key="player.id"
            :name="player.displayName"
            class="size-16 text-lg sm:size-20 sm:text-xl"
            :class="seat > 0 && '-ml-5'"
          />
        </span>

        <span class="flex animate-step-up flex-col items-center gap-1 motion-reduce:animate-soft-fade">
          <span class="max-w-full truncate text-center text-2xl font-bold text-text/25 sm:text-4xl">
            {{ step.players.map(player => player.displayName).join(' & ') }}
          </span>
          <span
            v-if="step.players.length > 1"
            class="font-mono text-label tracking-eyebrow text-text-muted uppercase"
          >{{ t('reveal.exAequo') }}</span>
        </span>

        <!-- A SQUARE border, and the only right angles left in a skin that
             methodically removed every one of them (vikunja-74). That is the
             intent rather than an oversight: a podium is a monument, and a
             monument reads as one because it is not shaped like the things
             around it. Written down so nobody straightens it back into the
             pixel frame in good faith.

             Three pixels — one cell of the 24-over-8 raster — so the line is
             square without being off the grid the rest of the skin is drawn on.

             `frame-fill` goes with the frame, which is what squares the wash on
             the winner's step. And the gradient no longer needs
             `background-origin: border-box`, the declaration `@utility frame`
             carries for exactly this block: a background image is laid out in
             the padding box and painted across the border box, so the browser
             tiles it into the band and shows both ends of the ramp on the wrong
             sides. A solid opaque border paints over that strip, so the defect
             has nowhere to appear. -->
        <div
          class="flex w-full animate-step-up flex-col items-center justify-center gap-1 border-3 motion-reduce:animate-soft-fade"
          :class="[
            HEIGHTS[COLUMNS[index]!],
            step.rank === 1
              ? 'border-torch-ink bg-linear-to-t from-torch/10 to-torch/40'
              : 'border-edge-strong bg-panel',
          ]"
        >
          <span
            class="font-mono text-label tracking-label uppercase"
            :class="step.rank === 1 ? 'text-torch-ink' : 'text-text-muted'"
          >{{ ordinal(step.rank) }}</span>
          <span
            class="text-4xl font-bold tabular-nums sm:text-6xl"
            :class="step.rank === 1 ? 'text-text/25' : 'text-text'"
          >{{ step.players[0]!.score }}</span>
          <span
            v-if="step.rank === 1"
            class="text-base text-text-soft"
          >{{ t('reveal.roomsOutOf', { score: step.players[0]!.score, total }, step.players[0]!.score) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>
