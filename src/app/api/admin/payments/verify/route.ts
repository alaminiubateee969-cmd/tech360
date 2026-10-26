import { featureEnabled } from "@/lib/features"
import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText } from '@/lib/security'
import { verifyPayment } from '@/lib/journey'
import { GovernanceDeniedError, ensureGovernedApproval } from '@/lib/governance/enforce'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // feature-gate: payments switch (Super Admin)
  if (!(await featureEnabled('payments'))) {
    return Response.json({ error: 'Payments are currently disabled by Super Admin.' }, { status: 503 })
  }
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const paymentId = sanitizeText(raw.paymentId, 40)
  if (!paymentId) return Response.json({ error: 'paymentId required' }, { status: 400 })
  const approvalId = sanitizeText(raw.approvalId, 40) || null
  try {
    await verifyPayment(paymentId, { type: 'HUMAN', id: g.user.id, role: g.user.role }, approvalId)
    return Response.json({ ok: true, message: 'Payment verified. Project status and pipeline updated.' })
  } catch (e) {
    if (e instanceof GovernanceDeniedError) {
      if (e.code === 'APPROVAL_REQUIRED') {
        // Verification is not performed. A PENDING approval is raised for a
        // Super Admin, and the request is repeated with its id once approved.
        const payment = await db.payment.findUnique({ where: { id: paymentId }, select: { id: true, clientId: true, projectId: true, amount: true } })
        const pendingId = payment
          ? await ensureGovernedApproval({
              action: 'payment.verify',
              requestedBy: g.user.id,
              resourceKey: `payment:${payment.id}`,
              amountMinor: Math.round(payment.amount * 100),
              clientId: payment.clientId,
              projectId: payment.projectId,
              title: 'Verify payment',
              description: 'A payment verification needs a Super Admin approval before the payment is marked paid.',
              extraPayload: { paymentId: payment.id },
            })
          : null
        return Response.json(
          { ok: false, status: 'APPROVAL_REQUIRED', approvalId: pendingId, error: 'Payment not verified. A Super Admin approval is required; it has been raised.', message: 'Payment not verified. A Super Admin approval is required; it has been raised.' },
          { status: 409 },
        )
      }
      return Response.json({ ok: false, status: 'GOVERNANCE_DENIED', code: e.code, error: 'This action was refused by governance.' }, { status: 403 })
    }
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
