/**
 * Application-level backup, verification and restore.
 *
 * A backup is NOT considered verified because a row or a file exists. The
 * verifier recomputes the SHA-256 of the exported payload, checks the record
 * counts and scans for secret-like content. Restore creates a NEW staging
 * application inside the SAME company; cross-company restore is refused, so
 * one client's live data can never be copied into another client's instance.
 */
import { db } from '@/lib/db'
import type { Actor } from './access'
import { writeFactoryAudit } from './access'
import { runHealthChecks } from './health'
import { checksum, jsonText, parseJson, secretLikeReason, stableStringify } from './util'

export interface BackupPayload {
  schemaVersion: 1
  exportedAt: string
  generator: string
  company: Record<string, unknown>
  definitions: Array<Record<string, unknown>>
  application: Record<string, unknown>
  configRevisions: Array<Record<string, unknown>>
  appModules: Array<Record<string, unknown>>
  records: Array<Record<string, unknown>>
  files: Array<Record<string, unknown>>
  releases: Array<Record<string, unknown>>
  healthChecks: Array<Record<string, unknown>>
  integrations: Array<Record<string, unknown>>
  members: Array<Record<string, unknown>>
  counts: { records: number; files: number; revisions: number; modules: number }
  restoreInstructions: string[]
  dependencyManifest: Record<string, unknown>
}

const RESTORE_INSTRUCTIONS = [
  'Use a disposable/test database. Never restore over a live production application.',
  'Run `npx prisma migrate deploy` against the target database first.',
  'POST /api/factory/backups/{id}/restore with the same companyId; the factory creates a new STAGING application.',
  'Verify the returned integrity report: record/file counts, config checksum, permissions and health status.',
  'Only after the restored application passes health checks may an authorized operator approve promotion.',
]

function date(v: Date | null | undefined): string | null {
  return v ? v.toISOString() : null
}

export async function buildBackupPayload(applicationId: string): Promise<BackupPayload> {
  const app = await db.factoryApplication.findUniqueOrThrow({ where: { id: applicationId } })
  const company = await db.factoryCompany.findUniqueOrThrow({ where: { id: app.companyId } })
  const [definitions, revisions, modules, records, files, releases, checks, integrations, members] = await Promise.all([
    db.factoryCompanyDefinition.findMany({ where: { companyId: app.companyId }, orderBy: { version: 'asc' } }),
    db.factoryConfigRevision.findMany({ where: { applicationId }, orderBy: { version: 'asc' } }),
    db.factoryAppModule.findMany({ where: { applicationId }, orderBy: { moduleId: 'asc' } }),
    db.factoryRecord.findMany({ where: { applicationId }, orderBy: { createdAt: 'asc' } }),
    db.factoryFile.findMany({ where: { applicationId }, orderBy: { createdAt: 'asc' } }),
    db.factoryRelease.findMany({ where: { applicationId }, orderBy: { createdAt: 'asc' } }),
    db.factoryHealthCheck.findMany({ where: { applicationId }, orderBy: { checkedAt: 'asc' } }),
    db.factoryIntegration.findMany({ where: { companyId: app.companyId }, orderBy: { providerKey: 'asc' } }),
    db.factoryCompanyMember.findMany({ where: { companyId: app.companyId }, orderBy: { userEmail: 'asc' } }),
  ])
  // tenantKey is an identity secret of the primary environment: it is never
  // exported. A restored instance gets a fresh one through the normal wizard.
  const { tenantKey: _omit, ...companySafe } = company
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    generator: 'BDTECH360 Software Factory Control Center',
    company: { ...companySafe, createdAt: date(company.createdAt), updatedAt: date(company.updatedAt) },
    definitions: definitions.map((d) => ({ ...d, createdAt: date(d.createdAt) })),
    application: { ...app, createdAt: date(app.createdAt), updatedAt: date(app.updatedAt), lastHealthAt: date(app.lastHealthAt), approvedAt: date(app.approvedAt), activatedAt: date(app.activatedAt) },
    configRevisions: revisions.map((r) => ({ ...r, createdAt: date(r.createdAt) })),
    appModules: modules.map((m) => ({ ...m, createdAt: date(m.createdAt) })),
    records: records.map((r) => ({ ...r, createdAt: date(r.createdAt), updatedAt: date(r.updatedAt) })),
    files: files.map((f) => ({ ...f, createdAt: date(f.createdAt) })),
    releases: releases.map((r) => ({ ...r, createdAt: date(r.createdAt), approvedAt: date(r.approvedAt), deployedAt: date(r.deployedAt) })),
    healthChecks: checks.map((c) => ({ ...c, checkedAt: date(c.checkedAt) })),
    integrations: integrations.map((i) => ({ ...i, createdAt: date(i.createdAt), updatedAt: date(i.updatedAt), lastCheckedAt: date(i.lastCheckedAt) })),
    members: members.map((m) => ({ ...m, createdAt: date(m.createdAt), updatedAt: date(m.updatedAt), expiresAt: date(m.expiresAt) })),
    counts: { records: records.length, files: files.length, revisions: revisions.length, modules: modules.length },
    restoreInstructions: RESTORE_INSTRUCTIONS,
    dependencyManifest: {
      runtime: 'Next.js 16 / Node.js 22 / Prisma 6.19.3',
      database: 'MySQL in production; disposable SQLite for preview and restore drills',
      migrations: 'prisma/migrations (apply with `npx prisma migrate deploy`)',
      externalServices: 'None required for internal-only operation. Optional providers are adapters with credentials from the environment.',
      credentialsIncluded: false,
      licence: 'All control-plane code is original to this repository; see THIRD_PARTY_NOTICES.md for component licences.',
    },
  }
}

