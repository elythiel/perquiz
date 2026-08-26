import { defineConfig } from 'vitest/config'

// The design-system tokens live in CSS: the test reads them off disk and does
// the maths. No DOM and no Nuxt runtime to boot — when a later milestone needs
// to mount components, `@nuxt/test-utils` will be added here, file by file.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'node',
  },
})
