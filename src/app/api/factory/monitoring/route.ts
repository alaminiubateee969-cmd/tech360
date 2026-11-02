import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { runHealthChecks } from '@/lib/factory/control/health'
import { bad, guardFailed, noStore, readBody, requireActor, text } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const [apps, checks, integrations, jobs] = await Promise.all([
    db.factoryApplication.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    db.factoryHealthCheck.findMany({ orderBy: { checkedAt: 'desc' }, take: 100 }),
    db.factoryIntegration.findMany({ take: 300 }),
    db.factoryProvisionJob.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
  ])
  const alerts = apps.filter((a) => a.healthStatus === 'DOWN' || a.healthStatus === 'DEGRADED').map((a) => ({
    applicationId: a.id, code: a.code, status: a.healthStatus, detail: `Last check ${a.lastHealthAt?.toISOString() ?? 'never'}`,
  }))
  return noStore({ applications: apps.map((a) => ({ id: a.id, code: a.code, name: a.name, status: a.status, healthStatus: a.healthStatus, lastHealthAt: a.lastHealthAt, companyId: a.companyId })), checks, integrations, jobs, alerts })
}

export async function POST(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const body = await readBody(req)
  const applicationId = text(body.applicationId, 60)
  if (!applicationId) return bad('applicationId is required')
  return noStore(await runHealthChecks(applicationId, g.actor))
}
