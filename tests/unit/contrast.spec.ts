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
  // 15% amber: the `preparation` phase chip.
  { flat: 'amber', alpha: 0.15, ink: 'amber-ink' },
  // 15% alert: the third of the three tints `<BaseMessage>` fills with, and
  // the one this table was missing. The other two were already here by way of
  // the chips; a message wears the same pair on the same two grounds.
  { flat: 'alert', alpha: 0.15, ink: 'alert-ink' },
  { flat: 'torch', alpha: 0.20, ink: 'torch-ink' },
  { flat: 'clue', alpha: 0.20, ink: 'clue-ink' },
  { flat: 'alert', alpha: 0.20, ink: 'alert-ink' },
  { flat: 'amber', alpha: 0.20, ink: 'amber-ink' },
  { flat: 'azure', alpha: 0.20, ink: 'azure-ink' },
] as const

/** The neutral text tokens that can land inside the header's glow. */
const TEXT_OVER_GLOW = ['text', 'text-soft', 'text-muted'] as const

/**
 * The pixel frames, by the token each one's SVG is filled with.
 *
 * These became BORDERS THAT CARRY MEANING with the HD-2D skin, and that is the
 * whole reason they are enumerated here. The frame is not decoration any more:
 * it is what tells a field at rest from a field in error, the phase the game is
 * in, the tab you are on. WCAG 1.4.11 puts every one of them at 3:1.
 *
 * Enumerated by token name and not by hex, so a tint whose ink moves is
 * remeasured without anyone remembering to come back here.
 */
const FRAME_TINTS = [
  'torch-ink',
  'clue-ink',
  'alert-ink',
  'amber-ink',
  'azure-ink',
  'edge-strong',
] as const

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

  describe(`frame tint on a background (>= ${CONTROL}:1)`, () => {
    it.each(pairs(FRAME_TINTS, BACKGROUNDS))('%s frame on %s', (tint, background) => {
      expect(contrast(palette[tint]!, palette[background]!)).toBeGreaterThanOrEqual(CONTROL)
    })

    // The one frame that does not sit on a background: `on-torch` is the line
    // around a torch flat — the primary button, the tab you are on — so what it
    // has to be legible against is the flat it encloses.
    it('on-torch frame on the torch flat', () => {
      expect(contrast(palette['on-torch']!, palette.torch!)).toBeGreaterThanOrEqual(CONTROL)
    })
  })

  describe(`text over the two decorative layers (>= ${TEXT}:1)`, () => {
    /*
     * The glow and the grain are both decorative and both `aria-hidden`, and
     * the header and the desktop nav live on top of BOTH: the scanline lifts
     * the night, the glow washes over that, and the nav's links are written on
     * what comes out. So the pair is composited in the order the browser paints
     * it, and measured at the centre of the gradient — the grain's own line
     * rather than the gap beside it, and the glow at its peak.
     *
     * Which is to say: the worst case, twice over. The alphas that pass here
     * are what caps how strong either layer is allowed to get, and lifting one
     * without measuring is how the desktop nav quietly drops below AA.
     */
    const grained = composite(palette.text!, ds.grainAlpha[_name], palette.night!)
    const lit = composite(palette.torch!, ds.glowAlpha, grained)

    it.each(TEXT_OVER_GLOW)('%s on the grain under the glow', (token) => {
      expect(contrast(palette[token]!, lit)).toBeGreaterThanOrEqual(TEXT)
    })

    // And on the grain alone, which is every other screenful of the app.
    it.each(TEXT_TOKENS)('%s on the grain', (token) => {
      expect(contrast(palette[token]!, grained)).toBeGreaterThanOrEqual(TEXT)
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

  it('the two light blocks agree on everything, frame tints included', () => {
    // The colour comparison above only sees `--color-*`. The frame tints are a
    // data URI each, redeclared in both blocks, and a hex mistyped in one of
    // the two copies is exactly the drift nobody would spot by reading.
    expect(ds.mediaProps).toStrictEqual(ds.classProps)
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
