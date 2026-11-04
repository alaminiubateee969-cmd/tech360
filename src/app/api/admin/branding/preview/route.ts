import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { getDocumentBranding, brandingCss, brandingPadHeader, brandingPadFooter, sealHtmlFor } from '@/lib/document-branding'
import { docDate } from '@/lib/letterhead'

export const dynamic = 'force-dynamic'

// GET /api/admin/branding/preview?type=SOW|INVOICE|PROPOSAL|LETTER|LEGAL
// Returns live branded HTML preview for Super Admin (same engine as real docs)
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  const type = (req.nextUrl.searchParams.get('type') ?? 'SOW').toUpperCase()
  const branding = await getDocumentBranding(true)
  const css = brandingCss(branding)
  const issued = docDate()
  let docKind = 'Document Preview'
  let seal = ''
  let title = 'Branding Preview'
  if (type === 'SOW') { docKind = 'Scope of Work — Project Preview'; title = 'SOW Preview (with seal when enabled)'; seal = sealHtmlFor('SOW' as never, branding) }
  else if (type === 'INVOICE') { docKind = 'Official Invoice · INV-2026-0001'; title = 'Invoice Preview (with seal when enabled)'; seal = sealHtmlFor('INVOICE' as never, branding) }
  else if (type === 'PROPOSAL') { docKind = 'Work Proposal'; title = 'Work Proposal (letterhead only, no seal)'; seal = '' }
  else if (type === 'LETTER') { docKind = 'Official Letter'; title = 'Official Letter (letterhead only, no seal)'; seal = '' }
  else if (type === 'LEGAL') { docKind = 'Legal Policy · Terms & Conditions'; title = 'Legal Policy (letterhead only, no seal)'; seal = '' }

  const header = brandingPadHeader(branding, docKind)
  const footer = brandingPadFooter(branding, `Branding preview — ${title} · version ${branding.version}`)

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title} — ${branding.legalName}</title><style>${css}</style></head><body>
<main class="sheet">
${header}
<div class="meta"><div><span>Document</span><b class="brand">${title}</b></div><div><span>Branding version</span><b>v${branding.version}</b></div><div><span>Page size</span><b>${branding.pageSize}</b></div><div><span>Issued</span><b>${issued}</b></div></div>
<div class="doc">
<h2>${title}</h2>
<div class="card"><p>This is a live preview of the approved TECH360 LLC letterhead (header ${branding.headerSpacingMm}mm · footer ${branding.footerSpacingMm}mm · ${branding.pageSize}) rendered with the current Super Admin branding configuration. Header asset: <code>${branding.headerAsset}</code> · Footer asset: <code>${branding.footerAsset}</code> · Seal: ${branding.sealAsset} (${branding.sealEnabledSOW ? 'SOW ON' : 'SOW OFF'} / ${branding.sealEnabledInvoice ? 'Invoice ON' : 'Invoice OFF'}).</p></div>
<div class="card"><h3>Seal rule verification</h3><p>Seal appears ONLY on SOW and Invoice when enabled. This preview type is <b>${type}</b> — seal html is ${seal ? 'ENABLED (length '+seal.length+')' : 'DISABLED (no seal, as per policy)'}. Legal policies and official letters never show the seal regardless of toggles.</p></div>
<div style="position:relative;margin-top:24px">
  <div class="sigs">
    <div class="sig"><div class="line">Authorized signature</div><div class="who">TECH360 LLC</div><div class="role">Project Authorization · on behalf of the company</div><div class="stamp">Date: ______________</div></div>
    <div class="sig"><div class="line">Signature</div><div class="who">Preview Client</div><div class="role">Client acceptance</div><div class="stamp">Date: ______________</div></div>
  </div>
  ${seal ? `<div style="position:absolute;right:0;bottom:-8px">${seal}</div>` : ''}
</div>
<div class="note">Print this page (Ctrl+P) to verify multi-page header/footer, spacing, and that the circular seal watermark appears only where allowed.</div>
</div>
${footer}
</main></body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } })
}
