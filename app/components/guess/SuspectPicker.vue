<script setup lang="ts">
interface Participant {
  id: number
  displayName: string
}

const props = defineProps<{
  participants: readonly Participant[]
  /** Participant id -> the numbers of the OTHER rooms already carrying it. */
  usedElsewhere: Readonly<Record<number, number[]>>
  /** The answer already given for the room being looked at. */
  selected: number | null
}>()
const emit = defineEmits<{ pick: [id: number] }>()

const { t } = useI18n()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const search = useTemplateRef<HTMLInputElement>('search')
const query = ref('')

/**
 * Accent-insensitive, because nobody types "Anaïs" with the diaeresis on a
 * phone keyboard when they are hunting for a name.
 */
function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr-FR')
}

/** « 4 », « 4 et 7 », « 4, 7 et 9 » — the separators French actually uses. */
const listFormat = new Intl.ListFormat('fr-FR', { style: 'long', type: 'conjunction' })

const matches = computed(() => {
  const needle = fold(query.value.trim())
  if (!needle) return props.participants
  return props.participants.filter(person => fold(person.displayName).includes(needle))
})

defineExpose({
  async open() {
    query.value = ''
    dialog.value?.showModal()
    await nextTick()
    search.value?.focus()
  },
})

function choose(id: number) {
  dialog.value?.close()
  emit('pick', id)
}
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto max-h-[80dvh] w-full max-w-md rounded-2xl bg-panel p-0 text-text backdrop:bg-night/80 open:flex open:flex-col"
    :aria-label="t('guess.pickerTitle')"
  >
    <header class="flex flex-col gap-3 px-5 pt-5">
      <button
        type="button"
        class="self-end rounded-lg px-2 py-1 font-mono text-label tracking-label whitespace-nowrap text-text-muted uppercase transition-colors duration-100 ease-micro hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
        @click="dialog?.close()"
      >
        {{ t('guess.pickerClose') }}
      </button>

      <h2 class="text-xl leading-tight">
        {{ t('guess.pickerTitle') }}
      </h2>

      <input
        ref="search"
        v-model="query"
        type="search"
        autocomplete="off"
        :placeholder="t('guess.pickerSearch')"
        :aria-label="t('guess.pickerSearch')"
        class="rounded-xl border border-edge-strong bg-night px-4 py-3 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torch-ink"
      >
    </header>

    <!-- The list scrolls, the header does not: with 25 names the search field
         has to stay reachable while you read. -->
    <ul class="flex flex-col gap-1 overflow-y-auto p-5">
      <li
        v-for="person in matches"
        :key="person.id"
      >
        <!--
          Names already spent on another room are marked, not hidden and not
          disabled: SPEC §4 allows the same person twice on purpose. Saying so
          here rather than only after the pick is the whole point — a warning
          that arrives once the choice is made is a warning that arrives late.
        -->
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-100 ease-micro focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-torch-ink"
          :class="person.id === selected ? 'bg-torch/10' : 'hover:bg-sunken'"
          :aria-current="person.id === selected ? 'true' : undefined"
          @click="choose(person.id)"
        >
          <GuessSuspectAvatar :display-name="person.displayName" />

          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-base text-text">{{ person.displayName }}</span>

            <span
              v-if="usedElsewhere[person.id]?.length && person.id !== selected"
              class="font-mono text-label tracking-label text-amber-ink uppercase"
            >{{ t(
              'guess.pickerUsed',
              { rooms: listFormat.format(usedElsewhere[person.id]!.map(String)) },
              usedElsewhere[person.id]!.length,
            ) }}</span>
          </span>

          <!--
            The mark is visual now, not a sentence: with twenty-five names, a
            line of prose on one row is noise the eye has to read before it can
            skip it. The words stay for screen readers, where `aria-current`
            alone announces a position without saying what it means.
          -->
          <span
            v-if="person.id === selected"
            class="shrink-0 text-torch-ink"
          >
            <svg
              viewBox="0 0 16 16"
              class="size-5"
              aria-hidden="true"
            >
              <path
                d="M3 8.5l3.2 3.2L13 5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="sr-only">{{ t('guess.pickerCurrent') }}</span>
          </span>
        </button>
      </li>

      <li
        v-if="matches.length === 0"
        class="px-3 py-2.5 text-base text-text-muted"
      >
        {{ t('guess.pickerEmpty') }}
      </li>
    </ul>
  </dialog>
</template>
