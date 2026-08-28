import { eq, sql } from 'drizzle-orm'
import { users } from '../../database/schema'
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN, tidyDisplayName } from '#shared/utils/display-name'

/**
 * Renaming yourself.
 *
 * Uniqueness is re-checked here and enforced by the index underneath, because
 * two people can pick the same free name in the same second — the check is a
 * good error message, the index is the guarantee.
 */
export default defineEventHandler(async (event) => {
  assertRoomsEditable()
  const userId = event.context.user!.id

  const body = await readBody<{ displayName?: unknown }>(event)
  if (typeof body?.displayName !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'invalid' })
  }

  const displayName = tidyDisplayName(body.displayName)
  if (displayName.length < DISPLAY_NAME_MIN || displayName.length > DISPLAY_NAME_MAX) {
    throw createError({ statusCode: 422, statusMessage: 'invalid-length' })
  }

  const db = useDatabase()
  const clash = db.select({ id: users.id }).from(users)
    .where(sql`lower(${users.displayName}) = lower(${displayName}) and ${users.id} <> ${userId}`)
    .get()

  if (clash) throw createError({ statusCode: 409, statusMessage: 'taken' })

  db.update(users).set({ displayName }).where(eq(users.id, userId)).run()

  return { displayName }
})
