<script setup lang="ts">
import { tidyDisplayName } from '#shared/utils/display-name'

/**
 * The name others will pick when they accuse you.
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
  <section class="flex flex-col gap-3 rounded-2xl bg-panel px-5 py-4">
    <h2 class="font-mono text-label tracking-eyebrow text-text-muted uppercase">
      <label for="display-name">{{ t('myRoom.nameLabel') }}</label>
    </h2>

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
        class="min-w-0 flex-1 rounded-xl border border-edge-strong bg-night px-4 py-3 text-lg text-text read-only:border-transparent read-only:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
        :aria-describedby="error ? 'display-name-error' : 'display-name-hint'"
      >

      <button
        v-if="!readOnly"
        type="submit"
        :disabled="!changed"
        class="shrink-0 rounded-xl border border-edge-strong px-4 py-3 text-base text-text-soft transition-colors duration-100 ease-micro enabled:hover:text-text disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
      >
        {{ t('myRoom.nameSave') }}
      </button>
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
  </section>
</template>
