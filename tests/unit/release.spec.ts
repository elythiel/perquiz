import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The version, and the tags that are no longer published.
 *
 * Nothing here runs the workflow — that only happens on GitHub. What it can do
 * is guard the two things that would break it silently from this side: a
 * version string the tag and the image name are derived from, and the moving
 * tags whose removal is the whole point of publishing per version.
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
