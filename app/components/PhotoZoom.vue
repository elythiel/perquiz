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
const dialog = useTemplateRef<{ open: () => void, close: () => void }>('dialog')
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
    dialog.value?.open()
    await nextTick()
    // Jump, not glide: the photo that was tapped should already be there.
    strip.value?.scrollTo({ left: at * (strip.value?.clientWidth ?? 0), behavior: 'instant' })
  },
  close: () => dialog.value?.close(),
})
</script>

<template>
  <!-- A darker backdrop than the rest, on purpose: what is behind a photograph
       being looked at should recede further than what is behind a question. -->
  <BaseDialog
    ref="dialog"
    class="max-h-[92dvh] max-w-4xl p-0 backdrop:bg-night/90 open:gap-4"
    :aria-label="t('photoZoom.title')"
  >
    <header class="flex items-center justify-between gap-4 px-5 pt-5">
      <p class="font-mono text-label tracking-label text-text-muted tabular-nums">
        {{ t('photoZoom.counter', { done: index + 1, total: photos.length }) }}
      </p>
      <button
        type="button"
        class="grid size-11 place-items-center text-text-muted transition-colors duration-100 ease-micro hover:text-text"
        :aria-label="t('photoZoom.close')"
        @click="dialog?.close()"
      >
        <Icon
          name="pixelarticons:close"
          class="block size-5"
          aria-hidden="true"
        />
      </button>
    </header>

    <div class="relative min-h-0 flex-1 pb-5">
      <ul
        ref="strip"
        class="flex h-full snap-x snap-mandatory scroll-smooth overflow-x-auto overscroll-x-contain motion-reduce:scroll-auto focus-ring-inset"
        tabindex="0"
        :aria-label="t('photoZoom.gallery')"
        @scroll.passive="onScroll"
      >
        <li
          v-for="(photo, position) in photos"
          :key="photo"
          class="flex w-full shrink-0 snap-center items-center justify-center px-5"
        >
          <!--
            Lazy, though nothing here is below the fold: the dialog is closed,
            so none of these is displayed, and a lazy image inside a closed
            `<dialog>` is not fetched at all. They load on open instead — which
            costs the first zoom a moment, and saves every visit that never
            zooms the 35 KiB Lighthouse measured (2026-08-28).
          -->
          <img
            :src="`/api/photos/${photo}/web`"
            :alt="t('photoZoom.photoOf', { position: position + 1, total: photos.length })"
            loading="lazy"
            decoding="async"
            class="max-h-[70dvh] w-auto max-w-full object-contain"
          >
        </li>
      </ul>

      <template v-if="photos.length > 1">
        <button
          type="button"
          class="frame frame-edge frame-fill absolute top-1/2 left-2 grid size-11 -translate-y-1/2 place-items-center bg-night/70 text-2xl text-text transition-opacity duration-100 ease-micro enabled:hover:bg-night disabled:opacity-0"
          :disabled="index === 0"
          :aria-label="t('photoZoom.previous')"
          @click="step(-1)"
        >
          <Icon
            name="pixelarticons:chevron-left"
            class="block size-6"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          class="frame frame-edge frame-fill absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center bg-night/70 text-2xl text-text transition-opacity duration-100 ease-micro enabled:hover:bg-night disabled:opacity-0"
          :disabled="index >= photos.length - 1"
          :aria-label="t('photoZoom.next')"
          @click="step(1)"
        >
          <Icon
            name="pixelarticons:chevron-right"
            class="block size-6"
            aria-hidden="true"
          />
        </button>
      </template>
    </div>
  </BaseDialog>
</template>
