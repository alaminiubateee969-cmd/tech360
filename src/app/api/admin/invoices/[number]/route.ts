import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { escapeHtml } from '@/lib/comms'
import { PAD_CSS, padHeader, padMeta, padFooter, PAD } from '@/lib/letterhead'

export const dynamic = 'force-dynamic'

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DRAFT: { label: 'Draft', color: '#526173', bg: '#F6F9FC', border: '#CBD8E6' },
  SENT: { label: 'Issued', color: '#063B8F', bg: '#F4FAFF', border: '#B7DBF3' },
  PARTIAL: { label: 'Partially paid', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
  PAID: { label: 'PAID', color: '#14532D', bg: '#F0FDF4', border: '#BBF7D0' },
  OVERDUE: { label: 'Overdue', color: '#7F1D1D', bg: '#FDECEC', border: '#FCA5A5' },
  CANCELLED: { label: 'Cancelled', color: '#7C8DA0', bg: '#F6F9FC', border: '#CBD8E6' },
}

const money = (n: number, currency: string) =>
  `${currency === 'USD' ? '$' : ''}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency === 'USD' ? '' : ` ${currency}`}`

// GET /api/admin/invoices/[number] — official invoice on the company pad.
// Admin-session auth (same guard as every admin API). Renders printable HTML.
export async function GET(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const { number } = await params
  const clean = sanitizeText(number, 32).replace(/[^A-Za-z0-9-]/g, '')
  const invoice = await db.invoice.findUnique({
    where: { number: clean },
    include: { client: { include: { payments: true } }, project: true, payments: true },
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
  : `<div class="pay-note"><strong>Payment:</strong> Bank transfer details are shared separately with payment instructions by our finance automation (PAY-016). Quote invoice <b>${escapeHtml(invoice.number)}</b> and your Client ID <b>${escapeHtml(invoice.client.clientId)}</b> as the transaction reference. A receipt is issued after verification.</div>`}
<p style="font-size:11.5px;color:#7C8DA0;line-height:1.7">Thank you for your business. This invoice was generated electronically by the Tech360 client platform and is valid without a manual signature. Questions: ${PAD.email} · ${PAD.whatsapp}.</p>
</main>
${padFooter('This invoice is confidential and intended for the addressed recipient. TECH360 LLC is a Missouri LLC.')}
</div>
<button class="print-btn" type="button" onclick="window.print()">Print / save as PDF</button>
</body></html>`
  return new Response(content, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}
