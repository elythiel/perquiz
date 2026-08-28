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

/**
 * The same CSS with its comments removed: what the browser is told, not what
 * the file explains to a reader. main.css is more prose than declaration, and
 * a rule quoted in a comment to say why it is NOT written is exactly what a
 * regex over the raw file would find first.
 */
const declared = css.replace(/\/\*[\s\S]*?\*\//g, '')

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
    //
    // Suppressing the ring is a different act from restating it, and it has its
    // own guard below — so what is forbidden here is any call site that spells
    // out a ring of its own.
    const restated = files.flatMap(({ path, source }) =>
      [...source.matchAll(/focus-visible:outline-[\w[\]-]+/g)]
        .filter(([declaration]) => declaration !== 'focus-visible:outline-none')
        .map(([declaration]) => `${path}: ${declaration}`))

    expect(restated).toEqual([])
  })

  it('is dropped only where the frame itself answers the focus', () => {
    /*
     * One control suppresses the ring, and the list is here so that the second
     * one has to be a decision somebody wrote down.
     *
     * The display-name field recolours its own frame on focus — `edge` at rest,
     * `torch` while you are in it — so the outline was a second indicator on
     * the same border, and two indicators on one border read as two borders.
     *
     * It does not generalise, which is the whole reason for pinning it: no
     * other framed control recolours on focus. A segment option's tint follows
     * its SELECTION, so for it the ring is the only thing that says where the
     * keyboard is, and taking it away would leave nothing at all.
     */
    const suppressors = files
      .filter(file => file.source.includes('focus-visible:outline-none'))
      .map(file => file.path)

    expect(suppressors).toEqual(['app/components/room/DisplayNameField.vue'])
  })

  it('never fires on a mouse click', () => {
    // The utilities carry their own `:focus-visible` precisely so that no call
    // site can reach for `focus:` instead. A ring on click is the one thing
    // these must not do, and it is not a matter of taste.
    const utilities = css.slice(css.indexOf('@utility focus-ring-inset'))
    expect(utilities).not.toMatch(/&:focus\s*\{/)
  })
})

describe('the hit area that grows without the control growing', () => {
  it('is only asked for by controls that are positioned', () => {
    /*
     * `@utility tap-target` says it in its own comment: the control must
     * already be positioned. It is not a style note. The pseudo-element is
     * `position: absolute` and sized `max(100%, 44px)`, so on a static control
     * both the containing block and that `100%` come from the nearest
     * positioned ANCESTOR — and the target silently becomes the size of
     * whatever that ancestor is.
     *
     * It cost two buttons on the photo tile: the reorder arrows each claimed
     * the entire photograph, and the later one in the DOM won every click, so
     * tapping the left arrow moved the photo right. Nothing threw, nothing
     * looked wrong, and the visible buttons were exactly where they belonged.
     *
     * The utility cannot set `position` itself — it would fight the `absolute`
     * on the controls that need the target most — so the contract is checked
     * here instead of assumed.
     */
    const offenders = files.flatMap(({ path, source }) =>
      [...markup(source).matchAll(/class="([^"]*\btap-target\b[^"]*)"/g)]
        .filter(([, value]) => !/(?<![-\w])(relative|absolute|fixed|sticky)(?![-\w])/.test(value!))
        .map(() => path))

    expect(offenders).toEqual([])
  })
})

describe('the gradient inside a frame', () => {
  it('is positioned on the border box, or it tiles into the band', () => {
    /*
     * `background-origin: border-box` on `@utility frame`, and it is load
     * bearing rather than tidy.
     *
     * A gradient is a background IMAGE. It is positioned in the
     * `background-origin` area — the padding box by default — and painted
     * across the `background-clip` area, the border box. The nine pixels of
     * band belong to the second and not the first, so the browser tiles the
     * image to cover them: the left band ends up showing the ramp's far end and
     * the right band its start. Two bright-and-dark strips on the wrong sides.
     *
     * `background-color` is immune, having no geometry to tile, which is why
     * only the two gradient blocks ever looked wrong — the leaderboard row and
     * the podium step — and why the defect survived a whole review pass looking
     * like a mask problem.
     */
    expect(declared.slice(declared.indexOf('@utility frame {'), declared.indexOf('@utility frame-fill')))
      .toContain('background-origin: border-box')
  })
})

