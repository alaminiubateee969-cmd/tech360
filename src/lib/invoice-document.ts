import { escapeHtml } from '@/lib/comms'
import { docDate, PAD, PAD_CSS, padFooter, padHeader, padMeta } from '@/lib/letterhead'
import {
  fromMinorUnits,
  parseStoredLineItems,
  resolveInvoiceTotalMinor,
  type InvoiceLineItem,
} from '@/lib/invoice-policy'

// ============================================================
// OFFICIAL INVOICE & VERIFIED PAYMENT RECEIPT RENDERER
//
// Renders print/PDF-ready HTML on the canonical TECH360 LLC
// company letterhead (`src/lib/letterhead.ts`) with strict HTML
// escaping and zero inline JavaScript so responses can carry a
// locked-down Content-Security-Policy (`script-src 'none'`).
//
// Security invariant: `internalNotes` is NEVER passed to or
// rendered by customer-facing invoice or receipt documents.
// ============================================================

export interface RenderableInvoice {
  number: string
  status: string
  currency: string
  amount: number
  subtotalMinor?: number | null
  discountMinor?: number | null
  discountReason?: string | null
  taxRateBps?: number | null
  taxLabel?: string | null
  taxMinor?: number | null
  totalMinor?: number | null
  description?: string | null
  lineItems?: string | null
  billingName?: string | null
  billingBusiness?: string | null
  billingEmail?: string | null
  billingAddress?: string | null
  billingCountry?: string | null
  paymentTerms?: string | null
  paymentMethodsSnapshot?: string | null
  customerNotes?: string | null
  internalNotes?: string | null
  notes?: string | null
  termsVersion?: string | null
  scopeVersion?: number | null
  revision?: number | null
  supersedesInvoiceNumber?: string | null
  issuedAt: Date | string
  dueAt?: Date | string | null
  viewedAt?: Date | string | null
  paidAt?: Date | string | null
  voidedAt?: Date | string | null
  voidReason?: string | null
  client: {
    clientId: string
    name: string
    businessName?: string | null
    email?: string | null
    country?: string | null
  }
  project?: {
    code: string
    name: string
  } | null
  paidMinor?: number
  remainingMinor?: number
}

export interface RenderableReceipt {
  receiptNumber: string
  amountMinor: number
  currency: string
  method?: string | null
  transactionId?: string | null
  verifiedBy: string
  verifiedAt: Date | string
  issuedAt: Date | string
  invoiceNumber?: string | null
  milestone?: string | null
  client: {
    clientId: string
    name: string
    businessName?: string | null
    email?: string | null
    country?: string | null
  }
  project?: {
    code: string
    name: string
  } | null
}

