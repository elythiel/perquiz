<script setup lang="ts">
import { tidyDisplayName } from '#shared/utils/display-name'

/**
 * The name others will pick when they accuse you.
 *
 * The one control in the app that answers focus with its own frame: `edge` at
 * rest, `torch` while you are in it, `alert` when the server refused the name.
 * So it is also the one that drops the `:focus-visible` outline — two
 * indicators on one border read as two borders, and the frame is already
 * saying it.
 *
 * Worth knowing before this is copied elsewhere: `edge-strong` against
 * `torch-ink` is 3.29:1 in the dark theme and 1.55:1 in the light one, where
 * the two are nearly the same luminance. That clears WCAG 2.4.7 (the indicator
 * is visible) and 1.4.11 (the frame holds 5.38:1 against the field's ground in
 * light, 12.24:1 in dark), and it does NOT clear the AAA change-of-state
 * threshold. A control whose frame does not recolour keeps its ring.
 *
 * One field, always editable, and a button that only lights up once the name
 * actually differs from the stored one. There is no view/edit toggle: it was a
 * step that bought nothing, made the field look typeable while it was not, and
 * gave a save button two jobs. The only read-only state left is the real one —
 * the game is locked (SPEC §2).
 */
const props = defineProps<{ name: string, readOnly: boolean }>()
const emit = defineEmits<{ save: [name: string] }>()

const { t } = useI18n()

const draft = ref(props.name)
const error = ref<string>()
const saved = ref(false)

// The server is the source of truth: a refused rename must not leave the
// refused text sitting in the field, and an accepted one resets the baseline.
watch(() => props.name, (name) => {
  draft.value = name
})

/** Compared the way the server will compare it, so the button never lies. */
const changed = computed(() =>
  tidyDisplayName(draft.value) !== props.name && tidyDisplayName(draft.value).length > 0)

watch(draft, () => {
  error.value = undefined
  saved.value = false
})

function submit() {
  if (!changed.value) return
  emit('save', tidyDisplayName(draft.value))
}

defineExpose({
  /** The page owns the request, so it hands the outcome back here. */
  fail: (reason: string) => { error.value = reason },
  succeed: () => { saved.value = true },
})
</script>

<template>
  <!-- No card of its own since vikunja-94: the page groups this with the photo
       grid inside one region, and a card nested in a card draws two frames
       around one subject. What `<BaseCard>` gave that is worth keeping is the
       eyebrow style on the label and the 12px rhythm, both restated here.

       A `<label>` rather than the `<h2>` the card wrapped it in: the text names
       a field, and a heading that is really a label announces a section that
       does not exist. -->
  <div class="flex flex-col gap-3">
    <label
      for="display-name"
      class="font-mono text-label tracking-eyebrow text-text-muted uppercase"
    >{{ t('myRoom.nameLabel') }}</label>

    <form
      class="flex items-center gap-3"
      @submit.prevent="submit"
    >
      <input
        id="display-name"
        v-model="draft"
        :readonly="readOnly"
        maxlength="30"
        autocomplete="off"
        class="frame frame-fill min-w-0 flex-1 bg-night px-2.5 py-1.5 text-lg text-text focus:frame-torch focus-visible:outline-none read-only:frame-none read-only:bg-transparent"
        :class="error ? 'frame-alert' : 'frame-edge'"
        :aria-describedby="error ? 'display-name-error' : 'display-name-hint'"
      >

      <ButtonSecondary
        v-if="!readOnly"
        class="shrink-0"
        size="md"
        type="submit"
        :disabled="!changed"
      >
        {{ t('myRoom.nameSave') }}
      </ButtonSecondary>
    </form>

    <p
      v-if="error"
      id="display-name-error"
      class="text-sm text-alert-ink"
      role="alert"
    >
      {{ t(`myRoom.errors.${error}`) }}
    </p>
    <p
      v-else-if="saved"
      class="text-sm text-torch-ink"
      role="status"
    >
      {{ t('myRoom.nameSaved') }}
    </p>
    <p
      v-else
      id="display-name-hint"
      class="text-sm leading-relaxed text-text-muted"
    >
      {{ t('myRoom.nameHint') }}
    </p>
  </div>
</template>
