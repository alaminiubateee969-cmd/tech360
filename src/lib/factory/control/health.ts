/**
 * Real, recomputed health checks. Each row persisted in FactoryHealthCheck is
 * produced by actually querying the database — never by a timer, a config
 * value or a decorative dashboard control.
 */
import { db } from '@/lib/db'
import type { Actor } from './access'
import { writeFactoryAudit } from './access'
import { getAdapter, computeAdapterStatus } from './integrations'
import type { ApplicationConfig, CheckResult } from './types'
import { checksum, jsonText, parseJson, stableStringify } from './util'

export interface HealthReport {
  applicationId: string
  companyId: string
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN'
  checks: CheckResult[]
  checkedAt: string
}

export async function evaluateHealth(app: {
  id: string
  companyId: string
  status: string
  config: string
  configChecksum: string
  healthStatus?: string
}): Promise<HealthReport> {
  const checks: CheckResult[] = []
  const add = (key: string, label: string, ok: boolean, detail: string) => checks.push({ key, label, ok, detail })

  let config: ApplicationConfig | null = null
  try {
    const parsed = JSON.parse(app.config) as ApplicationConfig
    if (parsed && parsed.schemaVersion === 1) config = parsed
  } catch { /* reported below */ }
  const configOk = Boolean(config) && checksum(config) === app.configChecksum
  add('config.checksum', 'Configuration integrity', configOk, configOk ? 'Stored configuration matches its SHA-256 checksum.' : 'Configuration is missing or its checksum does not match.')

  const latestRevision = await db.factoryConfigRevision.findFirst({ where: { applicationId: app.id }, orderBy: { version: 'desc' } })
  const revisionOk = Boolean(latestRevision) && latestRevision!.config === app.config
  add('config.revision', 'Known-good configuration revision', revisionOk, revisionOk ? `Revision v${latestRevision!.version} matches the live configuration.` : 'No matching configuration revision — rollback would be impossible.')

  const pins = await db.factoryAppModule.findMany({ where: { applicationId: app.id } })
  const approvedIds = new Set((await db.factoryModuleVersion.findMany({ where: { status: 'APPROVED' }, select: { id: true } })).map((v) => v.id))
  const pinOk = pins.length > 0 && pins.every((p) => approvedIds.has(p.moduleVersionId))
  add('modules.approved', 'Approved module version pins', pinOk, pinOk ? `${pins.length} module versions pinned to approved releases.` : 'An application module is pinned to a missing or unapproved version.')

  const orphanRecords = await db.factoryRecord.count({ where: { applicationId: app.id, companyId: { not: app.companyId } } })
  const orphanFiles = await db.factoryFile.count({ where: { applicationId: app.id, companyId: { not: app.companyId } } })
  add('isolation.records', 'Tenant-isolated records and files', orphanRecords === 0 && orphanFiles === 0, `Orphan records: ${orphanRecords}; orphan files: ${orphanFiles}.`)

  const adminGrants = await db.factoryCompanyMember.count({ where: { companyId: app.companyId, status: 'ACTIVE', role: 'COMPANY_ADMIN' } })
  add('identity.admin', 'Company administrator grant', adminGrants > 0, adminGrants > 0 ? `${adminGrants} active company administrator grant(s).` : 'No active COMPANY_ADMIN grant.')

  const integrations = await db.factoryIntegration.findMany({ where: { companyId: app.companyId } })
  const honestStates = integrations.every((row) => {
    const adapter = getAdapter(row.providerKey)
    if (!adapter) return false
    const computed = computeAdapterStatus(adapter, {
      enabled: row.enabled,
      envConfigured: row.configured,
      externalVerified: false,
      lastError: row.lastError,
    })
    return row.status !== 'AVAILABLE' || computed.availableNow || adapter.kind === 'INTERNAL'
  })
  add('integrations.honest', 'Integration status honesty', honestStates, `${integrations.length} adapter(s); no unconfigured adapter is reported as connected.`)

  const latestBackup = await db.factoryBackup.findFirst({ where: { applicationId: app.id }, orderBy: { createdAt: 'desc' } })
  const backupOk = Boolean(latestBackup?.verifiedAt)
  const live = app.status === 'LIVE'
  add('backup.verified', 'Verified recovery point', backupOk || !live, backupOk ? `Latest backup ${latestBackup!.code} verified at ${latestBackup!.verifiedAt?.toISOString()}.` : live ? 'LIVE application has no verified backup.' : 'Pre-activation backup not yet verified (not required until activation).')

  const failed = checks.filter((c) => !c.ok)
  const criticalFailures = failed.filter((c) => !c.key.startsWith('backup.'))
  const status = failed.length === 0 ? 'HEALTHY' : criticalFailures.length > 0 ? 'DOWN' : 'DEGRADED'
  return { applicationId: app.id, companyId: app.companyId, status, checks, checkedAt: new Date().toISOString() }
}

export async function runHealthChecks(applicationId: string, actor: Actor): Promise<HealthReport> {
  const app = await db.factoryApplication.findUnique({ where: { id: applicationId } })
  if (!app) throw new Error('Application not found')
  const report = await evaluateHealth(app)
  await db.factoryHealthCheck.create({ data: {
    applicationId: app.id, companyId: app.companyId, status: report.status,
    checks: jsonText(report.checks), checkedBy: actor.email,
  } })
  await db.factoryApplication.update({ where: { id: app.id }, data: { healthStatus: report.status, lastHealthAt: new Date() } })
  await writeFactoryAudit({
    actor, action: 'FACTORY_HEALTH_CHECK', targetType: 'APPLICATION', targetId: app.id,
    companyId: app.companyId, detail: { status: report.status, failed: report.checks.filter((c) => !c.ok).map((c) => c.key) },
  })
  return report
}

export function healthSummary(report: HealthReport): string {
  return `${report.status}: ${report.checks.filter((c) => c.ok).length}/${report.checks.length} checks passed`
}

/** Used by export/restore to prove a restored dataset is complete. */
export function integritySignature(payload: Record<string, unknown>): string {
  return checksum({ ...payload, checkedAt: undefined, status: undefined })
}

export function safeParseChecks(raw: string | null): CheckResult[] {
  return parseJson<CheckResult[]>(raw, [])
}

export function describeChecks(checks: CheckResult[]): string {
  return stableStringify(checks)
}
