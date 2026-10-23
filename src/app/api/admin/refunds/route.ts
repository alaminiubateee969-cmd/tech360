import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { nextRefundCaseNumber } from '@/lib/ids'
import { fromMinorUnits, isValidCurrency, toMinorUnits } from '@/lib/invoice-policy'
import { audit, readJson, sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

const VALID_KINDS = new Set(['REFUND', 'CANCELLATION', 'DISPUTE'])

export async function GET(req: NextRequest) {
  const g = await guard(req, { capability: 'finance.read', capabilityOnly: true })
  if (isResponse(g)) return g

  const sp = req.nextUrl.searchParams
  const status = sanitizeText(sp.get('status') ?? '', 40).toUpperCase()
  const kind = sanitizeText(sp.get('kind') ?? '', 40).toUpperCase()
  const clientRef = sanitizeText(sp.get('clientId') ?? '', 40)

  const where: Record<string, unknown> = {}
  if (status && status !== 'ALL') where.status = status
  if (kind && kind !== 'ALL') where.kind = kind
  if (clientRef) {
    where.OR = [{ clientId: clientRef }, { client: { clientId: clientRef } }]
  }

  const cases = await db.refundCase.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      client: { select: { id: true, clientId: true, name: true, businessName: true, email: true } },
      project: { select: { id: true, code: true, name: true, totalAmount: true, paidAmount: true, paymentStatus: true } },
      invoice: { select: { id: true, number: true, amount: true, currency: true, status: true } },
      payment: { select: { id: true, amount: true, currency: true, status: true, method: true, transactionId: true } },
    },
  })

  return Response.json({
    cases: cases.map((c) => ({
      ...c,
      requestedAmount: fromMinorUnits(c.requestedAmountMinor),
      approvedAmount: fromMinorUnits(c.approvedAmountMinor),
    })),
  })
}

