<script setup lang="ts">
/**
 * The account menu: who you are, and the way out.
 *
 * The first popover of the project, so it settles the pattern too. A native
 * `<details>` rather than a hand-rolled dropdown: the browser gives the
 * toggle, the keyboard, and the `aria-expanded` state on the summary for
 * free — the two things it does not give, Escape and a click outside, are the
 * dozen lines below. A `<dialog>` was the alternative — `<BaseDialog>` is one
 * import away — but a centred modal anchored to nothing, for a single action,
 * is out of proportion.
 *
 * No `role="menu"`: that role promises arrow-key navigation between items,
 * which a disclosure holding one button does not have and does not need.
 */
defineProps<{ displayName: string }>()

const { t } = useI18n()

const root = useTemplateRef<HTMLDetailsElement>('root')
const trigger = useTemplateRef<HTMLElement>('trigger')

/**
 * The element owns the open state; this is a mirror of it.
 *
 * `<details>` toggles itself on click, so a `ref` bound back onto `open` would
 * be a second source of truth racing the first. The `toggle` event is the
 * bridge: one state, held in the DOM, plus a reactive copy the two listeners
 * below can watch.
 */
const open = ref(false)

function close(restoreFocus: boolean) {
  if (!root.value?.open) return
  root.value.open = false

  // Escape hands the focus back to the chip. A click elsewhere must not, or it
  // would yank the focus out of whatever the visitor was just aiming at.
  if (restoreFocus) trigger.value?.focus()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close(true)
}

function onPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) close(false)
}

/**
 * Listening only while the menu is open.
 *
 * A document-wide `keydown` that lives for the whole session is a listener
 * that eventually catches something meant for someone else — and the shell is
 * mounted on every screen.
 */
watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('keydown', onKeydown)
    document.addEventListener('pointerdown', onPointerDown)
  }
  else {
    document.removeEventListener('keydown', onKeydown)
    document.removeEventListener('pointerdown', onPointerDown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onPointerDown)
})
</script>

<template>
  <details
    ref="root"
    class="group relative shrink-0"
    @toggle="open = root?.open ?? false"
  >
    <!--
      `list-none` and the webkit rule remove the disclosure triangle; the
      `flex` display would be enough on its own in current browsers, but the
      marker is the kind of thing that comes back with a rendering-engine
      update.

      The label overrides the chip's own text so the control says what it
      opens. It still *contains* the visible name, which is what WCAG 2.5.3
      asks of a label that replaces one.
    -->
    <summary
      ref="trigger"
      :aria-label="t('userMenu.trigger', { name: displayName })"
      class="flex cursor-pointer list-none items-center gap-1.5 rounded-full transition-opacity duration-100 ease-micro hover:opacity-80 [&::-webkit-details-marker]:hidden"
    >
      <ShellUserChip :display-name="displayName" />
      <Icon
        name="mingcute:down-small-line"
        class="block size-4 shrink-0 text-text-muted transition-transform duration-100 ease-micro group-open:rotate-180"
        aria-hidden="true"
      />
    </summary>

    <div class="absolute top-full right-0 z-20 mt-2 flex min-w-56 flex-col gap-1 rounded-2xl border border-edge-strong bg-panel p-2">
      <!-- On a phone the header shows initials only: this is the one place the
           display name is readable. -->
      <p class="truncate px-3 pt-1.5 pb-2 text-base font-bold text-text">
        {{ displayName }}
      </p>

      <!--
        A real form submission, not a `$fetch`. The browser follows the 303 to
        `/login` as a full page load, so the session state is rebuilt by a
        server that no longer knows this visitor. A fetch would leave
        `useSession()` holding a user the cookie no longer backs, and the
        global middleware would bounce `/login` straight back to `/`.

        No confirmation dialog: signing out is undone by one tap on « Se
        connecter ».
      -->
      <form
        method="post"
        action="/api/auth/logout"
      >
        <button
          type="submit"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-base text-text-soft transition-colors duration-100 ease-micro hover:bg-sunken hover:text-text focus-ring-inset"
        >
          <Icon
            name="mingcute:exit-door-line"
            class="block size-5 shrink-0"
            aria-hidden="true"
          />
          {{ t('userMenu.signOut') }}
        </button>
      </form>
    </div>
  </details>
</template>
