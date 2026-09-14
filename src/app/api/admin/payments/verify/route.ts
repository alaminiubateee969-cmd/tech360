import { featureEnabled } from "@/lib/features"
import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText } from '@/lib/security'
import { verifyPayment } from '@/lib/journey'

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
  try {
    await verifyPayment(paymentId, g.user.id)
    return Response.json({ ok: true, message: 'Payment verified. Project status and pipeline updated.' })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
