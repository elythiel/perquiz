<script setup lang="ts">
/**
 * The native `<dialog>`, written once.
 *
 * The focus trap, Escape and the inert background come with the element, and
 * every hand-rolled overlay gets one of the three wrong. Five screens had
 * rolled the same shell by hand around five very different insides.
 *
 * A default slot and no named ones, because that is what the survey found: the
 * five agree on the box and on nothing inside it — a heading over two buttons,
 * a header that stays put over a list that scrolls, a gallery, a photograph.
 *
 * What the base holds is only what all five say identically. Width is NOT among
 * them (three confirmations at `max-w-md`, a preview at `max-w-3xl`, a zoom at
 * `max-w-4xl`) and neither is the backdrop, which the photo viewer darkens a
 * notch further on purpose. Both are therefore the caller's, stated once each
 * rather than defaulted here and fought over: two competing `max-w-*` on one
 * element would be settled by the order Tailwind happens to emit them in, which
 * is not a decision anybody made. Padding, gap and max height are the caller's
 * for the same reason.
 *
 * The frame is `edge` and the dialog is one of the two blocks that keep the
 * `panel` flat — a modal has to sit ON something, or the page reads through it.
 * And it IS `frame-fill`. The first pass argued the other way — that a cut
 * corner on an opaque box floating over a dimmed page would read as damage —
 * and that was wrong in the only way that counts: an UNCUT corner puts a square
 * of `panel` outside an octagonal frame, which does not read as anything, it
 * just looks broken. What the notch shows is the dimmed backdrop, which is
 * exactly what a pixel frame is supposed to show through it.
 *
 * Nothing here touches focus. `showModal()` already moves it into the dialog,
 * and the picker moves it on to its search field afterwards; a second opinion
 * from this component would be a race with no winner. Nothing here closes on a
 * backdrop click either — none of the five did, and Escape is the affordance
 * the element already ships.
 */
const dialog = useTemplateRef<HTMLDialogElement>('dialog')

defineExpose({
  open: () => dialog.value?.showModal(),
  close: () => dialog.value?.close(),
})
</script>

<template>
  <dialog
    ref="dialog"
    class="frame frame-edge frame-fill m-auto w-full bg-panel text-text open:flex open:flex-col"
  >
    <slot />
  </dialog>
</template>
