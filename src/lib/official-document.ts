// ============================================================
// TECH360 — OFFICIAL DOCUMENT RENDERER
//
// Closes the Phase-0 gap "16 of the 18 required official document types have
// no renderer". Before this module only Invoice and verified Receipt could be
// produced. The registry (`GeneratedDocument.documentType`) and the permission
// rules in `document-storage.ts` ALREADY anticipated SOW, proposals,
// handover certificates and delivery packages — only the renderers were
// missing. This adds them without inventing a second subsystem.
//
// DESIGN CONSTRAINTS (inherited, deliberately)
// --------------------------------------------
//  - Zero inline JavaScript. Documents are served with `script-src 'none'`
//    (see DOCUMENT_HTML_HEADERS), so nothing here may add a <script> or an
//    on* handler.
//  - Every interpolated value is HTML-escaped. Customer-supplied text must
//    never become markup.
//  - Internal notes are NEVER accepted by this API. The renderer's input type
//    has no field for them, so they cannot leak by accident (same invariant
//    the invoice renderer documents).
//  - The owner-supplied letterhead is the real page template, via
//    `letterheadPageCss`. No renderer may re-draw the header/footer.
//  - A stamp is only drawn when branding says the type is allowed AND an
//    approved seal asset is configured. If no seal is approved, a bordered
//    STAMP AREA is reserved instead of fabricating a seal.
// ============================================================

import { escapeHtml } from '@/lib/comms'
import { getDefaultBranding, sealHtmlFor, type DocumentBrandingConfig, type DocumentType } from '@/lib/document-branding'
import { letterheadPageCss } from '@/lib/document-page-template'

/**
 * The official document types the directive requires.
 *
 * `INVOICE` and `RECEIPT` already have dedicated, richer renderers
 * (`invoice-document.ts`); they are intentionally NOT re-implemented here.
 */
export const OFFICIAL_DOCUMENT_KINDS = [
  'BUSINESS_PROPOSAL',
  'SOW',
  'QUOTATION',
  'PAYMENT_INSTRUCTION',
  'SERVICE_AGREEMENT',
  'CONTRACT',
  'MEETING_MINUTES',
  'CHANGE_REQUEST',
  'SCOPE_APPROVAL',
  'PROGRESS_REPORT',
  'QA_REPORT',
  'COMPLETION_REPORT',
  'DELIVERY_HANDOVER',
  'CUSTOMER_ACCEPTANCE',
  'WARRANTY_SUPPORT',
  'OFFICIAL_LETTER',
  'CERTIFICATE',
] as const

export type OfficialDocumentKind = (typeof OFFICIAL_DOCUMENT_KINDS)[number]

export const DOCUMENT_TITLES: Record<OfficialDocumentKind, string> = {
  BUSINESS_PROPOSAL: 'Business Proposal',
  SOW: 'Scope of Work',
  QUOTATION: 'Quotation',
  PAYMENT_INSTRUCTION: 'Payment Instruction',
  SERVICE_AGREEMENT: 'Service Agreement',
  CONTRACT: 'Contract',
  MEETING_MINUTES: 'Meeting Minutes',
  CHANGE_REQUEST: 'Change Request',
  SCOPE_APPROVAL: 'Scope Approval',
  PROGRESS_REPORT: 'Project Progress Report',
  QA_REPORT: 'Quality Assurance Report',
  COMPLETION_REPORT: 'Project Completion Report',
  DELIVERY_HANDOVER: 'Delivery & Handover Report',
  CUSTOMER_ACCEPTANCE: 'Customer Acceptance',
  WARRANTY_SUPPORT: 'Warranty & Support',
  OFFICIAL_LETTER: 'Official Business Letter',
  CERTIFICATE: 'Certificate',
}

/**
 * Which branding seal rule applies to each document kind.
 * Only commercial instruments are seal-eligible; reports and letters are not.
 */
const SEAL_ELIGIBILITY: Partial<Record<OfficialDocumentKind, DocumentType>> = {
  BUSINESS_PROPOSAL: 'WORK_PROPOSAL',
  SOW: 'SOW',
  QUOTATION: 'SOW',
  PAYMENT_INSTRUCTION: 'INVOICE',
  SERVICE_AGREEMENT: 'HANDOVER',
  CONTRACT: 'HANDOVER',
  SCOPE_APPROVAL: 'SOW',
  CERTIFICATE: 'HANDOVER',
}

export type DocumentField = { label: string; value: string }
export type DocumentSection = {
  heading: string
  /** Paragraphs of body copy. Escaped. */
  paragraphs?: string[]
  /** Bullet list. Escaped. */
  bullets?: string[]
  /** Definition rows, e.g. commercial terms. Escaped. */
  fields?: DocumentField[]
  /** Key/value table rendered as a real table (line items, deliverables). */
  table?: { columns: string[]; rows: string[][] }
}

