import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { audit } from '@/lib/security'
import { n8nPublicStatus, testN8nConnection } from '@/lib/n8n/adapter'
import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'

export const dynamic = 'force-dynamic'

// SUPER ADMIN — run a LIVE connection test against the configured n8n host.
// "Connected" is only ever shown after this succeeds; the result is stored.
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE, limit: { max: 10, windowMs: 60_000 } })
  if (isResponse(g)) return g
  const result = await testN8nConnection()
  await audit({ actor: g.user.email, action: 'N8N_CONNECTION_TESTED', userId: g.user.id, entityType: 'Integration', entityId: 'N8N', details: { ok: result.ok, httpStatus: result.httpStatus }, ip: g.ip })
  return Response.json({ ok: result.ok, result, status: await n8nPublicStatus() }, { status: 200 })
}
