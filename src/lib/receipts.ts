import { db } from '@/lib/db'
import { nextReceiptNumber } from '@/lib/ids'
import { evaluateReceiptEligibility } from '@/lib/invoice-policy'

/**
 * Issue (or return existing) official `PaymentReceipt` (`RCT-YYYY-NNNN`) for a
 * payment. Enforces server-side that ONLY verified `PAID` payments (`status ===
 * 'PAID'`, `verifiedAt`, `verifiedBy`) may ever receive a receipt.
 */
export async function ensureVerifiedPaymentReceipt(paymentId: string) {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: {
      receipt: true,
      client: { select: { id: true, clientId: true, name: true, businessName: true, email: true, country: true } },
      project: { select: { id: true, code: true, name: true } },
      invoice: { select: { id: true, number: true } },
    },
  })

  if (!payment) {
    return { ok: false as const, status: 404, code: 'PAYMENT_NOT_FOUND', error: 'Payment not found.' }
  }

  const eligibility = evaluateReceiptEligibility({
    status: payment.status,
    amount: payment.amount,
    verifiedAt: payment.verifiedAt,
    verifiedBy: payment.verifiedBy,
  })
  if (!eligibility.allowed) {
    return { ok: false as const, status: 409, code: eligibility.code, error: eligibility.error }
  }

  if (payment.receipt) {
    return {
      ok: true as const,
      receipt: payment.receipt,
      payment,
      created: false,
    }
  }

  const receiptNumber = await nextReceiptNumber()
  const verifiedAt = payment.verifiedAt!
  const verifiedBy = payment.verifiedBy!

  const snapshotPayload = {
    receiptNumber,
    paymentId: payment.id,
    invoiceNumber: payment.invoice?.number ?? null,
    clientCode: payment.client.clientId,
    clientName: payment.client.name,
    businessName: payment.client.businessName ?? null,
    projectCode: payment.project?.code ?? null,
    projectName: payment.project?.name ?? null,
    milestone: payment.milestone ?? null,
    amountMinor: eligibility.amountMinor,
    currency: payment.currency,
    method: payment.method ?? null,
    transactionId: payment.transactionId ?? null,
    verifiedBy,
    verifiedAt: verifiedAt.toISOString(),
  }

  try {
    const receipt = await db.paymentReceipt.create({
      data: {
        receiptNumber,
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        clientId: payment.clientId,
        projectId: payment.projectId,
        amountMinor: eligibility.amountMinor,
        currency: payment.currency,
        method: payment.method,
        transactionId: payment.transactionId,
        verifiedBy,
        verifiedAt,
        snapshot: JSON.stringify(snapshotPayload),
      },
    })
    return { ok: true as const, receipt, payment, created: true }
  } catch (err) {
    if (err && typeof err === 'object' && (err as { code?: unknown }).code === 'P2002') {
      const existing = await db.paymentReceipt.findUnique({ where: { paymentId: payment.id } })
      if (existing) return { ok: true as const, receipt: existing, payment, created: false }
    }
    throw err
  }
}
