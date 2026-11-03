import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { peekCompanyAccess } from '@/lib/factory/control/access'
import { runScopedJob } from '@/lib/factory/control/data'
import { bad, guardFailed, noStore, readBody, requireActor, text } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const jobs = await db.factoryProvisionJob.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  const visible: Array<Record<string, unknown>> = []
  for (const j of jobs) if (await peekCompanyAccess(g.actor, j.companyId)) visible.push(j)
  return noStore({ jobs: visible, total: visible.length })
}

export async function POST(req: NextRequest) {
  const g = await requireActor(req, 'STAFF')
  if (guardFailed(g)) return g
  const body = await readBody(req)
  const result = await runScopedJob(g.actor, text(body.companyId, 60), text(body.jobId, 60))
  return noStore(result as unknown as Record<string, unknown>, result.ok ? 200 : 403)
}
