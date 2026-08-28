import type { SaveState } from '~/components/guess/SuspectCard.vue'

/**
 * The guess sheet: what is on it, and keeping it saved.
 *
 * Auto-save is per room, not per sheet. Someone tapping through twenty rooms
 * on a train produces twenty independent little writes, and one of them
 * failing must not cast doubt on the other nineteen — so the save state is
 * held per room and shown on the room it belongs to.
 *
 * The answer is applied locally the moment it is picked. The request only
 * confirms it: waiting for a round trip before showing a name would make the
 * deck feel broken on a slow connection, and a failure has its own visible
 * state anyway.
 */
export async function useGuessSheet() {
  /**
   * One fetch for the whole sheet, shared by every room page.
   *
   * Keyed and cached on purpose: moving from one room to the next is a route
   * change now, and refetching the entire sheet on every step would be both
   * wasteful and wrong — the deck order would be re-read while you walk it.
   * The index route refreshes it, which is the "each visit" of PAGES.
   */
  // Awaited, not fired and forgotten: a page that reads the sheet in its setup
  // body — to decide whether the room in the URL exists at all — must not read
  // an empty one and conclude everything is fine.
  const { data, refresh } = await useFetch('/api/guess', {
    key: 'guess:sheet',
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  })

  const rooms = computed(() => data.value?.rooms ?? [])
  const participants = computed(() => data.value?.participants ?? [])

  /**
   * Answering is `open` and nothing else — the same narrow gate the server
   * keeps (`recordGuess`).
   *
   * Only two phases ever reach this line read-only, `locked` and `revealed`,
   * and both are "no longer". `preparation` never gets here: the sheet does
   * not exist yet and the route middleware has already sent the reader home.
   */
  const readOnly = computed(() => (data.value?.phase ?? 'open') !== 'open')

  const states = ref(new Map<string, SaveState>())
  const stateOf = (token: string) => states.value.get(token) ?? 'idle'

  const nameOf = (id: number | null | undefined) =>
    participants.value.find(person => person.id === id)?.displayName

  /** How many rooms carry this same answer — the soft duplicate warning. */
  function timesNamed(id: number | null | undefined): number {
    if (id === null || id === undefined) return 0
    return rooms.value.filter(room => room.guess === id).length
  }

  const answered = computed(() => rooms.value.filter(room => room.guess !== null).length)

  async function answer(token: string, participantId: number) {
    const room = rooms.value.find(candidate => candidate.token === token)
    if (!room) return

    const previous = room.guess
    room.guess = participantId
    states.value.set(token, 'saving')

    try {
      await $fetch('/api/guess', { method: 'PATCH', body: { room: token, participant: participantId } })
      states.value.set(token, 'saved')
    }
    catch {
      // Put the sheet back where it was: a name left on screen that the server
      // never accepted is the one thing worse than saying the save failed.
      room.guess = previous
      states.value.set(token, 'failed')
    }
  }

  return { data, rooms, participants, readOnly, answered, refresh, stateOf, nameOf, timesNamed, answer }
}
