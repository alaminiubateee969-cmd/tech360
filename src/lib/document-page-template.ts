// ============================================================
// TECH360 — OFFICIAL PAGE TEMPLATE
//
// WHY THIS EXISTS
// ---------------
// `DocumentBrandingConfig.letterheadAsset` previously pointed at the
// owner-supplied letterhead PNG and was then NEVER READ by any renderer: the
// invoice/receipt renderers rebuilt a letterhead out of HTML blocks
// (`brandingPadHeader` / `brandingPadFooter`). So the platform owned the
// artwork but never used it as the page, and the "reserve space for the
// header and footer" contract was hand-tuned constants rather than measured
// from the file.
//
// This module makes the supplied artwork the ACTUAL page template:
//
//   1. The letterhead is painted as a fixed, non-repeating page background
//      on the physical sheet.
//   2. Content is inset by insets MEASURED from the artwork pixels, so body
//      text can never overlap the logo, the tagline or the footer rule.
//   3. The branding repeats on EVERY printed page (the browser repaints the
//      fixed background per page when the sheet is paginated).
//
// MEASURED GEOMETRY (from public/brand/tech360-letterhead-a4.png)
// --------------------------------------------------------------
//   image            1102 x 1427 px   ratio 0.7722
//   header ink       rows 0 .. ~199    (logo + tagline + circuit lines)
//   body clear zone  rows ~200 .. ~1199 (verified blank: 0 inked rows)
//   footer ink       rows ~1200 .. 1375
//
//   As a fraction of page height:  header 14.0%, footer 9.6%, body 76.4%.
//
// INTEGRITY NOTE — the file is NOT A4
// -----------------------------------
// 0.7722 is US-Letter (215.9x279.4mm = 0.7727). A4 is 210x297mm = 0.7071.
// The default `pageSize` is 'A4' and the asset filename says "a4", but the
// artwork is Letter proportioned. Painting it as `background-size: 100% 100%`
// onto A4 would stretch it 9% vertically and distort the mark — which the
// owner explicitly forbids ("Do not distort the original artwork").
//
// So the template is OPT-IN per page size and preserves aspect ratio. For a
// page whose aspect differs from the artwork, the artwork is used whole and
// anchored to the top, and the body inset is derived from the rendered height.
// That is stated here rather than silently corrected because changing the
// canonical page size is an owner/commercial decision, not a code fix.
// ============================================================

import type { DocumentBrandingConfig, PageSize } from '@/lib/document-branding'

/** Page dimensions in mm. */
export const PAGE_MM: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  LETTER: { width: 215.9, height: 279.4 },
  A3: { width: 297, height: 420 },
}

/** The owner-supplied artwork's intrinsic pixel size. */
export const LETTERHEAD_INTRINSIC = { width: 1102, height: 1427 } as const

/** Intrinsic aspect ratio of the letterhead artwork (w/h). 0.7722. */
export const LETTERHEAD_ASPECT = LETTERHEAD_INTRINSIC.width / LETTERHEAD_INTRINSIC.height

/** Artwork ink bands, as a fraction of the image height. */
export const LETTERHEAD_INSET_FRACTION = {
  /** Header art occupies the top 14.0% of the artwork. */
  top: 0.14,
  /** Footer art starts at 84.1% (1200/1427). */
  bottom: 1375 / 1427 - 1200 / 1427 + (1427 - 1375) / 1427,
} as const

/**
 * Minimum safe body insets when the artwork is painted full-bleed, expressed
 * as a fraction of the *rendered* artwork height.
 *
 * top    → 200/1427 = 14.0%  (measured first blank row after the header)
 * bottom → (1427-1200)/1427 = 15.9% (from footer start to image bottom)
 */
export const SAFE_INSET = {
  topFraction: 200 / 1427,
  bottomFraction: (1427 - 1200) / 1427,
} as const

export type PageTemplateLayout = {
  /** CSS to inject, scoped to `selector`. */
  css: string
  /** Rendered height of the artwork on the page, in mm. */
  artworkHeightMm: number
  /** Whether the artwork aspect matched the page aspect (no distortion). */
  aspectPreserved: boolean
  /** Body inset from the top of the sheet, in mm. */
  contentTopMm: number
  /** Body inset from the bottom of the sheet, in mm. */
  contentBottomMm: number
}

/**
 * Build the print CSS that makes the supplied letterhead the real page.
 *
 * `selector` is the sheet element already used by the renderers (`.sheet`).
 * The artwork is applied to `body` so it survives pagination and repeats on
 * every page.
 */
export function letterheadPageCss(branding: DocumentBrandingConfig, selector = '.sheet'): PageTemplateLayout {
  const page = PAGE_MM[branding.pageSize] ?? PAGE_MM.A4
  const pageAspect = page.width / page.height
  const aspectPreserved = Math.abs(pageAspect - LETTERHEAD_ASPECT) < 0.005

  // If the page aspect differs from the artwork we must NOT stretch it.
  // Paint it at its true proportion, full width, anchored to the top.
  const artworkHeightMm = aspectPreserved ? page.height : page.width / LETTERHEAD_ASPECT

  // Body insets derive from how tall the artwork actually rendered.
  const contentTopMm = Math.max(
    branding.headerSpacingMm,
    artworkHeightMm * SAFE_INSET.topFraction,
  )
  const contentBottomMm = Math.max(
    branding.footerSpacingMm,
    artworkHeightMm * SAFE_INSET.bottomFraction,
  )

  const bgSize = aspectPreserved ? '100% 100%' : `100% ${artworkHeightMm}mm`
  const bgRepeat = 'no-repeat'

  const css = `
/* ---- OFFICIAL PAGE TEMPLATE (owner-supplied letterhead) ---- */
@page{size:${branding.pageSize};margin:0}
html,body{background:#fff}
body{
  background-image:url("${branding.letterheadAsset}");
  background-repeat:${bgRepeat};
  background-position:top center;
  background-size:${bgSize};
  background-attachment:fixed;
  print-color-adjust:exact;
  -webkit-print-color-adjust:exact;
}
/* Body content lives strictly inside the measured clear zone. */
${selector}{
  padding-top:${contentTopMm.toFixed(1)}mm;
  padding-bottom:${contentBottomMm.toFixed(1)}mm;
  padding-left:${branding.contentMarginMm}mm;
  padding-right:${branding.contentMarginMm}mm;
  background:transparent;
  box-shadow:none;
}
${selector} > *{background:transparent}
@media screen{
  .print-hint{display:block}
}
@media print{
  .acts,.no-print,.print-hint{display:none!important}
  ${selector}{max-width:none;margin:0;box-shadow:none}
  .card,.pay,ol.timeline li,.sigs{break-inside:avoid}
}
`.trim()

  return { css, artworkHeightMm, aspectPreserved, contentTopMm, contentBottomMm }
}

/** A short, non-deceptive note about the page geometry for the admin UI. */
export function pageTemplateNotice(branding: DocumentBrandingConfig): string {
  const layout = letterheadPageCss(branding)
  if (layout.aspectPreserved) {
    return `Official letterhead painted as the page template (${branding.pageSize}, aspect preserved).`
  }
  return `Official letterhead painted at its true proportion; it is US-Letter shaped (0.772), not ${branding.pageSize} (${(PAGE_MM[branding.pageSize].width / PAGE_MM[branding.pageSize].height).toFixed(3)}). The artwork is NOT stretched — the page shows additional white space below the artwork.`
}
