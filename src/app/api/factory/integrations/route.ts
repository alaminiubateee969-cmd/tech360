import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { writeFactoryAudit } from '@/lib/factory/control/access'
import { refreshIntegrations } from '@/lib/factory/control/data'
import { ADAPTERS } from '@/lib/factory/control/integrations'
import { bad, guardFailed, noStore, readBody, requireActor, text } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const url = new URL(req.url)
  const companyId = text(url.searchParams.get('companyId'), 60)
  const rows = await db.factoryIntegration.findMany({ where: companyId ? { companyId } : {}, orderBy: [{ companyId: 'asc' }, { providerKey: 'asc' }], take: 300 })
  return noStore({
    adapters: ADAPTERS, integrations: rows, total: rows.length,
    policy: 'An unconfigured or disabled provider is never reported as connected. Disabling one never affects internal-only modules.',
  })
}

export async function POST(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const body = await readBody(req)
  const action = text(body.action, 24).toLowerCase()
  const companyId = text(body.companyId, 60)
  if (!companyId) return bad('companyId is required')
  if (action === 'refresh') {
    const result = await refreshIntegrations(g.actor, companyId)
    return noStore(result, result.ok ? 200 : 403)
  }
  if (action === 'toggle') {
    const providerKey = text(body.providerKey, 60)
    const enabled = body.enabled === true
    const row = await db.factoryIntegration.findFirst({ where: { companyId, providerKey } })
    if (!row) return bad('Integration not found for this company', 404)
    const adapter = ADAPTERS.find((a) => a.key === providerKey)
    if (!adapter) return bad('Unknown adapter')
    // Never allow enabled=true without the credentials that adapter requires.
    const missing = adapter.envKeys.filter((k) => !process.env[k]?.trim())
    if (enabled && missing.length) return bad(`Cannot enable ${adapter.label}: missing ${missing.join(', ')}. The adapter stays disabled and is reported as NOT_CONFIGURED.`, 409)
    const updated = await db.factoryIntegration.update({ where: { id: row.id }, data: {
      enabled, status: enabled ? (adapter.kind === 'INTERNAL' ? 'AVAILABLE' : 'UNAVAILABLE') : 'DISABLED',
      lastCheckedAt: new Date(), lastError: null,
    } })
    await writeFactoryAudit({ actor: g.actor, action: 'FACTORY_INTEGRATION_TOGGLE', targetType: 'INTEGRATION', targetId: row.id, companyId, detail: { providerKey, enabled } })
    return noStore({ integration: updated })
  }
  return bad(`Unknown action "${action}"`)
}
