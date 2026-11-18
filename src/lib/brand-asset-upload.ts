/**
 * Content-verified image detection for Super Admin brand-asset uploads.
 *
 * Uploaded brand assets are written under public/brand/ and served from the
 * site's own origin, so the stored file type must come from the bytes — never
 * from the client-supplied file name or the declared MIME type. Only raster
 * formats are accepted: an unsanitised SVG (or an HTML file renamed to .png)
 * served same-origin can execute script.
 */

export type BrandImageKind = { ext: 'png' | 'jpg' | 'webp'; mime: 'image/png' | 'image/jpeg' | 'image/webp' }

export const BRAND_ASSET_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'] as const

/** Identify a PNG, JPEG or WebP image from its leading bytes; null for anything else. */
export function detectBrandImage(bytes: Uint8Array): BrandImageKind | null {
  const at = (i: number) => bytes[i]
  if (bytes.length >= 8 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47
    && at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a) {
    return { ext: 'png', mime: 'image/png' }
  }
  if (bytes.length >= 4 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' }
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' }
  }
  return null
}

export type BrandUploadCheck =
  | { ok: true; kind: BrandImageKind }
  | { ok: false; status: 400 | 415; error: string }

/**
 * Validate an upload: the content must be PNG/JPEG/WebP, and a declared MIME
 * type (when the browser sent one) must agree with the detected content.
 */
export function checkBrandAssetUpload(bytes: Uint8Array, declaredType: string): BrandUploadCheck {
  const kind = detectBrandImage(bytes)
  if (!kind) {
    return { ok: false, status: 415, error: 'Unsupported file content. Upload a PNG, JPEG or WebP image (SVG is not accepted).' }
  }
  const declared = declaredType.trim().toLowerCase()
  if (declared) {
    const normalized = declared === 'image/jpg' ? 'image/jpeg' : declared
    if (normalized !== kind.mime) {
      return { ok: false, status: 415, error: `Declared type ${declaredType} does not match the file content (${kind.mime}).` }
    }
  }
  return { ok: true, kind }
}
