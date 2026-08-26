import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxtjs/i18n'],

  devtools: { enabled: true },

  app: {
    head: {
      // `html lang`, the title and the description are driven by app/app.vue:
      // they follow the locale. `theme-color` is set there too, following the
      // theme; `color-scheme` is declared in CSS (main.css), for the same reason.
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
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

  // Every player-facing string lives in i18n/locales/ — see the README for the
  // key convention. French is the only locale for now; adding one is meant to
  // stay a data-only change.
  i18n: {
    defaultLocale: 'fr',
    locales: [
      { code: 'fr', name: 'Français', file: 'fr.json' },
    ],
    // The canonical URLs are the English ones, with no language prefix in
    // front. Localising the routes is a separate decision, to reopen the day
    // a second locale actually ships.
    strategy: 'no_prefix',
    // A single locale: nothing to detect, and no cookie worth setting.
    detectBrowserLanguage: false,
  },
})
