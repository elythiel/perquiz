# Perquiz

A party game for a group who know each other: everyone photographs a room of their
home, then tries to work out whose room is whose. Perquisition + quiz. The UI is in
French and mobile-first — participants upload and guess from their phones.

- **What it does, exactly**: [docs/SPEC.md](docs/SPEC.md) (rules, phases, security invariants)
- **Screen by screen**: [docs/PAGES.md](docs/PAGES.md)
- **How it gets built**: [docs/PLAN.md](docs/PLAN.md) (milestones, technical decisions)

## Stack

Nuxt 4 (SSR, TypeScript strict) · Tailwind v4 with the design-system tokens ·
SQLite (better-sqlite3 + Drizzle) · Zitadel for identity (OIDC, code + PKCE) ·
sharp for photo processing. Self-hosted fonts, no CDN.

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
| `yarn typecheck` | `vue-tsc` over the whole project |

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
