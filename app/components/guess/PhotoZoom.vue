<script setup lang="ts">
const props = defineProps<{ photos: readonly string[] }>()

const { t } = useI18n()

/**
 * One photo, big, with the others a swipe away.
 *
 * A horizontal snap gallery rather than a single image you close and reopen:
 * the photos of one room are looked at together, and making that a sequence of
 * open/close would be the interface getting in the way. The chevrons are the
 * same gallery, for the people who have no thumb — on a desktop nothing else
 * says that this strip scrolls.
 */
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const strip = useTemplateRef<HTMLElement>('strip')
const index = ref(0)

function onScroll() {
  const element = strip.value
  if (!element) return
  index.value = Math.round(element.scrollLeft / element.clientWidth)
}

function step(offset: number) {
  const element = strip.value
  const next = index.value + offset
  if (!element || next < 0 || next >= props.photos.length) return
  // Smoothness is a CSS concern on the strip, so `prefers-reduced-motion`
  // switches it off without this function knowing anything about it.
  element.scrollTo({ left: next * element.clientWidth })
}

defineExpose({
  async open(at: number) {
    index.value = at
    dialog.value?.showModal()
    await nextTick()
    // Jump, not glide: the photo that was tapped should already be there.
    strip.value?.scrollTo({ left: at * (strip.value?.clientWidth ?? 0), behavior: 'instant' })
  },
})
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto max-h-[92dvh] w-full max-w-4xl rounded-2xl bg-panel p-0 text-text backdrop:bg-night/90 open:flex open:flex-col open:gap-4"
    :aria-label="t('guess.zoomTitle')"
  >
    <header class="flex items-center justify-between gap-4 px-5 pt-5">
      <p class="font-mono text-label tracking-label text-text-muted tabular-nums">
        {{ t('guess.counter', { done: index + 1, total: photos.length }) }}
      </p>
      <button
        type="button"
        class="rounded-lg px-2 py-1 font-mono text-label tracking-label whitespace-nowrap text-text-muted uppercase transition-colors duration-100 ease-micro hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
        @click="dialog?.close()"
      >
        {{ t('guess.zoomClose') }}
      </button>
    </header>

    <div class="relative min-h-0 flex-1 pb-5">
      <ul
        ref="strip"
        class="flex h-full snap-x snap-mandatory scroll-smooth overflow-x-auto overscroll-x-contain motion-reduce:scroll-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-torch-ink"
        tabindex="0"
        :aria-label="t('guess.gallery')"
        @scroll.passive="onScroll"
      >
        <li
          v-for="(photo, position) in photos"
          :key="photo"
          class="flex w-full shrink-0 snap-center items-center justify-center px-5"
        >
          <img
            :src="`/api/photos/${photo}/web`"
            :alt="t('guess.photoOf', { position: position + 1, total: photos.length })"
            class="max-h-[70dvh] w-auto max-w-full object-contain"
          >
        </li>
      </ul>

      <template v-if="photos.length > 1">
        <button
          type="button"
          class="absolute top-1/2 left-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-night/70 text-2xl text-text transition-opacity duration-100 ease-micro enabled:hover:bg-night disabled:opacity-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
          :disabled="index === 0"
          :aria-label="t('guess.zoomPrevious')"
          @click="step(-1)"
        >
          &lsaquo;
        </button>
        <button
          type="button"
          class="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-night/70 text-2xl text-text transition-opacity duration-100 ease-micro enabled:hover:bg-night disabled:opacity-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
          :disabled="index >= photos.length - 1"
          :aria-label="t('guess.zoomNext')"
          @click="step(1)"
        >
          &rsaquo;
        </button>
      </template>
    </div>
  </dialog>
</template>
