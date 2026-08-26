import { randomBytes } from 'node:crypto'
import { unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

/**
 * Turning whatever a phone sent into two files we are willing to serve.
 *
 * Everything a camera knows about where and when a photo was taken is a
 * privacy problem in a game about guessing whose home this is — GPS most
 * obviously, but a timestamp narrows a room down too. So nothing that arrives
 * is ever stored: the bytes are decoded, re-encoded, and the original is
 * dropped. Stripping metadata is not a step here, it is a consequence of not
 * keeping the file.
 */

/**
 * SPEC §3: a reasonable ceiling before processing.
 *
 * Decimal megabytes, not binary: the screen says "15 Mo max", and a limit that
 * quietly accepts 15.7 would make that sentence a lie.
 */
export const MAX_UPLOAD_BYTES = 15_000_000

/** Long edge of each stored variant (SPEC §3). */
const WEB_EDGE = 1600
const THUMB_EDGE = 400

export type PhotoVariant = 'web' | 'thumb'

/** A stored photo is a random 32-hex name; nothing in it points at its owner. */
const NAME_PATTERN = /^[0-9a-f]{32}$/

export function isPhotoName(value: unknown): value is string {
  return typeof value === 'string' && NAME_PATTERN.test(value)
}

export function isPhotoVariant(value: unknown): value is PhotoVariant {
  return value === 'web' || value === 'thumb'
}

export function photoPath(name: string, variant: PhotoVariant): string {
  return join(usePhotoDirectory(), `${name}-${variant}.webp`)
}

/**
 * What the bytes actually are — never what the filename claims.
 *
 * A `.jpg` extension is a suggestion from a stranger, so the header decides.
 * HEIC is recognised on purpose even though it is refused: "this file is a
 * HEIC and here is what to do about it" is a useful thing to be told, and
 * "unsupported file" is not.
 *
 * MEASURED, 2026-08-26: sharp's prebuilt binaries parse a HEIC container —
 * `metadata()` returns 1600x1200, compression `hevc` — but cannot decode its
 * pixels, failing with "bad seek". Same result on darwin-arm64 and inside
 * node:24-alpine, which is what ships. The HEVC decoder is not in the
 * prebuilt libheif, and building libvips ourselves is not a milestone we want.
 * iOS converts to JPEG on upload in most cases anyway.
 */
export type ImageKind = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic'

export function sniffImageType(bytes: Uint8Array): ImageKind | undefined {
  const at = (offset: number, ...expected: number[]) =>
    expected.every((byte, index) => bytes[offset + index] === byte)

  if (at(0, 0xFF, 0xD8, 0xFF)) return 'image/jpeg'
  if (at(0, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) return 'image/png'

  // RIFF....WEBP
  const ascii = (offset: number, text: string) =>
    at(offset, ...[...text].map(char => char.charCodeAt(0)))
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp'

  // ISO base media: a box length, then `ftyp`, then the brand.
  if (ascii(4, 'ftyp')) {
    const brand = String.fromCharCode(...bytes.subarray(8, 12))
    const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']
    if (HEIF_BRANDS.includes(brand)) return 'image/heic'
  }

  return undefined
}

export interface StoredPhoto {
  name: string
  width: number
  height: number
}

/**
 * Writes the two variants and returns the name they share.
 *
 * `rotate()` before resizing is not cosmetic: it bakes the EXIF orientation
 * into the pixels, which is the only way an upright photo survives a
 * re-encode that throws that EXIF away. Portrait shots from a phone would
 * otherwise all land on their side.
 */
export async function storePhoto(bytes: Uint8Array): Promise<StoredPhoto> {
  const name = randomBytes(16).toString('hex')
  const source = sharp(bytes, { failOn: 'error' }).rotate()

  const render = (edge: number) => source
    .clone()
    .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true })

  const [web, thumb] = await Promise.all([render(WEB_EDGE), render(THUMB_EDGE)])

  await Promise.all([
    writeFile(photoPath(name, 'web'), web.data),
    writeFile(photoPath(name, 'thumb'), thumb.data),
  ])

  return { name, width: web.info.width, height: web.info.height }
}

/** Both variants, best effort: a missing file must not block a deletion. */
export async function removePhotoFiles(name: string): Promise<void> {
  await Promise.all((['web', 'thumb'] as const).map(variant =>
    unlink(photoPath(name, variant)).catch(() => undefined)))
}
