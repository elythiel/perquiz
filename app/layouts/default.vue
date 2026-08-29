<script setup lang="ts">
const { user } = useSession()
const { phase } = useGamePhase()

const displayName = computed(() => user.value?.displayName ?? '')
const isAdmin = computed(() => user.value?.isAdmin ?? false)
</script>

<template>
  <div class="grain relative flex min-h-dvh flex-col overflow-x-hidden">
    <!-- The scanline grain rides on the shell above: one line in three over
         the whole page, static, under everything else on it. -->
    <!-- The torchlight glow: decoration, never announced. Round, and the one
         round thing left in the skin — a light source has no corners, and this
         one is deliberately the smoothest edge on the page. -->
    <div
      class="torch-glow pointer-events-none absolute -top-48 -left-32 size-128 rounded-full"
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

        <!--
          Bottom bar on mobile, a row of tabs in the header above that.

          The offset is `1rem + env(safe-area-inset-bottom)` and not `1rem`:
          nuxt.config declares `viewport-fit=cover`, which is what lets the
          page paint edge to edge, and which also puts a fixed bar under the
          home indicator on a notched iPhone. On everything else the inset is
          0 and the bar sits exactly where it did.

          `frame-xs` since the frame vocabulary: the bar is still a surface laid
          over the page, and three pixels say so. `p-3` and not `p-1.5` is that
          band handed back — 9px of band held 6 of gap, 3px holds 2 — so the bar
          keeps the height it had and only its line got finer. The tabs inside
          are unaffected: each names its own `frame-sm`, so none of them is
          reading `--frame-band` off this element.
        -->
        <ShellNav
          :phase="phase"
          :is-admin="isAdmin"
          class="frame frame-xs frame-edge max-sm:frame-fill fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-10 bg-panel p-3 sm:static sm:inset-auto sm:mr-auto sm:ml-8 sm:unframed sm:bg-transparent sm:px-0 sm:py-0"
        />

        <ShellUserMenu :display-name="displayName" />
      </header>

      <div class="pt-4">
        <ShellPhaseChip :phase="phase" />
      </div>

      <!-- The bottom padding clears the floating bar, inset included: the last
           line of a page must not end up behind it. -->
      <main class="flex-1 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:pb-16">
        <slot />
      </main>
    </div>
  </div>
</template>
