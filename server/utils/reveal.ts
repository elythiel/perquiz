import type { RevealRoom, RevealShow } from '#shared/types/reveal'
import { standings } from '#shared/utils/scoring'
import { isBeforeLock } from '#shared/utils/game'
import { createHmac, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { rankBy } from './ranking'
import { APP_STATE_ID, appState, guesses, photos, users } from '../database/schema'

/**
 * The projected show: the one screen where the answers are allowed out.
 *
 * Everywhere else in this codebase is built to keep the room → owner mapping
 * hidden. Here it is the point — but only for an admin, only once the game is
 * frozen, and only on the projector. Participants' own devices stay blind
 * until the phase is flipped afterwards (SPEC §6).
 */

/**
 * The order the show deals the rooms in, minted once and kept.
 *
 * A show is driven live from one browser: a refresh, a laptop that went to
 * sleep, a second screen opened by mistake — none of them may re-deal the
 * rooms halfway through. So the seed is written to `app_state` on first use
 * and read from there forever after.
 */
function showSeed(): string {
  const state = useGameState()
  if (state.revealSeed) return state.revealSeed

  const seed = randomBytes(16).toString('hex')
  useDatabase().update(appState).set({ revealSeed: seed })
    .where(eq(appState.id, APP_STATE_ID)).run()
  return seed
}

/**
 * Rooms sorted by a digest of the seed and their owner.
 *
 * A keyed digest rather than a shuffle: it needs no state carried between
 * calls, and it gives the same order to every process that reads the same
 * seed — which is what "survives a refresh" actually means.
 */
function dealt(roomIds: readonly number[], seed: string): number[] {
  const rank = (id: number) =>
    createHmac('sha256', seed).update(`room:${id}`).digest('hex')
  return rankBy(roomIds, rank)
}

/**
 * Refuses to hand out the answers while people can still change theirs.
 *
 * Neither phase before the lock is a rehearsal mode: in `open` the results
 * would not be final and the screen would be showing live answers to a room
 * full of players (PAGES `/reveal`), and in `preparation` there is nothing to
 * reveal at all. The test is "has anything been frozen", not "is it `open`" —
 * naming one phase is what would let a new one through.
 */
export function assertShowIsReady(event: Parameters<typeof assertAdmin>[0]) {
  assertAdmin(event)

  const { phase } = useGameState()
  if (isBeforeLock(phase)) {
    throw createError({ statusCode: 409, statusMessage: 'not-locked' })
  }
}

export function revealShow(): RevealShow {
  const db = useDatabase()

  const roomIds = db.selectDistinct({ id: photos.userId }).from(photos).all().map(row => row.id)
  const players = db.select({ id: users.id, displayName: users.displayName })
    .from(users).all()
  const names = new Map(players.map(player => [player.id, player.displayName]))

  const roomPhotographs = photosByOwner()

  const answers = db.select({
    guesserId: guesses.guesserId,
    roomUserId: guesses.roomUserId,
    guessedUserId: guesses.guessedUserId,
  }).from(guesses).all()

  const inPlay = new Set(roomIds)

  const rooms = dealt(roomIds, showSeed()).map<RevealRoom>((ownerId) => {
    const forThisRoom = answers.filter(answer => answer.roomUserId === ownerId)

    const tally = new Map<number, number>()
    for (const answer of forThisRoom) {
      tally.set(answer.guessedUserId, (tally.get(answer.guessedUserId) ?? 0) + 1)
    }

    const votes = [...tally.entries()]
      .map(([id, count]) => ({
        displayName: names.get(id) ?? '',
        count,
        isOwner: id === ownerId,
      }))
      .sort((left, right) => right.count - left.count
        || left.displayName.localeCompare(right.displayName, 'fr'))

    return {
      owner: { id: ownerId, displayName: names.get(ownerId) ?? '' },
      photos: roomPhotographs.get(ownerId) ?? [],
      votes,
      // Everyone but the owner could have answered; those who did not are
      // their own bar on the chart.
      noAnswer: players.length - 1 - forThisRoom.length,
    }
  })

  return {
    rooms,
    standings: standings(players, answers, inPlay),
  }
}
