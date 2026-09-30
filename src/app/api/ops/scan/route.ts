import { NextRequest } from 'next/server'
import { opsScan } from '@/lib/ops-loop'
import { rateLimit, clientIp, constantTimeEquals } from '@/lib/security'

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const secret = process.env.OPS_SECRET
  // already fails closed on an unset secret; compare in constant time so the
  // value cannot be recovered byte-by-byte through response timing
  return constantTimeEquals(req.headers.get('x-ops-secret'), secret)
}

// AI Operations scan: everything the autonomous loop needs to decide.
// Real database queries — no fabrication. Shared with the in-process
// cycle (src/lib/ops-loop.ts) — this route stays for manual/n8n use.
export async function GET(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = rateLimit(`ops-scan:${clientIp(req)}`, 120, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 })

  return Response.json(await opsScan())
}
