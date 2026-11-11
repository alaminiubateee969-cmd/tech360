import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { peekCompanyAccess, writeFactoryAudit } from '@/lib/factory/control/access'
import { bad, guardFailed, noStore, readBody, requireActor, text } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const { id } = await params
  const company = await db.factoryCompany.findUnique({ where: { id } })
  if (!company) return bad('Company not found', 404)
  const dataAccess = await peekCompanyAccess(g.actor, id, 'audit')
  const [definitions, members, applications, backups, releases, integrations] = await Promise.all([
    db.factoryCompanyDefinition.findMany({ where: { companyId: id }, orderBy: { version: 'desc' } }),
    db.factoryCompanyMember.findMany({ where: { companyId: id }, orderBy: { userEmail: 'asc' } }),
    db.factoryApplication.findMany({ where: { companyId: id }, orderBy: { createdAt: 'desc' } }),
    db.factoryBackup.findMany({ where: { companyId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.factoryRelease.findMany({ where: { companyId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.factoryIntegration.findMany({ where: { companyId: id }, orderBy: { providerKey: 'asc' } }),
  ])
  // tenantKey is an identity secret of the primary environment: never expose.
  const { tenantKey: _hidden, ...safeCompany } = company
  return noStore({
    company: safeCompany, definitions, members, applications, backups, releases, integrations,
    dataAccess,
    auditEvents: dataAccess ? await db.factoryAuditEvent.findMany({ where: { companyId: id }, orderBy: { createdAt: 'desc' }, take: 50 }) : [],
    note: dataAccess ? 'Full company detail' : 'Registry metadata only — private business data requires an explicit company grant',
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const { id } = await params
  const company = await db.factoryCompany.findUnique({ where: { id } })
  if (!company) return bad('Company not found', 404)
  const body = await readBody(req)
  const allowed = ['contractStatus', 'supportStatus', 'status', 'retentionDays', 'backupPolicy'] as const
  const data: Record<string, unknown> = {}
  for (const key of allowed) if (body[key] !== undefined) data[key] = body[key]
  if (Object.keys(data).length === 0) return bad('No allowed field to update')
  if (data.status && !['DRAFT', 'CONFIGURED', 'PROVISIONING', 'ACTIVE', 'SUSPENDED', 'RETIRED'].includes(String(data.status))) return bad('Invalid company status')
  const updated = await db.factoryCompany.update({ where: { id }, data })
  await writeFactoryAudit({ actor: g.actor, action: 'FACTORY_COMPANY_UPDATE', targetType: 'COMPANY', targetId: id, companyId: id, detail: data })
  return noStore({ company: updated })
}
