# Perquiz — Implementation plan

Execution plan for building Perquiz from scratch, against [SPEC.md](./SPEC.md) and [PAGES.md](./PAGES.md), with the visual direction from `design-system.png` and `screens/`. Milestones are ordered by dependency; each is shippable-quality before moving on (typed, linted, French copy, mobile-first).

## Technical decisions

- **OIDC client**: `openid-client` wired directly in Nitro (login / callback / logout routes), rather than an auth module. Rationale: the flow is small and fully specified (code + PKCE, role-claim gate, JIT provisioning, `is_admin` sync), we keep zero framework lock-in on the pluggable-provider design, and one dependency replaces a module + its config surface.
- **Session**: h3's `useSession` (encrypted, httpOnly cookie) holding only `{ userId }` after provisioning — tokens are used at login time and discarded; roles live in the DB (`is_admin`), refreshed each login.
- **DB**: `better-sqlite3` + Drizzle; `drizzle-kit` migrations executed at server startup (Nitro plugin). DB file `./data/app.db`.
- **Images**: `sharp`. Magic-byte sniffing before processing; EXIF dropped by re-encoding; two stored variants (web ~1600px, thumb ~400px, WebP). Originals are not kept.
  - **HEIC caveat**: prebuilt sharp binaries decode HEIC only if built with libheif. Verify at M3; if unsupported, reject HEIC uploads with a clear message (iPhones can send JPEG) and note it in the README. Do not block the milestone on it.
