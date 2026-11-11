import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { getDocumentBranding, brandingCss, brandingPadHeader, brandingPadFooter, sealHtmlFor } from '@/lib/document-branding'
import { docDate, padMeta, padSignatures } from '@/lib/letterhead'
import { escapeHtml } from '@/lib/comms'

export const dynamic = 'force-dynamic'

const SAMPLES = ['WORK_PROPOSAL', 'SOW', 'INVOICE', 'OFFICIAL_LETTER', 'TERMS', 'PRIVACY', 'REFUND'] as const

// GET /api/admin/branding/sample?type=SOW  — generate a sample document HTML using live branding
// Super Admin only. Used by Settings → Document Branding to generate sample PDFs.
// Also powers the 7 required acceptance samples.
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  const raw = (req.nextUrl.searchParams.get('type') ?? 'SOW').toUpperCase().replace(/[\s-]+/g, '_')
  const type = SAMPLES.includes(raw as never) ? (raw as typeof SAMPLES[number]) : 'SOW'
  const branding = await getDocumentBranding(true)
  const css = brandingCss(branding)
  const issued = docDate()
  const clientName = 'Acme Corporation'
  const clientId = 'TECH-2026-000042'

  let docKind = type.replace(/_/g, ' ')
  let htmlBody = ''
  let sealHtml = ''
  let metaItems: Array<{ label: string; value: string; brand?: boolean }> = []

  if (type === 'WORK_PROPOSAL') {
    docKind = 'Work Proposal — Acme Corporation Website Redesign'
    metaItems = [
      { label: 'Proposal', value: 'PROP-2026-0001', brand: true },
      { label: 'Client ID', value: clientId },
      { label: 'Issued', value: issued },
      { label: 'Valid until', value: '2026-12-31' },
    ]
    htmlBody = `
      <h2>Executive Summary</h2>
      <div class="card"><p>Acme Corporation has engaged TECH360 LLC to redesign its corporate website for performance, accessibility, and lead generation. This proposal outlines objectives, deliverables, timeline, and investment.</p></div>
      <h2>Objectives</h2><div class="card"><p>Modern responsive design, CMS, SEO foundations, lead capture automation.</p></div>
      <h2>Investment</h2><table class="inv-table"><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th></tr></thead><tbody><tr><td>Discovery &amp; Design System</td><td class="num">1</td><td class="num">USD 3,500.00</td><td class="num">USD 3,500.00</td></tr><tr><td>Development &amp; CMS</td><td class="num">1</td><td class="num">USD 6,000.00</td><td class="num">USD 6,000.00</td></tr></tbody></table>
      <div class="note">Approval of this proposal authorizes TECH360 to proceed to detailed Scope of Work and formal approval. No seal on proposals per policy.</div>
      ${padSignatures(escapeHtml(clientName), 'Client acceptance of proposal')}
    `
  } else if (type === 'SOW') {
    docKind = 'Scope of Work — Project Preview'
    metaItems = [
      { label: 'Client reference', value: clientId, brand: true },
      { label: 'Document', value: 'SOW Preview v1' },
      { label: 'Issued', value: issued },
      { label: 'Status', value: 'For client review' },
    ]
    sealHtml = sealHtmlFor('SOW' as never, branding)
    htmlBody = `
      <h1 style="font-size:22px;margin:18px 0 6px">Hello ${escapeHtml(clientName)}</h1>
      <p style="color:#526173;font-size:14px;line-height:1.7;max-width:64ch">Working preview of your project scope. The approved SOW defines deliverables, timeline, and payment milestones.</p>
      <h2>Deliverables</h2><div class="card"><h3>E-commerce Storefront</h3><p>Custom storefront with inventory, orders, and payments.</p><div class="tag">Deliverable: as described</div></div>
      <h2>Timeline</h2><ol class="timeline"><li><strong>Discovery</strong> <span>(2 weeks)</span><p>Requirements &amp; design system</p></li><li><strong>Build</strong> <span>(6 weeks)</span><p>Development &amp; integrations</p></li></ol>
      <h2>Payment Plan</h2><div class="pay"><div><b>30%</b><br/><small>Advance</small></div><div><b>40%</b><br/><small>On milestone</small></div><div><b>30%</b><br/><small>On final delivery</small></div></div>
      <div style="position:relative;margin-top:18px">${padSignatures(escapeHtml(clientName), 'Client approval of scope preview')}${sealHtml ? `<div style="position:absolute;right:0;bottom:-8px">${sealHtml}</div>` : ''}</div>
    `
  } else if (type === 'INVOICE') {
    docKind = 'Official Invoice · INV-2026-0042 (Rev #1)'
    metaItems = [
      { label: 'Invoice Number', value: 'INV-2026-0042', brand: true },
      { label: 'Client ID', value: clientId },
      { label: 'Issue Date', value: issued },
      { label: 'Due Date', value: '2026-12-15' },
      { label: 'Status', value: 'ISSUED' },
    ]
    sealHtml = sealHtmlFor('INVOICE' as never, branding)
    htmlBody = `
      <div class="inv-grid"><div class="inv-box"><h4>Billed To</h4><strong>${escapeHtml(clientName)}</strong><br/>Client ID: <strong>${clientId}</strong><br/>Email: billing@acme.example</div><div class="inv-box"><h4>Engagement Reference</h4>Project: <strong>PRJ-2026-0010</strong> — Acme Website<br/>Currency: <strong>USD</strong><br/>Revision: <strong>Rev #1</strong></div></div>
      <h2>Itemized Charges</h2><table class="inv-table"><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Amount</th></tr></thead><tbody><tr><td>Design System</td><td class="num">1</td><td class="num">USD 3,500.00</td><td class="num"><strong>USD 3,500.00</strong></td></tr><tr><td>Dev &amp; CMS</td><td class="num">1</td><td class="num">USD 6,000.00</td><td class="num"><strong>USD 6,000.00</strong></td></tr></tbody></table>
      <div class="inv-totals"><div class="row"><span>Subtotal</span><strong>USD 9,500.00</strong></div><div class="row grand"><span>Invoice Total</span><span>USD 9,500.00</span></div></div>
      <div style="position:relative;margin-top:22px">${padSignatures(escapeHtml(clientName), 'Client acceptance')}${sealHtml ? `<div style="position:absolute;right:0;bottom:-8px">${sealHtml}</div>` : ''}</div>
      <div class="note">Seal appears ONLY on Invoice (and SOW). This invoice includes the circular TECH360 LLC seal because sealEnabledInvoice is ${String(branding.sealEnabledInvoice)}.</div>
    `
  } else if (type === 'OFFICIAL_LETTER') {
    docKind = 'Official Letter — Client Onboarding'
    metaItems = [
      { label: 'Letter Ref', value: 'LET-2026-0015', brand: true },
      { label: 'Client ID', value: clientId },
      { label: 'Issued', value: issued },
      { label: 'Status', value: 'ISSUED' },
    ]
    htmlBody = `
      <h2>Dear ${escapeHtml(clientName)} Team</h2>
      <div class="card"><p>We are pleased to confirm onboarding for your project. Our team will be in contact within one business day to schedule kickoff.</p><p style="margin-top:10px">For any questions, contact <b>${branding.email}</b> or reply in the client portal.</p></div>
      <p style="margin-top:20px;font-size:13px;color:#526173">Official letters use the approved TECH360 letterhead without the circular seal, per policy. This letter includes header+footer branding but no seal.</p>
      ${padSignatures('TECH360 LLC Operations', 'Issuing team')}
    `
  } else if (type === 'TERMS' || type === 'PRIVACY' || type === 'REFUND') {
    const titles: Record<string, string> = { TERMS: 'Terms & Conditions', PRIVACY: 'Privacy Policy', REFUND: 'Refund Policy' }
    const title = titles[type] ?? type
    docKind = `Legal & Policies · ${title} · Effective ${issued}`
    metaItems = [
      { label: 'Document', value: title, brand: true },
      { label: 'Effective', value: issued },
      { label: 'Entity', value: branding.legalName },
    ]
    htmlBody = `
      <h2>${escapeHtml(title)}</h2>
      <div class="card"><p>This is a branded sample of the ${escapeHtml(title.toLowerCase())} as served at <code>/legal/${type.toLowerCase()}</code>. Legal policies render on the official TECH360 letterhead header and footer via the reusable branding engine, but NEVER display the circular seal (seal is restricted to SOW &amp; Invoice only).</p></div>
      <h2>1. Acceptance</h2><div class="card"><p>By engaging TECH360 LLC you agree to these terms. A project-specific Scope of Work prevails where it differs.</p></div>
      <h2>2. Services</h2><div class="card"><p>Web, Cloud, AI, Data, Tech — enterprise-grade delivery via US-registered entity.</p></div>
      <h2>3. Contact</h2><div class="card"><p>Questions: <a href="mailto:${escapeHtml(branding.email)}">${escapeHtml(branding.email)}</a> · ${escapeHtml(branding.address)}</p></div>
      <div class="note">Branding version v${branding.version} · ${branding.pageSize} · header ${branding.headerSpacingMm}mm · This policy prints on the letterhead without seal.</div>
    `
  }

  const header = brandingPadHeader(branding, docKind)
  const footer = brandingPadFooter(branding, `${type} · Branding v${branding.version} · ${type === 'SOW' || type === 'INVOICE' ? 'with seal' : 'no seal per policy'}`)
  const metaHtml = padMeta(metaItems)

  const extraCss = `
.inv-table{width:100%;border-collapse:collapse;margin-top:18px;font-size:13px}
.inv-table th{background:#0B1F33;color:#fff;text-align:left;padding:10px 12px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase}
.inv-table th.num,.inv-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.inv-table td{padding:11px 12px;border-bottom:1px solid #E2E8F0;vertical-align:top}
.inv-totals{margin-top:16px;margin-left:auto;max-width:340px;border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;font-size:13px}
.inv-totals .row{display:flex;justify-content:space-between;padding:9px 14px;border-bottom:1px solid #E2E8F0;font-variant-numeric:tabular-nums}
.inv-totals .row:last-child{border-bottom:none}
.inv-totals .row.grand{background:#063B8F;color:#fff;font-weight:800;font-size:14.5px}
.inv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:18px}
.inv-box{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 16px;font-size:12.5px;line-height:1.6;color:#334155}
.inv-box h4{margin:0 0 6px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#64748B}
`

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(docKind)} — ${branding.legalName}</title><style>${css}${extraCss}</style></head><body><main class="sheet">
${header}
${metaHtml}
<div class="doc">
${htmlBody}
</div>
${footer}
</main></body></html>`

  // Also record as generated document for audit/history
  try {
    const { recordGeneratedDocument } = await import('@/lib/document-storage')
    await recordGeneratedDocument({
      documentId: `SAMPLE-${type}-${Date.now()}`,
      documentType: type as never,
      clientId: null,
      clientPublicId: null,
      projectId: null,
      version: 1,
      createdBy: g.user.email,
      approvalStatus: 'APPROVED' as const,
      finalizationStatus: 'FINALIZED' as const,
      fileLocation: `/api/admin/branding/sample?type=${type} (generated on demand, not persisted)`,
      brandingVersion: branding.version,
      accessPermissions: ['SUPER_ADMIN'],
      relatedId: type,
      sha256: null,
      title: `${type} Sample — ${docKind}`,
      isPublicTemplate: false,
    })
  } catch { /* best-effort */ }

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } })
}
