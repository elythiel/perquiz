import { defineConfig } from 'vitest/config'

// Les jetons du design system vivent dans du CSS : le test les lit sur le
// disque et calcule. Ni DOM ni runtime Nuxt à monter — quand un jalon
// ultérieur aura besoin de monter des composants, `@nuxt/test-utils` viendra
// s'ajouter ici, fichier par fichier.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'node',
  },
})
