<script setup lang="ts">
import type { SaveState } from '~/components/guess/SuspectCard.vue'

interface Suspect {
  id: number
  displayName: string
}

const props = defineProps<{
  /** The names this room offers, alphabetical — the server decides which six. */
  suspects: readonly Suspect[]
  /** The answer already given for the room being looked at. */
  selected: number | null
  /** Participant id -> the numbers of the OTHER rooms already carrying it. */
  usedElsewhere: Readonly<Record<number, number[]>>
  state: SaveState
}>()

defineEmits<{ pick: [id: number] }>()

const { t } = useI18n()

/** « 4 », « 4 et 7 », « 4, 7 et 9 » — the separators French actually uses. */
const listFormat = new Intl.ListFormat('fr-FR', { style: 'long', type: 'conjunction' })

/**
 * Which rooms already carry this name, said in words, and only for the names
 * that are not the current answer.
 *
 * The split is deliberate and predates the grid: a name spent elsewhere is
 * marked on its own tile, while "you have already used this one" for the name
 * you just picked is a sentence under the grid. Saying both on the same tile
 * would be the same fact twice.
 */
function usedIn(id: number): string | undefined {
  const rooms = props.usedElsewhere[id]
  if (!rooms?.length || id === props.selected) return undefined
  return t('guess.suspectUsed', { rooms: listFormat.format(rooms.map(String)) }, rooms.length)
}
</script>

<template>
  <!--
    Framed tiles rather than the segmented control's filled block: each one
    carries an avatar and two lines, and a torch flat under all of that would
    bury the accent the badge is there to show. The tint moves, the flat does
    not.

    Native radios, the pattern `ThemePicker` settled: one tab stop for the
    whole group, arrow keys between the names, and « 2 sur 6 » announced by
    the browser rather than by us — which is also why the selected tile needs
    no marker of its own. The inputs are `sr-only`; the labels are what
    you see, and the focus ring lands on the label because that is the visible
    thing (`focus-ring-within`).
  -->
  <fieldset class="flex flex-col gap-2">
    <legend class="sr-only">
      {{ t('guess.question') }}
    </legend>

    <!-- Two columns on a phone: six names, three rows, no scrolling to answer. -->
    <div class="grid grid-cols-2 gap-2">
      <label
        v-for="person in suspects"
        :key="person.id"
        class="frame frame-sm frame-fill flex cursor-pointer items-center gap-2.5 px-1.5 py-1 transition-colors duration-100 ease-micro focus-ring-within"
        :class="person.id === selected ? 'frame-torch bg-torch/10 text-torch-ink' : 'frame-edge text-text hover:bg-sunken'"
      >
        <input
          type="radio"
          name="suspect"
          class="sr-only"
          :value="person.id"
          :checked="person.id === selected"
          @change="$emit('pick', person.id)"
        >

        <GuessSuspectAvatar :display-name="person.displayName" />

        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-base font-bold">{{ person.displayName }}</span>

          <!--
            Marked, never removed and never disabled: SPEC §4 allows the same
            name twice on purpose, and hiding spent names would turn the sheet
            into a sudoku where the last room has only one possible answer.
          -->
          <span
            v-if="usedIn(person.id)"
            class="truncate font-mono text-label tracking-label text-amber-ink uppercase"
          >{{ usedIn(person.id) }}</span>
        </span>
      </label>
    </div>

    <!-- The one line of feedback the sheet has: the write happened, or it did
         not and the tap is worth repeating. -->
    <p
      v-if="state !== 'idle'"
      class="flex items-center gap-1.5 font-mono text-label tracking-label uppercase"
      :class="{
        'text-torch-ink': state === 'saved',
        'text-text-muted': state === 'saving',
        'text-alert-ink': state === 'failed',
      }"
      role="status"
    >
      <BaseIcon
        v-if="state === 'saved'"
        name="check"
        class="block size-3.5"
        aria-hidden="true"
      />
      {{ state === 'saving' ? t('guess.saving') : state === 'failed' ? t('guess.retry') : t('guess.saved') }}
    </p>
  </fieldset>
</template>
