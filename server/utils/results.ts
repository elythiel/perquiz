import type { Standing } from './scoring'
import { guesses, photos, users } from '../database/schema'

/**
 * The personal debrief, once the game is over.
 *
 * Nothing here is guarded beyond the phase: in `revealed` the answers are
 * public by design (SPEC §5), and every participant sees the same leaderboard.
 * What is personal is the detail — one card per room, with the answer *this*
 * reader gave.
 */

export interface ResultRoom {
  photos: string[]
  ownerName: string
  /** Null when the room was left blank: a valid sheet (SPEC §4). */
  guessName: string | null
  correct: boolean
}

export interface PersonalResults {
  standings: Standing[]
  me: { id: number, score: number, rank: number, total: number }
  /** Other people sharing my rank, for "ex æquo avec …". */
  tiedWith: string[]
  rooms: ResultRoom[]
}

export function assertResultsAreOut() {
  if (useGameState().phase !== 'revealed') {
    throw createError({ statusCode: 409, statusMessage: 'not-revealed' })
  }
}

export function personalResults(viewerId: number): PersonalResults {
  const db = useDatabase()

  const players = db.select({ id: users.id, displayName: users.displayName }).from(users).all()
  const names = new Map(players.map(player => [player.id, player.displayName]))

  const answers = db.select({
    guesserId: guesses.guesserId,
    roomUserId: guesses.roomUserId,
    guessedUserId: guesses.guessedUserId,
  }).from(guesses).all()

  const roomIds = db.selectDistinct({ id: photos.userId }).from(photos).all().map(row => row.id)
  const table = standings(players, answers, new Set(roomIds))

  const mine = table.find(player => player.id === viewerId)
  const rank = mine?.rank ?? table.length

  const roomPhotographs = photosByOwner()

  const myAnswers = new Map(answers
    .filter(answer => answer.guesserId === viewerId)
    .map(answer => [answer.roomUserId, answer.guessedUserId]))

  // The same order the guess sheet dealt them in, so the debrief reads in the
  // order the reader answered rather than in database order.
  const answerable = roomIds.filter(id => id !== viewerId)
  const rooms = deckOrder(answerable, viewerId, useRuntimeConfig().sessionPassword)
    .map<ResultRoom>((ownerId) => {
      const guessed = myAnswers.get(ownerId)
      return {
        photos: roomPhotographs.get(ownerId) ?? [],
        ownerName: names.get(ownerId) ?? '',
        guessName: guessed === undefined ? null : (names.get(guessed) ?? ''),
        correct: guessed === ownerId,
      }
    })

  return {
    standings: table,
    me: { id: viewerId, score: mine?.score ?? 0, rank, total: answerable.length },
    tiedWith: table
      .filter(player => player.rank === rank && player.id !== viewerId)
      .map(player => player.displayName),
    rooms,
  }
}
