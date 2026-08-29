import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The version, the tags that are no longer published, and the two workflow
 * files that split the job between them.
 *
 * Nothing here runs a workflow — that only happens on GitHub. What it can do is
 * guard the things that would break it silently from this side: a version
 * string the tag and the image name are derived from, the moving tags whose
 * removal is the whole point of publishing per version, and the pinning and
 * permissions that a later edit would undo without anybody noticing.
 *
 * A `latest` or a `main` coming back would not fail anything. It would just
 * quietly give a deployment something else to point at.
 *
 * SINCE THE SPLIT (vikunja-90), read the two files apart from each other:
 * `ci.yml` verifies pull requests, `release.yml` publishes from `main`, and an
 * assertion aimed at the wrong one passes for the wrong reason. The groups
 * below say which file each invariant belongs to — except the last two, which
 * hold of the CI as a whole and therefore sweep BOTH. That distinction is the
 * trap: a rule left reading one file would still be green while a new workflow
 * arrived with actions pinned to tags and permissions inherited from a
 * repository setting.
 */

const ROOT = new URL('../..', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, ROOT), 'utf8')

const ci = read('.github/workflows/ci.yml')
const release = read('.github/workflows/release.yml')

/** Every workflow, for the invariants that are about the CI rather than a file. */
const WORKFLOWS = [['ci.yml', ci], ['release.yml', release]] as const satisfies readonly (readonly [string, string])[]

const version = JSON.parse(read('package.json')).version as string

describe('the version everything is derived from', () => {
  it('is semver, because a tag and an image name are built out of it', () => {
    // Not a loose check: `v` + this string becomes a git tag and a registry
    // reference, and neither forgives a stray space or a missing part.
    expect(version).toMatch(/^\d+\.\d+\.\d+(?:-[\w.]+)?$/)
  })

  it('is what the release workflow reads, and from one place', () => {
    expect(release).toContain('node -p "require(\'./package.json\').version"')
  })
})

describe('the example nobody would notice going stale', () => {
  it('names the version being released', () => {
    /*
     * `compose.example.yml` is what a reader copies to deploy, and its own
     * comment says this line tracks the published versions — there is no
     * `latest` to fall back on, by design. Left behind at a bump it does not
     * break anything: it just quietly starts a fresh deployment on the previous
     * image, which is the kind of defect that is only ever found in production.
     *
     * Pinned to `package.json` so the bump stays one decision. If the example
     * should ever lag the release on purpose, this is the test to delete and
     * the comment above the image line to rewrite.
     */
    expect(read('compose.example.yml')).toContain(`perquiz:v${version}`)
  })
})

describe('what the registry receives', () => {
  it('is one tag, and it is the version', () => {
    expect(release).toContain('tags: type=raw,value=v${{ needs.version.outputs.value }}')
  })

  it('is no longer a moving tag, nor the commit', () => {
    // Each of these was published until versions took over. The commit still
    // travels — as `org.opencontainers.image.revision`, from `labels:` — which
    // is what made the `sha-` tag redundant rather than merely unfashionable.
    for (const gone of ['type=sha', 'type=ref,event=branch', 'value=latest']) {
      expect(release, gone).not.toContain(gone)
    }
    expect(release).toContain('labels: ${{ steps.meta.outputs.labels }}')
  })
})

describe('the guard that makes it once per version', () => {
  it('holds the publish back until the version is new', () => {
    expect(release).toContain('if: needs.version.outputs.unpublished == \'true\'')
  })

  it('can see the tags it asks about', () => {
    // A shallow clone has none, and the guard would answer "never published"
    // on every push — republishing exactly what this stops.
    expect(release).toContain('fetch-depth: 0')
  })

  it('may write the tag it publishes', () => {
    expect(release).toContain('contents: write')
  })
})

