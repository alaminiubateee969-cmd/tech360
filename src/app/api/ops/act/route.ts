import { NextRequest } from 'next/server'
import { executeOpsAction } from '@/lib/ops-actions'
import { readJson, sanitizeText, rateLimit, clientIp, constantTimeEquals } from '@/lib/security'

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const secret = process.env.OPS_SECRET
  // already fails closed on an unset secret; compare in constant time so the
  // value cannot be recovered byte-by-byte through response timing
  return constantTimeEquals(req.headers.get('x-ops-secret'), secret)
}

// ============================================================
// AI OPERATIONS ACT — single actions executed BY the autonomous
// loop (dev mini-service, n8n, or manual ops trigger). All real
// work lives in src/lib/ops-actions.ts, shared with the in-process
// production cycle so there is one source of truth.
// ============================================================
export async function POST(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = rateLimit(`ops-act:${clientIp(req)}`, 120, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 })

  const raw = await readJson(req)
  const action = sanitizeText(raw.action, 40).toUpperCase()
  const payload = (raw.payload ?? {}) as Record<string, unknown>

  const result = await executeOpsAction(action, payload)
  if (!result.ok && result.status >= 500) return Response.json(result.data, { status: result.status })
  return Response.json({ ok: result.ok, ...result.data }, { status: result.ok ? 200 : result.status })
}
