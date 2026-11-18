import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { checkBrandAssetUpload, detectBrandImage } from '../src/lib/brand-asset-upload'

/**
 * Regression: the Super Admin brand upload took the stored extension from the
 * client file name and skipped the MIME check when no type was declared, so an
 * HTML or scripted SVG file could be written to public/brand/ and served from
 * this origin. Content is now verified by magic bytes and the extension comes
 * from the detected format.
 */
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1])
const webp = new TextEncoder().encode('RIFF\x24\x00\x00\x00WEBPVP8 ')
const html = new TextEncoder().encode('<html><script>alert(document.cookie)</script></html>')
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>')

describe('brand asset upload — content-verified raster images only', () => {
  it('detects PNG, JPEG and WebP from their bytes', () => {
    assert.deepEqual(detectBrandImage(png), { ext: 'png', mime: 'image/png' })
    assert.deepEqual(detectBrandImage(jpeg), { ext: 'jpg', mime: 'image/jpeg' })
    assert.deepEqual(detectBrandImage(webp), { ext: 'webp', mime: 'image/webp' })
  })

  it('rejects HTML and SVG content even when no type is declared', () => {
    for (const bytes of [html, svg]) {
      const res = checkBrandAssetUpload(bytes, '')
      assert.equal(res.ok, false)
      if (!res.ok) assert.equal(res.status, 415)
    }
  })

  it('rejects HTML disguised with a declared image type', () => {
    const res = checkBrandAssetUpload(html, 'image/png')
    assert.equal(res.ok, false)
  })

  it('rejects a declared type that disagrees with the content', () => {
    const res = checkBrandAssetUpload(png, 'image/jpeg')
    assert.equal(res.ok, false)
    if (!res.ok) assert.match(res.error, /does not match/)
  })

  it('accepts matching declarations, image/jpg alias and a missing declaration', () => {
    assert.equal(checkBrandAssetUpload(png, 'image/png').ok, true)
    assert.equal(checkBrandAssetUpload(jpeg, 'image/jpg').ok, true)
    const res = checkBrandAssetUpload(webp, '')
    assert.equal(res.ok, true)
    if (res.ok) assert.equal(res.kind.ext, 'webp')
  })

  it('the upload route derives the extension from verified content, not the file name', () => {
    const src = readFileSync('src/app/api/admin/branding/route.ts', 'utf8')
    assert.match(src, /checkBrandAssetUpload\(bytes, /)
    assert.match(src, /const ext = checked\.kind\.ext/)
    assert.doesNotMatch(src, /file\.name\.split/)
    assert.doesNotMatch(src, /image\/svg\+xml/)
    assert.match(src, /guard\(req, \{ minRole: 'SUPER_ADMIN' \}\)/)
  })
})
