import { featureEnabled, assertGatewayUsable, getCustomerPaymentReadiness } from '@/lib/features'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import {
  computeInvoiceSettlement,
  isPayableInvoiceStatus,
  resolveInvoiceTotalMinor,
  toMinorUnits,
} from '@/lib/invoice-policy'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { recordPayment } from '@/lib/journey'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(req, { capability: 'finance.read', capabilityOnly: true })
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const status = sanitizeText(url.searchParams.get('status') ?? '', 20).toUpperCase()
  const clientId = sanitizeText(url.searchParams.get('clientId') ?? '', 40)
  const payments = await db.payment.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(clientId ? { client: { OR: [{ id: clientId }, { clientId }] } } : {}),
    },
    orderBy: { createdAt: 'desc' }, take: 200,
    include: {
      client: { select: { clientId: true, name: true, businessName: true } },
      project: { select: { code: true, name: true } },
      invoice: { select: { number: true } },
      receipt: { select: { receiptNumber: true, issuedAt: true } },
    },
  })
  const [paidAgg, pendingCount, failedCount, invoices, paymentReadiness] = await Promise.all([
    db.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    db.payment.count({ where: { status: 'PENDING' } }),
    db.payment.count({ where: { status: 'FAILED' } }),
    db.invoice.findMany({
      orderBy: { issuedAt: 'desc' }, take: 200,
      where: { ...(clientId ? { client: { OR: [{ id: clientId }, { clientId }] } } : {}) },
      include: { client: { select: { clientId: true, name: true } }, project: { select: { code: true, name: true } } },
    }),
    getCustomerPaymentReadiness(),
  ])
  return Response.json({
    payments,
    invoices,
    paymentReadiness,
    summary: { totalReceived: paidAgg._sum.amount ?? 0, pendingCount, failedCount },
  })
}

export async function POST(req: NextRequest) {
  // feature-gate: payments switch (Super Admin) + gateway governance
  if (!(await featureEnabled('payments'))) {
    return Response.json({ error: 'Payments are currently disabled by Super Admin (System → Feature Management).' }, { status: 503 })
  }
  const g = await guard(req, { capability: 'finance.payment.record', capabilityOnly: true })
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const clientRef = sanitizeText(raw.clientId, 40)
  const amount = Number(raw.amount)
  if (!clientRef) return Response.json({ error: 'clientId required' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) return Response.json({ error: 'Valid amount required' }, { status: 400 })
  const client = await db.client.findFirst({ where: { OR: [{ id: clientRef }, { clientId: clientRef }] } })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })
  // Gateway governance: the method's gateway must be enabled + usable —
  // disabled methods are rejected server-side (never silently accepted).
  const method = sanitizeText(raw.method, 40) || 'MANUAL'
  const usable = await assertGatewayUsable(method)
  if (!usable.ok) return Response.json({ error: usable.error }, { status: usable.status })
  // Per-invoice allocation (optional): resolve + validate the invoice
  // against this client before recording.
  let invoiceId: string | undefined
  const invoiceRef = sanitizeText(raw.invoiceNumber, 30) || sanitizeText(raw.invoiceId, 40)
  if (invoiceRef) {
    const invoice = await db.invoice.findFirst({
      where: { OR: [{ number: invoiceRef }, { id: invoiceRef }], client: { id: client.id } },
      include: { payments: { select: { amount: true, status: true } } },
    })
    if (!invoice) return Response.json({ error: 'Invoice not found for this client.' }, { status: 404 })
    if (!isPayableInvoiceStatus(invoice.status)) {
      return Response.json(
        { error: `Invoice ${invoice.number} is ${invoice.status} — issue/send the invoice before allocating payments to it.` },
        { status: 409 },
      )
    }
    const settlement = computeInvoiceSettlement({
      invoiceAmount: invoice.amount,
      invoiceTotalMinor: resolveInvoiceTotalMinor({ totalMinor: invoice.totalMinor, amount: invoice.amount }),
      currentStatus: invoice.status,
      dueAt: invoice.dueAt,
      payments: invoice.payments,
    })
    if (toMinorUnits(amount) > settlement.remainingMinor) {
      return Response.json(
        {
          error: `Payment of ${amount} exceeds remaining unpaid balance (${settlement.remainingAmount}) on invoice ${invoice.number}.`,
        },
        { status: 400 },
      )
    }
    invoiceId = invoice.id
  }
  try {
    const payment = await recordPayment(client.id, {
      amount, currency: sanitizeText(raw.currency, 8) || 'USD', method,
      transactionId: sanitizeText(raw.transactionId, 80), milestone: sanitizeText(raw.milestone, 60),
      notes: sanitizeText(raw.notes, 2000), invoiceId,
    })
    await audit({ actor: g.user.email, action: 'PAYMENT_RECORDED', userId: g.user.id, clientId: client.clientId, entityId: payment.id, details: { amount, invoice: invoiceId ?? null } })
    return Response.json({ ok: true, payment, message: invoiceId ? 'Payment recorded as PENDING against the invoice — verify it to settle the allocation.' : 'Payment recorded as PENDING — verify to confirm receipt.' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not record the payment.'
    return Response.json({ error: message }, { status: 400 })
  }
}