async function uniqueCode(prefix: string): Promise<string> {
  const count = await db.factoryBackup.count()
  for (let i = count + 1; i < count + 100; i++) {
    const code = `BKP-${String(i).padStart(5, '0')}`
    if (!(await db.factoryBackup.findUnique({ where: { code } }))) return code
  }
  return `BKP-${Date.now().toString(36)}`
}

export async function createBackup(applicationId: string, kind: string, actor: Actor) {
  const app = await db.factoryApplication.findUniqueOrThrow({ where: { id: applicationId } })
  const payload = await buildBackupPayload(applicationId)
  if (kind === 'CONFIG_ONLY') {
    payload.records = []
    payload.files = []
    payload.counts.records = 0
    payload.counts.files = 0
  }
  const text = jsonText(payload)
  const secret = secretLikeReason(payload)
  if (secret) throw new Error(`Backup refused: payload contains secret-like content (${secret})`)
  const row = await db.factoryBackup.create({ data: {
    code: await uniqueCode('BKP'), applicationId, companyId: app.companyId, kind,
    status: 'CREATED', payload: text, checksum: checksum(payload), sizeBytes: Buffer.byteLength(text, 'utf8'),
    storagePath: null, createdBy: actor.email,
  } })
  await writeFactoryAudit({ actor, action: 'FACTORY_BACKUP_CREATED', targetType: 'BACKUP', targetId: row.id, companyId: app.companyId, detail: { kind, bytes: row.sizeBytes } })
  return row
}

