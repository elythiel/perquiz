<script setup lang="ts">
import type { Standing } from '~~/server/utils/scoring'
import { ordinal } from '#shared/utils/show'

defineProps<{ standings: readonly Standing[] }>()
</script>

<template>
  <!-- Two columns on a wide screen: a party of twenty-five has to fit on one
       projected slide without anybody squinting. -->
  <ol class="grid h-full auto-rows-min grid-cols-1 content-start gap-x-10 gap-y-2 overflow-y-auto sm:grid-cols-2">
    <li
      v-for="(player, index) in standings"
      :key="player.id"
      class="frame frame-xs frame-fill flex animate-soft-fade items-center gap-4 px-4 py-0.5"
      :class="player.rank === 1 ? 'frame-torch bg-torch/10' : 'frame-none'"
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
