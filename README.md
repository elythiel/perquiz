# Perquiz

A party game for a group who know each other: everyone photographs a room of their
home, then tries to work out whose room is whose. Perquisition + quiz. The UI is in
French and mobile-first — participants upload and guess from their phones.

- **What it does, exactly**: [docs/SPEC.md](docs/SPEC.md) (rules, phases, security invariants)
- **Screen by screen**: [docs/PAGES.md](docs/PAGES.md)

## Stack

Nuxt 4 (SSR, TypeScript strict) · Tailwind v4 with the design-system tokens ·
`@nuxtjs/i18n` for the copy · SQLite (better-sqlite3 + Drizzle) · a generic
OIDC provider for identity (code + PKCE) · sharp for photo processing.
Self-hosted fonts, no CDN.

### Typefaces

Three faces ship with the app, all served from `public/` or the build — nothing
is fetched from a CDN at runtime.

- **Pixel Operator** © Jayvee Enaguas — [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
  The interface face, in its proportional and monospaced cuts.
- **Luciole** © Laurent Bourcellier & Jonathan Perez —
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). What the
  *Typographie → Lecture* setting switches to: a face drawn with the CTRDV for
  readers with low vision. **Its licence requires this credit**; the line is not
  decoration.
- **IBM Plex Mono** © IBM — [OFL 1.1](https://openfontlicense.org/). The
  monospaced face of that readable state, where Luciole has no cut of its own.

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
[.env.example](.env.example), and the four steps below.

**Nothing is public but `/login`**: with no working provider configured, that is
the only page the app will serve — a contributor without access to the instance
cannot browse the rest.

### Declaring Perquiz at the provider

The names below are Zitadel's, the reference setup and the only provider this
has been run against. Another provider follows the same four steps under
different names.

1. Create a **project** "Perquiz". Add the **roles** `player` and `admin`, and
   enable **"Assert Roles on Authentication"** — without it the token carries no
   roles and everybody lands on the "not on the guest list" screen.
2. Create an **application** in that project: type Web, **PKCE** (no secret).
   Redirect URI `<base>/api/auth/callback`, post-logout URI `<base>/login`,
   where `<base>` is exactly the `NUXT_BASE_URL` the app runs under.
3. **Grant the roles**: `admin` to whoever runs the game, `player` to everyone
   else. Grants can be handed out before anyone signs in — an account is created
   on first login (SPEC §1), not in advance.
4. Fill in `.env`: `NUXT_OIDC_ISSUER` and `NUXT_OIDC_CLIENT_ID`. Zitadel's claim
   name and role names are already the defaults; another provider needs
   `NUXT_OIDC_ROLES_CLAIM` pointed at wherever it puts roles — the three shapes
   understood are documented in [.env.example](.env.example).

Access is managed at the provider from then on: there is no invite, no
registration and no user list to maintain here. Revoking someone's roles stops
them signing in; their data stays until an admin removes it (SPEC §11).

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

**Backing it up.** Copying `app.db` while the app is running is the one thing
not to do: the database runs in WAL mode, so the recent writes live in
`app.db-wal` and a bare copy of the main file can land mid-transaction. Either
stop the container and copy the whole directory, or, with it running, let SQLite
write the snapshot itself:

```bash
sqlite3 data/app.db ".backup 'backup/app.db'"   # consistent, no downtime
cp -r data/photos backup/photos                 # plain files, copy any time
```

A restore is the reverse, with the app stopped: put `app.db` and `photos/` back
and start it. Migrations replay at boot, so a backup from an older version comes
up on the current schema without a step to remember. What a backup cannot
restore is the identity provider — accounts live there (SPEC §1), and a restored
database expects the same `sub` claims to come back.

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

Two stages: the build compiles nothing (both native dependencies — sharp and
better-sqlite3 — ship musl binaries, and the lockfile carries every platform
variant), and the runtime carries the built server, the migrations it replays at
boot, and no package manager.

The container runs as **`node`, uid 1000**, and that has one consequence worth
knowing before it bites: a *named* volume inherits the image's ownership and
just works, while a **bind mount keeps the host's** — if `./data` on the host is
not writable by uid 1000, the app exits at boot with `EACCES` on
`/app/data/photos`. Either `chown 1000:1000 ./data` first, or use a named volume
as [compose.example.yml](compose.example.yml) does.

The `HEALTHCHECK` fetches `/login`, the one page that needs no session. It
answers "is the server serving?" and deliberately not "is the database happy":
a probe that read SQLite could take a healthy game down over a lock it should
have waited on.

## Publishing

Every pull request runs lint, typecheck and the test suite
([.github/workflows/ci.yml](.github/workflows/ci.yml)), on the merge ref — so
what is checked is what would land. `main` is protected and takes nothing any
other way, which is why the release side verifies nothing again. An image is
pushed to `ghcr.io/elythiel/perquiz` only when the `version` in `package.json`
names one that does not exist yet
([.github/workflows/release.yml](.github/workflows/release.yml)) — so bumping
that line *is* the decision to release, and it is the only one.

One tag comes out of it, `vX.Y.Z`, and it never moves: it is what a deployment
pins and what it rolls back to. There is no `latest` and no `main` — a moving
tag has nothing to point at in a scheme where every published image has a
number, and on a pre-1.0 project it would quietly cross a breaking change.
There is no `sha-<short>` either: the commit is in the image, as
`org.opencontainers.image.revision`, so `docker inspect` answers "what exactly
is running" without a tag spent on it.

The release workflow also creates the matching git tag, and only after the push
succeeded: a tag is a promise that an image exists.

That is where this repository's responsibility ends. **Deployment is a pull**,
and it is deliberately not described here: no host, no domain, no proxy config
and no deploy credential lives in this repo, which is why the release workflow
needs no secret beyond the token GitHub gives the job. Whatever pulls the image — a
version bumped by hand, a cron `docker compose pull && up -d`, or a bot like
Renovate opening the bump as a pull request — is configured on the machine that
runs it. [compose.example.yml](compose.example.yml) is a portable
starting point for that side; it carries the image, the env file and the one
volume, and nothing about any particular host.