- **Styling**: Tailwind v4 with the design-system tokens (`night`, `panel`, `edge-subtle`, `text`, `torch`, `clue`, `alert`) as theme colors. The art direction names its colours in French; `app/assets/css/main.css` holds the only written mapping between those names and the English tokens. Space Grotesk + IBM Plex Mono self-hosted (no CDN). Animations follow `screens/animation-rules.png`, including the `prefers-reduced-motion` fallback.
- **Icons**: `@nuxt/icon` with a locally installed MingCute collection (`@iconify-json/mingcute`), `clientBundle: { scan: true }` and everything else off — no server bundle, no provider, no API fallback. The source is scanned and only the icons actually used are embedded, so nothing is fetched at runtime, the same rule as the self-hosted fonts. A library rather than hand-drawn SVGs because of the count: at three icons drawing them is reasonable, at a dozen they drift in grid, stroke and optical size, and that only shows when you put them side by side. Two libraries were weighed and declined: a charting package for the reveal show (it colours series, not bars, and dragged a map-projection stack behind it) and an animation library (the motion is state to state, which CSS transitions do, and the one hard part — FLIP — is already in Vue's `<TransitionGroup>`).
- **Tests**: Vitest on the pure logic (scoring/ranking, guess validation, OIDC claim reading) and on the security invariants (no owner data in participant payloads, phase/role guards). No E2E suite in v1; the reveal show is validated by hand with seed data.

## Prerequisite: identity provider (manual)

Perquiz needs an OIDC provider **able to assert roles in the token**; everything about it is configuration (`.env.example`). The steps below are the **reference setup**, on the homelab's Zitadel — the only instance this is tested against. Another provider follows the same four steps under different names, and needs `NUXT_OIDC_ROLES_CLAIM` pointed at wherever it puts roles.

1. Create a **project** "Perquiz"; add **roles** `player` and `admin`; enable **"Assert Roles on Authentication"**.
2. Create an **application** in the project: type Web, **PKCE** (no secret), redirect URI `https://<host>/api/auth/callback`, post-logout URI `https://<host>/login`.
3. Grant roles: `admin` to your personal user, `player` to everyone else (grantable in advance).
4. Collect for `.env`: issuer URL, client ID. Zitadel's claim name and role names are already the defaults.

## Milestones

### M0 — Scaffold
Nuxt 4 + TypeScript strict + ESLint (Nuxt preset) + Yarn 4, Tailwind v4 wired with the design tokens and both fonts, app shell (nav, user chip, phase chip placeholder), `./data/` layout, `.env.example`, Dockerfile skeleton.
**Done when**: `yarn dev` boots the themed shell, lint and typecheck pass.

### M1 — Data layer & seed
Drizzle schema (`users`, `identities`, `photos`, `guesses`, `app_state`) + migrations running at boot; db util; **dev seed script** generating ~10 fake users, rooms with generated placeholder images, partial guess sheets — enough to exercise every later screen (including reveal) without real players.
**Done when**: fresh clone → migrate + seed → inspectable playable state.

### M2 — Auth (OIDC)
`/api/auth/login|callback|logout`, PKCE flow via `openid-client` on the discovery document, role gate through `extractRoles` and the configured claim, JIT provisioning + display-name collision suffix (seeded by `extractDisplayName`), `is_admin` sync at every login, session cookie, global server-side guard (all routes except login/callback) + client route middleware, `/login` page with its three states (nominal, not-on-the-guest-list, IdP error). Configuration and claim reading already landed — see `server/utils/oidc.ts`; no provider name belongs anywhere else.
**Done when**: real round-trip against the homelab provider works for a `player`, an `admin`, and a role-less user.

### M3 — My room (`/my-room`)
Upload API (multipart, size/type limits, magic bytes, sharp pipeline), authenticated photo-serving route (`/api/photos/…`, no identity leakage), list/reorder/delete, display-name edit, player-preview mode, per-phase read-only. UI per `screens/my-room.png` (upload progress, per-file errors, processing state).
**Done when**: happy path from a phone works; served files verified EXIF-free; last-photo deletion warns about discarding others' guesses.

### M4 — Guess sheet (`/guess`)
Anonymized rooms endpoint (excludes own room, never includes owner), guess upsert endpoint (phase-guarded, target-validated), deck UI per `screens/room-guess.png`: one room at a time, swipe/next navigation, searchable participant picker (self excluded), save-state indicator, duplicate soft warning, unanswered filter, progress `X/N`.
**Done when**: autosave with visible states works; payload audit shows no deducible answer; Vitest covers the guards.

### M5 — Dashboard (`/`)
Aggregates endpoint (my room status, my progress, rooms/participants counts, new-rooms-since-last-visit), per-phase content and prioritized CTAs per `screens/home.png`.

### M6 — Régie (`/admin`)
Phase-transition API with guards + confirmations UI, participation dashboard (photo count, X/N progress, last activity — never guess content), photo moderation without owner names, remove-participant-data with cascade confirmation. Per `screens/admin-panel.png` minus the invite block (obsolete — access lives at the identity provider).

### M7 — Reveal show (`/reveal`)
Reveal API (admin + `locked` only): stable shuffled order (seed persisted in `app_state`), per-room vote distribution incl. « sans réponse », owner, podium data. Big-screen UI per `screens/room-reveal.png` and `podium-reveal.png`: three admin-advanced steps per room, keyboard navigation, URL-addressable position (refresh-proof), cascading bar animation, podium 3-2-1 then full ranking, `prefers-reduced-motion` variants.
**Done when**: full show runs on seed data start-to-finish with keyboard only, and survives a mid-show refresh.

### M8 — Results (`/results`)
Scoring util (correct-guess count, shared-rank competition ranking) with unit tests; page per `screens/results.png`: score, rank (ex æquo), leaderboard, per-room detail (my guess vs owner, unanswered); `revealed`-only guard with redirect.

### M9 — Hardening & ship
Security pass on the invariants (§9 of SPEC.md) with endpoint tests; final Dockerfile (single volume `./data`); README (setup, the reference provider guide from the prerequisite section, backup note); French copy proofread; Lighthouse-style mobile pass on the three participant pages.

## Design deltas to fold back into the mockups

- `login-and-registration.png`: tabs/invite-code/password gone → single SSO action + "not on the guest list" + IdP-error states.
- `admin-panel.png`: « Lien d'invitation » block removed.

## Order rationale

Auth before any feature (everything is session-gated); photos before guessing (a sheet needs rooms); reveal before results (results reuse the scoring + distribution work); seed data early because reveal/results are otherwise untestable until a real party has played.
