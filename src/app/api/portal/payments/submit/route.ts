import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { featureEnabled } from '@/lib/features'
import { verifyPortalToken, PORTAL_COOKIE, portalGate } from '@/lib/portal'
import {
  computeInvoiceSettlement,
  isPayableInvoiceStatus,
  resolveInvoiceTotalMinor,
  toMinorUnits,
} from '@/lib/invoice-policy'
import { evaluateClientPaymentProofSubmission, paymentStatusLabel } from '@/lib/payment-policy'
import { redactSensitiveCrmData } from '@/lib/sensitive-redaction'
import { readJson, sanitizeText, audit, rateLimit, clientIp } from '@/lib/security'
import { createNotification } from '@/lib/notify'

export const dynamic = 'force-dynamic'

/**
 * POST /api/portal/payments/submit
 *
 * Client submits payment reference and/or uploaded screenshot evidence
 * (`proofFileId` from `/api/portal/documents`) against a pending payment or
 * payable invoice.
 *
 * Policy enforcement (Stage 8 / Section 10):
 * - A screenshot or client-supplied reference is stored as EVIDENCE ONLY.
 * - Status transitions to `SUBMITTED` ("Payment Submitted") — NEVER `PAID`.
 * - Only governed Super Admin reconciliation (`/api/admin/payments/verify`)
 *   or a cryptographically verified gateway webhook can mark a payment `PAID`.
 */
