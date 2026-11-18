import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, readJson, sanitizeText } from '@/lib/security'
import { connectionStates, isConnectionProvider, testProviderConnection } from '@/lib/integrations/connection-tests'

export const dynamic = 'force-dynamic'

// SUPER ADMIN — GET: honest connection state per provider (from the last LIVE test).
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  return Response.json({ providers: await connectionStates() })
}

// SUPER ADMIN — POST { provider }: run a live connection test now and store it.
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN', limit: { max: 10, windowMs: 60_000 } })
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const provider = sanitizeText(raw.provider, 20).toUpperCase()
  if (!isConnectionProvider(provider)) return Response.json({ error: 'Unknown provider', code: 'BAD_PROVIDER' }, { status: 400 })
  const result = await testProviderConnection(provider)
  await audit({ actor: g.user.email, action: 'INTEGRATION_CONNECTION_TESTED', userId: g.user.id, entityType: 'Integration', entityId: provider, details: { ok: result.ok, httpStatus: result.httpStatus }, ip: g.ip })
  return Response.json({ ok: result.ok, result, providers: await connectionStates() })
}