export async function verifyBackup(backupId: string, actor: Actor): Promise<{ ok: boolean; errors: string[]; backupId: string }> {
  const row = await db.factoryBackup.findUnique({ where: { id: backupId } })
  if (!row) return { ok: false, errors: ['Backup not found'], backupId }
  const errors: string[] = []
  let payload: BackupPayload | null = null
  try { payload = JSON.parse(row.payload) as BackupPayload } catch { errors.push('Payload is not valid JSON') }
  if (payload) {
    if (payload.schemaVersion !== 1) errors.push('Unsupported backup schema version')
    if (checksum(payload) !== row.checksum) errors.push('Checksum mismatch — the payload has been altered')
    if (payload.counts.records !== payload.records.length) errors.push('Record count does not match payload')
    if (payload.counts.files !== payload.files.length) errors.push('File count does not match payload')
    if (payload.counts.revisions !== payload.configRevisions.length) errors.push('Config revision count does not match payload')
    const companyId = String(payload.company.id ?? '')
    if (payload.records.some((r) => r.companyId !== companyId)) errors.push('Payload contains records from another company')
    if (payload.files.some((f) => f.companyId !== companyId)) errors.push('Payload contains files from another company')
    const secret = secretLikeReason(payload)
    if (secret) errors.push(`Payload contains secret-like content (${secret})`)
  }
  const ok = errors.length === 0
  await db.factoryBackup.update({ where: { id: row.id }, data: { status: ok ? 'VERIFIED' : 'FAILED', verifiedAt: ok ? new Date() : null } })
  await writeFactoryAudit({ actor, action: 'FACTORY_BACKUP_VERIFIED', targetType: 'BACKUP', targetId: row.id, companyId: row.companyId, decision: ok ? 'ALLOW' : 'DENY', detail: { ok, errors } })
  return { ok, errors, backupId }
}