export async function POST(req: NextRequest) {
  const portalDisabled = await portalGate()
  if (portalDisabled) return portalDisabled
  if (!(await featureEnabled('payments'))) {
    return Response.json({ error: 'Payment submissions are currently unavailable. Please contact info@bdtech360.com.' }, { status: 503 })
  }

  const ip = clientIp(req)
  const rl = rateLimit(`portal-payment-submit:${ip}`, 10, 10 * 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many submissions. Please wait a few minutes.' }, { status: 429 })

  const store = await cookies()
  const clientId = verifyPortalToken(store.get(PORTAL_COOKIE)?.value)
  if (!clientId) return Response.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })

  const client = await db.client.findFirst({
    where: { clientId, deletedAt: null },
    include: { projects: true },
  })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  const raw = await readJson(req)
  const paymentId = sanitizeText(raw.paymentId, 40)
  const invoiceRef = sanitizeText(raw.invoiceNumber, 30) || sanitizeText(raw.invoiceId, 40)
  const transactionId = sanitizeText(raw.transactionId, 80)
  const proofFileId = sanitizeText(raw.proofFileId, 40)
  const method = sanitizeText(raw.method, 40) || 'MANUAL'
  const notes = redactSensitiveCrmData(sanitizeText(raw.notes, 1500)).text

  const policyCheck = evaluateClientPaymentProofSubmission({
    hasProofFile: Boolean(proofFileId),
    transactionId: transactionId || null,
    method,
  })
  if (!policyCheck.ok) {
    return Response.json({ error: policyCheck.error, code: policyCheck.code }, { status: 400 })
  }

  if (proofFileId) {
    const proof = await db.fileRecord.findFirst({
      where: { id: proofFileId, clientId: client.id, scanStatus: { not: 'REJECTED' } },
      select: { id: true },
    })
    if (!proof) {
      return Response.json({ error: 'Uploaded payment proof file was not found for your account.' }, { status: 404 })
    }
  }

  // Case 1: Updating an existing PENDING / FAILED payment record for this client
  if (paymentId) {
    const existing = await db.payment.findFirst({
      where: { id: paymentId, clientId: client.id },
    })
    if (!existing) return Response.json({ error: 'Payment record not found.' }, { status: 404 })
    if (existing.status === 'PAID') {
      return Response.json({ error: 'This payment is already verified.' }, { status: 409 })
    }
    if (!['PENDING', 'SUBMITTED', 'FAILED'].includes(existing.status)) {
      return Response.json({ error: `Payment in state ${existing.status} cannot be re-submitted.` }, { status: 409 })
    }

    const updated = await db.payment.update({
      where: { id: existing.id },
      data: {
        status: policyCheck.status, // strictly 'SUBMITTED'
        ...(transactionId ? { transactionId } : {}),
        ...(proofFileId ? { proofFileId } : {}),
        ...(method ? { method } : {}),
        ...(notes ? { notes } : {}),
      },
    })

    await audit({
      actor: `client:${client.clientId}`,
      action: 'PAYMENT_PROOF_SUBMITTED',
      clientId: client.clientId,
      entityType: 'Payment',
      entityId: updated.id,
      details: {
        status: updated.status,
        hasProofFile: Boolean(proofFileId),
        hasTransactionId: Boolean(transactionId),
        evidenceOnly: true,
      },
      ip,
    })

    await createNotification({
      type: 'PAYMENT_PROOF',
      severity: 'INFO',
      title: `Payment proof submitted: ${client.clientId}`,
      body: `${client.name} submitted payment evidence (${updated.currency} ${updated.amount}). Screenshot/reference is stored as evidence only — human reconciliation required before marking PAID.`,
      link: 'finance',
    })

    return Response.json({
      ok: true,
      payment: {
        id: updated.id,
        status: updated.status,
        statusLabel: paymentStatusLabel(updated.status),
        evidenceOnly: true,
      },
      message: policyCheck.notice,
    })
  }

  // Case 2: Submitting proof against an issued/payable invoice
  if (!invoiceRef) {
    return Response.json({ error: 'Provide either paymentId or invoiceNumber to submit payment proof.' }, { status: 400 })
  }

  const invoice = await db.invoice.findFirst({
    where: { OR: [{ number: invoiceRef }, { id: invoiceRef }], clientId: client.id },
    include: { payments: { select: { amount: true, status: true } } },
  })
  if (!invoice) return Response.json({ error: 'Invoice not found.' }, { status: 404 })
  if (!isPayableInvoiceStatus(invoice.status)) {
    return Response.json({ error: `Invoice ${invoice.number} is not currently payable.` }, { status: 409 })
  }

  const settlement = computeInvoiceSettlement({
    invoiceAmount: invoice.amount,
    invoiceTotalMinor: resolveInvoiceTotalMinor({ totalMinor: invoice.totalMinor, amount: invoice.amount }),
    currentStatus: invoice.status,
    dueAt: invoice.dueAt,
    payments: invoice.payments,
  })
  const requestedAmount = raw.amount !== undefined ? Number(raw.amount) : settlement.remainingAmount
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    return Response.json({ error: 'Enter a valid positive payment amount.' }, { status: 400 })
  }
  if (toMinorUnits(requestedAmount) > settlement.remainingMinor) {
    return Response.json(
      { error: `Submitted amount (${requestedAmount}) exceeds remaining unpaid balance (${settlement.remainingAmount}) on invoice ${invoice.number}.` },
      { status: 400 },
    )
  }

  const created = await db.payment.create({
    data: {
      clientId: client.id,
      projectId: invoice.projectId ?? client.projects[0]?.id ?? null,
      invoiceId: invoice.id,
      amount: requestedAmount,
      currency: invoice.currency,
      method,
      transactionId: transactionId || undefined,
      proofFileId: proofFileId || null,
      milestone: `Invoice ${invoice.number}`,
      notes: notes || null,
      status: policyCheck.status, // strictly 'SUBMITTED'
    },
  })

  await audit({
    actor: `client:${client.clientId}`,
    action: 'PAYMENT_PROOF_SUBMITTED',
    clientId: client.clientId,
    entityType: 'Payment',
    entityId: created.id,
    details: {
      invoiceNumber: invoice.number,
      amount: requestedAmount,
      status: created.status,
      hasProofFile: Boolean(proofFileId),
      evidenceOnly: true,
    },
    ip,
  })

  await createNotification({
    type: 'PAYMENT_PROOF',
    severity: 'INFO',
    title: `Payment proof submitted for ${invoice.number}`,
    body: `${client.clientId} (${client.name}) submitted payment evidence (${invoice.currency} ${requestedAmount}). Reconcile against actual gateway/bank settlement before verifying.`,
    link: 'finance',
  })

  return Response.json({
    ok: true,
    payment: {
      id: created.id,
      status: created.status,
      statusLabel: paymentStatusLabel(created.status),
      evidenceOnly: true,
    },
    message: policyCheck.notice,
  }, { status: 201 })
}
