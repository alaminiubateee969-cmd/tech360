import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { peekCompanyAccess, writeFactoryAudit } from '@/lib/factory/control/access'
import { runHealthChecks } from '@/lib/factory/control/health'
import { activateApplication, retireApplication, submitForApproval, updateApplicationConfig } from '@/lib/factory/control/provision'
import { bad, guardFailed, noStore, readBody, requireActor, text } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const url = new URL(req.url)
  const companyId = text(url.searchParams.get('companyId'), 60) || undefined
  const apps = await db.factoryApplication.findMany({ where: companyId ? { companyId } : {}, orderBy: { createdAt: 'desc' }, take: 200 })
  const companies = await db.factoryCompany.findMany({ select: { id: true, name: true, code: true, kind: true } })
  const visible: Array<Record<string, unknown>> = []
  for (const a of apps) if (await peekCompanyAccess(g.actor, a.companyId)) visible.push(a)
  return noStore({ applications: visible, companies, total: visible.length })
}

export async function POST(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const body = await readBody(req)
  const action = text(body.action, 24).toLowerCase()
  const id = text(body.applicationId, 60)
  if (!id) return bad('applicationId is required')
  const app = await db.factoryApplication.findUnique({ where: { id } })
  if (!app) return bad('Application not found', 404)
  if (action === 'submit') return noStore(await submitForApproval(id, g.actor))
  if (action === 'activate') return noStore(await activateApplication(id, g.actor, text(body.evidence, 2000) || null))
  if (action === 'retire') return noStore(await retireApplication(id, g.actor, text(body.reason, 1000)))
  if (action === 'config') return noStore(await updateApplicationConfig(id, body.config ?? body.patch ?? {}, g.actor))
  if (action === 'health') return noStore(await runHealthChecks(id, g.actor))
  if (action === 'grant') {
    // Explicit, audited, time-limited privileged access grant.
    const email = text(body.email, 200).toLowerCase()
    const reason = text(body.reason, 1000)
    if (!email.includes('@') || reason.length < 10) return bad('A valid email and a meaningful reason are required')
    if (g.actor.role !== 'SUPER_ADMIN') return bad('Only a SUPER_ADMIN can grant privileged company access', 403)
    const expiresAt = new Date(Date.now() + Math.min(90, Math.max(1, Number(body.days ?? 7))) * 24 * 3600 * 1000)
    const member = await db.factoryCompanyMember.upsert({
      where: { companyId_userEmail: { companyId: app.companyId, userEmail: email } },
      create: { companyId: app.companyId, userEmail: email, role: 'FACTORY_OPERATOR', status: 'ACTIVE', privileged: true, grantedBy: g.actor.email, grantReason: reason, expiresAt },
      update: { status: 'ACTIVE', privileged: true, grantedBy: g.actor.email, grantReason: reason, expiresAt },
    })
    await writeFactoryAudit({ actor: g.actor, action: 'FACTORY_GRANT_CREATE', targetType: 'MEMBER', targetId: member.id, companyId: app.companyId, detail: { email, reason, expiresAt } })
    return noStore({ member })
  }
  return bad(`Unknown action "${action}"`)
}
