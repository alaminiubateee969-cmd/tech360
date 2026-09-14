import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { recordPayment } from '@/lib/journey'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(req)
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
    include: { client: { select: { clientId: true, name: true, businessName: true } }, project: { select: { code: true, name: true } } },
  })
  const [paidAgg, pendingCount, failedCount, invoices] = await Promise.all([
    db.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    db.payment.count({ where: { status: 'PENDING' } }),
    db.payment.count({ where: { status: 'FAILED' } }),
    db.invoice.findMany({
      orderBy: { issuedAt: 'desc' }, take: 200,
      where: { ...(clientId ? { client: { OR: [{ id: clientId }, { clientId }] } } : {}) },
      include: { client: { select: { clientId: true, name: true } }, project: { select: { code: true, name: true } } },
    }),
  ])
  return Response.json({
    payments,
    invoices,
    summary: { totalReceived: paidAgg._sum.amount ?? 0, pendingCount, failedCount },
  })
}

export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const clientRef = sanitizeText(raw.clientId, 40)
  const amount = Number(raw.amount)
  if (!clientRef) return Response.json({ error: 'clientId required' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) return Response.json({ error: 'Valid amount required' }, { status: 400 })
  const client = await db.client.findFirst({ where: { OR: [{ id: clientRef }, { clientId: clientRef }] } })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })
  const payment = await recordPayment(client.id, {
    amount, currency: sanitizeText(raw.currency, 8) || 'USD', method: sanitizeText(raw.method, 40),
    transactionId: sanitizeText(raw.transactionId, 80), milestone: sanitizeText(raw.milestone, 60),
    notes: sanitizeText(raw.notes, 2000),
  })
  await audit({ actor: g.user.email, action: 'PAYMENT_RECORDED', userId: g.user.id, clientId: client.clientId, entityId: payment.id, details: { amount } })
  return Response.json({ ok: true, payment, message: 'Payment recorded as PENDING — verify to confirm receipt.' })
}
