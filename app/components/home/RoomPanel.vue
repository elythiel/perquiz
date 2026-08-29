<script setup lang="ts">
/**
 * A preview, and nothing you can act on.
 *
 * It used to hold four thumbnails that were links and a « + » tile that was
 * one too — and that tile was the defect: an `<a>` carrying `frame-torch`,
 * `press` and a plus icon, three signs all saying "this adds a photograph
 * here", named « Ajouter des photos » to a screen reader and navigating
 * instead (WCAG 2.4.4). It also only appeared between one and four
 * photographs, vanishing past that with nothing to explain it.
 *
 * Nothing replaces it, and that is the decision rather than an omission:
 * « Ma pièce » is one tap away in the nav bar on every screen and in every
 * phase, and the page's own call to action points there when a room is what
 * is missing. A third road would only repeat the first two.
 *
 * `readOnly` went with the tile — it was the only thing that read it, and a
 * preview has nothing to lock.
 */
defineProps<{ photos: readonly string[] }>()

const { t } = useI18n()

/** Enough to recognise the room at a glance; « Ma pièce » holds the rest. */
const SHOWN = 4
</script>

<template>
  <BaseCard
    :title="t('home.roomLabel')"
    align="center"
  >
    <template #aside>
      <RoomStatusChip :in-play="photos.length > 0" />
    </template>

    <ul
      v-if="photos.length"
      class="grid grid-cols-4 gap-2"
    >
      <!-- Cut and not framed, which is the vocabulary's rule for a photograph
           and here it does a second job: the azure line these wore came from
           the controls' vocabulary and was most of what made them read as
           buttons. `frame-fill` is self-contained — its own `mask-border`, its
           own width — so the corners are cut to exactly the steps they were
           and only the line is gone. It rides on the `<li>` and not on the
           `<img>` for the reason `<AdminModerationGrid>` gives: a replaced
           element has no box to hang a mask on the way this needs.

           `alt=""`, and the reason the old comment gave is precisely why. It
           said the alt was there to name the LINK — "without one a screen
           reader announces four links called nothing at all". There is no link
           any more, and « Photo 1, Photo 2 » numbers without informing: the app
           knows filenames, not what is in the picture. The card is already
           titled « Ma pièce » and carries its status pill, so these are what
           they look like — decoration over a fact stated elsewhere. -->
      <li
        v-for="photo in photos.slice(0, SHOWN)"
        :key="photo"
        class="frame-fill relative aspect-square overflow-hidden bg-sunken"
      >
        <img
          :src="`/api/photos/${photo}/thumb`"
          alt=""
          loading="lazy"
          class="size-full object-cover"
        >
      </li>
    </ul>

    <p
      v-else
      class="max-w-measure text-base leading-relaxed text-text-soft"
    >
      {{ t('home.roomEmpty') }}
    </p>
  </BaseCard>
</template>
