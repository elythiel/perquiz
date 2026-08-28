import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The decisions behind the shared primitives — never their appearance.
 *
 * These files used to pin class strings: the exact panel surface, the exact
 * segment chrome, the two button tones by colour. Those assertions guarded a
 * refactor for a while and then became a tax on every restyle, red at each
 * legitimate change and never once catching a defect. A test that fails
 * whenever the design moves is a test somebody eventually stops reading.
 *
 * What is left is the other kind: structure and accessibility. A phase that
 * must not become a radio, a dialog that must exist once, a wrapper that has
 * to hand its API on, a ring that must not fire on a mouse click. None of it
 * mentions a colour, a radius or a spacing, so a new skin passes untouched —
 * and breaking one of them is still a defect, whatever the skin.
 */

const ROOT = new URL('../..', import.meta.url)
const css = readFileSync(new URL('app/assets/css/main.css', ROOT), 'utf8')

/** Every `.vue` under `app/`, with its repo-relative path. */
function templates(): { path: string, source: string }[] {
  const found: { path: string, source: string }[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(fileURLToPath(new URL(dir, ROOT)))) {
      const path = join(dir, entry)
      if (statSync(fileURLToPath(new URL(path, ROOT))).isDirectory()) walk(path)
      else if (entry.endsWith('.vue')) {
        found.push({ path, source: readFileSync(fileURLToPath(new URL(path, ROOT)), 'utf8') })
      }
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

const source = (path: string) => markup(files.find(file => file.path === path)!.source)

describe('the focus ring', () => {
  it('has app sources to sweep', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('is stated once and restated nowhere', () => {
    // `@layer base` rings every `:focus-visible` element, so a control wanting
    // the default declares nothing. Thirty-three used to declare it anyway.
    expect(files.filter(file => file.source.includes('focus-visible:outline')).map(file => file.path))
      .toEqual([])
  })

  it('never fires on a mouse click', () => {
    // The utilities carry their own `:focus-visible` precisely so that no call
    // site can reach for `focus:` instead. A ring on click is the one thing
    // these must not do, and it is not a matter of taste.
    const utilities = css.slice(css.indexOf('@utility focus-ring-inset'))
    expect(utilities).not.toMatch(/&:focus\s*\{/)
  })
})

describe('the dialog shell', () => {
  it('is written once, and every screen borrows it', () => {
    // Five screens rolled the same native `<dialog>` by hand. A sixth copy
    // would come with its own opinion about the focus trap, which is the part
    // nobody gets right twice.
    //
    // Markup only: two files still MENTION the element, in a comment
    // explaining why they do not use it.
    const holders = files
      .filter(file => /<dialog[\s>]/.test(markup(file.source)))
      .map(file => file.path)

    expect(holders).toEqual(['app/components/BaseDialog.vue'])
  })

  it('exposes the two methods the wrappers hand on', () => {
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
      'app/components/guess/SuspectPicker.vue',
      'app/components/room/DeletePhotoDialog.vue',
      'app/components/room/PlayerPreview.vue',
    ]) {
      const wrapper = files.find(candidate => candidate.path === path)
      if (!wrapper) continue
      expect(markup(wrapper.source), path).toContain('<BaseDialog')
      expect(wrapper.source, path).toMatch(/dialog\.value\?\.open\(\)/)
      expect(wrapper.source, path).toMatch(/close: \(\) => dialog\.value\?\.close\(\)/)
    }
  })

  it('closes on Escape and nothing else', () => {
    // None of the five closed on a backdrop click, and adding it here would
    // change five behaviours at once.
    const shell = markup(files.find(file => file.path === 'app/components/BaseDialog.vue')!.source)
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
      'app/components/room/UploadTile.vue',
      'app/components/shell/PhaseChip.vue',
      'app/components/home/ProgressPanel.vue',
    ]) {
      expect(source(path), path).not.toContain('AvatarBadge')
    }
  })
})

describe('the single choice, and the one that is confirmed first', () => {
  it('leaves the selected state to each caller, because there are two of them', () => {
    /*
     * Not folded into the shared chrome, and the reason is not style: the
     * selected option is a checked radio on one side and `aria-pressed` on the
     * other, so a single `:has(input:checked)` would light one and never the
     * other.
     */
    const segment = css.slice(css.indexOf('@utility segment {'), css.indexOf('@utility tap-target'))
    expect(segment).not.toContain(':checked')
  })

  it('gives the radio group the browser\'s own keyboard', () => {
    /*
     * A `<fieldset>` for the accessible name, native radios for the arrow keys,
     * the single tab stop and the « 2 sur 3 ». Every hand-rolled radio group
     * has to reimplement those three, and gets one of them wrong.
     */
    const group = source('app/components/RadioGroup.vue')

    expect(group).toContain('<fieldset')
    expect(group).toContain('type="radio"')
    expect(group).toContain('class="sr-only"')
    expect(group).not.toContain('role="radiogroup"')
    expect(group).not.toMatch(/@keydown|ArrowRight|ArrowDown/)
  })

  it('keeps the phase control on buttons, because a phase is confirmed first', () => {
    /*
     * The one thing a shared segmented look must not do. A radio that can be
     * refused announces `aria-checked` on a state nothing has reached, and
     * flickers back when the dialog is dismissed.
     */
    const phase = source('app/components/admin/PhaseControl.vue')

    expect(phase).toMatch(/<button/)
    expect(phase).toContain('aria-pressed')
    expect(phase).toContain('<ConfirmDialog')
    expect(phase).not.toContain('type="radio"')
    expect(phase).not.toContain('<RadioGroup')
  })

  it('keeps the sheet filter a toggle, not a link', () => {
    // Two states of one view, so they are pressed rather than navigated to.
    expect(source('app/pages/guess/[token].vue')).toContain('aria-pressed')
  })

  it('left the theme picker with nothing but the setting', () => {
    const picker = source('app/components/ThemePicker.vue')

    expect(picker).toContain('<RadioGroup')
    expect(picker).not.toContain('type="radio"')
    expect(picker).not.toContain('<fieldset')
  })
})