export type OfficialDocumentInput = {
  kind: OfficialDocumentKind
  /** Document reference, e.g. SOW-2026-000123 / QT-2026-0042. */
  reference: string
  version?: number
  issuedAt: Date
  clientId?: string | null
  projectCode?: string | null
  /** Customer-facing name / business. Escaped. */
  recipientName?: string | null
  recipientBusiness?: string | null
  recipientEmail?: string | null
  subject?: string | null
  /** Ordered body blocks. */
  sections: DocumentSection[]
  /** Signature blocks; a stamp area is always reserved for sealed kinds. */
  signatories?: { name: string; role: string }[]
  /** Approval metadata shown in the audit strip. Escaped. */
  approvals?: { action: string; by: string; at: Date }[]
  branding?: DocumentBrandingConfig | null
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function fmtDateTime(d: Date): string {
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

function renderSections(sections: DocumentSection[]): string {
  return sections.map((s, i) => {
    const parts: string[] = [`<section class="doc-section" aria-labelledby="sec-${i}">`,
      `<h2 id="sec-${i}">${escapeHtml(s.heading)}</h2>`]
    for (const p of s.paragraphs ?? []) parts.push(`<p>${escapeHtml(p)}</p>`)
    if (s.bullets?.length) {
      parts.push('<ul>', ...s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`), '</ul>')
    }
    if (s.fields?.length) {
      parts.push('<dl class="fields">')
      for (const f of s.fields) parts.push(`<dt>${escapeHtml(f.label)}</dt><dd>${escapeHtml(f.value)}</dd>`)
      parts.push('</dl>')
    }
    if (s.table) {
      parts.push('<table class="grid"><thead><tr>',
        ...s.table.columns.map((c) => `<th>${escapeHtml(c)}</th>`),
        '</tr></thead><tbody>')
      for (const row of s.table.rows) {
        parts.push('<tr>', ...row.map((cell) => `<td>${escapeHtml(cell)}</td>`), '</tr>')
      }
      parts.push('</tbody></table>')
    }
    parts.push('</section>')
    return parts.join('\n')
  }).join('\n')
}

function renderSignatures(input: OfficialDocumentInput, branding: DocumentBrandingConfig): string {
  const signatories = input.signatories ?? [{ name: 'For TECH360 LLC', role: 'Authorised Signatory' }]
  const sealRule = SEAL_ELIGIBILITY[input.kind]
  const seal = sealRule ? sealHtmlFor(sealRule, branding) : ''

  const blocks = signatories.map((s) => `<div class="sig">
      <div class="sig-line" aria-hidden="true"></div>
      <div class="sig-name">${escapeHtml(s.name)}</div>
      <div class="sig-role">${escapeHtml(s.role)}</div>
    </div>`).join('\n')

  // If the branding forbids/omits a seal we RESERVE the area rather than
  // fabricate one. This is the directive's explicit "reserve a stamp area".
  const stampSlot = seal
    ? seal
    : `<div class="stamp-area" aria-label="Reserved stamp area"><span>STAMP AREA</span><span class="stamp-note">Reserved — no approved seal configured for this document</span></div>`

  return `<div class="sigs">${blocks}${stampSlot}</div>`
}

/**
 * Render an official document to print/PDF-ready HTML.
 *
 * The returned markup carries no JavaScript and no external network
 * dependencies other than the branding assets under /brand/.
 */
export function renderOfficialDocumentHtml(input: OfficialDocumentInput, brandingOverride?: DocumentBrandingConfig | null): string {
  const branding = brandingOverride ?? getDefaultBranding()
  const title = DOCUMENT_TITLES[input.kind]
  const layout = letterheadPageCss(branding)
  const safeTitle = escapeHtml(title)
  const safeRef = escapeHtml(input.reference)

  const meta: string[] = []
  meta.push(`<div><span>Document</span><b>${safeRef}</b></div>`)
  meta.push(`<div><span>Type</span><b>${safeTitle}</b></div>`)
  meta.push(`<div><span>Issued</span><b>${escapeHtml(fmtDate(input.issuedAt))}</b></div>`)
  if (input.version) meta.push(`<div><span>Version</span><b>v${Number(input.version)}</b></div>`)
  if (input.clientId) meta.push(`<div><span>Client ID</span><b>${escapeHtml(input.clientId)}</b></div>`)
  if (input.projectCode) meta.push(`<div><span>Project</span><b>${escapeHtml(input.projectCode)}</b></div>`)

  const recipient: string[] = []
  if (input.recipientName) recipient.push(`<div class="recipient-name">${escapeHtml(input.recipientName)}</div>`)
  if (input.recipientBusiness) recipient.push(`<div>${escapeHtml(input.recipientBusiness)}</div>`)
  if (input.recipientEmail) recipient.push(`<div>${escapeHtml(input.recipientEmail)}</div>`)

  const approvalStrip = input.approvals?.length
    ? `<div class="audit"><h3>Approval record</h3><ul>${input.approvals
        .map((a) => `<li><b>${escapeHtml(a.action)}</b> — ${escapeHtml(a.by)} · ${escapeHtml(fmtDateTime(a.at))}</li>`)
        .join('')}</ul></div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${safeTitle} ${safeRef} — ${escapeHtml(branding.legalName)}</title>
<style>
${layout.css}
:root{
  --ink:${branding.ink};
  --navy:${branding.brandNavy};
  --blue:${branding.brandBlue};
  --green:${branding.brandGreen};
}
*{box-sizing:border-box}
body{font-family:"Segoe UI",Inter,system-ui,-apple-system,sans-serif;color:var(--ink);font-size:11pt;line-height:1.55;margin:0}
.sheet{max-width:${branding.pageSize === 'A3' ? '420' : branding.pageSize === 'LETTER' ? '216' : '210'}mm;margin:0 auto}
.doc-head{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;align-items:flex-start;margin-bottom:6mm}
.doc-head h1{margin:0;font-size:19pt;letter-spacing:-.01em;color:var(--navy)}
.doc-head .ref{font-size:9.5pt;color:#5b6b7d;margin-top:2px}
.doc-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:4px 14px;margin:0 0 7mm;padding:3.5mm 0;border-top:1px solid #dbe4ee;border-bottom:1px solid #dbe4ee}
.doc-meta div{font-size:9pt}
.doc-meta span{display:block;color:#7b8a9b;font-size:7.5pt;text-transform:uppercase;letter-spacing:.09em}
.doc-meta b{color:var(--navy);font-weight:700}
.recipient{margin:0 0 7mm;font-size:10.5pt}
.recipient-name{font-weight:700;color:var(--navy)}
.doc-section{margin:0 0 6mm;break-inside:avoid}
.doc-section h2{font-size:11.5pt;color:var(--navy);margin:0 0 2.5mm;padding-bottom:1.5mm;border-bottom:2px solid var(--blue)}
.doc-section p{margin:0 0 2.5mm}
.doc-section ul{margin:0 0 2.5mm;padding-left:5mm}
.doc-section li{margin-bottom:1.2mm}
.fields{display:grid;grid-template-columns:38% 62%;gap:1.5mm 4mm;margin:0 0 2.5mm;font-size:10pt}
.fields dt{color:#6b7a8c;font-weight:600}
.fields dd{margin:0;font-weight:600}
table.grid{width:100%;border-collapse:collapse;font-size:9.5pt;margin:0 0 3mm}
table.grid th{background:#eef3f9;color:var(--navy);text-align:left;padding:2mm;border:1px solid #dbe4ee;font-size:8.5pt;text-transform:uppercase;letter-spacing:.05em}
table.grid td{padding:2mm;border:1px solid #e5ecf3;vertical-align:top}
.sigs{display:flex;flex-wrap:wrap;gap:10mm;align-items:flex-end;margin-top:9mm;break-inside:avoid}
.sig{min-width:58mm;flex:1}
.sig-line{height:11mm;border-bottom:1px solid #7b8a9b;margin-bottom:1.5mm}
.sig-name{font-weight:700;color:var(--navy);font-size:10pt}
.sig-role{font-size:8.5pt;color:#6b7a8c}
.stamp-area{width:38mm;height:38mm;border:1.5px dashed #b9c7d6;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#93a3b4;font-size:7pt;letter-spacing:.08em;padding:3mm}
.stamp-area .stamp-note{font-size:5.8pt;letter-spacing:0;margin-top:1mm;line-height:1.3;text-transform:none}
.audit{margin-top:7mm;padding:3mm;background:#f6f9fc;border-left:3px solid var(--green);break-inside:avoid}
.audit h3{margin:0 0 1.5mm;font-size:8.5pt;text-transform:uppercase;letter-spacing:.09em;color:#6b7a8c}
.audit ul{margin:0;padding-left:4mm;font-size:8.5pt;color:#4b5a6b}
.doc-foot{display:none}
@media print{.doc-foot{display:block}}
</style>
</head>
<body>
<main class="sheet" role="main">
  <header class="doc-head">
    <div>
      <h1>${safeTitle}</h1>
      <div class="ref">Reference ${safeRef}</div>
    </div>
  </header>
  <section class="doc-meta" aria-label="Document metadata">${meta.join('')}</section>
  ${recipient.length ? `<section class="recipient" aria-label="Recipient">${recipient.join('')}</section>` : ''}
  ${input.subject ? `<section class="doc-section"><h2>Subject</h2><p>${escapeHtml(input.subject)}</p></section>` : ''}
  ${renderSections(input.sections)}
  ${renderSignatures(input, branding)}
  ${approvalStrip}
  <footer class="doc-foot">Issued by ${escapeHtml(branding.legalName)} · ${escapeHtml(branding.domain)} · ${escapeHtml(branding.email)}</footer>
</main>
</body>
</html>`
}
