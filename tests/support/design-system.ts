import { readFileSync } from 'node:fs'

/**
 * Reading the design-system tokens and computing contrast ratios.
 *
 * The CSS is the single source of truth: this module reads
 * `app/assets/css/main.css` off disk rather than copying the values, so that a
 * token changed in the CSS is measured on the next test run without anyone
 * having to remember to keep the two in sync.
 */

const CSS_PATH = new URL('../../app/assets/css/main.css', import.meta.url)

/** A token → value table, with the `--color-` prefix stripped from the names. */
export type Palette = Record<string, string>

/**
 * The body of a CSS block, with balanced braces. A plain `/\{([^}]*)\}/` will
 * not do: `@theme` contains nested `@keyframes`.
 */
function blockBody(css: string, opening: RegExp): string {
  const header = opening.exec(css)
  if (!header) throw new Error(`Block not found in main.css: ${opening}`)

  const start = css.indexOf('{', header.index)
  let depth = 0

  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(start + 1, i)
  }

  throw new Error(`Unclosed brace in main.css: ${opening}`)
}

/** A block's custom-property declarations, in source order. */
function customProperties(body: string): Palette {
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name!, value!.trim()]),
  )
}

/** Only the colour declarations, with the `color-` prefix removed. */
function colours(raw: Palette): Palette {
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([name]) => name.startsWith('color-'))
      .map(([name, value]) => [name.slice('color-'.length), value]),
  )
}

export interface DesignSystem {
  /** The dark theme's palette: the values declared in `@theme`. */
  dark: Palette
  /** The light theme's palette: `@theme` with the light overrides applied. */
  light: Palette
  /** The light overrides from the `.light` selector (the explicit choice). */
  classOverrides: Palette
  /** The light overrides from the media query (the `auto` setting). */
  mediaOverrides: Palette
  /**
   * EVERY custom property the two light blocks declare, colours and otherwise.
   * The palettes above drop anything that is not a `--color-*`, and the light
   * theme also redeclares the six frame tints — which are the copies most
   * likely to drift, being one long data URI each.
   */
  classProps: Palette
  mediaProps: Palette
  /**
   * The torchlight glow's PEAK opacity, as a fraction: the first stop of the
   * gradient, which is the most opaque point and therefore the worst case for
   * anything painted on top of it.
   */
  glowAlpha: number
  /** The scanline grain's opacity per theme, as a fraction. */
  grainAlpha: { dark: number, light: number }
  /** The mono label size, exactly as written (e.g. `0.6875rem`). */
  labelSize: string
}

/** A percentage written as `2%` or `1.4%`, as a fraction. */
function fraction(value: string | undefined, what: string): number {
  const percent = /^(\d+(?:\.\d+)?)%$/.exec(value?.trim() ?? '')
  if (!percent) throw new Error(`${what} is not a percentage in main.css: ${value}`)
  return Number(percent[1]) / 100
}

export function readDesignSystem(): DesignSystem {
  const css = readFileSync(CSS_PATH, 'utf8')

  const theme = customProperties(blockBody(css, /@theme\s*\{/))
  const classProps = customProperties(blockBody(css, /\.light\s*\{/))
  const mediaProps = customProperties(blockBody(css, /:root:not\(\.dark\)\s*\{/))
  const classOverrides = colours(classProps)
  const mediaOverrides = colours(mediaProps)

  const dark = colours(theme)

  const glow = /@utility torch-glow[\s\S]*?var\(--color-torch\)\s+(\d+(?:\.\d+)?)%/.exec(css)
  if (!glow) throw new Error('Glow opacity not found in main.css')

  const labelSize = theme['text-label']
  if (!labelSize) throw new Error('--text-label not found in main.css')

  return {
    dark,
    light: { ...dark, ...classOverrides },
    classOverrides,
    mediaOverrides,
    classProps,
    mediaProps,
    glowAlpha: Number(glow[1]) / 100,
    grainAlpha: {
      dark: fraction(theme['grain-alpha'], 'The dark grain'),
      light: fraction(classProps['grain-alpha'], 'The light grain'),
    },
    labelSize,
  }
}

/** An sRGB channel, linearised per the WCAG 2.x definition. */
function toLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function channels(hex: string): [number, number, number] {
  const raw = hex.trim().replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(raw)) throw new Error(`Unreadable colour: ${hex}`)

  return [0, 2, 4].map(i => Number.parseInt(raw.slice(i, i + 2), 16)) as [number, number, number]
}

/** Relative luminance, WCAG 2.x. */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/** The WCAG 2.x contrast ratio between two opaque colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Flattens a translucent colour onto its background, in sRGB.
 *
 * This is exactly what the browser does for a `bg-torch/20`: Tailwind v4
 * compiles the opacity modifier to
 * `color-mix(in oklab, var(--color-torch) 20%, transparent)`, and mixing a
 * colour with `transparent` under premultiplied interpolation yields precisely
 * the original colour at alpha 0.20 — the compositing onto the background then
 * happens at paint time, in sRGB.
 */
export function composite(colour: string, alpha: number, background: string): string {
  const front = channels(colour)
  const back = channels(background)

  return `#${front
    .map((value, i) => Math.round(alpha * value + (1 - alpha) * back[i]!)
      .toString(16)
      .padStart(2, '0'))
    .join('')}`
}
