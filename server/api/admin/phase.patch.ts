import { isGamePhase } from '#shared/utils/game'
import { JSON_BODY_CEILING, readBodyUnderCap } from '../../utils/body'

/** Moves the game. Every direction is allowed — a mistaken lock is reopenable. */
export default defineEventHandler(async (event) => {
  assertAdmin(event)

  await readBodyUnderCap(event, JSON_BODY_CEILING)
  const body = await readBody<{ phase?: unknown }>(event)
  if (!isGamePhase(body?.phase)) {
    throw createError({ statusCode: 400, statusMessage: 'unknown-phase' })
  }

  return setPhase(body.phase)
})
