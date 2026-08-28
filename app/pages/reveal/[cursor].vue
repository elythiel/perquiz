<script setup lang="ts">
import { podium } from '~~/server/utils/scoring'
import { clampCursor, ordinal, sceneAt, totalScenes } from '#shared/utils/show'

/**
 * The projected show.
 *
 * No layout: this is a slide, not a page of the app — no navigation, no user
 * chip, no phase chip in front of an audience. The theme is NOT pinned; the
 * screen is built from tokens and holds up in either, so it follows whatever
 * the person driving it has set.
 *
 * The position is the last path segment and nothing else. Refreshing, waking a
 * sleeping laptop or opening a second window all resume on the same slide,
 * because there is no state to lose (PAGES `/reveal`).
 */
/**
 * One page for the whole show.
 *
 * The cursor lives in the path — that is what survives a refresh — but a
 * constant page key keeps this component mounted while it changes, so moving
 * from one step to the next patches the DOM instead of replacing it. The
 * photographs, the chart and the reveal are all present from the first step
 * and merely change size and opacity: blocks move, nothing is swapped.
 */
definePageMeta({ layout: false, key: 'reveal-show', access: { role: 'admin' } })

const { t } = useI18n()
const route = useRoute()

const { data, error } = await useFetch('/api/reveal', { key: 'reveal:show' })

const rooms = computed(() => data.value?.rooms ?? [])
const steps = computed(() => podium(data.value?.standings ?? []))
const layout = computed(() => ({ rooms: rooms.value.length, podiumSteps: steps.value.length }))

const cursor = computed(() => clampCursor(Number(route.params.cursor), layout.value))
const scene = computed(() => sceneAt(cursor.value, layout.value))
const last = computed(() => totalScenes(layout.value) - 1)

const room = computed(() => scene.value.kind === 'room' ? rooms.value[scene.value.room] : undefined)

function go(offset: number) {
  const next = clampCursor(cursor.value + offset, layout.value)
  if (next !== cursor.value) navigateTo(`/reveal/${next}`)
}

/**
 * Driven from the keyboard, because the presenter is standing up.
 *
 * Space and the right arrow advance; the left arrow goes back, which re-hides
 * whatever the last step showed simply by rendering an earlier slide.
 */
function onKey(event: KeyboardEvent) {
  const forward = [' ', 'Spacebar', 'ArrowRight', 'PageDown', 'Enter']
  const back = ['ArrowLeft', 'PageUp', 'Backspace']

  if (forward.includes(event.key)) {
    event.preventDefault()
    go(1)
  }
  else if (back.includes(event.key)) {
    event.preventDefault()
    go(-1)
  }
  else if (event.key === 'Home') {
    event.preventDefault()
    navigateTo('/reveal/0')
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const stepName = computed(() => {
  if (scene.value.kind !== 'room') return t('reveal.finalRanking')
  return [t('reveal.stepPhotos'), t('reveal.stepVotes'), t('reveal.stepOwner')][scene.value.step - 1]
})
</script>

<template>
  <div class="grain flex min-h-dvh flex-col gap-6 bg-night px-6 py-6 text-text sm:px-12 sm:py-10">
    <template v-if="error">
      <!-- The guard PAGES asks for: the show would project a ranking that is
           not final while people can still change their answers. -->
      <div class="m-auto flex max-w-measure flex-col gap-4 text-center">
        <ShellPageTitle>
          {{ t('reveal.notLockedTitle') }}
        </ShellPageTitle>
        <p class="text-lg leading-relaxed text-text-soft">
          {{ t('reveal.notLockedBody') }}
        </p>
        <NuxtLink
          to="/admin"
          class="frame frame-on-torch frame-fill press self-center bg-torch px-3.5 py-1.5 text-base font-bold text-on-torch"
        >
          {{ t('reveal.toAdmin') }}
        </NuxtLink>
      </div>
    </template>

    <template v-else>
      <header class="flex items-baseline justify-between gap-6 font-mono text-label tracking-eyebrow uppercase">
        <p class="text-text-muted">
          {{ scene.kind === 'room'
            ? t('reveal.roomCounter', { position: scene.room + 1, total: rooms.length })
            : t('reveal.finalRanking') }}
        </p>
        <!-- Empty on the last slide: the left-hand label already says
             "Classement final", and saying it twice reads as a bug. -->
        <p class="text-torch-ink">
          {{ scene.kind === 'podium'
            ? t('reveal.podiumStep', { place: ordinal(steps[scene.step]?.rank ?? 1) })
            : scene.kind === 'standings' ? '' : stepName }}
        </p>
      </header>

      <main class="flex min-h-0 flex-1 flex-col">
        <template v-if="scene.kind === 'room' && room">
          <!--
            Three beats, each with the stage to itself.

            The photographs get step one whole. Step two is the distribution
            and nothing else — the moment the room sees who it bet on and
            starts arguing, which is the point of showing votes before the
            answer (SPEC §6). Repeating the photographs underneath it only
            diluted that. Step three splits the stage: the chart slides right,
            the owner arrives on the left, and the winning bar lights up.
          -->
          <!--
            Three beats, one page. The photographs own the stage, then glide up
            into a strip while the bars grow, then the owner arrives beside
            them. A room change fades — that boundary is worth marking — but
            a step change never does.
          -->
          <Transition
            mode="out-in"
            enter-active-class="transition-opacity duration-240 ease-deck"
            leave-active-class="transition-opacity duration-240 ease-deck"
            enter-from-class="opacity-0"
            leave-to-class="opacity-0"
          >
            <div
              :key="room.owner.id"
              class="flex min-h-0 flex-1 flex-col gap-8"
            >
              <div
                class="min-h-0 transition-[height,flex-grow] duration-600 ease-deck motion-reduce:transition-none"
                :class="scene.step === 1 ? 'flex-1' : 'h-24 flex-none sm:h-32'"
              >
                <RevealPhotoStage
                  :photos="room.photos"
                  :compact="scene.step > 1"
                />
              </div>

              <div class="grid min-h-0 flex-1 items-center gap-10 lg:grid-cols-2">
                <RevealOwnerReveal
                  :owner="room.owner"
                  :votes="room.votes"
                  :shown="scene.step === 3"
                  class="lg:col-start-1"
                />
                <RevealVoteChart
                  :votes="room.votes"
                  :no-answer="room.noAnswer"
                  :revealed="scene.step === 3"
                  :shown="scene.step >= 2"
                  class="min-h-0 lg:col-start-2"
                />
              </div>
            </div>
          </Transition>
        </template>

        <RevealPodium
          v-else-if="scene.kind === 'podium'"
          :steps="steps"
          :revealed="scene.step + 1"
          :total="rooms.length"
          class="mt-auto"
        />

        <RevealStandings
          v-else
          :standings="data?.standings ?? []"
        />
      </main>

      <footer class="font-mono text-label tracking-eyebrow text-text-muted uppercase">
        <span v-if="cursor > 0">&larr; {{ t('reveal.hintPrevious') }} · </span>
        <span v-if="cursor < last">
          {{ scene.kind === 'podium' && scene.step === steps.length - 1
            ? t('reveal.hintFullRanking')
            : t('reveal.hintNext') }} &rarr;
        </span>
        <span v-else>{{ t('reveal.hintEnd') }}</span>
      </footer>
    </template>
  </div>
</template>
