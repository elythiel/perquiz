# Perquiz — Specification

A social guessing game. Every participant uploads photos of a room in their home. Everyone then tries to guess which room belongs to whom. Answers stay hidden until a live reveal show, followed by a final leaderboard.

The visible app name is **« Perquiz »** (perquisition + quiz — you're "searching" the other players' homes for clues). The detective/investigation theme should inform the visual identity and UI copy. The UI is in **French** and must never display the word "Martelle". Mobile-first: participants upload and guess from their phones.

---

## 1. Roles & authentication

- **Participant** — a user authenticated through the instance's IdP and holding the `player` (or `admin`) role.
- **Admin** — a participant holding the `admin` role. Admins are also players.

### v1: a generic OIDC provider able to assert roles

- Perquiz is an **OIDC client** of whichever provider the deployment points it at (authorization code flow + PKCE). Endpoints come from `<issuer>/.well-known/openid-configuration`; no provider URL is hard-coded. No in-app registration or password handling: accounts are provisioned at the provider by the organizer.
- **The provider must be able to assert roles in the token** — that is the one requirement beyond plain OIDC. Two role names are needed, `player` and `admin` by default, granted per user at the provider. Which claim carries them, and under which names, is configuration (`NUXT_OIDC_ROLES_CLAIM`, `NUXT_OIDC_ROLE_PLAYER`, `NUXT_OIDC_ROLE_ADMIN`). Three claim shapes are understood: an array of strings, an object whose keys are the roles, and a space-separated string.
- **Tested with Zitadel.** Its claim (`urn:zitadel:iam:org:project:roles`) and role names ship as the configuration defaults, and the organizer's instance is the only one this is exercised against. Other providers are supported by their *documented* claim shapes — a smaller promise than "works with any OIDC", and deliberately worded that way.
- At login: a user with neither role is rejected (explanatory screen, no account created). Otherwise a local user record + identity are created on first login (JIT provisioning), and `is_admin` is **synced from the roles claim on every login** — the provider is the source of truth for who is admin.
- **Display name**: defaults from the token — `name`, else `preferred_username`, else the local part of `email`, else a prefix of `sub`, since `name` is optional in OIDC — then freely editable in-app (unique, case-insensitive — it's the name others pick when guessing). On collision at first login, a suffix is added and the user is invited to rename.
- No anonymous access: every page and API route requires a session, except the login screen and the OIDC callback.
- Sessions are the app's own encrypted, httpOnly cookies (established after the OIDC callback).
- Logout ends the app session (no single-logout at the provider in v1).

### Extensibility: pluggable identity providers

Authentication is architecturally isolated from the game domain. A user's profile (`users`) is separate from how they authenticate (`identities`, 1-N per user: provider + subject + optional credential). v1 configures exactly **one** provider, whose id (`NUXT_OIDC_PROVIDER_ID`) is what lands in `identities.provider`; adding another OIDC provider — or local invite-code accounts — later means adding an identity row type and a login entry, and game code never touches identities.

**Several providers can be active simultaneously.** Provider configuration is deployment-driven (a *list* of provider configs via env/config file, not a single set), and the login page renders one entry per enabled provider alongside the local form. Because identities are 1-N per user, one account can hold several login methods (account linking). Runtime-editable IdP config stored in DB (admin adds a provider without redeploy) is deliberately **not** pursued.

## 2. Application phases

A single global phase, controlled by the admin:

| Phase | Participants can… | Notes |
|---|---|---|
| `preparation` | upload/manage their room photos — there is no guess sheet yet | Default phase. The room-filling airlock: the admin lets everyone furnish their room, then opens the game for all at once. |
| `open` | upload/manage their room photos, fill and revise their guess sheet | Guessing and uploading happen concurrently: the guess sheet grows as new rooms appear. |
| `locked` | nothing — everything read-only | Admin locks shortly before the reveal event. Scores are computable from this point but **not shown** to participants. |
| `revealed` | see their personal results and the final leaderboard | Flipped by the admin at the end of the live reveal show. |

Two rights, two boundaries, and they are not the same: a room is editable in `preparation` **and** `open`; guessing is `open` only. Opening the game is therefore an addition, never a removal — nothing a player could do in `preparation` stops working at `open`.

Phase transitions are manual (admin panel), reversible (an admin can reopen if locked by mistake, or fall back to `preparation`), and take effect immediately. There is no timer: every transition is a deliberate act.

## 3. Rooms & photos

- Each participant owns **exactly one room** and uploads **up to 10 photos** of it. The cap is a product choice, not a storage one — a stored photo costs ~76 Ko across both variants — and it exists so the guess sheet and the reveal show can present a room one screen at a time. A room already holding more keeps them: the cap refuses additions, it never deletes.
- A room is "in play" once it has at least one photo.
- Owners can reorder and delete their own photos while the phase is `preparation` or `open`.
- Upload constraints: JPEG/PNG/WebP input, 15 Mo max per file, 10 per room. HEIC was in this list until M3 measured that sharp's prebuilt binaries cannot decode it (no HEVC decoder); it is detected and refused with an explanatory message. iOS transcodes to JPEG on upload, so the common path is unaffected — see the README.
- Server-side processing on upload:
  - **strip all EXIF metadata** (GPS coordinates especially — privacy),
  - re-encode and resize to a web variant (~1600px long edge) and a thumbnail (~400px),
  - store on local disk under `./data/photos/`, filenames are random IDs.
- Photos are **never publicly served**: they go through an authenticated API route. Nothing in a photo URL or payload may leak the owner's identity.
- Content moderation: an admin can delete any photo. The moderation view must not display the room → owner mapping (see §7).

## 4. Guessing

- Each participant has **one guess sheet** covering every in-play room **except their own**.
- For each room: pick one name from a **short list of six** — the owner and five decoys — shown as a grid under the photographs. One tap, one answer; there is no search, because searching six names is not a thing anyone does.
- The short list is **derived from the room and a server secret, never from the reader**: two players comparing screens see the same six for the same room. Photograph filenames are global, so they *can* line the room up across two sheets; per-reader decoys would make the intersection of their two lists the owner.
- The pool the decoys come from is **every participant**, with or without photographs — a player who uploaded nothing is still a credible answer. The reader is removed on the way out rather than before the draw, so on the rooms where they happened to be a decoy they see five names instead of six. The list is never topped back up: that sixth name would be per-reader, which is the leak just avoided.
- The guesser's own name is excluded from their options. An answer saved before the short list existed stays offered and selected, and the server accepts it — the reader already knows that name.
- The sheet comes into existence with the `open` phase: during `preparation` there is no sheet at all — `/guess` is not reachable and the route that feeds it refuses.
- Guesses are **auto-saved** individually and revisable at will until the phase is `locked`.
- The same name **may** be assigned to several rooms (no hard uniqueness constraint), but the UI shows a discreet warning on duplicates, since each person owns exactly one room.
- Unanswered rooms simply score 0 — a partial sheet is valid.
- A participant who uploaded no photos can still guess (they just win no points from their own absent room, and their room doesn't appear on anyone's sheet).
- Progress indicator: "X / N pièces devinées" on the dashboard and the sheet.

## 5. Scoring & leaderboard

- **Score = number of correct guesses** at lock time. Nothing else — no speed bonus, no penalty for revisions.
- Ties share the same rank (standard competition ranking: 1, 2, 2, 4…).
- Scores and per-guess correctness are computed server-side and exposed **only** in the `revealed` phase (and through the reveal show, §6).

**Partial disclosure, accepted knowingly.** Before §4's short list, no API response allowed deducing a correct answer at all. That invariant is now weaker, in two named ways, and both are the price of a sheet people finish rather than abandon:

- **The orphan name.** With six names over twenty-nine rooms, roughly one party in seven has a name appearing on *no other* room's short list. That name is certainly its room's owner.
- **Two readings across a wave of sign-ups.** The owner is in every reading of their room, so intersecting two readings narrows the field. The derivation ranks candidates by HMAC and keeps the five smallest, which means a newcomer can rank in and displace a decoy — so the two lists differ and the intersection is smaller than six. Measured over four hundred simulated parties growing from eight players to thirty *during play*: the intersection averages 2.2 names and 22% of rooms come out named outright. A party where everyone signs up before the first guess never triggers this — the list does not move — and that is how the game is played.

Neither is engineered away. Freezing the pool at opening, or persisting each room's six names, would close the second one; both were weighed and set aside as buying less than they cost.

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
- User management: remove a participant's data (photos, room, guesses — cascading). Access and admin role are managed at the identity provider, not in the app.
- Participation dashboard: who has uploaded photos (count), who has started/completed their guess sheet — **without showing the guesses' content**.
- Photo moderation: browse and delete photos, shown without owner names.
- Design constraint: **admins play too**, so no admin screen may display the room → owner answer key. The only place answers appear is the reveal show (which the admin runs live, at which point the game is over anyway).
- **Known limit, accepted rather than fixed.** The panel moderates photographs anonymously *and* reports per-person counts, and those two are not fully separable: an admin who deletes a photograph from the anonymous grid can compare the participation counts before and after, and the one that dropped names its owner. Every fix costs the panel the thing it exists for — dropping the counts blinds the organizer to who still has a room to fill, delaying the deletion until the game ends removes the point of moderating during it, and batching deletions only raises the number of photographs an admin must be willing to destroy to learn one owner. It is written here so that a reader finds it stated rather than deduces it: an admin who wants to cheat can, at the price of destroying somebody's photograph, which is a social cost this game already relies on everywhere else.

## 8. Pages

Detailed per-page functional specs (features, states, edge cases) live in [PAGES.md](./PAGES.md).

| Route | Access | Content |
|---|---|---|
| `/login` | public | SSO sign-in (redirect to the OIDC provider) |
| `/` | participant | Dashboard: current phase, my room status, guess progress, links |
| `/my-room` | participant | Upload, reorder, delete my photos; edit my display name |
| `/guess` | participant | The guess sheet: grid of rooms (photo carousel + owner picker each) |
| `/results` | participant, `revealed` only | Personal results + final leaderboard |
| `/reveal` | admin | The projected reveal show |
| `/admin` | admin | Phase control, participation stats, moderation |

## 9. Tech stack

- **Nuxt 4** (Vue 3, `<script setup>`, TypeScript) with the Nitro server for the API.
- **SQLite** via **Drizzle ORM**, migrations with **drizzle-kit**. DB file at `./data/app.db`.
- **Tailwind CSS** (v4) — custom design, no component library.
- OIDC client: `openid-client` hand-wired in Nitro. Issuer, client, roles claim and role names all arrive from the environment — the only code that knows what a given IdP's tokens look like is `server/utils/oidc.ts`.
- **sharp** for image processing (resize, re-encode, EXIF stripping).
- Package manager: **Yarn 4 via corepack**.
- Lint: ESLint (Nuxt preset).

### Data model (Drizzle)

```
users       id, display_name (unique, ci), is_admin, created_at
identities  id, user_id → users, provider (NUXT_OIDC_PROVIDER_ID), subject,
            created_at, UNIQUE (provider, subject)
photos      id, user_id → users, filename, position, created_at
guesses     guesser_id → users, room_user_id → users, guessed_user_id → users,
            updated_at, PK (guesser_id, room_user_id)
app_state   singleton row: phase, locked_at
```

`subject` is the OIDC `sub` claim. `users.is_admin` is a cache of the provider's `admin` role, refreshed at every login. The game domain only ever references `users.id` — it is provider-agnostic.

Scores are derived (computed from `guesses` at read time in `locked`/`revealed`), never stored.

### Security invariants

- All API routes behind the session check; admin routes behind the admin flag.
- The room → owner mapping never leaves the server before `revealed`, except through the reveal-show endpoints (admin-only).
- Photos served only through authenticated routes; EXIF stripped at upload.
- Uploads validated by magic bytes, not extension.

## 10. Deployment

- Node server build (`nuxt build`), single process.
- All persistent state under `./data/` (SQLite file + photos) → one volume to back up.
- Runtime config via env vars: session secret, public base URL, OIDC issuer + client ID (+ client secret if the app is registered as a confidential client), roles claim and role names. Full annotated list in `.env.example`.
- A simple `Dockerfile` is provided; HTTPS termination is assumed to be handled by the host's reverse proxy.
- Images are published to a public container registry on each push to the default branch, tagged both immutably (by commit) and movingly (by branch/version). Deployment is a **pull**: nothing about a particular host — address, proxy configuration, credentials — lives in the repository.

## 11. Out of scope (v1)

- **IdPs that cannot assert roles** (Google, GitHub, Apple as direct providers). OIDC standardizes authentication, not authorization: supporting them would mean bringing authorization back into the app — allow-list, approval queue or invite codes — plus bootstrapping the first admin, which is a milestone of its own. Without that guard, "no anonymous access" above would quietly become "any Google account walks in and sees the photos".
- **Several providers at once, and account linking** — the `identities` model is designed to host them later, but v1 configures one.
- Local invite-code accounts and email-based flows.
- Single-logout at the provider, and automatic reaction to users deleted/revoked there (they simply can't log in anymore; their data stays until an admin removes it).
- Live/synchronous game modes (Kahoot-style).
- Notifications and email reminders.
- Multiple rooms per participant, or multiple concurrent games/seasons.
- Realtime sync between the projected show and participants' devices.
