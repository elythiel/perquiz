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
      /*
       * The pixel lantern, three files because no one of them is enough.
       *
       * The SVG is the real icon and the only theme-aware one: it carries its
       * own `prefers-color-scheme` query, so it turns dark torch on a light tab
       * strip and mint on a dark one. That query follows the SYSTEM, not the
       * app's theme picker — someone forcing "light" in Perquiz under a dark OS
       * sees the dark variant in their tab. A limit of the format, accepted:
       * the alternative is JavaScript rewriting an icon, for a 16px glyph.
       *
       * The `.ico` is what the SVG cannot be. Safari ignored SVG favicons for
       * years, and plenty of things that show a site's icon — feed readers,
       * chat unfurlers, bookmark managers — fetch `/favicon.ico` by convention
       * and read nothing else. It is declared here anyway rather than left to
       * that convention, so the icon a browser uses is the one this file names.
       *
       * The apple-touch icon is PNG and opaque, both because iOS demands it:
       * it blackens transparency and rounds the corners itself, so the tile is
       * painted on `night` with a margin the rounding can eat.
       */
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', sizes: '16x16 32x32 48x48', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
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

    /*
     * The app's absolute base, and deliberately NOT in `public`.
     *
     * Only the server reads it, to build the OIDC redirect URIs
     * (server/utils/oidc-client.ts). Everything in `public` is inlined into a
     * `<script>` in every page: the browser plainly knows its own origin, so
     * shipping it there leaked nothing — it was just a public configuration
     * surface with no reader, and those are the ones that grow.
     */
    baseUrl: 'http://localhost:3000',

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
  },

  /*
   * Security headers, on every response.
   *
   * MEASURED against the built output (2026-08-28) rather than copied off a
   * checklist. This app loads nothing from a third party — no CDN, no
   * analytics, fonts self-hosted, icons embedded at build time — and there is
   * no `v-html` anywhere in it, so almost every directive can be closed
   * completely. The CSP therefore *enforces* the no-third-party rule the
   * project already follows by hand.
   *
   * One exception, and it is `script-src`. A hydrated Nuxt page carries an
   * inline `window.__NUXT__.config` block (build id, i18n config) that no
   * setting removes; allowing it means `'unsafe-inline'` or a per-request nonce
   * injected into every script tag. The nonce is the strong version, it is a
   * Nitro plugin's worth of hand-rolled plumbing, and its failure mode is a
   * blank page on party night — so it is a decision of its own, not a header.
   *
   * What this buys as written: nothing executes, styles, loads or connects from
   * another origin, no `eval`, no plugins, no framing, no `<base>` hijack, and
   * no form posting anywhere but here. What it does not buy is protection from
   * an injected inline script — against which the actual defences are Vue
   * escaping every string it renders, and the absence of `v-html`.
   *
   * A second exception sits on `img-src`, narrower and explained where it is
   * written: the design system's pixel frames are inline SVGs.
   */
  routeRules: {
    '/**': {
      headers: {
        'content-security-policy': [
          'default-src \'self\'',
          'base-uri \'none\'',
          'object-src \'none\'',
          'frame-ancestors \'none\'',
          'form-action \'self\'',
          /*
           * `data:` and the reason it is not laziness.
           *
           * The HD-2D frames are SVGs carried in `url("data:image/svg+xml,…")`
           * custom properties — one per tint, recoloured with the theme, which
           * is the whole point of not shipping a frozen PNG. CSS images are
           * governed by `img-src`, and `'self'` alone does NOT match a `data:`
           * URL: the scheme has to be named.
           *
           * MEASURED, 2026-08-28, and it cost an invisible sign-in button
           * before it was: a blocked `border-image` degrades quietly to the
           * border colour, but a blocked `mask-border` is an EMPTY MASK, and an
           * empty mask hides the element it is on. Every block wearing
           * `frame-fill` disappeared. Tightening this back does not soften the
           * skin, it deletes fourteen controls.
           *
           * What it opens: an inline image. It cannot execute, cannot be
           * fetched from anywhere, and cannot phone home — `data:` is not
           * another origin, so the no-third-party rule this policy enforces is
           * untouched. `data:` stays out of every other directive, which
           * tests/unit/headers.spec.ts asserts by name.
           */
          'img-src \'self\' data:',
          'font-src \'self\'',
          'connect-src \'self\'',
          'script-src \'self\' \'unsafe-inline\'',
          // Vue writes `style="…"` attributes — 21 of them on `/my-room` — and
          // no nonce can cover an attribute. `style-src-attr` would narrow the
          // exception to exactly those, but it is not carried by every browser
          // this has to work in, and falling back to a blocked `style-src`
          // would break layout rather than fail safe.
          'style-src \'self\' \'unsafe-inline\'',
        ].join('; '),
        // A stored photo is served as `image/webp` and must not be re-guessed
        // as something executable.
        'x-content-type-options': 'nosniff',
        // Room handles travel in URLs (`/guess/<token>`): nothing outside this
        // origin needs to be told which one someone is looking at.
        'referrer-policy': 'strict-origin-when-cross-origin',
        // The app asks for none of these. The upload is a file input, which is
        // the native picker and not the camera API, so denying them changes
        // nothing today and makes the day one is wanted visible here.
        'permissions-policy': 'camera=(), microphone=(), geolocation=()',
      },
    },
  },

  future: { compatibilityVersion: 4 },
  compatibilityDate: '2026-08-26',

  /*
   * Precompressed assets, gzip and brotli.
   *
   * MEASURED with Lighthouse on 2026-08-28: the bundle went out uncompressed,
   * 271 KiB of it, and render-blocking cost ~750 ms on a throttled phone. The
   * reverse proxy in front could gzip on the fly, but it cannot brotli a file
   * as well as the build can, and a party is a dozen phones opening the same
   * three pages at once over a home connection.
   */
  nitro: {
    compressPublicAssets: { gzip: true, brotli: true },
  },

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
  // `pixelarticons:*` names actually used and embeds only those, so the page
  // makes no request to the Iconify API — the same rule as the self-hosted
  // fonts.
  //
  // pixelarticons and no longer MingCute: the HD-2D skin crenellates every
  // corner it draws, and a smoothly rounded line icon in the middle of it was
  // the one thing on the page still speaking the old language. The glyphs are
  // vector and blocky by construction, so they stay crisp at any size without
  // `image-rendering` — unlike the frames, which need it.
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
    // Scan the source and embed the handful of `pixelarticons:*` actually used.
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
