import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The three primitives, and the copies they were extracted from.
 *
 * Every one of these was a string repeated across files until somebody counted
 * them — forty-two focus rings, nine panels, seven buttons. The regression to
 * catch is not a broken component; it is the forty-third copy, pasted next
 * year by someone who never knew the primitive existed. So what is asserted
 * here is absence: the patterns must not come back.
 *
 * What no test here can do is look at the result. Both themes, on a real
 * screen, stay a human's job.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const css = readFileSync(join(ROOT, 'app/assets/css/main.css'), 'utf8')

/** Every `.vue` under `app/`, with its repo-relative path. */
function templates(): { path: string, source: string }[] {
  const found: { path: string, source: string }[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(ROOT, dir))) {
      const path = join(dir, entry)
      if (statSync(join(ROOT, path)).isDirectory()) walk(path)
      else if (entry.endsWith('.vue')) found.push({ path, source: readFileSync(join(ROOT, path), 'utf8') })
    }
  }
  walk('app')
  return found
}

const files = templates()

/** A component's template, comments stripped: what it renders, not what it says. */
function markup(source: string): string {
  const template = /<template>([\s\S]*)<\/template>/.exec(source)?.[1] ?? ''
  return template.replace(/<!--[\s\S]*?-->/g, '')
}

describe('the focus ring', () => {
  it('is stated once, in the base layer, and restated nowhere', () => {
    // `@layer base` rings every `:focus-visible` element, so a control wanting
    // the default declares nothing. Thirty-three used to declare it anyway.
    expect(css).toMatch(/:focus-visible\s*\{\s*outline: 2px solid var\(--color-torch-ink\)/)
    expect(files.filter(file => file.source.includes('focus-visible:outline')).map(file => file.path))
      .toEqual([])
  })

  it('keeps a utility only where the base rule cannot serve', () => {
    for (const name of ['focus-ring-inset', 'focus-ring-alert', 'focus-ring-within']) {
      expect(css).toContain(`@utility ${name} {`)
    }
  })

  it('never fires on a mouse click', () => {
    // The utilities carry their own `:focus-visible` precisely so that no call
    // site can reach for `focus:` instead. A ring on click is the one thing
    // these must not do.
    const utilities = css.slice(css.indexOf('@utility focus-ring-inset'))
    expect(utilities).not.toMatch(/&:focus\s*\{/)
  })
})

describe('the button components', () => {
  it('own the two tones that were copied from screen to screen', () => {
    const tones = [/bg-torch px-/, /border-edge-strong px-/]
    const offenders = files
      .filter(file => !file.path.includes('components/Button'))
      .filter(file => tones.some(tone => tone.test(file.source)))
      .map(file => file.path)

    // Two survivors, each now unique and each for a stated reason: the sign-in
    // link is a real `<a href>` to the provider, and the show's fallback wears
    // no hover because nobody hovers a projector.
    expect(offenders.sort()).toEqual(['app/pages/login.vue', 'app/pages/reveal/[cursor].vue'])
  })

  it('did not swallow what merely shares a border token', () => {
    // Inputs, chips, dotted add tiles, segmented toggles and the menu shell
    // wear `border-edge-strong` and nothing else of a button. Each still owns
    // its markup, and none of them became one.
    for (const path of [
      'app/components/room/DisplayNameField.vue', // an input, beside a real button
      'app/components/room/PhotoGrid.vue', //        the dotted add tile
      'app/components/room/StatusChip.vue', //       a chip
      'app/pages/guess/[token].vue', //              a segmented toggle
      'app/components/shell/UserMenu.vue', //        the menu shell
    ]) {
      const source = files.find(candidate => candidate.path === path)!.source
      expect(source, path).toContain('border border-edge-strong')
    }

    // The one that would be hardest to spot in review: a toggle turned into a
    // button loses its `aria-pressed`, and nothing visual would say so.
    const toggles = files.find(file => file.path === 'app/pages/guess/[token].vue')!.source
    expect(toggles).toContain('aria-pressed')
  })
})

describe('the card', () => {
  it('is the only thing that paints the panel surface', () => {
    const surface = /rounded-2xl bg-panel px-5 py-4/
    const offenders = files
      .filter(file => surface.test(file.source))
      .map(file => file.path)

    // `ThemePicker` keeps its own: a radio group is a `<fieldset>` with a
    // `<legend>`, and `<BaseCard>` renders neither.
    expect(offenders.sort()).toEqual(['app/components/BaseCard.vue', 'app/components/ThemePicker.vue'])
  })
})

describe('the dialog shell', () => {
  it('is written once, and every screen borrows it', () => {
    // Five screens rolled the same native `<dialog>` by hand. The element must
    // now appear in exactly one file: a sixth copy would come with its own
    // opinion about the focus trap, which is the part nobody gets right twice.
    //
    // Markup only — two files still MENTION the element, in a comment
    // explaining why they do not use it, and a grep that counted those would
    // be a grep nobody trusts.
    const holders = files
      .filter(file => /<dialog[\s>]/.test(markup(file.source)))
      .map(file => file.path)

    expect(holders).toEqual(['app/components/BaseDialog.vue'])
  })

  it('exposes the two methods the wrappers hand on', () => {
    // The other half of the forwarding: a shell that stops exposing `close()`
    // leaves five wrappers forwarding into nothing, and TypeScript cannot see
    // it — the wrappers type their ref by hand.
    const shell = files.find(file => file.path === 'app/components/BaseDialog.vue')!.source

    expect(shell).toMatch(/open: \(\) => dialog\.value\?\.showModal\(\)/)
    expect(shell).toMatch(/close: \(\) => dialog\.value\?\.close\(\)/)
  })

  it('has its API forwarded by every wrapper', () => {
    // Callers hold a ref to the wrapper, not to the shell. A wrapper that
    // forgets to hand `open()` on breaks its call sites at once and silently —
    // no type error, no warning, just a dialog that never appears.
    for (const path of [
      'app/components/ConfirmDialog.vue',
      'app/components/PhotoZoom.vue',
      'app/components/room/DeletePhotoDialog.vue',
      'app/components/room/PlayerPreview.vue',
    ]) {
      const source = files.find(candidate => candidate.path === path)!.source
      expect(source, path).toContain('<BaseDialog')
      expect(source, path).toMatch(/dialog\.value\?\.open\(\)/)
      expect(source, path).toMatch(/close: \(\) => dialog\.value\?\.close\(\)/)
    }
  })

  it('closes on Escape and nothing else', () => {
    // None of the five closed on a backdrop click, and adding it here would
    // change five behaviours at once. Escape is what the element already ships.
    const shell = files.find(file => file.path === 'app/components/BaseDialog.vue')!.source
    expect(shell).not.toMatch(/@click|addEventListener/)
  })
})

describe('the avatar badge', () => {
  it('is the only place the initials and the accent are drawn', () => {
    const holders = files
      .filter(file => /initialsOf|accentOf/.test(file.source))
      .map(file => file.path)

    expect(holders).toEqual(['app/components/AvatarBadge.vue'])
  })

  it('left the round things that are not people alone', () => {
    // A progress bar, the pulsing phase dot: round, and not avatars. Turning
    // them into badges would be the mistake this refactor invites.
    for (const path of [
      'app/components/room/UploadTile.vue', //     the upload progress bar
      'app/components/shell/PhaseChip.vue', //     the pulsing phase dot
      'app/components/home/ProgressPanel.vue', //  the answers bar
    ]) {
      const source = files.find(candidate => candidate.path === path)!.source
      expect(source, path).toContain('rounded-full')
      expect(source, path).not.toContain('AvatarBadge')
    }
  })
})
