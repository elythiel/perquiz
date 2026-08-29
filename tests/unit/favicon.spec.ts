import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

/**
 * Which icon the browser ends up showing, pinned where the decision lives.
 *
 * A config test, the same trick tests/unit/headers.spec.ts uses on the headers
 * and tests/unit/contrast.spec.ts on the CSS: the invariant lives in a
 * declaration, so the test reads the declaration.
 *
 * The invariant is counter-intuitive enough to be worth a test — it is the fix
 * for vikunja-92, and it looks like an oversight. MEASURED on Chromium 141
 * (fresh profile, incognito, network log + the browser's own Favicons
 * database): with both an SVG and an `.ico` link declared, it requests
 * `/favicon.ico` and never the SVG — whatever `sizes` either link carries,
 * in either order. Remove the `.ico` link and it requests the SVG alone and
 * rasterises the right variant (#4fe3c1 dark, #0a7159 light). Anyone
 * "completing" the head by declaring the `.ico` again turns the theme-aware
 * icon off for every Chromium user, silently.
 *
 * The file itself stays in `public/`, where anything asking for the
 * conventional path still finds it.
 */

const ROOT = new URL('../..', import.meta.url)
const config = readFileSync(new URL('nuxt.config.ts', ROOT), 'utf8')

/** The `app.head.link` array, as one string. */
const links = config.slice(config.indexOf('link: ['), config.indexOf(']', config.indexOf('link: [')))

/** What `scripts/favicons.ts` paints the raster in, and why it is neither of the SVG's colours. */
const ICO_INK = '#17a37f'

/** The images inside an ICO container, in declaration order. */
function icoImages(file: Buffer): { size: number, png: Buffer }[] {
  return Array.from({ length: file.readUInt16LE(4) }, (_, index) => {
    const entry = 6 + index * 16
    const offset = file.readUInt32LE(entry + 12)
    return { size: file.readUInt8(entry), png: file.subarray(offset, offset + file.readUInt32LE(entry + 8)) }
  })
}

/** Every colour a raster paints, transparent pixels left out, as `#rrggbb`. */
async function inks(png: Buffer): Promise<string[]> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const seen = new Set<string>()

  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] === 0) continue
    seen.add(`#${[...data.subarray(i, i + 3)].map(v => v.toString(16).padStart(2, '0')).join('')}`)
  }

  return [...seen]
}

describe('the icon a browser is told about', () => {
  it('declares the SVG, the only theme-aware one', () => {
    expect(links).toContain('{ rel: \'icon\', type: \'image/svg+xml\', href: \'/favicon.svg\' }')
  })

  it('does NOT declare the .ico — declaring it hides the SVG from Chromium', () => {
    // See the note above: this is the fix, not a forgotten line.
    expect(links).not.toContain('favicon.ico')
  })

  it('still ships the .ico, for whatever asks for the conventional path', () => {
    expect(readFileSync(new URL('public/favicon.ico', ROOT)).length).toBeGreaterThan(0)
  })
})

describe('the raster fallbacks', () => {
  const ico = icoImages(readFileSync(new URL('public/favicon.ico', ROOT)))

  it('carries the three sizes an .ico is asked for', () => {
    expect(ico.map(image => image.size)).toEqual([16, 32, 48])
  })

  it.each([0, 1, 2])('is transparent and single-inked at index %i', async (index) => {
    // An opaque tile is what made Perquiz read as a hole in the tab strip
    // (vikunja-92): its background was the colour of the chrome around it.
    // The ink is neither of the SVG's two, because an .ico cannot switch:
    // #17a37f is the one value that holds on a light strip and a dark one.
    expect(await inks(ico[index]!.png)).toEqual([ICO_INK])
  })

  it('keeps the apple-touch icon opaque on night, because iOS demands it', async () => {
    /*
     * iOS blackens transparency and rounds the corners itself, so the ground
     * is a constraint rather than a choice. It is NOT the tab-strip case.
     *
     * The expected colour is read from the stylesheet rather than typed, which
     * is the third copy this value used to have (script, test, CSS). Now the
     * token is the only one: change `--color-night` without re-running
     * `yarn favicons` and this turns red, which is the message it should have
     * been sending all along.
     */
    const css = readFileSync(new URL('app/assets/css/main.css', ROOT), 'utf8')
    const night = /--color-night:\s*#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(css)
    expect(night).not.toBeNull()

    const ground = night!.slice(1, 4).map(channel => Number.parseInt(channel, 16))
    const tile = await sharp(new URL('public/apple-touch-icon.png', ROOT).pathname).raw().toBuffer({ resolveWithObject: true })

    expect(tile.info.channels).toBe(4)
    expect([...tile.data.subarray(0, 4)]).toEqual([...ground, 255])
  })
})

describe('the rasters and the SVG draw the same lantern', () => {
  const svg = readFileSync(new URL('public/favicon.svg', ROOT), 'utf8')
  const cells = [...svg.matchAll(/<rect x="\d+" y="\d+"/g)].length

  it('lights the same 72 cells, so a redrawn SVG cannot leave them behind', async () => {
    // `yarn favicons` paints one grid cell per block of pixels; at 16px a lit
    // cell is exactly one pixel, so the count is directly comparable.
    const smallest = icoImages(readFileSync(new URL('public/favicon.ico', ROOT)))[0]!
    const { data, info } = await sharp(smallest.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    let lit = 0

    for (let i = 0; i < data.length; i += info.channels) if (data[i + 3] !== 0) lit++

    expect(cells).toBe(72)
    expect(lit).toBe(cells)
  })
})
