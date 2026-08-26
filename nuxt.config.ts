import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint'],

  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'Perquiz',
      // `theme-color` is driven by app/app.vue: it swaps with the theme.
      // `color-scheme` is declared in CSS (main.css), for the same reason.
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Une pièce, quelques photos, autant de suspects. Devinez qui vit ici.' },
      ],
    },
  },

  css: [
    // Self-hosted fonts (no CDN): the woff2 files are served by the build.
    // Only the subsets French needs are loaded (latin, latin-ext).
    '@fontsource-variable/space-grotesk/index.css',
    '@fontsource/ibm-plex-mono/latin-400.css',
    '@fontsource/ibm-plex-mono/latin-ext-400.css',
    '@fontsource/ibm-plex-mono/latin-500.css',
    '@fontsource/ibm-plex-mono/latin-ext-500.css',
    '@fontsource/ibm-plex-mono/latin-600.css',
    '@fontsource/ibm-plex-mono/latin-ext-600.css',
    '~/assets/css/main.css',
  ],

  // Every sensitive value arrives through the environment (see .env.example).
  runtimeConfig: {
    dataDir: './data',
    sessionPassword: '',
    zitadel: {
      issuer: '',
      clientId: '',
      clientSecret: '',
    },
    public: {
      baseUrl: 'http://localhost:3000',
    },
  },

  future: { compatibilityVersion: 4 },
  compatibilityDate: '2026-08-26',

  vite: {
    plugins: [tailwindcss()],
  },

  typescript: {
    strict: true,
    typeCheck: false, // run on demand through `yarn typecheck`
  },

  eslint: {
    config: {
      stylistic: true,
    },
  },
})
