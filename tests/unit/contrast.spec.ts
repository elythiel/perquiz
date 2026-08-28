import { describe, expect, it } from 'vitest'
import { composite, contrast, type Palette, readDesignSystem } from '../support/design-system'

/**
 * The design system's contrast ratios, measured and not estimated, across both
 * themes.
 *
 * The values are read from `app/assets/css/main.css`: this test fails as soon
 * as a token drops below its threshold, including for a colour added later —
 * the pairs below are enumerated by token name, not hard-coded.
 */

/** WCAG 2.2: 1.4.3 for text, 1.4.11 for user-interface components. */
const TEXT = 4.5
const CONTROL = 3

const ds = readDesignSystem()

const THEMES = [['dark', ds.dark], ['light', ds.light]] as const satisfies readonly (readonly [string, Palette])[]

/** The three backgrounds content can sit on. */
const BACKGROUNDS = ['night', 'panel', 'sunken'] as const

/** Every token that carries text or an icon. */
const TEXT_TOKENS = [
  'text',
  'text-soft',
  'text-muted',
  'torch-ink',
  'clue-ink',
  'alert-ink',
  'amber-ink',
  'azure-ink',
] as const

/**
 * The tinted chips as actually used: an accent as a translucent flat fill, the
 * accent as ink on top. 10% and 15% for the phase chip (`ShellPhaseChip`), 20%
 * for the initials pill (`ShellUserChip`). They sit on `night` (page, header)
 * or `panel` (mobile nav bar), never in a sunken well.
 */
const CHIPS = [
  { flat: 'torch', alpha: 0.10, ink: 'torch-ink' },
  // 15%: the admin panel's phase control (M6). It went in unmeasured; adding
  // it here either confirms it or finds a real defect.
  { flat: 'torch', alpha: 0.15, ink: 'torch-ink' },
  { flat: 'clue', alpha: 0.15, ink: 'clue-ink' },
  { flat: 'torch', alpha: 0.20, ink: 'torch-ink' },
  { flat: 'clue', alpha: 0.20, ink: 'clue-ink' },
  { flat: 'alert', alpha: 0.20, ink: 'alert-ink' },
  { flat: 'amber', alpha: 0.20, ink: 'amber-ink' },
  { flat: 'azure', alpha: 0.20, ink: 'azure-ink' },
] as const

/** The neutral text tokens that can land inside the header's glow. */
const TEXT_OVER_GLOW = ['text', 'text-soft', 'text-muted'] as const

const pairs = <A extends readonly string[], B extends readonly string[]>(a: A, b: B) =>
  a.flatMap(x => b.map(y => [x, y] as const))

describe.each(THEMES)('%s theme', (_name, palette) => {
  describe(`text on a background (>= ${TEXT}:1)`, () => {
    it.each(pairs(TEXT_TOKENS, BACKGROUNDS))('%s on %s', (token, background) => {
      expect(contrast(palette[token]!, palette[background]!)).toBeGreaterThanOrEqual(TEXT)
    })
  })

  describe(`text on a flat accent (>= ${TEXT}:1)`, () => {
    // `on-torch` is the only text meant to sit on a solid accent fill. The
    // flats do not move between themes, so the ratio is the same in both — we
    // check it anyway, since either value could change one day.
    it('on-torch on torch', () => {
      expect(contrast(palette['on-torch']!, palette.torch!)).toBeGreaterThanOrEqual(TEXT)
    })
  })

  describe(`border that carries meaning (>= ${CONTROL}:1)`, () => {
    it.each(BACKGROUNDS)('edge-strong on %s', (background) => {
      expect(contrast(palette['edge-strong']!, palette[background]!)).toBeGreaterThanOrEqual(CONTROL)
    })

    // The `:focus-visible` ring takes the accent as INK, not as a flat fill:
    // `torch` on a white panel would be only 1.4:1.
    it.each(BACKGROUNDS)('focus ring on %s', (background) => {
      expect(contrast(palette['torch-ink']!, palette[background]!)).toBeGreaterThanOrEqual(CONTROL)
    })
  })

  describe(`tinted chip (>= ${TEXT}:1)`, () => {
    it.each(CHIPS.flatMap(chip => (['night', 'panel'] as const).map(on => ({ ...chip, on }))))(
      '$ink on $flat at $alpha, sitting on $on',
      ({ flat, alpha, ink, on }) => {
        const tint = composite(palette[flat]!, alpha, palette[on]!)
        expect(contrast(palette[ink]!, tint)).toBeGreaterThanOrEqual(TEXT)
      },
    )
  })

  describe(`text inside the torchlight glow (>= ${TEXT}:1)`, () => {
    // The glow is decorative and `aria-hidden`, but the header and the desktop
    // nav live inside it: what counts is the rendered contrast, at the centre
    // of the gradient where the glow is at its most opaque.
    it.each(TEXT_OVER_GLOW)('%s on the glow', (token) => {
      const glow = composite(palette.torch!, ds.glowAlpha, palette.night!)
      expect(contrast(palette[token]!, glow)).toBeGreaterThanOrEqual(TEXT)
    })
  })
})

describe('consistency between the two themes', () => {
  // `.light` (the explicit choice) and the media query (the `auto` setting)
  // carry the same palette, written twice because no CSS selector can express
  // "the class OR the system preference". The day one of the two copies drifts,
  // this is where it breaks.
  it('the .light class and the media query declare the same palette', () => {
    expect(ds.mediaOverrides).toStrictEqual(ds.classOverrides)
  })

  it('no light override invents a token the dark theme lacks', () => {
    expect(Object.keys(ds.classOverrides).filter(token => !(token in ds.dark))).toStrictEqual([])
  })

  it('every measured token exists in both themes', () => {
    const expected = [...TEXT_TOKENS, ...BACKGROUNDS, 'edge-strong', 'on-torch', 'torch', 'clue', 'alert', 'amber', 'azure']
    expect(expected.filter(token => !(token in ds.dark))).toStrictEqual([])
    expect(expected.filter(token => !(token in ds.light))).toStrictEqual([])
  })

  // In mono caps with 0.12em of tracking, 10px sat below the comfortable floor
  // of legibility. 11px cleared that one and not Lighthouse's: measured on
  // 2026-08-28, `.text-label` was 45–48 % of the text on the three participant
  // pages, and its mobile audit calls anything under 12px illegible. 12px is
  // the first size that satisfies both.
  it('mono labels are 12px', () => {
    expect(ds.labelSize).toBe('0.75rem')
  })
})
