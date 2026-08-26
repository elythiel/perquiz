# Perquiz — Specification

A social guessing game. Every participant uploads photos of a room in their home. Everyone then tries to guess which room belongs to whom. Answers stay hidden until a live reveal show, followed by a final leaderboard.

The visible app name is **« Perquiz »** (perquisition + quiz — you're "searching" the other players' homes for clues). The detective/investigation theme should inform the visual identity and UI copy. The UI is in **French** and must never display the word "Martelle". Mobile-first: participants upload and guess from their phones.

---

## 1. Roles & authentication

- **Participant** — a user authenticated through the instance's IdP and holding the `player` (or `admin`) role.
- **Admin** — a participant holding the `admin` role. Admins are also players.

### v1: OIDC via Zitadel, role-gated

- Perquiz is an **OIDC client of a Zitadel instance** (authorization code flow + PKCE). No in-app registration or password handling: accounts are provisioned in Zitadel by the organizer.
- Authorization uses a **Zitadel project** with two **project roles**: `player` and `admin`, granted per user in Zitadel. The app requires roles asserted in the token (`urn:zitadel:iam:org:project:roles`).
- At login: a user with neither role is rejected (explanatory screen, no account created). Otherwise a local user record + identity are created on first login (JIT provisioning), and `is_admin` is **synced from the roles claim on every login** — Zitadel is the source of truth for who is admin.
- **Display name**: defaults from the Zitadel profile, freely editable in-app (unique, case-insensitive — it's the name others pick when guessing). On collision at first login, a suffix is added and the user is invited to rename.
- No anonymous access: every page and API route requires a session, except the login screen and the OIDC callback.
- Sessions are the app's own encrypted, httpOnly cookies (established after the OIDC callback).
- Logout ends the app session (no Zitadel single-logout in v1).

### Extensibility: pluggable identity providers

Authentication is architecturally isolated from the game domain. A user's profile (`users`) is separate from how they authenticate (`identities`, 1-N per user: provider + subject + optional credential). v1 ships only the `zitadel` provider; adding another OIDC provider — or local invite-code accounts — later means adding an identity row type and a login entry, and game code never touches identities.

**Several providers can be active simultaneously.** Provider configuration is deployment-driven (a *list* of provider configs via env/config file, not a single set), and the login page renders one entry per enabled provider alongside the local form. Because identities are 1-N per user, one account can hold several login methods (account linking). Runtime-editable IdP config stored in DB (admin adds a provider without redeploy) is deliberately **not** pursued.

## 2. Application phases

A single global phase, controlled by the admin:

| Phase | Participants can… | Notes |
|---|---|---|
| `open` | upload/manage their room photos, fill and revise their guess sheet | Default phase. Guessing and uploading happen concurrently: the guess sheet grows as new rooms appear. |
| `locked` | nothing — everything read-only | Admin locks shortly before the reveal event. Scores are computable from this point but **not shown** to participants. |
| `revealed` | see their personal results and the final leaderboard | Flipped by the admin at the end of the live reveal show. |

Phase transitions are manual (admin panel), reversible (an admin can reopen if locked by mistake), and take effect immediately.

## 3. Rooms & photos

- Each participant owns **exactly one room** and uploads **any number of photos** of it (unlimited).
- A room is "in play" once it has at least one photo.
- Owners can reorder and delete their own photos while the phase is `open`.
- Upload constraints: JPEG/PNG/WebP/HEIC input, reasonable max size per file (e.g. 15 MB before processing).
- Server-side processing on upload:
  - **strip all EXIF metadata** (GPS coordinates especially — privacy),
  - re-encode and resize to a web variant (~1600px long edge) and a thumbnail (~400px),
  - store on local disk under `./data/photos/`, filenames are random IDs.
- Photos are **never publicly served**: they go through an authenticated API route. Nothing in a photo URL or payload may leak the owner's identity.
- Content moderation: an admin can delete any photo. The moderation view must not display the room → owner mapping (see §7).

## 4. Guessing

- Each participant has **one guess sheet** covering every in-play room **except their own**.
- For each room: pick one participant from the **full participant list** (searchable select). The guesser's own name is excluded from their options.
- Guesses are **auto-saved** individually and revisable at will until the phase is `locked`.
- The same name **may** be assigned to several rooms (no hard uniqueness constraint), but the UI shows a discreet warning on duplicates, since each person owns exactly one room.
- Unanswered rooms simply score 0 — a partial sheet is valid.
- A participant who uploaded no photos can still guess (they just win no points from their own absent room, and their room doesn't appear on anyone's sheet).
- Progress indicator: "X / N pièces devinées" on the dashboard and the sheet.

## 5. Scoring & leaderboard

- **Score = number of correct guesses** at lock time. Nothing else — no speed bonus, no penalty for revisions.
- Ties share the same rank (standard competition ranking: 1, 2, 2, 4…).
- Scores and per-guess correctness are computed server-side and exposed **only** in the `revealed` phase (and through the reveal show, §6). Before that, no API response may allow deducing a correct answer.

## 6. Live reveal show

A dedicated **big-screen page**, driven by the admin (accessible to admins during `locked`), designed to be projected in front of the players (or screen-shared on a call):

1. Rooms are presented one by one (shuffled order); admin navigates next/previous.
2. For each room, three steps advanced by the admin:
   a. the photos (carousel),
   b. the **guess distribution** — a bar chart of "who you all voted for",
   c. the **owner reveal**, with a celebratory flourish.
3. After the last room: the **podium** — final leaderboard revealed in suspense order (3rd, then 2nd, then 1st), then the full ranking.

After the show, the admin switches the phase to `revealed`: every participant can then browse, on their own device, their personal results (each room, their guess, the right answer) and the final leaderboard.

No realtime sync needed: the projected page is simply a page the admin controls directly.

## 7. Admin panel

- Phase control (`open` / `locked` / `revealed`).
- User management: remove a participant's data (photos, room, guesses — cascading). Access and admin role are managed in Zitadel, not in the app.
- Participation dashboard: who has uploaded photos (count), who has started/completed their guess sheet — **without showing the guesses' content**.
- Photo moderation: browse and delete photos, shown without owner names.
- Design constraint: **admins play too**, so no admin screen may display the room → owner answer key. The only place answers appear is the reveal show (which the admin runs live, at which point the game is over anyway).

## 8. Pages

Detailed per-page functional specs (features, states, edge cases) live in [PAGES.md](./PAGES.md).

| Route | Access | Content |
|---|---|---|
| `/login` | public | SSO sign-in (redirect to Zitadel) |
| `/` | participant | Dashboard: current phase, my room status, guess progress, links |
| `/ma-piece` | participant | Upload, reorder, delete my photos; edit my display name |
| `/deviner` | participant | The guess sheet: grid of rooms (photo carousel + owner picker each) |
| `/resultats` | participant, `revealed` only | Personal results + final leaderboard |
| `/reveal` | admin | The projected reveal show |
| `/admin` | admin | Phase control, participation stats, moderation |

## 9. Tech stack

- **Nuxt 4** (Vue 3, `<script setup>`, TypeScript) with the Nitro server for the API.
- **SQLite** via **Drizzle ORM**, migrations with **drizzle-kit**. DB file at `./data/app.db`.
- **Tailwind CSS** (v4) — custom design, no component library.
- OIDC client for Zitadel (e.g. `openid-client` hand-wired in Nitro, or the `nuxt-oidc-auth` module — decided at planning).
- **sharp** for image processing (resize, re-encode, EXIF stripping).
- Package manager: **Yarn 4 via corepack**.
- Lint: ESLint (Nuxt preset).

### Data model (Drizzle)

```
users       id, display_name (unique, ci), is_admin, created_at
identities  id, user_id → users, provider ('zitadel' in v1), subject,
            secret_hash (nullable — reserved for a future local provider),
            created_at, UNIQUE (provider, subject)
photos      id, user_id → users, filename, position, created_at
guesses     guesser_id → users, room_user_id → users, guessed_user_id → users,
            updated_at, PK (guesser_id, room_user_id)
app_state   singleton row: phase, locked_at
```

For the `zitadel` provider, `subject` is the OIDC `sub` claim. `users.is_admin` is a cache of the Zitadel `admin` role, refreshed at every login. The game domain only ever references `users.id` — it is provider-agnostic.

Scores are derived (computed from `guesses` at read time in `locked`/`revealed`), never stored.

### Security invariants

- All API routes behind the session check; admin routes behind the admin flag.
- The room → owner mapping never leaves the server before `revealed`, except through the reveal-show endpoints (admin-only).
- Photos served only through authenticated routes; EXIF stripped at upload.
- Uploads validated by magic bytes, not extension.

## 10. Deployment

- Node server build (`nuxt build`), single process.
- All persistent state under `./data/` (SQLite file + photos) → one volume to back up.
- Runtime config via env vars: session secret, public base URL, Zitadel issuer URL + client ID (+ client secret if the app is registered as a confidential client).
- A simple `Dockerfile` is provided; HTTPS termination is assumed to be handled by the host's reverse proxy.

## 11. Out of scope (v1)

- Additional identity providers (local invite-code accounts, Google, generic OIDC…) and email-based flows — the `identities` model is designed to host them later.
- Zitadel single-logout, and automatic reaction to users deleted/revoked in Zitadel (they simply can't log in anymore; their data stays until an admin removes it).
- Live/synchronous game modes (Kahoot-style).
- Notifications and email reminders.
- Multiple rooms per participant, or multiple concurrent games/seasons.
- Realtime sync between the projected show and participants' devices.
