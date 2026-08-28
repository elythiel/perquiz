import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// The design-system tokens live in CSS: the test reads them off disk and does
// the maths. No DOM and no Nuxt runtime to boot — when a later milestone needs
// to mount components, `@nuxt/test-utils` will be added here, file by file.
export default defineConfig({
  // `#shared` is a Nuxt alias, and server code uses it; the endpoint tests load
  // that code outside Nuxt, so the alias has to exist here too.
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },

  test: {
    // tests/unit is pure logic; tests/api drives the real routes through the
    // real middleware (see tests/support/api.ts).
    include: ['tests/{unit,api}/**/*.spec.ts'],
    environment: 'node',
  },
})
