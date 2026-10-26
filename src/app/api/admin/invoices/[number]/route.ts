import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { hasCapability } from '@/lib/access-policy'
import { guard, isResponse } from '@/lib/api-guard'
import { channelConfigured, escapeHtml, sendCommunication } from '@/lib/comms'
import { acceptedMethodsPhrase, featureEnabled } from '@/lib/features'
import { nextInvoiceNumber } from '@/lib/ids'
import { DOCUMENT_HTML_HEADERS, renderInvoiceDocumentHtml } from '@/lib/invoice-document'
import {
  canEditInvoiceFields,
  canTransitionInvoiceStatus,
  computeInvoiceSettlement,
  computeInvoiceTotals,
  parseStoredLineItems,
  resolveInvoiceTotalMinor,
  type InvoiceLineItemInput,
} from '@/lib/invoice-policy'
import { PAD } from '@/lib/letterhead'
import { audit, readJson, sanitizeEmail, sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

// ============================================================
// ADMIN SINGLE INVOICE LIFECYCLE
//   GET   /api/admin/invoices/[number]         → JSON or ?format=html printable invoice
//   PATCH /api/admin/invoices/[number]         → edit_draft | submit_for_approval |
//                                                approve | issue | send | mark_overdue |
//                                                void | cancel | reissue | mark_disputed
// ============================================================

export async function GET(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const g = await guard(req, { capability: 'finance.read', capabilityOnly: true })
  if (isResponse(g)) return g

  const { number } = await params
  const cleanNumber = sanitizeText(number, 40)
  const invoice = await db.invoice.findUnique({
    where: { number: cleanNumber },
    include: {
      client: { select: { id: true, clientId: true, name: true, businessName: true, email: true, country: true } },
      project: { select: { id: true, code: true, name: true } },
      payments: { orderBy: { createdAt: 'desc' }, include: { receipt: { select: { receiptNumber: true } } } },
      refundCases: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!invoice) return Response.json({ error: 'Invoice not found.' }, { status: 404 })

  const totalMinor = resolveInvoiceTotalMinor({ totalMinor: invoice.totalMinor, amount: invoice.amount })
  const settlement = computeInvoiceSettlement({
    invoiceAmount: invoice.amount,
    invoiceTotalMinor: totalMinor,
    currentStatus: invoice.status,
    dueAt: invoice.dueAt,
    payments: invoice.payments,
  })

  if (req.nextUrl.searchParams.get('format') === 'html') {
    const phrase = await acceptedMethodsPhrase()
    const html = renderInvoiceDocumentHtml(
      {
        ...invoice,
        totalMinor,
        paidMinor: settlement.paidMinor,
        remainingMinor: settlement.remainingMinor,
      },
      phrase,
    )
    return new Response(html, { status: 200, headers: DOCUMENT_HTML_HEADERS })
  }

  return Response.json({
    invoice: {
      ...invoice,
      totalMinor,
      paidMinor: settlement.paidMinor,
      remainingMinor: settlement.remainingMinor,
      paidAmount: settlement.paidAmount,
      remainingAmount: settlement.remainingAmount,
      parsedLineItems: parseStoredLineItems(
        invoice.lineItems,
        invoice.description || invoice.customerNotes || invoice.notes || 'Software engineering & delivery services',
        totalMinor,
      ),
    },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const g = await guard(req, { capability: 'finance.invoice.write', capabilityOnly: true })
  if (isResponse(g)) return g

  const { number } = await params
  const cleanNumber = sanitizeText(number, 40)
  const raw = await readJson(req)
  const action = (sanitizeText(raw.action, 40) || 'send').toLowerCase()

  const invoice = await db.invoice.findUnique({
    where: { number: cleanNumber },
    include: {
      client: { select: { id: true, clientId: true, name: true, businessName: true, email: true, whatsapp: true, phone: true, country: true } },
      project: { select: { id: true, code: true, name: true } },
      payments: { select: { id: true, amount: true, status: true, verifiedAt: true } },
    },
  })
  if (!invoice) return Response.json({ error: 'Invoice not found.' }, { status: 404 })

  const totalMinor = resolveInvoiceTotalMinor({ totalMinor: invoice.totalMinor, amount: invoice.amount })
  const settlement = computeInvoiceSettlement({
    invoiceAmount: invoice.amount,
    invoiceTotalMinor: totalMinor,
    currentStatus: invoice.status,
    dueAt: invoice.dueAt,
    payments: invoice.payments,
  })
  if (!invoice) return Response.json({ error: 'Invoice not found' }, { status: 404 })

  const st = STATUS_STYLE[invoice.status] ?? STATUS_STYLE.DRAFT
  // Payments link to projects (not individual invoices), so a PAID invoice
  // settles in full and a PARTIAL one shows the verified project payments to
  // date against this milestone — honest provenance either way.
  const paidOnThis = invoice.status === 'PAID' ? invoice.amount : invoice.payments.filter((p) => p.status === 'PAID').reduce((a, p) => a + p.amount, 0)
  const balance = Math.max(0, invoice.amount - paidOnThis)
  const due = invoice.dueAt ? new Date(invoice.dueAt).toISOString().slice(0, 10) : 'On receipt'
  const issued = new Date(invoice.issuedAt).toISOString().slice(0, 10)

  // ---- Payment instructions quote ONLY the gateways the Super Admin has
  // enabled (real-time from the governance engine; disabled methods are
  // never printed as accepted). When payments are globally off, the invoice
  // says so honestly instead of listing methods. ----
  const paymentsOn = await featureEnabled('payments')
  const methodsPhrase = paymentsOn ? await acceptedMethodsPhrase() : ''
  const payNoteHtml = !paymentsOn
    ? `<div class="pay-note"><strong>Payment:</strong> Online payment intake is temporarily disabled by the platform administrator. Our finance automation (PAY-016) will contact you directly to settle invoice <b>${escapeHtml(invoice.number)}</b>.</div>`
    : methodsPhrase
      ? `<div class="pay-note"><strong>Payment:</strong> Accepted methods: <b>${escapeHtml(methodsPhrase)}</b>. Account details are shared with payment instructions by our finance automation (PAY-016). Quote invoice <b>${escapeHtml(invoice.number)}</b> and your Client ID <b>${escapeHtml(invoice.client.clientId)}</b> as the transaction reference. A receipt is issued after verification.</div>`
      : `<div class="pay-note"><strong>Payment:</strong> All payment methods are currently disabled by the platform administrator. Our finance automation (PAY-016) will contact you to arrange settlement of invoice <b>${escapeHtml(invoice.number)}</b>.</div>`

  const content = `
<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex,nofollow"/><title>${escapeHtml(invoice.number)} — Tech360 Invoice</title><style>${PAD_CSS}
.bill{display:flex;gap:24px;flex-wrap:wrap;margin-top:26px}
.bill-to{flex:1.2;min-width:240px;background:#F6F9FC;border:1px solid #E2E8F0;border-radius:12px;padding:16px 20px}
.bill-to h3,.totals h3{margin:0 0 10px;font-size:10.5px;letter-spacing:.15em;text-transform:uppercase;color:#7C8DA0}
.bill-to p{margin:0;font-size:13.5px;line-height:1.7;color:#33475C}
.bill-to .ref{font-weight:700;color:${PAD.ink}}
.totals{flex:1;min-width:240px}
.totals table{width:100%;border-collapse:collapse}
.totals td{padding:9px 4px;font-size:13.5px;border-bottom:1px solid #EEF2F7;color:#33475C}
.totals td:last-child{text-align:right;font-weight:600;color:${PAD.ink}}
.totals tr.grand td{border-bottom:none;border-top:2px solid ${PAD.ink};font-size:17px;font-weight:800;color:${PAD.brandNavy};padding-top:12px}
.status-chip{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.06em;padding:6px 14px;border-radius:99px;border:1px solid ${st.border};background:${st.bg};color:${st.color}}
.line-item{display:flex;justify-content:space-between;gap:18px;background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px 20px}
.line-item b{color:${PAD.ink}}
.line-item span{color:#526173;font-size:13.5px}
.pay-note{background:#F4FAFF;border:1px solid #B7DBF3;border-radius:10px;padding:13px 16px;font-size:13px;color:#0B4A8F;margin:18px 0;line-height:1.7}
.print-btn{position:fixed;right:22px;bottom:22px;background:${PAD.brandNavy};color:#fff;border:none;border-radius:10px;padding:12px 22px;font-weight:700;font-size:13.5px;cursor:pointer;box-shadow:0 10px 30px -8px rgba(6,59,143,.5)}
@media print{.print-btn{display:none}}
</style></head><body>
<div class="sheet">
${padHeader('Tax Invoice')}
${padMeta([
    { label: 'Invoice number', value: escapeHtml(invoice.number), brand: true },
    { label: 'Issued', value: issued },
    { label: 'Due', value: due },
    { label: 'Client reference', value: escapeHtml(invoice.client.clientId) },
  ])}
<main class="doc">
<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-top:24px">
  <h2 style="margin:0">Invoice</h2>
  <span class="status-chip">${st.label}</span>
</div>
<div class="bill">
  <div class="bill-to">
    <h3>Bill to</h3>
    <p><span class="ref">${escapeHtml(invoice.client.name)}</span><br/>
    ${invoice.client.businessName ? `${escapeHtml(invoice.client.businessName)}<br/>` : ''}
    ${invoice.client.email ? `${escapeHtml(invoice.client.email)}<br/>` : ''}
    Ref: ${escapeHtml(invoice.client.clientId)}</p>
  </div>
  <div class="totals">
    <h3>Summary</h3>
    <table>
      ${invoice.status === 'PAID'
        ? `<tr><td>Invoice amount</td><td>${money(invoice.amount, invoice.currency)}</td></tr><tr><td>Paid in full</td><td>${money(invoice.amount, invoice.currency)}</td></tr><tr class="grand"><td>Balance due</td><td>${money(0, invoice.currency)}</td></tr>`
        : paidOnThis > 0
          ? `<tr><td>Invoice amount</td><td>${money(invoice.amount, invoice.currency)}</td></tr><tr><td>Paid to date</td><td>${money(paidOnThis, invoice.currency)}</td></tr><tr class="grand"><td>Balance due</td><td>${money(balance, invoice.currency)}</td></tr>`
          : `<tr><td>Invoice amount</td><td>${money(invoice.amount, invoice.currency)}</td></tr><tr class="grand"><td>Amount due</td><td>${money(invoice.amount, invoice.currency)}</td></tr>`}
    </table>
  </div>
</div>
<h2>Services</h2>
<div class="line-item">
  <div><b>${escapeHtml(invoice.notes || 'Professional services — project milestone')}</b><br/>
  ${invoice.project ? `<span>Project ${escapeHtml(invoice.project.code)} · ${escapeHtml(invoice.project.name)}</span>` : '<span>Engagement milestone as agreed in the approved scope of work</span>'}</div>
  <b style="white-space:nowrap">${money(invoice.amount, invoice.currency)}</b>
</div>
${invoice.status === 'PAID'
  ? `<div class="pay-note"><strong>Payment received — thank you.</strong> This invoice is settled in full and serves as your receipt. Payment verified by the Tech360 finance automation with your Client ID ${escapeHtml(invoice.client.clientId)} quoted as reference.</div>`
  : payNoteHtml}
<p style="font-size:11.5px;color:#7C8DA0;line-height:1.7">Thank you for your business. This invoice was generated electronically by the Tech360 client platform and is valid without a manual signature. Questions: ${PAD.email} · live support chat at www.${PAD.domain}.</p>
</main>
${padFooter('This invoice is confidential and intended for the addressed recipient. TECH360 LLC is a Missouri LLC.')}
</div>
<button class="print-btn" type="button" onclick="window.print()">Print / save as PDF</button>
</body></html>`
  return new Response(content, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}
