<script setup lang="ts">
defineProps<{ photos: readonly { name: string }[] }>()

const { t } = useI18n()

/**
 * The shell is `<BaseDialog>`, which is where the focus trap, the Escape key
 * and the inert background come from — all of which a hand-rolled overlay gets
 * wrong in a way nobody notices until someone navigates with a keyboard.
 *
 * Wider than a confirmation, because it shows a room: the width is stated here
 * rather than defaulted by the shell.
 */
const dialog = useTemplateRef<{ open: () => void, close: () => void }>('dialog')

defineExpose({
  open: () => dialog.value?.open(),
  close: () => dialog.value?.close(),
})
</script>

<template>
  <BaseDialog
    ref="dialog"
    class="max-w-3xl p-0 backdrop:bg-night/80 open:gap-5"
    :aria-label="t('myRoom.previewTitle')"
  >
    <!--
      The close action sits on its own line, above the title rather than
      beside it. Side by side, "Fermer l'aperçu" and the heading fought over
      the same 320px and both lost. Stacking also puts the button first in
      reading order, which is where a dialog wants its escape hatch.
    -->
    <header class="flex flex-col gap-3 px-5 pt-5">
      <button
        type="button"
        class="self-end grid size-11 place-items-center rounded-lg text-text-muted transition-colors duration-100 ease-micro hover:text-text"
        :aria-label="t('myRoom.closePreview')"
        @click="dialog?.close()"
      >
        <Icon
          name="mingcute:close-line"
          class="block size-5"
          aria-hidden="true"
        />
      </button>

      <div class="flex flex-col gap-1">
        <h2 class="text-xl leading-tight">
          {{ t('myRoom.previewTitle') }}
        </h2>
        <p class="max-w-measure text-sm leading-relaxed text-text-muted">
          {{ t('myRoom.previewHint') }}
        </p>
      </div>
    </header>

    <!--
      Photos only. No name, no badge, no control: this is the whole point.

      One at a time, swiped horizontally, because that is how the guess sheet
      will show them (M4) — a preview that looks nothing like the real thing is
      not a preview. Each slide stops in the centre; the next one peeks past
      the edge, which is what tells a thumb there is more to see.

      `tabindex="0"` is not decoration: a scroll container that a keyboard
      cannot focus is a scroll container a keyboard cannot scroll.
    -->
    <ul
      class="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-5 pb-5"
      tabindex="0"
      :aria-label="t('myRoom.previewGallery')"
    >
      <li
        v-for="(photo, index) in photos"
        :key="photo.name"
        class="flex shrink-0 snap-center"
      >
        <!--
          The photo and nothing else: no frame, no rounding, no plate behind
          it. A fixed box plus `object-contain` was letterboxing every portrait
          shot into a grey card, which is a frame around the one thing the
          preview exists to show. Each slide is now exactly the size of its
          photo, capped so a landscape one still fits a phone.
        -->
        <img
          :src="`/api/photos/${photo.name}/web`"
          :alt="t('myRoom.photoLabel', { position: index + 1 })"
          loading="lazy"
          decoding="async"
          class="max-h-[65dvh] w-auto max-w-[86vw] object-contain"
        >
      </li>
    </ul>
  </BaseDialog>
</template>
