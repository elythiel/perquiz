<script setup lang="ts">
import type { Standing } from '~~/server/utils/scoring'
import { ordinal } from '#shared/utils/show'

defineProps<{ standings: readonly Standing[] }>()
</script>

<template>
  <!-- Two columns on a wide screen: a party of twenty-five has to fit on one
       projected slide without anybody squinting. -->
  <ol class="grid h-full auto-rows-min grid-cols-1 content-start gap-x-10 gap-y-2 overflow-y-auto sm:grid-cols-2">
    <!-- A list, not a monument. This was the last case the frame vocabulary left
         open (vikunja-102): the rows carry the same torch/edge pattern the
         podium does, so they could have gone with the objects apart and their
         square corners. They did not — twenty-five names read one after another
         are a list you read, and the podium two slides earlier is the thing you
         look at. So they take the underline every other list in the app took in
         vikunja-106, and the two leaderboards in this game now have one shape.

         The leader keeps the torch wash and the torch ordinal beside it; what
         went is the torch LINE, for the reason « Résultats » gave up its own —
         a colour is a poor way to say something a row already says. `frame-fill`
         went with the frame: it cut that wash to corners that no longer exist.

         `py-1` and not `py-0.5` is the 3px band handed back, which the density
         here can afford exactly once: twenty-five players in two columns have to
         fit on one projected slide. -->
    <li
      v-for="(player, index) in standings"
      :key="player.id"
      class="flex animate-soft-fade items-center gap-4 border-b-3 border-edge-strong px-4 py-1"
      :class="player.rank === 1 && 'bg-torch/10'"
      :style="{ animationDelay: `${index * 40}ms` }"
    >
      <span
        class="shrink-0 text-right font-mono text-label tracking-label uppercase tabular-nums"
        :class="player.rank === 1 ? 'text-torch-ink' : 'text-text-muted'"
      >{{ ordinal(player.rank) }}</span>

      <AvatarBadge
        :name="player.displayName"
        class="frame-none! size-11 shrink-0 text-xs"
      />

      <span class="min-w-0 flex-1 truncate text-lg">{{ player.displayName }}</span>
      <span class="shrink-0 text-lg font-bold tabular-nums">{{ player.score }}</span>
    </li>
  </ol>
</template>
