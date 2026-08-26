# Perquiz

A party game for a group who know each other: everyone photographs a room of their
home, then tries to work out whose room is whose. Perquisition + quiz. The UI is in
French and mobile-first — participants upload and guess from their phones.

- **What it does, exactly**: [docs/SPEC.md](docs/SPEC.md) (rules, phases, security invariants)
- **Screen by screen**: [docs/PAGES.md](docs/PAGES.md)
- **How it gets built**: [docs/PLAN.md](docs/PLAN.md) (milestones, technical decisions)

## Stack

Nuxt 4 (SSR, TypeScript strict) · Tailwind v4 with the design-system tokens ·
`@nuxtjs/i18n` for the copy · SQLite (better-sqlite3 + Drizzle) · Zitadel for
identity (OIDC, code + PKCE) · sharp for photo processing. Self-hosted fonts,
no CDN.

## Requirements

- **Node 24**
- **Yarn 4** — the only supported package manager, pinned via `packageManager`.
  Enable it with `corepack enable`; there is no npm/pnpm/bun lockfile and none
  is supported.

## Setup

```bash
yarn install
cp .env.example .env   # then fill it in — see the comments in the file
yarn dev
```

The app boots on http://localhost:3000.

Identity requires a Zitadel project (roles `player` / `admin`, a Web+PKCE app).
The manual setup steps live in the "Prerequisite" section of
[docs/PLAN.md](docs/PLAN.md); the full guide lands with M9.

## Scripts

| Command | What it does |
|---|---|
| `yarn dev` | Dev server with HMR |
| `yarn build` | Production build into `.output/` |
| `yarn preview` | Serve the production build locally |
| `yarn lint` / `yarn lint:fix` | ESLint (Nuxt preset, stylistic rules) |
| `yarn typecheck` | `vue-tsc` over the whole project, `tests/` included |
| `yarn test` / `yarn test:watch` | Vitest unit tests |

`yarn test` includes a contrast audit that reads the design tokens straight out
of `app/assets/css/main.css` and computes WCAG ratios for both themes — it
fails below 4.5:1 for text and 3:1 for meaningful borders. Adjust a colour
token and the audit tells you whether it still passes.

## Copy and translations

Every string a player can read — button labels, headings, and the `aria-label`s
a screen reader announces — lives in `i18n/locales/`, never in a component. The
app ships **French only**; the point of the setup is that adding a language is
dropping `i18n/locales/en.json` next to `fr.json` and listing it in
`nuxt.config.ts`, with no component touched.

**Key convention.** One namespace per screen or shared UI element, named after
its route or component; inside it, one camelCase key per string, named for the
role the string plays rather than for its wording:

```
app.name          nav.myRoom        phase.locked      myRoom.description
```

Two rules follow from that:

- `strategy: 'no_prefix'` — URLs carry no language segment. `/my-room` stays
  `/my-room`. Localised routes are a separate decision.
- French keeps the singular at zero, so plural messages carry **three** forms
  (`zero | one | many`), not the usual two — see `guess.progress`.

`yarn test` fails if a component asks for a key the locale file does not
answer, or if a message is empty.

## Configuration

Every setting arrives through the environment — see [.env.example](.env.example)
for the full annotated list (session secret, public base URL, Zitadel issuer and
client, data directory). Nothing sensitive is committed.

## Persistent state

All persistent state lives in a single directory, `./data`:

```
data/
├── app.db      SQLite database
└── photos/     processed photo variants (web + thumb)
```

That directory is the only thing to back up, and the only volume the container
needs. It is git-ignored except for the `.gitkeep` files that keep the layout
present on a fresh clone.

## Docker

```bash
docker build -t perquiz .
docker run --rm -p 3000:3000 --env-file .env -v perquiz-data:/app/data perquiz
```

The image is a skeleton for now (M0); M9 finalizes it — non-root user,
healthcheck, native dependencies on musl.