function fmtCurrencyMinor(minor: number, currency: string): string {
  const code = escapeHtml((currency || 'USD').toUpperCase())
  const major = fromMinorUnits(minor).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${code} ${major}`
}

function fmtIsoDate(value: Date | string | null | undefined): string {
  if (!value) return 'Upon receipt'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return 'Upon receipt'
  return docDate(d)
}

export const DOCUMENT_HTML_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy': "default-src 'none'; script-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'private, no-store',
})

const EXTRA_CSS = `
.inv-banner{margin:16px 42px 0;padding:12px 16px;border-radius:10px;font-size:12.5px;font-weight:700;letter-spacing:.04em}
.inv-banner.draft{background:#FEF3C7;border:1px solid #F59E0B;color:#92400E}
.inv-banner.void{background:#FEE2E2;border:1px solid #EF4444;color:#991B1B}
.inv-banner.paid{background:#DCFCE7;border:1px solid #22C55E;color:#166534}
.inv-banner.unconfigured{background:#F1F5F9;border:1px solid #94A3B8;color:#334155}
.inv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:18px}
.inv-box{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 16px;font-size:12.5px;line-height:1.6;color:#334155}
.inv-box h4{margin:0 0 6px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#64748B}
.inv-table{width:100%;border-collapse:collapse;margin-top:18px;font-size:13px}
.inv-table th{background:#0B1F33;color:#fff;text-align:left;padding:10px 12px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase}
.inv-table th.num,.inv-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.inv-table td{padding:11px 12px;border-bottom:1px solid #E2E8F0;vertical-align:top}
.inv-totals{margin-top:16px;margin-left:auto;max-width:340px;border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;font-size:13px}
.inv-totals .row{display:flex;justify-content:space-between;padding:9px 14px;border-bottom:1px solid #E2E8F0;font-variant-numeric:tabular-nums}
.inv-totals .row:last-child{border-bottom:none}
.inv-totals .row.grand{background:#063B8F;color:#fff;font-weight:800;font-size:14.5px}
.inv-totals .row.due{background:#F0F9FF;color:#0B1F33;font-weight:700}
.print-hint{background:#0B1F33;color:#E2E8F0;padding:10px 42px;font-size:12px;display:flex;justify-content:space-between;align-items:center;gap:12px}
@media print{.print-hint{display:none!important}}
`

export function renderInvoiceDocumentHtml(inv: RenderableInvoice, currentPaymentReadinessPhrase: string): string {
  const totalMinor = resolveInvoiceTotalMinor({ totalMinor: inv.totalMinor, amount: inv.amount })
  const items: InvoiceLineItem[] = parseStoredLineItems(
    inv.lineItems,
    inv.description || inv.customerNotes || inv.notes || 'Software engineering & delivery services',
    totalMinor,
  )
  const subtotalMinor =
    typeof inv.subtotalMinor === 'number' && inv.subtotalMinor > 0
      ? inv.subtotalMinor
      : items.reduce((s, item) => s + item.amountMinor, 0)
  const discountMinor = Math.max(0, inv.discountMinor ?? 0)
  const taxRateBps = Math.max(0, inv.taxRateBps ?? 0)
  const taxMinor = Math.max(0, inv.taxMinor ?? 0)
  const paidMinor = Math.max(0, inv.paidMinor ?? 0)
  const remainingMinor = Math.max(0, inv.remainingMinor ?? Math.max(0, totalMinor - paidMinor))

  const billingName = inv.billingName || inv.client.name
  const billingBusiness = inv.billingBusiness ?? inv.client.businessName
  const billingEmail = inv.billingEmail ?? inv.client.email
  const billingCountry = inv.billingCountry ?? inv.client.country
  const customerFacingNotes = inv.customerNotes ?? (inv.internalNotes ? null : inv.notes)
  const methodsText = inv.paymentMethodsSnapshot || currentPaymentReadinessPhrase || 'Not Configured — Payment setup required'
  const isUnconfiguredPayment = /not configured/i.test(methodsText)

  let statusBanner = ''
  if (inv.status === 'DRAFT' || inv.status === 'AWAITING_APPROVAL' || inv.status === 'APPROVED') {
    statusBanner = `<div class="inv-banner draft">PRE-ISSUANCE (${escapeHtml(inv.status)}) — Internal review copy; not yet issued for payment.</div>`
  } else if (inv.status === 'VOID' || inv.status === 'CANCELLED') {
    statusBanner = `<div class="inv-banner void">${escapeHtml(inv.status)} INVOICE — Do not remit payment.${inv.voidReason ? ` Reason: ${escapeHtml(inv.voidReason)}` : ''}</div>`
  } else if (inv.status === 'PAID') {
    statusBanner = `<div class="inv-banner paid">PAID IN FULL — Verified settlement recorded${inv.paidAt ? ` on ${escapeHtml(fmtIsoDate(inv.paidAt))}` : ''}.</div>`
  } else if (isUnconfiguredPayment) {
    statusBanner = `<div class="inv-banner unconfigured">Payment Configuration: Not Configured — Payment setup required before live payment collection.</div>`
  }

  const revisionLabel = inv.revision && inv.revision > 1 ? `Rev #${inv.revision}` : 'Rev #1'
  const docTitle = `Official Invoice · ${escapeHtml(inv.number)} (${revisionLabel})`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(inv.number)} — ${PAD.legalName}</title>
  <style>${PAD_CSS}${EXTRA_CSS}</style>
</head>
<body>
  <div class="print-hint no-print">
    <span>${escapeHtml(inv.number)} · Official ${PAD.legalName} Invoice Document</span>
    <span>Use browser Print (Ctrl+P / Cmd+P) → Save as PDF</span>
  </div>
  <main class="sheet">
    ${padHeader(docTitle)}
    ${padMeta([
      { label: 'Invoice Number', value: escapeHtml(inv.number), brand: true },
      { label: 'Client ID', value: escapeHtml(inv.client.clientId) },
      { label: 'Issue Date', value: escapeHtml(fmtIsoDate(inv.issuedAt)) },
      { label: 'Due Date', value: escapeHtml(fmtIsoDate(inv.dueAt)) },
      { label: 'Status', value: escapeHtml(inv.status) },
    ])}
    ${statusBanner}
    <section class="doc">
      <div class="inv-grid">
        <div class="inv-box">
          <h4>Billed To</h4>
          <strong>${escapeHtml(billingName)}</strong><br/>
          ${billingBusiness ? `${escapeHtml(billingBusiness)}<br/>` : ''}
          Client ID: <strong>${escapeHtml(inv.client.clientId)}</strong><br/>
          ${billingEmail ? `Email: ${escapeHtml(billingEmail)}<br/>` : ''}
          ${inv.billingAddress ? `${escapeHtml(inv.billingAddress)}<br/>` : ''}
          ${billingCountry ? `Country: ${escapeHtml(billingCountry)}` : ''}
        </div>
        <div class="inv-box">
          <h4>Engagement Reference</h4>
          ${inv.project ? `Project: <strong>${escapeHtml(inv.project.code)}</strong> — ${escapeHtml(inv.project.name)}<br/>` : 'Project: General Engagement<br/>'}
          ${inv.scopeVersion ? `Approved Scope Version: <strong>v${Number(inv.scopeVersion)}</strong><br/>` : ''}
          Currency: <strong>${escapeHtml(inv.currency.toUpperCase())}</strong><br/>
          Revision: <strong>${revisionLabel}</strong>${inv.supersedesInvoiceNumber ? ` (supersedes ${escapeHtml(inv.supersedesInvoiceNumber)})` : ''}<br/>
          Terms Version: ${escapeHtml(inv.termsVersion || 'TECH360-MSA-2026.1')}
        </div>
      </div>

      ${inv.description ? `<h2>Scope &amp; Description of Services</h2><div class="card"><p>${escapeHtml(inv.description)}</p></div>` : ''}

      <h2>Itemized Charges</h2>
      <table class="inv-table">
        <thead>
          <tr>
            <th style="width:52%">Description</th>
            <th class="num" style="width:12%">Qty</th>
            <th class="num" style="width:18%">Unit Price</th>
            <th class="num" style="width:18%">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `<tr>
            <td>${escapeHtml(item.description)}</td>
            <td class="num">${escapeHtml(String(item.quantity))}</td>
            <td class="num">${fmtCurrencyMinor(item.unitMinor, inv.currency)}</td>
            <td class="num"><strong>${fmtCurrencyMinor(item.amountMinor, inv.currency)}</strong></td>
          </tr>`,
            )
            .join('')}
        </tbody>
      </table>

      <div class="inv-totals">
        <div class="row"><span>Subtotal</span><strong>${fmtCurrencyMinor(subtotalMinor, inv.currency)}</strong></div>
        ${
          discountMinor > 0
            ? `<div class="row"><span>Discount${inv.discountReason ? ` (${escapeHtml(inv.discountReason)})` : ''}</span><strong>- ${fmtCurrencyMinor(discountMinor, inv.currency)}</strong></div>`
            : ''
        }
        ${
          taxMinor > 0 || taxRateBps > 0
            ? `<div class="row"><span>${escapeHtml(inv.taxLabel || 'Tax')} (${(taxRateBps / 100).toFixed(2)}%)</span><strong>${fmtCurrencyMinor(taxMinor, inv.currency)}</strong></div>`
            : ''
        }
        <div class="row grand"><span>Invoice Total</span><span>${fmtCurrencyMinor(totalMinor, inv.currency)}</span></div>
        <div class="row"><span>Verified Paid</span><span>${fmtCurrencyMinor(paidMinor, inv.currency)}</span></div>
        <div class="row due"><span>Balance Due</span><span>${fmtCurrencyMinor(remainingMinor, inv.currency)}</span></div>
      </div>

      <div class="inv-grid">
        <div class="inv-box">
          <h4>Payment Terms &amp; Configured Methods</h4>
          <p style="margin:0 0 6px"><strong>Terms:</strong> ${escapeHtml(inv.paymentTerms || 'HTML Preview where included in the agreed process. Final source-code handover after required outstanding project payments have cleared, unless otherwise agreed in writing.')}</p>
          <p style="margin:0"><strong>Payment Methods:</strong> ${escapeHtml(methodsText)}</p>
        </div>
        ${
          customerFacingNotes
            ? `<div class="inv-box"><h4>Notes</h4><p style="margin:0">${escapeHtml(customerFacingNotes)}</p></div>`
            : `<div class="inv-box"><h4>Commercial Governance</h4><p style="margin:0">Payments are credited only upon server-side provider webhook verification or Super Admin ledger verification. Source-code handover remains gated until Balance Due is 0.00.</p></div>`
        }
      </div>
    </section>
    ${padFooter(`Invoice ${escapeHtml(inv.number)} · Client ${escapeHtml(inv.client.clientId)} · Confidential commercial record`)}
  </main>
</body>
</html>`
}

export function renderReceiptDocumentHtml(rec: RenderableReceipt): string {
  const docTitle = `Official Payment Receipt · ${escapeHtml(rec.receiptNumber)}`
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(rec.receiptNumber)} — ${PAD.legalName}</title>
  <style>${PAD_CSS}${EXTRA_CSS}</style>
</head>
<body>
  <div class="print-hint no-print">
    <span>${escapeHtml(rec.receiptNumber)} · Official Verified Payment Receipt</span>
    <span>Use browser Print (Ctrl+P / Cmd+P) → Save as PDF</span>
  </div>
  <main class="sheet">
    ${padHeader(docTitle)}
    ${padMeta([
      { label: 'Receipt Number', value: escapeHtml(rec.receiptNumber), brand: true },
      { label: 'Client ID', value: escapeHtml(rec.client.clientId) },
      { label: 'Invoice Ref', value: escapeHtml(rec.invoiceNumber || 'Account Credit') },
      { label: 'Verified Date', value: escapeHtml(fmtIsoDate(rec.verifiedAt)) },
      { label: 'Status', value: 'PAID · VERIFIED' },
    ])}
    <div class="inv-banner paid">OFFICIAL VERIFIED RECEIPT — Payment settled and verified on ${escapeHtml(fmtIsoDate(rec.verifiedAt))}.</div>
    <section class="doc">
      <div class="inv-grid">
        <div class="inv-box">
          <h4>Received From</h4>
          <strong>${escapeHtml(rec.client.name)}</strong><br/>
          ${rec.client.businessName ? `${escapeHtml(rec.client.businessName)}<br/>` : ''}
          Client ID: <strong>${escapeHtml(rec.client.clientId)}</strong><br/>
          ${rec.client.email ? `Email: ${escapeHtml(rec.client.email)}<br/>` : ''}
          ${rec.client.country ? `Country: ${escapeHtml(rec.client.country)}` : ''}
        </div>
        <div class="inv-box">
          <h4>Settlement Details</h4>
          ${rec.project ? `Project: <strong>${escapeHtml(rec.project.code)}</strong> — ${escapeHtml(rec.project.name)}<br/>` : ''}
          ${rec.milestone ? `Milestone: <strong>${escapeHtml(rec.milestone)}</strong><br/>` : ''}
          Payment Method: <strong>${escapeHtml(rec.method || 'VERIFIED_TRANSFER')}</strong><br/>
          Transaction Reference: <strong>${escapeHtml(rec.transactionId || 'Recorded on ledger')}</strong><br/>
          Issued Date: ${escapeHtml(fmtIsoDate(rec.issuedAt))}
        </div>
      </div>

      <h2>Verified Payment Summary</h2>
      <div class="inv-totals" style="max-width:100%">
        <div class="row grand">
          <span>Verified Amount Received</span>
          <span>${fmtCurrencyMinor(rec.amountMinor, rec.currency)}</span>
        </div>
      </div>

      <div class="card" style="margin-top:18px">
        <h3>Commercial &amp; Handover Policy Notice</h3>
        <p>This receipt confirms verified settlement of the amount stated above. Source-code and credential handover packages unlock automatically only when the full contracted project balance has been settled and verified.</p>
      </div>
    </section>
    ${padFooter(`Receipt ${escapeHtml(rec.receiptNumber)} · Client ${escapeHtml(rec.client.clientId)} · Verified financial record`)}
  </main>
</body>
</html>`
}
