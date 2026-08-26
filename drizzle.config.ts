import { defineConfig } from 'drizzle-kit'

// Only ever used through `yarn db:generate`: the SQL it writes is what the
// server replays at boot (server/utils/database.ts). drizzle-kit is a
// development tool and never runs in production.
export default defineConfig({
  dialect: 'sqlite',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dbCredentials: { url: './data/app.db' },
  strict: true,
})
