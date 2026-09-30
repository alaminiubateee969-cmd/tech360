import { NextRequest } from 'next/server'
import { recordHeartbeat } from '@/lib/ops-loop'
import { rateLimit, clientIp, constantTimeEquals } from '@/lib/security'

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const secret = process.env.OPS_SECRET
  // already fails closed on an unset secret; compare in constant time so the
  // value cannot be recovered byte-by-byte through response timing
  return constantTimeEquals(req.headers.get('x-ops-secret'), secret)
}

// Heartbeat kept for compatibility (dev service / probes). The
// in-process cycle records its own heartbeat each run.
export async function POST(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = rateLimit(`ops-hb:${clientIp(req)}`, 120, 60_000)
  if (!rl.ok) return Response.json({ ok: true })

  const cycles = await recordHeartbeat()
  return Response.json({ ok: true, ts: new Date().toISOString(), cycles })
}