describe('the components a `:is` switches between', () => {
  it('names them as components, never as strings', () => {
    /*
     * The other defect that renders perfectly and does nothing.
     *
     * `<component :is="'NuxtLink'">` resolves that name at RUNTIME, and Nuxt
     * auto-imports at compile time — so a component whose name only ever
     * appears inside quotes is one the transform never sees.
     * `resolveDynamicComponent` falls through to treating it as an element
     * name, and the page ships a literal `<NuxtLink to="…">` tag: styled, laid
     * out, indistinguishable, and navigating nowhere. Both button primitives
     * shipped that way, and it took a pair of eyes on the dashboard rather than
     * anything automated.
     *
     * A quoted name starting with a capital is the whole tell. Element names
     * are lowercase, so `:is="titled ? 'section' : 'div'"` is fine and always
     * will be.
     */
    const offenders = files.flatMap(({ path, source }) =>
      [...markup(source).matchAll(/:is="([^"]*)"/g)]
        .filter(([, expression]) => /'[A-Z]/.test(expression!))
        .map(([, expression]) => `${path}: ${expression}`))

    expect(offenders).toEqual([])
  })
})

describe('the mask that cuts a flat to the frame', () => {
  it('is asked for by every framed block that has a flat to cut', () => {
    /*
     * The rule was already written down — in `@utility segment-group`, of all
     * places: "a flat that is not the page's own ground has to be cut to the
     * frame, or its four square corners say the opposite of the frame around
     * them". Written and not checked, so eleven blocks quietly disagreed with
     * it: a dialog, a podium step, two login panels, the reveal link on the
     * admin screen. Each drew an octagonal frame with a square of colour
     * sitting outside it, which does not read as a style, it reads as broken.
     *
     * The first version of this test exempted `bg-night`, on the grounds that
     * `night` IS the page's ground so an uncut corner there would show exactly
     * the colour already behind it. That was wrong, and the dashboard gauge is
     * where it showed: the page's ground is not a flat colour. It carries the
     * scanline grain everywhere and the torchlight glow across the top-left, so
     * an OPAQUE `bg-night` block covers both, and its uncut corners read as
     * darker, un-grained squares against the page. There is no colour a block
     * can paint that matches a ground made of three layers.
     *
     * `bg-transparent` stays exempt, and that one is sound: there is no flat to
     * cut. It only ever appears as the field's read-only state.
     *
     * Element by element, `class` and `:class` read together: the flat is often
     * in the conditional half and the frame in the static one.
     */
    const GROUND = new Set(['bg-transparent'])

    const uncut = files.flatMap(({ path, source }) =>
      [...markup(source).matchAll(/<[a-zA-Z][^>]*>/g)]
        .map(([tag]) => ({
          tag,
          classes: [...tag.matchAll(/(?<![-\w]):?class="([^"]*)"/g)].map(([, value]) => value).join(' '),
        }))
        .filter(({ classes }) => /\bframe(-flush)?\b/.test(classes) && !classes.includes('frame-fill'))
        .flatMap(({ classes }) =>
          [...classes.matchAll(/(?<![-\w])(bg-(?!clip|blend|none)[\w./[\]%-]+)(?![-\w])/g)]
            .map(([, flat]) => flat!)
            .filter(flat => !GROUND.has(flat))
            .map(flat => `${path}: ${flat}`)))

    expect(uncut).toEqual([])
  })

  it('keeps the middle region, in every declaration that draws it', () => {
    /*
     * The one line whose absence deletes a control.
     *
     * A mask sliced at 3 is cut into nine regions and the middle one is
     * DISCARDED unless `fill` asks for it — same rule as `border-image`, and no
     * warning either way. Without the keyword, `frame-fill` masks everything
     * but a 3px ring: the primary button renders as an empty frame with no
     * torch and no label inside it. It shipped that way once, found by eye and
     * not by anything here, on a skin where fourteen blocks wear this utility.
     *
     * Both spellings are checked because both are written: `mask-border` is the
     * standard name that Chrome drops, `-webkit-mask-box-image` is the one it
     * acts on — so the prefixed declaration is precisely the one that must not
     * be the careless copy.
     */
    const declarations = [...declared.matchAll(/(-webkit-mask-box-image|mask-border):\s*([^;]+);/g)]

    expect(declarations.length).toBeGreaterThan(0)
    for (const [, property, value] of declarations) {
      expect(value, property).toMatch(/\bfill\b/)
    }
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
