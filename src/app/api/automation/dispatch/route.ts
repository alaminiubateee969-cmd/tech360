import { NextRequest } from 'next/server'
import { clientIp, constantTimeEquals, logError, rateLimit } from '@/lib/security'
import { processDueAutomation } from '@/lib/automation/engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// SCHEDULER — automation dispatcher tick. Header `x-ops-secret: $OPS_SECRET`.
// Processes due retries, pending/scheduled events (follow-ups) and emits
// CONVERSATION_UNANSWERED events. Safe to call concurrently (atomic claims).
export async function POST(req: NextRequest) {
  if (!constantTimeEquals(req.headers.get('x-ops-secret'), process.env.OPS_SECRET)) {
    return Response.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const rl = rateLimit(`automation-dispatch:${clientIp(req)}`, 30, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 })
  try {
    const summary = await processDueAutomation()
    return Response.json({ ok: true, summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await logError({ source: 'AUTOMATION_DISPATCH', code: 'DISPATCH_FAILED', message: message.slice(0, 900) }).catch(() => null)
    return Response.json({ ok: false, error: 'Dispatch failed', code: 'DISPATCH_FAILED' }, { status: 500 })
  }
}
