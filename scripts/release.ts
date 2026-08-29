import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'

/**
 * Cuts a release: the green bar, the two files that name the version, one commit.
 *
 *   yarn release 0.2.1 "the session that changed owner (vikunja-79)"
 *
 * Both arguments are required, the second one included. A release that says
 * only its number is a release whose reason has to be reconstructed from the
 * diff later, and "later" is the moment nobody has the context any more — so
 * the subject is asked for while it is still obvious. Nothing here judges what
 * it says; it just refuses to invent one.
 *
 * The version in `package.json` IS the release — the workflow reads it, and
 * publishes when that version has no tag yet (.github/workflows/release.yml;
 * `ci.yml` is the other half of the split, and only checks pull requests).
 * Which is why nothing here tags or pushes: this script prepares the decision
 * and leaves the moment of it to `git push`.
 *
 * The order is the point. Verification runs BEFORE the version moves, so a red
 * bar leaves a clean tree and nothing to undo — no half-bumped repository to
 * reason about, no `git checkout --` to remember. The only check that has to
 * come after is the one about the files this script just rewrote.
 */

/** Exactly what `release.spec.ts` requires of it: a git tag is built from this. */
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?$/

/** `yarn lint` and friends, one after another, with their output left visible. */
const GREEN_BAR = ['lint', 'typecheck', 'test', 'build'] as const

function fail(message: string, ...details: string[]): never {
  console.error(`release: ${message}`)
  for (const line of details) console.error(`         ${line}`)
  process.exit(1)
}

function git(...args: string[]): string {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.status !== 0) fail(`git ${args[0]} failed`, (result.stderr || '').trim())
  return result.stdout.trim()
}

function yarn(script: string) {
  const result = spawnSync('yarn', [script], { stdio: 'inherit' })
  if (result.status !== 0) {
    fail(`\`yarn ${script}\` is red — nothing was changed.`, 'The version is still where it was.')
  }
}

/**
 * Numbers compared as numbers, because `'10' < '9'` as strings and a tenth
 * minor version is not a hypothetical.
 *
 * A pre-release suffix only ever decides ties: `0.3.0-beta.1` may follow
 * `0.3.0`, and this is not the place to litigate the rest of the semver
 * ordering — the guard exists to catch a typo and a re-release, not to be a
 * complete implementation of a spec.
 */
function isAfter(candidate: string, current: string): boolean {
  const [, ...next] = SEMVER.exec(candidate)!
  const [, ...previous] = SEMVER.exec(current)!

  for (let part = 0; part < 3; part++) {
    const difference = Number(next[part]) - Number(previous[part])
    if (difference !== 0) return difference > 0
  }

  return next[3] !== previous[3]
}

/**
 * The version, replaced where it is written rather than where it is parsed.
 *
 * `JSON.parse` then `JSON.stringify` would reformat the whole file — key order
 * survives, but the indentation, the trailing newline and any comment-shaped
 * spacing do not, and a release commit is not the place to find that out. So
 * the line is rewritten, and the value it held is checked against the one this
 * script read: if the two disagree, the file is not the shape assumed here.
 */
function bump(path: string, pattern: RegExp, replacement: string, expected: string) {
  const before = readFileSync(path, 'utf8')
  const found = pattern.exec(before)

  if (!found) fail(`${path} does not carry the version where this script looks for it.`)
  if (found[1] !== expected) {
    fail(`${path} names ${found[1]}, but package.json names ${expected}.`,
      'The two are pinned to each other by tests/unit/release.spec.ts.')
  }

  writeFileSync(path, before.replace(pattern, replacement))
  console.log(`release: ${path.padEnd(20)} ${found[1]} → ${replacement.replace('$1', '')}`)
}

const USAGE = 'yarn release 0.2.1 "what this release is (vikunja-79)"'

const [version, subject, ...extra] = process.argv.slice(2)

if (!version) fail('give it a version.', USAGE)

if (!subject) {
  fail('give it a subject too — what this release is.',
    'It becomes the commit: 🔖 release: <version> — <subject>',
    USAGE)
}

/*
 * An unquoted subject arrives as one word per argument, and `subject` would be
 * the first of them — a commit reading "🔖 release: 0.2.1 — a", which is worse
 * than no subject because it looks deliberate. Cheap to catch, and the quoting
 * is exactly what goes wrong when the command is pasted rather than typed.
 */
if (extra.length > 0) {
  fail(`${extra.length + 1} words where one subject was expected — quote it.`,
    `Read as: "${subject}" then ${extra.map(word => `"${word}"`).join(', ')}`,
    USAGE)
}

if (!SEMVER.test(version)) {
  fail(`"${version}" is not a version a tag can be built from.`,
    'Three numbers, optionally a pre-release suffix: 0.2.1, 0.3.0-beta.1.')
}

const manifest = 'package.json'
const current = JSON.parse(readFileSync(manifest, 'utf8')).version as string

if (version === current) fail(`${current} is already the version in ${manifest}.`)
if (!isAfter(version, current)) {
  fail(`${version} does not come after ${current}.`,
    'A published version is never republished — the workflow skips a version that has a tag.')
}

/*
 * A dirty tree, refused rather than swept into the commit.
 *
 * This script commits, and a commit built from `git status` is a commit whose
 * contents nobody chose. The two version lines are the whole release; anything
 * else in the tree is somebody's work in progress, and it belongs in its own
 * commit with its own message.
 */
const dirty = git('status', '--porcelain')
if (dirty) {
  fail('the working tree is not clean.', ...dirty.split('\n'),
    'A release commit holds the version and nothing else.')
}

/*
 * `yarn build` and `yarn dev` share `.nuxt/`, and the build wins: it empties
 * the directory the running dev server is reading from, which ends that server
 * in a way that looks like a crash rather than a consequence. Cheaper to say so
 * than to be the reason someone's afternoon restarts.
 */
if (spawnSync('pgrep', ['-f', 'nuxt dev'], { encoding: 'utf8' }).status === 0) {
  fail('a `yarn dev` is running, and `yarn build` would take its `.nuxt/` out from under it.',
    'Stop the dev server, then run this again.')
}

console.log(`release: ${current} → ${version}, once the bar is green\n`)
for (const script of GREEN_BAR) yarn(script)

console.log('')
bump(manifest, /"version": "([^"]+)"/, `"version": "${version}"`, current)
bump('compose.example.yml', /perquiz:v([\w.-]+)/, `perquiz:v${version}`, current)

/*
 * The one check that could not run before the edits: `release.spec.ts` asserts
 * that the example names the version being released, and until a moment ago it
 * was asserting it about the old one. Re-run alone, it is the difference
 * between "the files were rewritten" and "the files agree".
 */
console.log('')
const pinned = spawnSync('yarn', ['vitest', 'run', 'tests/unit/release.spec.ts'], { stdio: 'inherit' })
if (pinned.status !== 0) {
  fail('the two files disagree after the bump.',
    'They are left on disk, uncommitted, for you to look at.')
}

const message = `🔖 release: ${version} — ${subject}`
git('commit', '-m', message, '--', manifest, 'compose.example.yml')

console.log(`\nrelease: committed — ${message}`)
console.log('release: no tag, no push. The workflow tags v'
  + `${version} itself, when this reaches GitHub.`)
