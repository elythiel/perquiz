import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/icon', '@nuxtjs/i18n'],

  /*
   * Development resolves icons on demand; production does not.
   *
   * `clientBundle.scan` collects the icon names at build time, so a name added
   * to a component while the dev server is up is in no bundle and renders as
   * "failed to load icon" until a restart. Here the locally installed
   * collection answers over the dev server's own endpoint instead — still no
   * network, just no rebuild. Production keeps the strict setup above.
   */
  $development: {
    icon: {
      serverBundle: 'local',
      provider: 'server',
      // The base config sets this to `false`, which is what stops the client
      // asking for an icon it has not got. `'server-only'` re-opens exactly
      // one door: this project's own dev endpoint, never api.iconify.design.
      fallbackToApi: 'server-only',
    },
  },

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

    // A generic OIDC provider able to assert roles. The defaults below are the
    // Zitadel reference configuration — the only instance this is tested
    // against; another provider is a matter of env vars, not of code. The
    // shapes those roles can take live in server/utils/oidc.ts.
    oidc: {
      issuer: '',
      clientId: '',
      clientSecret: '',
      providerId: 'zitadel',
      rolesClaim: 'urn:zitadel:iam:org:project:roles',
      rolePlayer: 'player',
      roleAdmin: 'admin',
      scopes: 'openid profile email',
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

  // Icons ship in the bundle, never fetched. `scan` walks the source for the
  // `mingcute:*` names actually used and embeds only those, so the page makes no
  // request to the Iconify API — the same rule as the self-hosted fonts.
  icon: {
    /*
     * A real `<svg>` element, not the default CSS mask.
     *
     * In CSS mode the module writes the size — and `display: inline-block` —
     * into an inline `style` attribute, which beats any class: `size-5` and
     * `block` were silently ignored, and every icon rendered at 1em of
     * whatever font-size it happened to inherit. An svg element takes its
     * dimensions from CSS like anything else.
     */
    mode: 'svg',
    // Scan the source and embed the handful of `mingcute:*` actually used.
    clientBundle: { scan: true },
    // Off: measured, the server bundle changes nothing in the HTML the browser
    // first receives — the glyphs come from the client bundle either way — and
    // it costs ~570 kB of Lucide-sized collection inside .output.
    serverBundle: false,
    // No provider and no fallback: a missing icon is a hole in the build, not
    // a request to a third party.
    provider: 'none',
    // The flag the runtime would actually act on. Left at its default it stays
    // `true` even with no provider, so it is turned off by name: a missing
    // icon is a hole in the build, never a request to a third party.
    fallbackToApi: false,
  },
})
