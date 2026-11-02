import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guardFailed, noStore, requireActor } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

/** Real counts only. Nothing here is a placeholder or a simulated metric. */
export async function GET(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const [
    companies, templates, modules, apps, jobs, releases, backups, integrations, audits,
    recentJobs, recentAudit, templateLinks,
  ] = await Promise.all([
    db.factoryCompany.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    db.factoryTemplate.findMany({ orderBy: { code: 'asc' } }),
    db.factoryModule.findMany({ orderBy: { code: 'asc' } }),
    db.factoryApplication.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    db.factoryProvisionJob.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    db.factoryRelease.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    db.factoryBackup.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    db.factoryIntegration.findMany({ take: 200 }),
    db.factoryAuditEvent.count(),
    db.factoryProvisionJob.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    db.factoryAuditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    db.factoryTemplateModule.count(),
  ])
  const byStatus = (rows: Array<{ status: string }>) => rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})
  return noStore({
    generatedAt: new Date().toISOString(),
    catalogInitialized: modules.length > 0 && templates.length > 0,
    counts: {
      companies: companies.length, templates: templates.length, modules: modules.length,
      applications: apps.length, jobs: await db.factoryProvisionJob.count(), releases: releases.length,
      backups: backups.length, verifiedBackups: backups.filter((b) => Boolean(b.verifiedAt)).length,
      integrations: integrations.length, auditEvents: audits, templateModuleLinks: templateLinks,
      productionReadyTemplates: templates.filter((t) => t.status === 'PRODUCTION_READY').length,
    },
    companies: companies.map((c) => ({ id: c.id, code: c.code, slug: c.slug, name: c.name, kind: c.kind, status: c.status, isolationModel: c.isolationModel, domain: c.domain, createdAt: c.createdAt })),
    applicationStatuses: byStatus(apps),
    jobStatuses: byStatus(jobs),
    healthStatuses: apps.reduce<Record<string, number>>((acc, a) => { acc[a.healthStatus] = (acc[a.healthStatus] ?? 0) + 1; return acc }, {}),
    integrationStatuses: byStatus(integrations),
    recentJobs, recentAudit,
    note: 'Every value is read from the control-plane database. No simulated deployment, health or activity data.',
  })
}
