import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import sharp from 'sharp'

/**
 * Redraws the raster favicons from `public/favicon.svg`.
 *
 *   yarn favicons
 *
 * The SVG is the icon; these two files are what the SVG cannot be, and until
 * now they existed with no way to reproduce them (debt noted in vikunja-57).
 * They are not rasterised BY rendering the SVG — a renderer resolves the
 * `prefers-color-scheme` query one way and resamples on its own terms. The 72
 * cells are read out of the file and painted as whole blocks of pixels
 * instead, which is nearest-neighbour by construction: no filter to ask for,
 * no half-lit edge pixel possible, at any integer multiple of 16.
 *
 * The two files answer different constraints, so they get different ink:
 *
 * The ICO is TRANSPARENT and its ink is neither of the SVG's two colours. An
 * ICO cannot switch on the colour scheme, and a tab strip is light for some
 * people and dark for others, so a single value has to hold on both: #17a37f
 * measures 3.2:1 on a white tab and 3.8:1 on a dark one, never under 2.4:1 on
 * the inactive shades either side. Torch #4fe3c1 would be 1.6:1 on white —
 * exactly the case the SVG takes the trouble to avoid — and dark torch
 * #0a7159 falls to 2.0:1 on a dark strip. The old opaque `night` tile solved
 * the same problem by painting its own background, which is why Perquiz read
 * as a hole in the tab strip next to icons that had none (vikunja-92).
 *
 * The apple-touch icon stays OPAQUE on `night`, painted in the SVG's own
 * torch: iOS blackens transparency and rounds the corners itself, so the
 * background is a constraint rather than a choice, and the lantern is drawn at
 * 160 (10x) centred in 180 to leave the rounding a margin to eat.
 */

const SVG_PATH = new URL('../public/favicon.svg', import.meta.url)
const ICO_PATH = new URL('../public/favicon.ico', import.meta.url)
const APPLE_PATH = new URL('../public/apple-touch-icon.png', import.meta.url)

/** The lantern is drawn on a 16x16 grid; everything else is a multiple of it. */
const GRID = 16

/** What a `.ico` is expected to carry, and what Windows and old agents ask for. */
const ICO_SIZES = [16, 32, 48] as const

/** Holds on a light tab strip and on a dark one. See the note above. */
const ICO_INK = '#17a37f'

/**
 * `--color-night`, the app's darkest surface, read out of the stylesheet.
 *
 * It used to be typed here as a second copy of a value that lives in
 * `main.css`, which is a copy that drifts in silence: the apple-touch icon
 * would keep a ground the app had stopped using, on the one surface iOS
 * refuses to let be transparent. The token is the source; this reads it.
 */
function nightFromStylesheet(): string {
  const css = readFileSync(new URL('../app/assets/css/main.css', import.meta.url), 'utf8')
  const declared = /--color-night:\s*(#[0-9a-f]{6})/i.exec(css)?.[1]

  if (!declared) {
    throw new Error('favicons: --color-night is not declared in app/assets/css/main.css')
  }

  return declared.toLowerCase()
}

const NIGHT = nightFromStylesheet()

const APPLE_SIZE = 180
const APPLE_SCALE = 10

type Rgba = readonly [number, number, number, number]

function rgba(hex: string, alpha = 255): Rgba {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF, alpha]
}

/** The lit cells, as `x + y * GRID`, and the dark-scheme ink, read off the SVG. */
function readLantern(): { cells: Set<number>, ink: string } {
  const svg = readFileSync(SVG_PATH, 'utf8')
  const cells = new Set<number>()

  for (const rect of svg.matchAll(/<rect x="(\d+)" y="(\d+)"/g)) {
    cells.add(Number(rect[1]) + Number(rect[2]) * GRID)
  }

  const fill = /rect\s*\{\s*fill:\s*(#[0-9a-f]{6})/i.exec(svg)
  if (!cells.size || !fill) throw new Error('public/favicon.svg: no lantern found in it')

  return { cells, ink: fill[1]! }
}

/**
 * The lantern painted as raw RGBA: one grid cell per `scale`x`scale` block of
 * pixels, on a canvas that may be larger than the grid (the apple-touch
 * margin). `ground` transparent leaves the cells alone on nothing.
 */
function paint(cells: Set<number>, options: { canvas: number, scale: number, ink: Rgba, ground: Rgba }): Buffer {
  const { canvas, scale, ink, ground } = options
  const offset = Math.round((canvas - GRID * scale) / 2)
  const pixels = Buffer.alloc(canvas * canvas * 4)

  for (let i = 0; i < canvas * canvas; i++) pixels.set(ground, i * 4)

  for (const cell of cells) {
    const left = (cell % GRID) * scale + offset
    const top = Math.floor(cell / GRID) * scale + offset

    for (let y = top; y < top + scale; y++) {
      for (let x = left; x < left + scale; x++) pixels.set(ink, (y * canvas + x) * 4)
    }
  }

  return pixels
}

function png(pixels: Buffer, size: number): Promise<Buffer> {
  return sharp(pixels, { raw: { width: size, height: size, channels: 4 } })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer()
}

/**
 * A PNG-in-ICO container: the six-byte directory, one sixteen-byte entry per
 * image, then the PNGs. Every size here is under 256, so no entry has to
 * encode its dimension as the zero that means 256.
 */
function ico(images: readonly { size: number, png: Buffer }[]): Buffer {
  const directory = Buffer.alloc(6 + images.length * 16)
  directory.writeUInt16LE(0, 0) // reserved
  directory.writeUInt16LE(1, 2) // 1 = icon
  directory.writeUInt16LE(images.length, 4)

  let offset = directory.length

  images.forEach(({ size, png: image }, index) => {
    const entry = 6 + index * 16
    directory.writeUInt8(size, entry)
    directory.writeUInt8(size, entry + 1)
    directory.writeUInt8(0, entry + 2) // palette colours: none, it is truecolour
    directory.writeUInt8(0, entry + 3) // reserved
    directory.writeUInt16LE(1, entry + 4) // colour planes
    directory.writeUInt16LE(32, entry + 6) // bits per pixel, RGBA
    directory.writeUInt32LE(image.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += image.length
  })

  return Buffer.concat([directory, ...images.map(image => image.png)])
}

const { cells, ink } = readLantern()

const icoImages = await Promise.all(ICO_SIZES.map(async size => ({
  size,
  png: await png(paint(cells, {
    canvas: size,
    scale: size / GRID,
    ink: rgba(ICO_INK),
    ground: [0, 0, 0, 0],
  }), size),
})))

writeFileSync(ICO_PATH, ico(icoImages))
console.log(`favicons: public/favicon.ico — ${ICO_SIZES.join(', ')} px, transparent, ${ICO_INK}`)

writeFileSync(APPLE_PATH, await png(paint(cells, {
  canvas: APPLE_SIZE,
  scale: APPLE_SCALE,
  ink: rgba(ink),
  ground: rgba(NIGHT),
}), APPLE_SIZE))
console.log(`favicons: public/apple-touch-icon.png — ${APPLE_SIZE} px, ${NIGHT} ground, ${ink}`)

process.exitCode = 0
