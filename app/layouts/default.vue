<script setup lang="ts">
const { user } = useSession()
const { phase } = useGamePhase()

const displayName = computed(() => user.value?.displayName ?? '')
const isAdmin = computed(() => user.value?.isAdmin ?? false)
</script>

<template>
  <div class="relative flex min-h-dvh flex-col overflow-x-hidden">
    <!-- The torchlight glow: decoration, never announced. -->
    <div
      class="torch-glow pointer-events-none absolute -top-40 -left-24 size-96 rounded-full"
      aria-hidden="true"
    />

    <div class="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 sm:px-8">
      <header class="flex items-center justify-between gap-4 pt-5 sm:pt-6">
        <NuxtLink
          to="/"
          class="text-lg font-bold tracking-tight sm:text-xl"
        >
          {{ $t('app.name') }}
        </NuxtLink>

        <!-- Bottom bar on mobile, a row of tabs in the header above that. -->
        <ShellNav
          :phase="phase"
          :is-admin="isAdmin"
          class="fixed inset-x-4 bottom-4 z-10 rounded-2xl bg-panel p-3 sm:static sm:inset-auto sm:mr-auto sm:ml-8 sm:rounded-none sm:bg-transparent sm:px-0 sm:py-0"
        />

        <ShellUserChip :display-name="displayName" />
      </header>

      <div class="pt-4">
        <ShellPhaseChip :phase="phase" />
      </div>

      <main class="flex-1 pt-5 pb-28 sm:pb-16">
        <slot />
      </main>
    </div>
  </div>
</template>