export async function restoreBackup(backupId: string, actor: Actor, requestedCompanyId?: string): Promise<{
  ok: boolean
  errors: string[]
  applicationId: string | null
  integrity: Record<string, unknown>
}> {
  const row = await db.factoryBackup.findUnique({ where: { id: backupId } })
  if (!row) return { ok: false, errors: ['Backup not found'], applicationId: null, integrity: {} }
  if (!row.verifiedAt || row.status === 'FAILED') {
    await writeFactoryAudit({ actor, action: 'FACTORY_BACKUP_RESTORE', targetType: 'BACKUP', targetId: row.id, companyId: row.companyId, decision: 'DENY', detail: { reason: 'backup not verified' } })
    return { ok: false, errors: ['Only a verified backup can be restored'], applicationId: null, integrity: {} }
  }
  const payload = parseJson<BackupPayload | null>(row.payload, null)
  if (!payload) return { ok: false, errors: ['Payload is unreadable'], applicationId: null, integrity: {} }
  const companyId = String(payload.company.id ?? '')
  if (requestedCompanyId && requestedCompanyId !== companyId) {
    await writeFactoryAudit({ actor, action: 'FACTORY_BACKUP_RESTORE', targetType: 'BACKUP', targetId: row.id, companyId: row.companyId, decision: 'DENY', detail: { reason: 'cross-company restore refused', requestedCompanyId } })
    return { ok: false, errors: ['Cross-company restore is refused: one company’s data must never be copied into another company’s instance'], applicationId: null, integrity: {} }
  }
  const company = await db.factoryCompany.findUnique({ where: { id: companyId } })
  if (!company) return { ok: false, errors: ['Source company no longer exists'], applicationId: null, integrity: {} }
  if (payload.records.some((r) => r.companyId !== companyId) || payload.files.some((f) => f.companyId !== companyId)) {
    return { ok: false, errors: ['Payload contains foreign-company data'], applicationId: null, integrity: {} }
  }

  const source = payload.application
  const originalConfig = String(source.config ?? '{}')
  const configChecksum = String(source.configChecksum ?? checksum(JSON.parse(originalConfig)))
  const code = `APP-RESTORE-${Date.now().toString(36).toUpperCase()}`
  const restored = await db.factoryApplication.create({ data: {
    code, companyId, templateId: String(source.templateId ?? ''), templateVersionId: String(source.templateVersionId ?? ''),
    name: `${String(source.name ?? 'Application')} (restored)`, environment: 'STAGING',
    deploymentModel: String(source.deploymentModel ?? 'SHARED_TENANT'), status: 'STAGING',
    config: originalConfig, configChecksum, definitionVersion: Number(source.definitionVersion ?? 1),
    releaseVersion: String(source.releaseVersion ?? '0.0.0'), domain: null, healthStatus: 'UNKNOWN',
    createdBy: actor.email,
  } })

  const moduleRows = payload.appModules.map((m) => ({
    applicationId: restored.id, moduleId: String(m.moduleId), moduleVersionId: String(m.moduleVersionId),
    semver: String(m.semver), enabled: m.enabled !== false, config: m.config ? String(m.config) : null,
  }))
  if (moduleRows.length) await db.factoryAppModule.createMany({ data: moduleRows })
  const recordRows = payload.records.map((r) => ({
    applicationId: restored.id, companyId, moduleKey: String(r.moduleKey), entityType: String(r.entityType),
    data: String(r.data), createdBy: r.createdBy ? String(r.createdBy) : null,
  }))
  if (recordRows.length) await db.factoryRecord.createMany({ data: recordRows })
  const fileRows = payload.files.map((f) => ({
    applicationId: restored.id, companyId, name: String(f.name), mimeType: String(f.mimeType),
    sizeBytes: Number(f.sizeBytes ?? 0), content: String(f.content), checksum: String(f.checksum),
    uploadedBy: f.uploadedBy ? String(f.uploadedBy) : null,
  }))
  if (fileRows.length) await db.factoryFile.createMany({ data: fileRows })
  const revisionRows = payload.configRevisions.map((r, i) => ({
    applicationId: restored.id, version: Number(r.version ?? i + 1), config: String(r.config),
    checksum: String(r.checksum ?? checksum(String(r.config))), changeType: String(r.changeType ?? 'CREATE'),
    changedBy: r.changedBy ? String(r.changedBy) : actor.email, note: r.note ? String(r.note) : null,
  }))
  const nextVersion = Math.max(0, ...revisionRows.map((r) => r.version)) + 1
  // The newest revision must equal the live configuration, otherwise the
  // health check would correctly refuse to call this application healthy.
  await db.factoryConfigRevision.createMany({ data: [
    ...revisionRows,
    { applicationId: restored.id, version: nextVersion, config: originalConfig, checksum: configChecksum,
      changeType: 'CREATE', changedBy: actor.email, note: `Restored from ${row.code}` },
  ] })

  const [records, files, revisions, modules] = await Promise.all([
    db.factoryRecord.count({ where: { applicationId: restored.id } }),
    db.factoryFile.count({ where: { applicationId: restored.id } }),
    db.factoryConfigRevision.count({ where: { applicationId: restored.id } }),
    db.factoryAppModule.count({ where: { applicationId: restored.id } }),
  ])
  const health = await runHealthChecks(restored.id, actor)
  const integrity = {
    expectedRecords: payload.records.length, restoredRecords: records,
    expectedFiles: payload.files.length, restoredFiles: files,
    configChecksumMatches: checksum(JSON.parse(originalConfig)) === configChecksum,
    revisions, modules,
    permissions: await db.factoryCompanyMember.count({ where: { companyId, status: 'ACTIVE' } }),
    health: health.status,
  }
  const ok = records === payload.records.length && files === payload.files.length && integrity.configChecksumMatches === true && health.status === 'HEALTHY'
  await db.factoryBackup.update({ where: { id: row.id }, data: { status: ok ? 'RESTORED' : 'FAILED', restoredAt: ok ? new Date() : null, restoreTarget: restored.id } })
  await writeFactoryAudit({ actor, action: 'FACTORY_BACKUP_RESTORE', targetType: 'APPLICATION', targetId: restored.id, companyId, decision: ok ? 'ALLOW' : 'DENY', detail: { backup: row.code, integrity } })
  return { ok, errors: ok ? [] : ['Restored application did not pass the integrity/health verification'], applicationId: restored.id, integrity }
}

/** Portable archive consumed by the download endpoint. */
export function portableArchive(backup: { code: string; checksum: string; payload: string; createdAt: Date }): string {
  return stableStringify({
    type: 'BDTECH360_FACTORY_PORTABLE_BACKUP',
    code: backup.code,
    checksum: backup.checksum,
    exportedAt: backup.createdAt.toISOString(),
    verifyWith: 'sha256(stableStringify(payload)) must equal checksum',
    payload: JSON.parse(backup.payload) as unknown,
  })
}
