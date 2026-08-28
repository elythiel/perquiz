<script setup lang="ts">
interface Participant {
  id: number
  displayName: string
  photos: number
  answered: number
  total: number
  lastActivity: number | null
  ready: boolean
}

defineProps<{
  participants: readonly Participant[]
  ready: number
  /** The admin reading the page: their own row offers no removal. */
  me: number
}>()
const emit = defineEmits<{ remove: [id: number] }>()

const { t } = useI18n()

const relative = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' })

/** The largest unit that still says something useful. */
function when(seconds: number | null): string {
  if (!seconds) return t('admin.neverSeen')
  const elapsed = Math.round(Date.now() / 1000) - seconds
  const scale: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400], ['hour', 3600], ['minute', 60],
  ]
  for (const [unit, size] of scale) {
    if (elapsed >= size) return t('admin.lastActivity', { when: relative.format(-Math.floor(elapsed / size), unit) })
  }
  return t('admin.lastActivity', { when: relative.format(0, 'minute') })
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex items-baseline justify-between gap-4">
      <h2 class="font-mono text-label tracking-eyebrow text-text-muted uppercase">
        {{ t('admin.participation') }}
      </h2>
      <p class="font-mono text-label tracking-label text-text-muted uppercase tabular-nums">
        {{ t('admin.ready', { ready, total: participants.length }) }}
      </p>
    </div>

    <ul class="flex flex-col gap-2">
      <li
        v-for="person in participants"
        :key="person.id"
        class="flex items-center gap-3 rounded-2xl bg-panel px-4 py-3"
      >
        <GuessSuspectAvatar :display-name="person.displayName" />

        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-base text-text">
            {{ person.displayName }}
            <!-- Marks the row whose button is off, so the disabled state reads
                 as a rule rather than as a glitch. -->
            <span
              v-if="person.id === me"
              class="text-text-muted"
            >{{ t('admin.you') }}</span>
          </span>
          <span class="font-mono text-label tracking-label text-text-muted">
            {{ when(person.lastActivity) }}
          </span>
        </span>

        <!--
          Counts only. What they answered is never shown, and never sent:
          admins play too (SPEC §7).
        -->
        <p
          class="shrink-0 font-mono text-label tracking-label whitespace-nowrap tabular-nums"
          :class="person.photos === 0 ? 'text-alert-ink' : person.ready ? 'text-torch-ink' : 'text-text-muted'"
        >
          {{ t('admin.photosShort', { count: person.photos }) }} ·
          {{ person.total === 0 ? '—' : `${person.answered}/${person.total}` }}
        </p>

        <!--
          Off on your own row. The server refuses it with a 422 (deleting
          yourself would sign you out mid-action), and an interface that offers
          what the server will refuse is how that refusal became a console
          message nobody saw.
        -->
        <button
          type="button"
          class="grid size-8 shrink-0 place-items-center rounded-lg text-text-muted transition-colors duration-100 ease-micro enabled:hover:text-alert-ink disabled:opacity-25 focus-ring-alert"
          :disabled="person.id === me"
          :title="person.id === me ? t('admin.cannotRemoveYourself') : undefined"
          :aria-label="t('admin.removeParticipant', { name: person.displayName })"
          @click="emit('remove', person.id)"
        >
          <Icon
            name="mingcute:close-line"
            class="block size-4"
            aria-hidden="true"
          />
        </button>
      </li>
    </ul>
  </section>
</template>
