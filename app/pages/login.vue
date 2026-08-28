<script setup lang="ts">
/**
 * The way in — and the only page a stranger may see.
 *
 * One action, no form: accounts live at the identity provider, so there is
 * nothing here to fill in. The three states of PAGES `/login` are driven by
 * the `error` query the callback redirects with, which keeps the page a plain
 * server-rendered document with no state of its own.
 */
const route = useRoute()

definePageMeta({ layout: false })

const PROBLEMS = {
  'not-invited': { title: 'login.notInvitedTitle', body: 'login.notInvited' },
  'provider': { title: 'login.providerErrorTitle', body: 'login.providerError' },
} as const

const problem = computed(() => {
  const error = route.query.error
  return typeof error === 'string' ? PROBLEMS[error as keyof typeof PROBLEMS] : undefined
})

/**
 * Arriving here from the sign-out button, which is the only thing that adds
 * `?bye`.
 *
 * Worth a sentence because the next tap looks like a bug: single logout is out
 * of v1 (SPEC §1), so the provider still knows this browser and signing back
 * in asks for nothing. Unexplained, that reads as "the button did not work".
 */
const signedOut = computed(() => route.query.bye !== undefined)
</script>

<template>
  <div class="grain relative flex min-h-dvh flex-col overflow-x-hidden">
    <!-- The same torchlight wash and the same grain as the shell: decoration,
         never announced. -->
    <div
      class="torch-glow pointer-events-none absolute -top-48 -left-32 size-128 rounded-full"
      aria-hidden="true"
    />

    <main class="relative mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-8 px-5 py-16 sm:px-8">
      <!-- Barely lit, like the rest of the art direction — but `text-muted`,
           which the contrast audit holds above 4.5:1 in both themes. -->
      <h1 class="text-center text-6xl leading-none font-bold tracking-tight text-text-muted sm:text-7xl">
        {{ $t('app.name') }}
      </h1>

      <p class="max-w-measure text-lg leading-relaxed text-text-soft">
        {{ $t('login.pitch') }}
      </p>

      <section
        v-if="problem"
        class="frame frame-alert frame-fill flex flex-col gap-2 bg-alert/15 px-3.5 py-2.5"
      >
        <h2 class="font-mono text-label tracking-label text-alert-ink uppercase">
          {{ $t(problem.title) }}
        </h2>
        <p class="text-base leading-relaxed text-text-soft">
          {{ $t(problem.body) }}
        </p>
      </section>

      <!-- `clue` and not `alert`: nothing went wrong here, a state changed. -->
      <section
        v-else-if="signedOut"
        class="frame frame-clue frame-fill flex flex-col gap-2 bg-clue/15 px-3.5 py-2.5"
      >
        <h2 class="font-mono text-label tracking-label text-clue-ink uppercase">
          {{ $t('login.signedOutTitle') }}
        </h2>
        <p class="text-base leading-relaxed text-text-soft">
          {{ $t('login.signedOut') }}
        </p>
      </section>

      <!-- A full page navigation, not a fetch: the next stop is the provider. -->
      <a
        href="/api/auth/login"
        class="frame frame-on-torch frame-fill press bg-torch px-4.5 py-2.5 text-center text-lg font-bold text-on-torch transition-opacity duration-100 ease-micro hover:opacity-90"
      >
        {{ problem ? $t('login.retry') : $t('login.signIn') }}
      </a>
    </main>
  </div>
</template>
