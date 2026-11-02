import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { canApproveRelease, writeFactoryAudit } from '@/lib/factory/control/access'
import { bad, guardFailed, noStore, readBody, requireActor, text } from '@/lib/factory/control/http'
import { CHANGE_DISPOSITIONS } from '@/lib/factory/control/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const [requests, releases, modules, templates] = await Promise.all([
    db.factoryChangeRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    db.factoryRelease.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    db.factoryModule.findMany({ select: { code: true, name: true, currentVersion: true } }),
    db.factoryTemplate.findMany({ select: { code: true, name: true, currentVersion: true } }),
  ])
  return noStore({ requests, releases, modules, templates, dispositions: CHANGE_DISPOSITIONS })
}

export async function POST(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const body = await readBody(req)
  const action = text(body.action, 24).toLowerCase()
  if (action === 'create') {
    const title = text(body.title, 160)
    if (title.length < 5) return bad('A descriptive title is required')
    const n = await db.factoryChangeRequest.count()
    const row = await db.factoryChangeRequest.create({ data: {
      code: `CR-${String(n + 1).padStart(5, '0')}`, title,
      type: ['CHANGE', 'FEATURE', 'BUG', 'SECURITY', 'IMPROVEMENT'].includes(String(body.type)) ? String(body.type) : 'CHANGE',
      disposition: 'PENDING_TRIAGE', status: 'OPEN', companyId: text(body.companyId, 60) || null,
      requestedBy: g.actor.email, details: text(body.details, 8000) || null,
    } })
    await writeFactoryAudit({ actor: g.actor, action: 'FACTORY_CHANGE_CREATE', targetType: 'CHANGE_REQUEST', targetId: row.id, companyId: row.companyId, detail: { title } })
    return noStore({ request: row }, 201)
  }
  const id = text(body.requestId, 60)
  const row = id ? await db.factoryChangeRequest.findUnique({ where: { id } }) : null
  if (!row) return bad('Change request not found', 404)
  if (action === 'triage') {
    const disposition = text(body.disposition, 40)
    if (!CHANGE_DISPOSITIONS.includes(disposition as typeof CHANGE_DISPOSITIONS[number])) return bad('Invalid disposition')
    const decision = text(body.decision, 2000)
    const updated = await db.factoryChangeRequest.update({ where: { id: row.id }, data: {
      disposition, status: 'TRIAGED', decision: decision || `Triaged as ${disposition}`,
    } })
    await writeFactoryAudit({ actor: g.actor, action: 'FACTORY_CHANGE_TRIAGE', targetType: 'CHANGE_REQUEST', targetId: row.id, companyId: row.companyId, detail: { disposition } })
    return noStore({ request: updated })
  }
  if (action === 'approve') {
    if (!canApproveRelease(g.actor)) return bad('Approval requires a SUPER_ADMIN', 403)
    const decision = text(body.decision, 2000)
    if (decision.length < 10) return bad('A meaningful approval decision is required')
    const updated = await db.factoryChangeRequest.update({ where: { id: row.id }, data: {
      status: 'APPROVED', decision, linkedReleaseId: text(body.releaseId, 60) || null,
    } })
    await writeFactoryAudit({ actor: g.actor, action: 'FACTORY_CHANGE_APPROVE', targetType: 'CHANGE_REQUEST', targetId: row.id, companyId: row.companyId, detail: { decision } })
    return noStore({ request: updated })
  }
  return bad(`Unknown action "${action}"`)
}
