import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { peekCompanyAccess } from '@/lib/factory/control/access'
import { deploymentSummary } from '@/lib/factory/control/provision'
import { bad, guardFailed, noStore, requireActor } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const { id } = await params
  const app = await db.factoryApplication.findUnique({ where: { id } })
  if (!app) return bad('Application not found', 404)
  const [revisions, modules, backups, releases, checks, integrations, jobs, company] = await Promise.all([
    db.factoryConfigRevision.findMany({ where: { applicationId: id }, orderBy: { version: 'desc' } }),
    db.factoryAppModule.findMany({ where: { applicationId: id }, orderBy: { moduleId: 'asc' } }),
    db.factoryBackup.findMany({ where: { applicationId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.factoryRelease.findMany({ where: { applicationId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.factoryHealthCheck.findMany({ where: { applicationId: id }, orderBy: { checkedAt: 'desc' }, take: 10 }),
    db.factoryIntegration.findMany({ where: { companyId: app.companyId }, orderBy: { providerKey: 'asc' } }),
    db.factoryProvisionJob.findMany({ where: { applicationId: id }, orderBy: { createdAt: 'desc' }, take: 10 }),
    db.factoryCompany.findUnique({ where: { id: app.companyId }, select: { id: true, name: true, code: true, kind: true, isolationModel: true } }),
  ])
  const dataAccess = await peekCompanyAccess(g.actor, app.companyId, 'read')
  return noStore({
    application: app,
    config: JSON.parse(app.config),
    deployment: deploymentSummary(app),
    company, revisions, modules, backups, releases, checks, integrations, jobs, dataAccess,
    recordCount: dataAccess ? await db.factoryRecord.count({ where: { applicationId: id } }) : null,
    fileCount: dataAccess ? await db.factoryFile.count({ where: { applicationId: id } }) : null,
  })
}