export async function POST(req: NextRequest) {
  const g = await guard(req, { capability: 'finance.refund.request', capabilityOnly: true })
  if (isResponse(g)) return g

  const raw = await readJson(req)
  const clientRef = sanitizeText(raw.clientId, 40)
  const projectRef = sanitizeText(raw.projectId, 40) || null
  const invoiceRef = sanitizeText(raw.invoiceId, 40) || null
  const paymentRef = sanitizeText(raw.paymentId, 40) || null
  const kind = (sanitizeText(raw.kind, 30) || 'REFUND').toUpperCase()
  const reason = sanitizeText(raw.reason, 4000)
  const policyBasis = sanitizeText(raw.policyBasis, 2000) || null
  const evidenceNotes = sanitizeText(raw.evidenceNotes, 8000) || null
  const revokeHandover = raw.revokeHandover === undefined ? true : Boolean(raw.revokeHandover)

  if (!VALID_KINDS.has(kind)) {
    return Response.json({ error: 'Case kind must be REFUND, CANCELLATION, or DISPUTE.' }, { status: 400 })
  }
  if (!clientRef) return Response.json({ error: 'Client is required.' }, { status: 400 })
  if (reason.length < 5) return Response.json({ error: 'Provide a clear reason (min 5 characters).' }, { status: 400 })

  const client = await db.client.findFirst({
    where: { OR: [{ id: clientRef }, { clientId: clientRef }], deletedAt: null },
    select: { id: true, clientId: true, name: true },
  })
  if (!client) return Response.json({ error: 'Client not found.' }, { status: 404 })

  let projectId: string | null = null
  if (projectRef) {
    const project = await db.project.findFirst({
      where: { OR: [{ id: projectRef }, { code: projectRef }], clientId: client.id },
      select: { id: true },
    })
    if (!project) return Response.json({ error: 'Project does not belong to that client.' }, { status: 400 })
    projectId = project.id
  }

  let invoice: { id: string; number: string; currency: string; projectId: string | null; status: string } | null = null
  if (invoiceRef) {
    invoice = await db.invoice.findFirst({
      where: { OR: [{ id: invoiceRef }, { number: invoiceRef }], clientId: client.id },
      select: { id: true, number: true, currency: true, projectId: true, status: true },
    })
    if (!invoice) return Response.json({ error: 'Invoice does not belong to that client.' }, { status: 400 })
    if (!projectId && invoice.projectId) projectId = invoice.projectId
  }

  let payment: { id: string; amount: number; currency: string; status: string; invoiceId: string | null; projectId: string | null } | null = null
  if (paymentRef) {
    payment = await db.payment.findFirst({
      where: { id: paymentRef, clientId: client.id },
      select: { id: true, amount: true, currency: true, status: true, invoiceId: true, projectId: true },
    })
    if (!payment) return Response.json({ error: 'Payment does not belong to that client.' }, { status: 400 })
    if (kind === 'REFUND' && payment.status !== 'PAID') {
      return Response.json(
        { error: `Only settled PAID payments can be refunded (payment is ${payment.status}).` },
        { status: 409 },
      )
    }
    if (!projectId && payment.projectId) projectId = payment.projectId
  }

  const currency = (sanitizeText(raw.currency, 8) || payment?.currency || invoice?.currency || 'USD').toUpperCase()
  if (!isValidCurrency(currency)) {
    return Response.json({ error: `Unsupported currency "${currency}".` }, { status: 400 })
  }

  let requestedAmountMinor = 0
  if (raw.requestedAmountMinor !== undefined) {
    requestedAmountMinor = Number(raw.requestedAmountMinor)
  } else if (raw.requestedAmount !== undefined) {
    requestedAmountMinor = toMinorUnits(Number(raw.requestedAmount))
  } else if (payment && kind === 'REFUND') {
    requestedAmountMinor = toMinorUnits(payment.amount)
  }
  if (!Number.isInteger(requestedAmountMinor) || requestedAmountMinor < 0) {
    return Response.json({ error: 'Invalid requested amount.' }, { status: 400 })
  }
  if (kind === 'REFUND' && requestedAmountMinor <= 0) {
    return Response.json({ error: 'Refund cases require a positive requested amount.' }, { status: 400 })
  }
  if (payment && requestedAmountMinor > toMinorUnits(payment.amount)) {
    return Response.json({ error: 'Requested refund exceeds the linked payment amount.' }, { status: 400 })
  }

  const caseNumber = await nextRefundCaseNumber()
  const initialStatus = kind === 'DISPUTE' ? 'DISPUTE_OPEN' : 'REQUESTED'

  const created = await db.$transaction(async (tx) => {
    const refundCase = await tx.refundCase.create({
      data: {
        caseNumber,
        clientId: client.id,
        projectId,
        invoiceId: invoice?.id ?? payment?.invoiceId ?? null,
        paymentId: payment?.id ?? null,
        kind,
        status: initialStatus,
        requestedAmountMinor,
        approvedAmountMinor: 0,
        currency,
        reason,
        policyBasis,
        evidenceNotes,
        requestedBy: g.user.email,
        revokeHandover,
      },
    })

    const targetInvoiceId = invoice?.id ?? payment?.invoiceId ?? null
    if (targetInvoiceId) {
      if (kind === 'DISPUTE') {
        await tx.invoice.update({ where: { id: targetInvoiceId }, data: { status: 'DISPUTED', updatedAt: new Date() } })
      } else if (kind === 'REFUND') {
        await tx.invoice.update({ where: { id: targetInvoiceId }, data: { status: 'REFUND_PENDING', updatedAt: new Date() } })
      }
    }

    await tx.approvalRequest.create({
      data: {
        type: 'REFUND',
        title: `${kind} ${caseNumber} — ${client.clientId} (${currency} ${fromMinorUnits(requestedAmountMinor).toFixed(2)})`,
        description: reason,
        risk: 'HIGH',
        clientId: client.id,
        projectId,
        requestedBy: g.user.email,
        payload: JSON.stringify({
          refundCaseId: refundCase.id,
          caseNumber,
          kind,
          requestedAmountMinor,
          currency,
        }),
      },
    })

    return refundCase
  })

  await audit({
    userId: g.user.id,
    actor: g.user.email,
    action: 'REFUND_CASE_OPENED',
    entityType: 'RefundCase',
    entityId: created.id,
    clientId: client.clientId,
    projectId: projectId ?? undefined,
    details: { caseNumber, kind, requestedAmountMinor, currency },
    ip: g.ip,
  })

  return Response.json({ ok: true, refundCase: created }, { status: 201 })
}
