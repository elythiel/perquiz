# Perquiz — Page specifications

Functional spec of every page, for UX/UI design. Features, states and edge cases only — no layout or visual decisions. Companion to [SPEC.md](./SPEC.md); phases (`open` / `locked` / `revealed`) and rules are defined there.

## Global shell (all authenticated pages)

- Navigation to: dashboard, « Ma pièce », « Deviner », « Résultats » (only in `revealed`), admin panel (admins only).
- Current user's display name + logout action.
- The current phase must be perceivable everywhere (participants should never wonder why something is read-only).
- All pages are mobile-first; the reveal show is the only big-screen-first page.
- UI language: French. The word "Martelle" never appears.

---

## `/login` — public

Purpose: enter the game through the SSO.

Features:
- One action: sign in → redirect to the identity provider (OIDC; Zitadel in the reference deployment). No registration, no password, no invite code — accounts are provisioned at the provider by the organizer.
- App name + one-sentence pitch of the game (a newcomer must understand what they're joining).

States & edge cases:
- Already authenticated → redirected to `/`.
- Back from the IdP without a `player`/`admin` role → "you're not on the guest list" screen: explain that access is granted by the organizer; no account is created.
- IdP unreachable / OIDC error → readable error + retry action.
- First login: account auto-created; display name defaults from the token — `name`, else `preferred_username`, else the local part of `email`, else a prefix of `sub`. If that name is already taken, a suffix is appended and the user is nudged to pick a better one in « Ma pièce ».
- Display name rules (unique case-insensitive, 2–30 chars) apply to renames in « Ma pièce », not here.

---

## `/` — dashboard (participant)

Purpose: know where I stand, and where to go next.

Features, by phase:
- `open`:
  - My room status: number of photos uploaded; explicit warning when 0 ("your room is not in play yet").
  - My guessing progress: "X pièces devinées sur N".
  - Entry points to « Ma pièce » and « Deviner », prioritized by what's missing (no photos yet → push upload; sheet incomplete → push guessing).
  - Number of rooms in play / number of participants.
- `locked`:
  - Clear "answers are locked, reveal is coming" message.
  - Recap of my final progress (photos count, X/N guessed). No scores.
- `revealed`:
  - My score and rank, entry point to « Résultats ».

Edge cases:
- New rooms can appear during `open` (people keep uploading): the X/N progress reflects it, which is the signal to come back to « Deviner ».

---

## `/my-room` — my room (participant)

Purpose: manage the photos of my room and my display name.

Features (`open` phase):
- Upload photos: multiple files, from camera or gallery. Accepted: JPEG/PNG/WebP, ≤ 15 Mo each, unlimited count. HEIC is detected and refused with an explanatory message — see §3 of SPEC.md and the README.
- Upload feedback: per-file progress/processing state, per-file errors (too big, unsupported, failed) without blocking the other files.
- List my photos; reorder them; delete any (with confirmation).
- "In play" status: visible ("your room appears on others' sheets") vs 0 photos ("not in play").
- Preview my room as others see it: photos only, nothing identifying.
- Edit my display name (same rules as registration; uniqueness re-checked).

States:
- `locked` / `revealed`: everything read-only (photos still viewable, no actions).

Edge cases:
- Deleting the last photo while others have already guessed my room: allowed during `open`; the room leaves everyone's sheet (existing guesses on it are discarded). The UI must warn about this consequence.

---

## `/guess` — the guess sheet (participant)

Purpose: assign an owner to every room in play (except mine), revisable until lock.

Features (`open` phase):
- All in-play rooms except my own, each with:
  - the room's photos (all of them, browsable),
  - an owner picker: searchable list of **all** participants except myself; one selection per room, changeable at will.
- Auto-save on every selection, with visible save-state feedback (saved / saving / failed-retry).
- Progress "X / N" always visible.
- Filter: all rooms / unanswered only.
- Soft duplicate warning when the same participant is assigned to several rooms (allowed, but each person owns exactly one room).
- Rooms appear/disappear as participants upload/remove photos; the sheet reflects the current state on each visit.

States:
- `locked`: read-only — my picks visible, no correctness shown.
- `revealed`: read-only; points to « Résultats » for correctness.

Edge cases:
- No room in play at all (early days): explain and point to « Ma pièce ».
- A participant list too small to be interesting is not the app's problem — no special handling.
- Unanswered rooms are valid (score 0 for them).

---

## `/results` — results (participant, `revealed` only)

Purpose: my personal debrief + the final leaderboard.

Features:
- My score (correct guesses / total) and my rank.
- Final leaderboard: rank, display name, score, for all participants; standard competition ranking, ties share rank (1, 2, 2, 4…).
- Per-room detail of my sheet: the room's photos, my guess, the actual owner, correct/incorrect. Unanswered rooms shown as such.

States & edge cases:
- Accessed before `revealed` → redirect to `/` (with the "locked" or "open" explanation).
- Participants who guessed nothing still see the leaderboard and their (empty) detail.

---

## `/reveal` — the reveal show (admin, big screen)

Purpose: the projected live show. Admin-driven, step by step. Designed for an audience.

Features:
- Available to admins during `locked` (a guard warns if the phase is still `open`: results would not be final).
- One room at a time, in a stable shuffled order. For each room, three admin-advanced steps:
  1. the room's photos,
  2. the guess distribution: how many votes each guessed participant received (including a "no answer" count),
  3. the owner reveal, with a celebratory moment.
- After the last room, the podium: 3rd revealed, then 2nd, then 1st, then the complete final ranking.
- Navigation: next / previous (going back re-hides accordingly), operable by keyboard.
- Discreet presenter cue: room i / N.
- Interruption-proof: refreshing or reopening the page resumes at the same room/step (position is URL-addressable, order is stable).

Edge cases:
- Rooms whose owner made no guesses, or that nobody guessed correctly: distribution still shown (possibly all-wrong — that's part of the fun).
- The show reveals answers on screen only; participants' devices stay blind until the admin flips the phase to `revealed` (done from `/admin`, after the show).

---

## `/admin` — admin panel (admin)

Purpose: run the game without ever seeing the answer key.

Features:
- **Phase control**: current phase + transitions (`open` → `locked` → `revealed`, and reversals). Each transition confirmed, with its consequences stated (lock = players can no longer change anything; reveal = everyone sees results).
- **Participation dashboard** (per participant): photo count, guess progress (X/N), last activity. Never the content of their guesses.
- **User management**: remove a participant's data (confirmation with consequences: their photos, room and guesses are removed; guesses others made about their room are discarded). A note makes clear this does not revoke their access — accounts and roles are managed at the identity provider.
- **Photo moderation**: browse all photos without owner names, delete any (confirmation).

Constraints:
- No admin screen shows the room → owner mapping. Admins play like everyone else; the only place answers appear is `/reveal`, live.
- Who is admin is decided by the provider's `admin` role (synced at each login) — no promote/demote in the app.
