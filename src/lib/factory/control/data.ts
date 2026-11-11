/**
 * Tenant-scoped business data services.
 *
 * Every function here takes the companyId from the SERVER-RESOLVED grant,
 * never from the request body, and checks that the application/file/job being
 * addressed belongs to that same company. These are the exact surfaces the
 * cross-company leakage acceptance test attacks.
 */
import { db } from '@/lib/db'
import { DOC_MAX_BYTES, scanDocumentBytes, serializeScanResult } from '@/lib/files'
import { assertResourceInScope, resolveCompanyAccess, writeFactoryAudit, type Actor, type CompanyScope } from './access'
import { validateModuleRecord } from './definition'
import { getAdapter, computeAdapterStatus } from './integrations'
import type { ModuleManifest } from './types'
import { checksum, jsonText, parseJson } from './util'

export interface DataResult<T> { ok: boolean; code?: string; reason?: string; data?: T }

async function scopedApplication(actor: Actor, scope: CompanyScope, applicationId: string, action: string) {
  const app = await db.factoryApplication.findUnique({ where: { id: applicationId } })
  const allowed = await assertResourceInScope(actor, scope, app, 'APPLICATION', applicationId, action)
  return allowed ? app : null
}

export async function listRecords(actor: Actor, query: { companyId?: string; applicationId: string; moduleKey?: string; entityType?: string }): Promise<DataResult<{ records: unknown[]; total: number }>> {
  const access = await resolveCompanyAccess(actor, query.companyId, 'read', 'FACTORY_RECORDS_READ')
  if (!access.ok || !access.scope) return { ok: false, code: access.code, reason: access.reason }
  const app = await scopedApplication(actor, access.scope, query.applicationId, 'FACTORY_RECORDS_READ')
  if (!app) return { ok: false, code: 'CROSS_COMPANY_DENIED', reason: 'Application does not belong to this company' }
  const records = await db.factoryRecord.findMany({
    where: {
      companyId: access.scope.companyId,
      applicationId: query.applicationId,
      ...(query.moduleKey ? { moduleKey: query.moduleKey } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
    },
    orderBy: { createdAt: 'desc' }, take: 200,
  })
  await writeFactoryAudit({ actor, action: 'FACTORY_RECORDS_READ', targetType: 'APPLICATION', targetId: app.id, companyId: access.scope.companyId, detail: { count: records.length } })
  return { ok: true, data: { records: records.map((r) => ({ ...r, data: parseJson(r.data, {}) })), total: records.length } }
}

export async function createRecord(actor: Actor, body: Record<string, unknown>): Promise<DataResult<{ id: string }>> {
  const access = await resolveCompanyAccess(actor, String(body.companyId ?? ''), 'write', 'FACTORY_RECORD_CREATE')
  if (!access.ok || !access.scope) return { ok: false, code: access.code, reason: access.reason }
  const applicationId = String(body.applicationId ?? '')
  const moduleKey = String(body.moduleKey ?? '')
  const entityType = String(body.entityType ?? '')
  const app = await scopedApplication(actor, access.scope, applicationId, 'FACTORY_RECORD_CREATE')
  if (!app) return { ok: false, code: 'CROSS_COMPANY_DENIED', reason: 'Application does not belong to this company' }
  if (app.status === 'RETIRED') return { ok: false, code: 'RETIRED', reason: 'Retired applications are read-only' }
  const pin = await db.factoryAppModule.findUnique({ where: { applicationId_moduleId: { applicationId, moduleId: moduleKey } } })
  if (!pin || !pin.enabled) return { ok: false, code: 'MODULE_DISABLED', reason: 'This module is not enabled for the application' }
  const version = await db.factoryModuleVersion.findUnique({ where: { id: pin.moduleVersionId } })
  if (!version || version.status !== 'APPROVED') return { ok: false, code: 'MODULE_NOT_APPROVED', reason: 'Module version is not approved' }
  let manifest: ModuleManifest
  try { manifest = JSON.parse(version.manifest) as ModuleManifest } catch { return { ok: false, code: 'MANIFEST_INVALID', reason: 'Module manifest is unreadable' } }
  const check = validateModuleRecord(manifest, entityType, body.data)
  if (!check.ok) return { ok: false, code: 'VALIDATION_FAILED', reason: check.errors.join('; ') }
  const created = await db.factoryRecord.create({ data: {
    applicationId, companyId: access.scope.companyId, moduleKey, entityType,
    data: jsonText(body.data), createdBy: actor.email,
  } })
  await writeFactoryAudit({ actor, action: 'FACTORY_RECORD_CREATE', targetType: 'RECORD', targetId: created.id, companyId: access.scope.companyId, detail: { applicationId, moduleKey, entityType } })
  return { ok: true, data: { id: created.id } }
}

export async function companyReport(actor: Actor, companyId: string, applicationId?: string): Promise<DataResult<Record<string, unknown>>> {
  const access = await resolveCompanyAccess(actor, companyId, 'read', 'FACTORY_REPORT_READ')
  if (!access.ok || !access.scope) return { ok: false, code: access.code, reason: access.reason }
  const where = { companyId: access.scope.companyId, ...(applicationId ? { applicationId } : {}) }
  const [records, files, apps, jobs, audits, byModule] = await Promise.all([
    db.factoryRecord.count({ where }),
    db.factoryFile.count({ where }),
    db.factoryApplication.count({ where: { companyId: access.scope.companyId } }),
    db.factoryProvisionJob.count({ where: { companyId: access.scope.companyId } }),
    db.factoryAuditEvent.count({ where: { companyId: access.scope.companyId } }),
    db.factoryRecord.groupBy({ by: ['moduleKey'], where, _count: { _all: true } }),
  ])
  await writeFactoryAudit({ actor, action: 'FACTORY_REPORT_READ', targetType: 'COMPANY', targetId: access.scope.companyId, companyId: access.scope.companyId, detail: { records } })
  return { ok: true, data: {
    companyId: access.scope.companyId, records, files, applications: apps, jobs, auditEvents: audits,
    byModule: byModule.map((m) => ({ module: m.moduleKey, records: m._count._all })),
    scopeEnforced: true,
  } }
}

export async function uploadFile(actor: Actor, body: Record<string, unknown>): Promise<DataResult<{ id: string; scan: unknown }>> {
  const access = await resolveCompanyAccess(actor, String(body.companyId ?? ''), 'write', 'FACTORY_FILE_UPLOAD')
  if (!access.ok || !access.scope) return { ok: false, code: access.code, reason: access.reason }
  const applicationId = String(body.applicationId ?? '')
  const app = await scopedApplication(actor, access.scope, applicationId, 'FACTORY_FILE_UPLOAD')
  if (!app) return { ok: false, code: 'CROSS_COMPANY_DENIED', reason: 'Application does not belong to this company' }
  const name = String(body.name ?? '').replace(/[\\/\u0000-\u001f]/g, '').slice(0, 180) || 'document.txt'
  const mimeType = String(body.mimeType ?? 'text/plain')
  const base64 = String(body.contentBase64 ?? '')
  let bytes: Buffer
  try { bytes = Buffer.from(base64, 'base64') } catch { return { ok: false, code: 'INVALID_CONTENT', reason: 'Content is not valid base64' } }
  if (bytes.length === 0 || bytes.length > DOC_MAX_BYTES) return { ok: false, code: 'INVALID_SIZE', reason: `File must be 1–${DOC_MAX_BYTES} bytes` }
  const scan = scanDocumentBytes(bytes, mimeType, name)
  if (scan.verdict !== 'CLEAN') {
    await writeFactoryAudit({ actor, action: 'FACTORY_FILE_UPLOAD', targetType: 'FILE', targetId: name, companyId: access.scope.companyId, decision: 'DENY', detail: { reason: scan.notes } })
    return { ok: false, code: 'QUARANTINED', reason: `Upload refused: ${scan.notes.join('; ')}` }
  }
  const created = await db.factoryFile.create({ data: {
    applicationId, companyId: access.scope.companyId, name, mimeType: scan.mimeType,
    sizeBytes: bytes.length, content: bytes.toString('base64'), checksum: checksum(bytes.toString('base64')),
    uploadedBy: actor.email,
  } })
  await writeFactoryAudit({ actor, action: 'FACTORY_FILE_UPLOAD', targetType: 'FILE', targetId: created.id, companyId: access.scope.companyId, detail: { name, bytes: bytes.length, scan: serializeScanResult(scan) } })
  return { ok: true, data: { id: created.id, scan: JSON.parse(serializeScanResult(scan)) } }
}

export async function readFile(actor: Actor, companyId: string, fileId: string): Promise<DataResult<{ file: { id: string; name: string; mimeType: string; content: string; checksum: string } }>> {
  const access = await resolveCompanyAccess(actor, companyId, 'read', 'FACTORY_FILE_READ')
  if (!access.ok || !access.scope) return { ok: false, code: access.code, reason: access.reason }
  const file = await db.factoryFile.findUnique({ where: { id: fileId } })
  const allowed = await assertResourceInScope(actor, access.scope, file, 'FILE', fileId, 'FACTORY_FILE_READ')
  if (!allowed || !file) return { ok: false, code: 'CROSS_COMPANY_DENIED', reason: 'File does not belong to this company' }
  if (checksum(file.content) !== file.checksum) return { ok: false, code: 'INTEGRITY_FAILED', reason: 'Stored file failed its checksum' }
  await writeFactoryAudit({ actor, action: 'FACTORY_FILE_READ', targetType: 'FILE', targetId: fileId, companyId: access.scope.companyId })
  return { ok: true, data: { file: { id: file.id, name: file.name, mimeType: file.mimeType, content: file.content, checksum: file.checksum } } }
}

/** A real background-style operation, strictly scoped to one company. */
export async function runScopedJob(actor: Actor, companyId: string, jobId: string): Promise<DataResult<Record<string, unknown>>> {
  const access = await resolveCompanyAccess(actor, companyId, 'write', 'FACTORY_JOB_RUN')
  if (!access.ok || !access.scope) return { ok: false, code: access.code, reason: access.reason }
  const job = await db.factoryProvisionJob.findUnique({ where: { id: jobId } })
  const allowed = await assertResourceInScope(actor, access.scope, job, 'JOB', jobId, 'FACTORY_JOB_RUN')
  if (!allowed || !job) return { ok: false, code: 'CROSS_COMPANY_DENIED', reason: 'Job does not belong to this company' }
  const apps = await db.factoryApplication.findMany({ where: { companyId: access.scope.companyId }, select: { id: true, code: true } })
  const counts = await db.factoryRecord.groupBy({
    by: ['entityType'], where: { companyId: access.scope.companyId }, _count: { _all: true },
  })
  const result = { jobId, companyId: access.scope.companyId, applications: apps.length, entityCounts: counts.map((c) => ({ entity: c.entityType, count: c._count._all })) }
  // Record background work as its own job. Overwriting the original PROVISION
  // job would destroy the evidence of its acceptance checks.
  const execution = await db.factoryProvisionJob.create({ data: {
    code: `SJOB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    companyId: access.scope.companyId, applicationId: apps[0]?.id ?? null,
    action: 'SCOPED_RECOMPUTE', status: 'PASSED', requestedBy: actor.email,
    steps: jsonText([{ key: 'scoped.recompute', label: 'Recompute company-scoped aggregates', status: 'PASS', detail: jsonText(result) }]),
    testResults: jsonText({ sourceJobId: jobId, result }), startedAt: new Date(), finishedAt: new Date(),
  } })
  await writeFactoryAudit({ actor, action: 'FACTORY_JOB_RUN', targetType: 'JOB', targetId: execution.id, companyId: access.scope.companyId, detail: { ...result, sourceJobId: jobId } })
  return { ok: true, data: { ...result, executionId: execution.id } }
}

/** Re-evaluate every adapter for a company and persist the honest result. */
export async function refreshIntegrations(actor: Actor, companyId: string): Promise<DataResult<{ adapters: unknown[] }>> {
  const access = await resolveCompanyAccess(actor, companyId, 'manage', 'FACTORY_INTEGRATION_REFRESH')
  if (!access.ok || !access.scope) return { ok: false, code: access.code, reason: access.reason }
  const rows = await db.factoryIntegration.findMany({ where: { companyId: access.scope.companyId }, orderBy: { providerKey: 'asc' } })
  const result: Array<Record<string, unknown>> = []
  for (const row of rows) {
    const adapter = getAdapter(row.providerKey)
    if (!adapter) continue
    const missing = adapter.envKeys.filter((k) => !process.env[k]?.trim())
    const computed = computeAdapterStatus(adapter, { enabled: row.enabled, envConfigured: missing.length === 0, lastError: row.lastError })
    await db.factoryIntegration.update({ where: { id: row.id }, data: {
      status: computed.status, configured: computed.configured, lastCheckedAt: new Date(),
    } })
    result.push({ code: row.code, providerKey: row.providerKey, kind: adapter.kind, ...computed, limitation: adapter.limitation, dependencyNote: adapter.dependencyNote, missingEnvKeys: missing })
  }
  await writeFactoryAudit({ actor, action: 'FACTORY_INTEGRATION_REFRESH', targetType: 'COMPANY', targetId: access.scope.companyId, companyId: access.scope.companyId, detail: { count: result.length } })
  return { ok: true, data: { adapters: result } }
}
