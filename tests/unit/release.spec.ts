import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The version, and the tags that are no longer published.
 *
 * Nothing here runs the workflow — that only happens on GitHub. What it can do
 * is guard the things that would break it silently from this side: a version
 * string the tag and the image name are derived from, the moving tags whose
 * removal is the whole point of publishing per version, and the pinning and
 * permissions that a later edit would undo without anybody noticing.
 *
 * A `latest` or a `main` coming back would not fail anything. It would just
 * quietly give a deployment something else to point at.
 */

const ROOT = new URL('../..', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, ROOT), 'utf8')

const workflow = read('.github/workflows/release.yml')
const version = JSON.parse(read('package.json')).version as string

describe('the version everything is derived from', () => {
  it('is semver, because a tag and an image name are built out of it', () => {
    // Not a loose check: `v` + this string becomes a git tag and a registry
    // reference, and neither forgives a stray space or a missing part.
    expect(version).toMatch(/^\d+\.\d+\.\d+(?:-[\w.]+)?$/)
  })

  it('is what the workflow reads, and from one place', () => {
    expect(workflow).toContain('node -p "require(\'./package.json\').version"')
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
    expect(workflow).toContain('tags: type=raw,value=v${{ needs.version.outputs.value }}')
  })

  it('is no longer a moving tag, nor the commit', () => {
    // Each of these was published until versions took over. The commit still
    // travels — as `org.opencontainers.image.revision`, from `labels:` — which
    // is what made the `sha-` tag redundant rather than merely unfashionable.
    for (const gone of ['type=sha', 'type=ref,event=branch', 'value=latest']) {
      expect(workflow, gone).not.toContain(gone)
    }
    expect(workflow).toContain('labels: ${{ steps.meta.outputs.labels }}')
  })
})

describe('the guard that makes it once per version', () => {
  it('holds the publish back until the version is new', () => {
    expect(workflow).toContain('if: needs.version.outputs.unpublished == \'true\'')
  })

  it('can see the tags it asks about', () => {
    // A shallow clone has none, and the guard would answer "never published"
    // on every push — republishing exactly what this stops.
    expect(workflow).toContain('fetch-depth: 0')
  })

  it('may write the tag it publishes', () => {
    expect(workflow).toContain('contents: write')
  })

  it('checks every push, and publishes only some', () => {
    // The gate is the release, never the verification.
    expect(workflow).toMatch(/needs: \[version, check\]/)
    for (const script of ['yarn lint', 'yarn typecheck', 'yarn test']) {
      expect(workflow, script).toContain(script)
    }
  })
})

/**
 * The pinning, and the two halves that only work together.
 *
 * A tag is mutable: whoever owns an action can move `v4` onto other code, and
 * this workflow may push a tag and an image. A digest cannot move. But a digest
 * nobody updates is a version that will never receive a fix either — so pinning
 * alone trades one risk for another, and what makes it a hardening is the bot
 * that keeps the digests fresh.
 *
 * Neither half is taste, which is why both are pinned here while the durations
 * and the easings elsewhere are not.
 */
describe('the actions the workflow runs', () => {
  const uses = [...workflow.matchAll(/uses:\s*(\S+)/g)].map(match => match[1]!)

  it('has some to sweep', () => {
    // Cheap guard against the regex quietly finding nothing and every
    // assertion below passing over an empty list.
    expect(uses.length).toBeGreaterThan(5)
  })

  it('pins every one to a digest, never to a tag', () => {
    // The failure this catches is not a rewrite: it is the seventh action,
    // added months from now, arriving as `@v1` because that is what the
    // documentation shows.
    expect(uses.filter(ref => !/@[0-9a-f]{40}$/.test(ref))).toEqual([])
  })

  it('says which version each digest is', () => {
    // Not decoration: Dependabot reads that comment to know what it is
    // upgrading from, and a reader needs it to know what is pinned at all —
    // a bare digest says nothing a human can act on.
    const commented = [...workflow.matchAll(/uses:\s*\S+@[0-9a-f]{40}\s*#\s*v\S+/g)]
    expect(commented).toHaveLength(uses.length)
  })

  it('has something keeping those digests fresh', () => {
    // Without this the pins are a freeze, and the trade stops being worth it.
    const dependabot = read('.github/dependabot.yml')
    expect(dependabot).toContain('package-ecosystem: github-actions')
  })
})

describe('what the workflow is allowed to do', () => {
  it('grants nothing at the root beyond reading', () => {
    /*
     * Least privilege where a job that says nothing lands. Without this block
     * the read-only jobs inherit the repository default, which is a setting in
     * a place nobody looks — and on a public repository, one that can be
     * widened without touching this file.
     */
    expect(workflow).toMatch(/^permissions:\n {2}contents: read$/m)
  })

  it('leaves the publish job its own, wider block', () => {
    // Job permissions REPLACE the root ones rather than adding to them, so the
    // one job that pushes a tag and an image has to name both itself. If this
    // and the assertion above ever disagree, the release stops at a 403.
    expect(workflow).toContain('contents: write')
    expect(workflow).toContain('packages: write')
  })
})
