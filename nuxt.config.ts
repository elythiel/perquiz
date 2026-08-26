import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint'],

  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'Perquiz',
      // `theme-color` est piloté par app/app.vue : il bascule avec le thème.
      // `color-scheme` est déclaré en CSS (main.css), pour la même raison.
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Une pièce, quelques photos, autant de suspects. Devinez qui vit ici.' },
      ],
    },
  },

  css: [
    // Polices auto-hébergées (aucun CDN) : les woff2 sont servis par le build.
    // On ne charge que les sous-ensembles utiles au français (latin, latin-ext).
    '@fontsource-variable/space-grotesk/index.css',
    '@fontsource/ibm-plex-mono/latin-400.css',
    '@fontsource/ibm-plex-mono/latin-ext-400.css',
    '@fontsource/ibm-plex-mono/latin-500.css',
    '@fontsource/ibm-plex-mono/latin-ext-500.css',
    '@fontsource/ibm-plex-mono/latin-600.css',
    '@fontsource/ibm-plex-mono/latin-ext-600.css',
    '~/assets/css/main.css',
  ],

  // Toutes les valeurs sensibles arrivent par l'environnement (voir .env.example).
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
    typeCheck: false, // exécuté à la demande via `yarn typecheck`
  },

  eslint: {
    config: {
      stylistic: true,
    },
  },
})