describe('what a pull request is checked with', () => {
  it('runs the three scripts a merge is gated on', () => {
    /*
     * The verification lives in `ci.yml` alone since the split, and this is the
     * file branch protection names as a required check. The scripts are pinned
     * here because dropping one would leave the gate green while checking less
     * — `yarn typecheck` quietly gone is a merge that compiles nowhere.
     */
    for (const script of ['yarn lint', 'yarn typecheck', 'yarn test']) {
      expect(ci, script).toContain(script)
    }
  })

  it('is triggered by the pull request itself, before a merge and not after', () => {
    /*
     * Half of the reason that file is worth anything: `check` has to run BEFORE
     * a merge. Without this trigger nothing verified a pull request at all —
     * measured on Dependabot's first, which reported zero check runs while
     * carrying six major action bumps (vikunja-89).
     *
     * Its removal would be silent, and now more so than before: `ci.yml` has no
     * other trigger left, so it would simply never run again.
     */
    expect(ci).toMatch(/^ {2}pull_request:$/m)
  })
})

/**
 * The pinning, and the two halves that only work together.
 *
 * A tag is mutable: whoever owns an action can move `v4` onto other code, and
 * this repository runs a workflow that pushes a tag and an image. A digest
 * cannot move. But a digest nobody updates is a version that will never receive
 * a fix either — so pinning alone trades one risk for another, and what makes
 * it a hardening is the bot that keeps the digests fresh.
 *
 * Neither half is taste, which is why both are pinned here while the durations
 * and the easings elsewhere are not.
 *
 * Every rule in this group sweeps BOTH workflows: the eight pinned `uses:` were
 * split between them, and a rule reading one file would guard half a CI.
 */
describe.each(WORKFLOWS)('the actions %s runs', (name, workflow) => {
  const uses = [...workflow.matchAll(/uses:\s*(\S+)/g)].map(match => match[1]!)

  it('has some to sweep', () => {
    // Cheap guard against the regex quietly finding nothing and every
    // assertion below passing over an empty list. Two is the floor a workflow
    // that does anything meets — `ci.yml` checks out and sets up node.
    expect(uses.length).toBeGreaterThan(1)
  })

  it('pins every one to a digest, never to a tag', () => {
    // The failure this catches is not a rewrite: it is the next action, added
    // months from now, arriving as `@v1` because that is what the
    // documentation shows — or a whole new workflow file arriving that way.
    expect(uses.filter(ref => !/@[0-9a-f]{40}$/.test(ref))).toEqual([])
  })

  it('says which version each digest is', () => {
    // Not decoration: Dependabot reads that comment to know what it is
    // upgrading from, and a reader needs it to know what is pinned at all —
    // a bare digest says nothing a human can act on.
    const commented = [...workflow.matchAll(/uses:\s*\S+@[0-9a-f]{40}\s*#\s*v\S+/g)]
    expect(commented).toHaveLength(uses.length)
  })
})

describe('what keeps those digests fresh', () => {
  it('is configured, so the pins are not a freeze', () => {
    // Without this the pins are a freeze, and the trade stops being worth it.
    // Dependabot sweeps the whole directory, so it followed the split without
    // a line of configuration.
    expect(read('.github/dependabot.yml')).toContain('package-ecosystem: github-actions')
  })
})

describe.each(WORKFLOWS)('what %s is allowed to do', (name, workflow) => {
  it('grants nothing at the root beyond reading', () => {
    /*
     * Least privilege where a job that says nothing lands. Without this block
     * the read-only jobs inherit the repository default, which is a setting in
     * a place nobody looks — and on a public repository, one that can be
     * widened without touching these files.
     *
     * Swept over both, because the file that arrives without this block is the
     * one nobody thought to give it.
     */
    expect(workflow).toMatch(/^permissions:\n {2}contents: read$/m)
  })
})

describe('what the publish job alone is allowed to do', () => {
  it('has its own, wider block', () => {
    // Job permissions REPLACE the root ones rather than adding to them, so the
    // one job that pushes a tag and an image has to name both itself. If this
    // and the root assertion above ever disagree, the release stops at a 403.
    expect(release).toContain('contents: write')
    expect(release).toContain('packages: write')
  })
})
