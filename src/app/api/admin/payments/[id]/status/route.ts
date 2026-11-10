import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { featureEnabled } from '@/lib/features'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { paymentStatusLabel, validatePaymentLifecycleTransition } from '@/lib/payment-policy'
import { redactSensitiveCrmData } from '@/lib/sensitive-redaction'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/payments/[id]/status
 *
 * Governed operator transition for non-final Stage 8 payment states:
 *   - PENDING / SUBMITTED -> UNDER_VERIFICATION ("Payment Under Verification")
 *   - PENDING / SUBMITTED / UNDER_VERIFICATION -> FAILED ("Payment Failed")
 *   - FAILED -> SUBMITTED / UNDER_VERIFICATION (after re-submission)
 *
 * Direct transition to `PAID` is strictly refused here: `PAID` ("Payment Verified")
 * requires Super Admin approval through `/api/admin/payments/verify`.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await featureEnabled('payments'))) {
    return Response.json({ error: 'Payments are currently disabled by Super Admin.' }, { status: 503 })
  }
  const g = await guard(req, { capability: 'finance.payment.record', capabilityOnly: true })
  if (isResponse(g)) return g

  const { id } = await ctx.params
  const paymentId = sanitizeText(id, 40)
  if (!paymentId) return Response.json({ error: 'Payment id required.' }, { status: 400 })

  const raw = await readJson(req)
  const targetStatus = sanitizeText(raw.status, 30).toUpperCase()
  const reason = redactSensitiveCrmData(sanitizeText(raw.reason ?? raw.notes, 1000)).text

  const existing = await db.payment.findUnique({
    where: { id: paymentId },
    include: { client: { select: { clientId: true, name: true } } },
  })
  if (!existing) return Response.json({ error: 'Payment not found.' }, { status: 404 })

  const check = validatePaymentLifecycleTransition({
    currentStatus: existing.status,
    targetStatus,
  })
  if (!check.ok) {
    return Response.json({ error: check.error, code: check.code }, { status: 409 })
  }

  const mergedNotes = reason
    ? [existing.notes, `[${new Date().toISOString()} · ${check.nextStatus}] ${reason}`].filter(Boolean).join('\n')
    : existing.notes

  const updated = await db.payment.update({
    where: { id: existing.id },
    data: {
      status: check.nextStatus,
      notes: mergedNotes ? mergedNotes.slice(0, 4000) : null,
    },
  })

  await audit({
    actor: g.user.email,
    userId: g.user.id,
    action: 'PAYMENT_STATUS_UPDATED',
    clientId: existing.client.clientId,
    entityType: 'Payment',
    entityId: updated.id,
    details: {
      previousStatus: existing.status,
      nextStatus: updated.status,
      statusLabel: paymentStatusLabel(updated.status),
      reason: reason || null,
    },
  })

  return Response.json({
    ok: true,
    payment: {
      ...updated,
      statusLabel: paymentStatusLabel(updated.status),
    },
  })
}
