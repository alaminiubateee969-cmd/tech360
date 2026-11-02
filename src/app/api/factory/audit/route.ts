import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolveCompanyAccess } from '@/lib/factory/control/access'
import { bad, guardFailed, noStore, requireActor, text } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const url = new URL(req.url)
  const companyId = text(url.searchParams.get('companyId'), 60)
  const decision = text(url.searchParams.get('decision'), 10).toUpperCase()
  if (companyId) {
    const access = await resolveCompanyAccess(g.actor, companyId, 'audit', 'FACTORY_AUDIT_READ')
    if (!access.ok) return bad(access.reason, 403, access.code)
  } else if (g.actor.role !== 'SUPER_ADMIN') {
    return bad('Global audit view requires a SUPER_ADMIN', 403)
  }
  const rows = await db.factoryAuditEvent.findMany({
    where: { ...(companyId ? { companyId } : {}), ...(decision === 'DENY' || decision === 'ALLOW' ? { decision } : {}) },
    orderBy: { createdAt: 'desc' }, take: 200,
  })
  const denials = rows.filter((r) => r.decision === 'DENY').length
  return noStore({ events: rows, total: rows.length, denials })
}
