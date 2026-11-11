import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  LETTERHEAD_ASPECT,
  LETTERHEAD_INTRINSIC,
  PAGE_MM,
  letterheadPageCss,
  pageTemplateNotice,
} from '../src/lib/document-page-template'
import { getDefaultBranding } from '../src/lib/document-branding'

const branding = getDefaultBranding()

describe('official page template — the supplied letterhead is the actual page', () => {
  it('paints the owner letterhead as the page background (not dead config)', () => {
    const { css } = letterheadPageCss(branding)
    assert.match(css, /background-image:url\("\/brand\/tech360-letterhead-a4\.png"\)/)
    assert.match(css, /background-repeat:no-repeat/)
    // Must be a page-level background, not a decorative inline block.
    assert.match(css, /body\{/)
  })

  it('reserves body space measured from the artwork clear zone', () => {
    const layout = letterheadPageCss(branding)
    // Insets are measured against the RENDERED ARTWORK height, because the
    // artwork is anchored to the top of the sheet and may be shorter than the
    // page (see the Letter-vs-A4 note). Measuring against page height would
    // under-reserve on a page taller than the artwork.
    const art = layout.artworkHeightMm
    // Header art ends at row 200 of 1427 → ≥13.9% of artwork height.
    assert.ok(layout.contentTopMm >= art * 0.139, `top inset too small: ${layout.contentTopMm} vs art ${art}`)
    // Footer art starts at row 1200 → ≥15.8% reserved at the bottom.
    assert.ok(layout.contentBottomMm >= art * 0.158, `bottom inset too small: ${layout.contentBottomMm} vs art ${art}`)
    // And the two together must not consume the whole sheet.
    assert.ok(layout.contentTopMm + layout.contentBottomMm < PAGE_MM[branding.pageSize].height,
      'insets leave no room for body content')
  })

  it('never stretches the artwork when the page aspect does not match', () => {
    const layout = letterheadPageCss(branding)
    // A4 is 0.7071; the artwork is 0.7722 (US Letter). They differ, so the
    // template must NOT use background-size:100% 100%.
    assert.equal(layout.aspectPreserved, false)
    const { css } = layout
    assert.doesNotMatch(css, /background-size:100% 100%/)
    assert.match(css, /background-size:100% [\d.]+mm/)
  })

  it('preserves aspect exactly when the page does match the artwork', () => {
    const letter = getDefaultBranding()
    letter.pageSize = 'LETTER'
    const layout = letterheadPageCss(letter)
    assert.equal(layout.aspectPreserved, true)
    assert.match(layout.css, /background-size:100% 100%/)
    assert.ok(Math.abs(layout.artworkHeightMm - PAGE_MM.LETTER.height) < 0.001)
  })

  it('states the Letter-vs-A4 discrepancy honestly instead of hiding it', () => {
    const notice = pageTemplateNotice(branding)
    assert.match(notice, /US-Letter/i)
    assert.match(notice, /NOT stretched/i)
  })

  it('pins the measured geometry constants to the real asset ratio', () => {
    assert.equal(LETTERHEAD_INTRINSIC.width, 1102)
    assert.equal(LETTERHEAD_INTRINSIC.height, 1427)
    assert.ok(Math.abs(LETTERHEAD_ASPECT - 1102 / 1427) < 1e-9)
    assert.ok(LETTERHEAD_ASPECT > 0.77 && LETTERHEAD_ASPECT < 0.78)
  })

  it('renders every branding asset referenced by the config from a real file', () => {
    for (const key of ['letterheadAsset', 'logoAsset', 'sealAsset', 'headerAsset', 'footerAsset'] as const) {
      const path = (branding as unknown as Record<string, string>)[key]
      assert.ok(path, `${key} missing`)
      assert.equal(existsSync(`public${path}`), true, `${key} → public${path} does not exist`)
    }
  })

  it('quotes every asset path used by documents that must not be a public URL leak', () => {
    // GeneratedDocument stores a PRIVATE fileLocation; the *branding* assets are
    // intentionally public. Guard the distinction so nobody swaps them.
    const src = readFileSync('src/lib/document-branding.ts', 'utf8')
    assert.match(src, /logoAsset: '\/brand\/tech360-logo-owner\.jpg'/)
    assert.match(src, /sealAsset: '\/brand\/tech360-seal-approved\.png'/)
    assert.doesNotMatch(src, /logoAsset: '\/brand\/tech360-logo-original\.jpg'/)
  })
})
