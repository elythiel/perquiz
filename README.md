# Perquiz

A party game for a group who know each other: everyone photographs a room of their
home, then tries to work out whose room is whose. Perquisition + quiz. The UI is in
French and mobile-first — participants upload and guess from their phones.

- **What it does, exactly**: [docs/SPEC.md](docs/SPEC.md) (rules, phases, security invariants)
- **Screen by screen**: [docs/PAGES.md](docs/PAGES.md)
- **How it gets built**: [docs/PLAN.md](docs/PLAN.md) (milestones, technical decisions)

## Stack

Nuxt 4 (SSR, TypeScript strict) · Tailwind v4 with the design-system tokens ·
`@nuxtjs/i18n` for the copy · SQLite (better-sqlite3 + Drizzle) · a generic
OIDC provider for identity (code + PKCE) · sharp for photo processing.
Self-hosted fonts, no CDN.

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

Identity requires an OIDC provider able to **assert roles** in the token, with
two roles granted per user (`player` / `admin` by default) and a Web+PKCE
application. Everything about the provider is configuration — see
[.env.example](.env.example). The manual setup steps live in the "Prerequisite"
section of [docs/PLAN.md](docs/PLAN.md); the full guide lands with M9.

Register the app with the redirect URI `<base>/api/auth/callback` and the
post-logout URI `<base>/login`. **Nothing is public but `/login`**: with no
working provider configured, that is the only page the app will serve — a
contributor without access to the instance cannot browse the rest.

**Tested with Zitadel**, whose claim and role names ship as the defaults. Other
providers are wired from their documented claim shapes (an array of strings, an
object keyed by role, a space-separated string — Keycloak, Authentik and
Authelia all fall into one of the three) and have not been run against a live
instance. Providers that cannot assert roles at all — Google, GitHub, Apple —
are out of scope on purpose: see §11 of [docs/SPEC.md](docs/SPEC.md).

Entra ID is worth naming, because "unsupported" would be too broad. Its **app
roles** arrive as an array of strings in a `roles` claim and fit the first
shape, so an app-role deployment should work — untested, like the others. Its
**groups** claim is the problem: it carries opaque GUIDs, and no claim *name*
fixes that. Mapping GUIDs onto role names is a second kind of configuration,
and past ~200 groups Entra stops sending the list altogether, pointing at Graph
instead. Group-based Entra deployments are out of scope.

## Scripts

| Command | What it does |
|---|---|
| `yarn dev` | Dev server with HMR |
| `yarn build` | Production build into `.output/` |
| `yarn preview` | Serve the production build locally |
| `yarn lint` / `yarn lint:fix` | ESLint (Nuxt preset, stylistic rules) |
| `yarn typecheck` | `vue-tsc` over the whole project, `tests/` and `scripts/` included |
| `yarn test` / `yarn test:watch` | Vitest unit tests |
| `yarn db:generate` | Write a migration from the changes made to the schema |
| `yarn seed` | Refill the development database with a playable game |

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
role the string plays rather than for its wording. One further level of
grouping is allowed only where the sub-keys are looked up dynamically —
`myRoom.errors.<reason>`, keyed by the slug a refused upload answers with:

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

## Photos

An upload is decoded, re-encoded into two WebP variants (~1600px and ~400px)
and the original is dropped. Stripping metadata is not a step in that pipeline,
it is a consequence of never keeping the file — which matters, because GPS
coordinates in a photo of someone's living room give the game away. Files are
served only through `/api/photos/<name>/<variant>`, behind the session, under a
random name that says nothing about who took them.

**HEIC is refused, deliberately.** Measured on 2026-08-26: sharp's prebuilt
binaries parse a HEIC container — `metadata()` reports the dimensions and
`compression: hevc` — but cannot decode its pixels, failing with `bad seek`.
Same result on darwin-arm64 and inside `node:24-alpine`, which is what ships:
the HEVC decoder is not in the prebuilt libheif, and building libvips
ourselves is not worth a milestone. In practice iOS transcodes to JPEG when a
photo is picked through a file input, so the common path is unaffected; the
uploads that do arrive as HEIC get a message naming the setting to change.
Accepted: JPEG, PNG, WebP, up to 15 Mo each, **10 photos per room**. Both limits live in [shared/utils/photos.ts](shared/utils/photos.ts), applied by the server and mirrored by the form.

Uploads are processed **one at a time per person**. The count cap bounds the disk and nothing else — deleting and re-uploading in a loop is unbounded work, and decoding a 15 Mo JPEG twice is where the machine actually goes. Twenty-five phones uploading at once stay fast; one phone uploading twenty-five times queues.

## Configuration

Every setting arrives through the environment — see [.env.example](.env.example)
for the full annotated list (session secret, public base URL, OIDC issuer and
client, roles claim and role names, data directory). Nothing sensitive is
committed.

## Persistent state

All persistent state lives in a single directory, `./data`:

```
data/
├── app.db      SQLite database
└── photos/     processed photo variants (web + thumb)
```

That directory is the only thing to back up, and the only volume the container
needs. It is git-ignored except for the `.gitkeep` files that keep the layout
present on a fresh clone. The app creates the tree itself at boot, so a fresh
clone, a bind mount and an empty volume all behave the same.

## Database

Drizzle over `better-sqlite3`, one file, one connection, synchronous calls —
for a dozen phones reading a local file, a pool would be machinery without a
purpose. The schema is [server/database/schema.ts](server/database/schema.ts);
it also carries the rules of the game that are worth enforcing in SQL rather
than trusting to an endpoint (a sheet skips its owner's room, nobody names
themselves, `app_state` holds exactly one row).

**Changing the schema** — edit `schema.ts`, then:

```bash
yarn db:generate      # writes server/database/migrations/NNNN_*.sql
```

Commit the generated SQL. The server replays pending migrations at boot, so
there is no deploy step to remember and no way to run the app against a stale
file. That folder is a runtime input: the Dockerfile copies it next to
`.output`.

**Seeding** — `yarn seed` wipes the game tables and rewrites them from
[scripts/seed-plan.ts](scripts/seed-plan.ts): ten players, nine rooms, 29
generated placeholder photos and 51 guesses. It refuses to run with
`NODE_ENV=production`.

The plan is deliberate rather than random, and deterministic — two runs give
the same game, down to the ids. It holds one room with no photos, one player
who never opened their sheet, another who filled it entirely, rooms left
unanswered, the same suspect named twice on one sheet, a podium with three
distinct steps and ties just below it. Every one of those exists to keep a
later screen testable without real players, and
[tests/unit/seed-plan.spec.ts](tests/unit/seed-plan.spec.ts) fails if one
disappears.

## Docker

```bash
docker build -t perquiz .
docker run --rm -p 3000:3000 --env-file .env -v perquiz-data:/app/data perquiz
```

The image is a skeleton for now (M0); M9 finalizes it — non-root user,
healthcheck, native dependencies on musl.
