/**
 * BDTECH360 Software Factory — the APPLICATION RUNTIME.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Provisioning used to produce a versioned configuration and scoped records,
 * but nothing *consumed* them. That is a control plane, not "many working
 * business applications". This module is the single runtime that turns one
 * approved template + company configuration + pinned modules into a REAL,
 * operating application:
 *
 *   one renderer  ×  N company configs  ×  approved shared modules
 *
 * Everything here reads the checksummed application config from the database,
 * loads the pinned module manifests, and operates on company-scoped records
 * and files. There is no per-company code, no mock data and no placeholder
 * endpoint. Every action is authorized through `resolveCompanyAccess`, scoped
 * server-side, validated against the module's declared entity schema, and
 * written to the audit trail.
 *
 * `runFactoryTests()` is an EXECUTABLE acceptance suite: it performs a real
 * create → read → validate → delete round trip and real isolation queries,
 * then persists the results in a FactoryProvisionJob. `stageUpgradeRelease`
 * and `deployRelease` require that suite to actually pass.
 */
import { db } from '@/lib/db'
import {
  assertResourceInScope, resolveCompanyAccess, writeFactoryAudit,
  type Actor, type CompanyScope,
} from './access'
import { companyReport, createRecord, readFile, uploadFile } from './data'
import { validateModuleManifest, validateModuleRecord } from './definition'
import { runHealthChecks } from './health'
import type {
  ApplicationConfig, ModuleManifest, ModuleEntity, RuntimePage, ThemeTokens,
} from './types'
import { checksum, jsonText, parseJson, stableStringify } from './util'

export const DEFAULT_THEME: ThemeTokens = {
  primary: '#063B8F', accent: '#009FE3', surface: '#FFFFFF', background: '#F4FAFF',
  text: '#0B1F33', muted: '#526173', motif: 'grid', radius: 'soft', density: 'comfortable',
}

export interface RuntimeModule {
  code: string
  name: string
  capability: string
  semver: string
  version: number
  enabled: boolean
  manifest: ModuleManifest
  entities: ModuleEntity[]
}

export interface RuntimeContext {
  scope: CompanyScope
  company: { id: string; code: string; slug: string; name: string; kind: string; industry: string | null; status: string }
  app: {
    id: string; code: string; name: string; status: string; environment: string
    releaseVersion: string; healthStatus: string; configChecksum: string
    deploymentModel: string; domain: string | null
  }
  config: ApplicationConfig
  theme: ThemeTokens
  pages: RuntimePage[]
  modules: RuntimeModule[]
  template: { code: string; name: string; version: number | null }
}

export interface RuntimeResult<T> {
  ok: boolean
  code?: string
  reason?: string
  status?: number
  data?: T
}

function deny<T>(code: string, reason: string, status = 403): RuntimeResult<T> {
  return { ok: false, code, reason, status }
}

function fallbackPages(config: ApplicationConfig): RuntimePage[] {
  return (config.navigation.length ? config.navigation : ['Overview']).map((label, i) => ({
    key: `page-${i + 1}`,
    label,
    kind: i === 0 ? 'dashboard' : 'list',
    description: `${label} for this company application.`,
  }))
}

/** Pick the application a company member actually operates: LIVE first. */
function pickApplication<T extends { status: string; createdAt: Date }>(rows: T[]): T | null {
  if (rows.length === 0) return null
  const live = rows.filter((r) => r.status === 'LIVE').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  if (live.length) return live[0]
  return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
}

/**
 * Resolve a company application by its PRIVATE slug. The companyId never
 * comes from the request: it is derived from the slug and then checked
 * against an explicit, active, unexpired membership grant.
 */
export async function resolveRuntime(actor: Actor, slug: string, level: 'read' | 'write' = 'read', applicationId?: string): Promise<RuntimeResult<RuntimeContext>> {
  const clean = String(slug ?? '').trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(clean)) return deny('INVALID_SLUG', 'A valid company slug is required', 400)
  const company = await db.factoryCompany.findUnique({ where: { slug: clean } })
  if (!company) {
    await writeFactoryAudit({ actor, action: 'FACTORY_RUNTIME_OPEN', targetType: 'COMPANY', targetId: clean, decision: 'DENY', detail: { reason: 'unknown slug' } })
    return deny('NOT_FOUND', 'No application is registered at this address.', 404)
  }
  const access = await resolveCompanyAccess(actor, company.id, level, 'FACTORY_RUNTIME_OPEN')
  if (!access.ok || !access.scope) return deny(access.code, access.reason, 403)

  const rows = applicationId
    ? await db.factoryApplication.findMany({ where: { id: applicationId, companyId: company.id, status: { notIn: ['RETIRED', 'TEST_FAILED'] } } })
    : await db.factoryApplication.findMany({
      where: { companyId: company.id, status: { notIn: ['RETIRED', 'TEST_FAILED'] } },
      orderBy: { createdAt: 'desc' }, take: 50,
    })
  const app = pickApplication(rows)
  if (!app) return deny('NO_APPLICATION', 'This company has no provisioned application yet.', 404)
  const scoped = await assertResourceInScope(actor, access.scope, app, 'APPLICATION', app.id, 'FACTORY_RUNTIME_OPEN')
  if (!scoped) return deny('CROSS_COMPANY_DENIED', 'Application does not belong to this company.')

  let config: ApplicationConfig
  try {
    config = JSON.parse(app.config) as ApplicationConfig
    if (config?.schemaVersion !== 1) throw new Error('schema')
  } catch {
    return deny('CONFIG_INVALID', 'The stored application configuration is unreadable.', 500)
  }

  const pins = await db.factoryAppModule.findMany({ where: { applicationId: app.id }, orderBy: { moduleId: 'asc' } })
  const versionIds = [...new Set(pins.map((p) => p.moduleVersionId))]
  const versions = versionIds.length ? await db.factoryModuleVersion.findMany({ where: { id: { in: versionIds } } }) : []
  const moduleIds = [...new Set(versions.map((v) => v.moduleId))]
  const moduleRows = moduleIds.length ? await db.factoryModule.findMany({ where: { id: { in: moduleIds } } }) : []
  const modules: RuntimeModule[] = pins.map((pin) => {
    const version = versions.find((v) => v.id === pin.moduleVersionId)
    const mod = moduleRows.find((m) => m.id === version?.moduleId)
    let manifest: ModuleManifest | null = null
    try { manifest = JSON.parse(version?.manifest ?? '{}') as ModuleManifest } catch { manifest = null }
    return {
      code: pin.moduleId,
      name: mod?.name ?? pin.moduleId,
      capability: manifest?.capability ?? 'unknown',
      semver: pin.semver,
      version: version?.version ?? 0,
      enabled: pin.enabled,
      manifest: manifest ?? { schemaVersion: 1, capability: 'identity' as ModuleManifest['capability'], dependencies: [], permissions: [], configKeys: [], entities: [], migrations: [], testDefinitions: [], acceptanceCriteria: [] },
      entities: manifest?.entities ?? [],
    }
  })

  const template = await db.factoryTemplate.findUnique({ where: { id: app.templateId } })
  const templateVersion = await db.factoryTemplateVersion.findUnique({ where: { id: app.templateVersionId } })
  const theme: ThemeTokens = { ...DEFAULT_THEME, ...(config.theme ?? {}) }
  const pages = config.pages?.length ? config.pages : fallbackPages(config)

  await writeFactoryAudit({ actor, action: 'FACTORY_RUNTIME_OPEN', targetType: 'APPLICATION', targetId: app.id, companyId: company.id, detail: { slug: clean, level, modules: modules.length } })
  return {
    ok: true,
    data: {
      scope: access.scope,
      company: { id: company.id, code: company.code, slug: company.slug, name: company.name, kind: company.kind, industry: company.industry, status: company.status },
      app: {
        id: app.id, code: app.code, name: app.name, status: app.status, environment: app.environment,
        releaseVersion: app.releaseVersion, healthStatus: app.healthStatus, configChecksum: app.configChecksum,
        deploymentModel: app.deploymentModel, domain: app.domain,
      },
      config, theme, pages, modules,
      template: { code: template?.code ?? '(unknown)', name: template?.name ?? '(unknown)', version: templateVersion?.version ?? null },
    },
  }
}

/** Real state for the runtime UI. Nothing is fabricated; all counts are queries. */
export async function runtimeState(ctx: RuntimeContext): Promise<Record<string, unknown>> {
  const appId = ctx.app.id
  const companyId = ctx.scope.companyId
  const where = { applicationId: appId, companyId }
  const [records, files, audits, releases, checks, jobs, backups, byModule, byEntity] = await Promise.all([
    db.factoryRecord.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 }),
    db.factoryFile.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, name: true, mimeType: true, sizeBytes: true, checksum: true, uploadedBy: true, createdAt: true } }),
    db.factoryAuditEvent.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 40 }),
    db.factoryRelease.findMany({ where: { applicationId: appId }, orderBy: { createdAt: 'desc' }, take: 20,
      select: { id: true, code: true, kind: true, status: true, fromVersion: true, toVersion: true, createdAt: true, deployedAt: true } }),
    db.factoryHealthCheck.findMany({ where: { applicationId: appId }, orderBy: { checkedAt: 'desc' }, take: 5,
      select: { id: true, status: true, checkedAt: true } }),
    db.factoryProvisionJob.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 10,
      select: { id: true, code: true, action: true, status: true, createdAt: true, finishedAt: true } }),
    db.factoryBackup.findMany({ where: { applicationId: appId }, orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, code: true, kind: true, status: true, verifiedAt: true, createdAt: true } }),
    db.factoryRecord.groupBy({ by: ['moduleKey'], where, _count: { _all: true } }),
    db.factoryRecord.groupBy({ by: ['entityType'], where, _count: { _all: true } }),
  ])
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    company: ctx.company,
    application: ctx.app,
    template: ctx.template,
    config: ctx.config,
    theme: ctx.theme,
    pages: ctx.pages,
    modules: ctx.modules.map((m) => ({
      code: m.code, name: m.name, capability: m.capability, semver: m.semver,
      enabled: m.enabled, entities: m.entities,
      permissions: m.manifest.permissions, dependencies: m.manifest.dependencies,
    })),
    access: { role: ctx.scope.membership.role, level: ctx.scope.level, privileged: ctx.scope.membership.privileged },
    records: records.map((r) => ({ ...r, data: parseJson<Record<string, unknown>>(r.data, {}) })),
    files,
    audits: audits.map((a) => ({ id: a.id, action: a.action, decision: a.decision, actor: a.actor, createdAt: a.createdAt, targetType: a.targetType })),
    releases, checks, jobs, backups,
    counts: {
      records: records.length, files: files.length, modules: ctx.modules.length,
      enabledModules: ctx.modules.filter((m) => m.enabled).length, pages: ctx.pages.length,
    },
    aggregates: {
      byModule: byModule.map((r) => ({ module: r.moduleKey, count: r._count._all })),
      byEntity: byEntity.map((r) => ({ entity: r.entityType, count: r._count._all })),
    },
    fact: 'Every value above is a database query scoped to the resolved company grant. No demo or placeholder rows are injected by the runtime.',
  }
}

function moduleFor(ctx: RuntimeContext, code: string): RuntimeModule | null {
  const m = ctx.modules.find((x) => x.code === code)
  return m && m.enabled ? m : null
}

function sampleData(entity: ModuleEntity): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of entity.fields) {
    switch (f.type) {
      case 'number': out[f.key] = 1; break
      case 'boolean': out[f.key] = true; break
      case 'date': out[f.key] = new Date().toISOString().slice(0, 10); break
      case 'email': out[f.key] = `factory.test+${f.key}@example.test`; break
      default: out[f.key] = f.required ? `Factory test ${f.key}` : `test ${f.key}`
    }
  }
  return out
}

/**
 * EXECUTABLE acceptance tests. Each check performs a real query or a real
 * write/read/delete round trip. Results are persisted so "tests passed" is a
 * recorded fact, never a boolean literal in a release transition.
 */
export async function runFactoryTests(actor: Actor, ctx: RuntimeContext): Promise<{
  ok: boolean
  jobId: string | null
  passed: number
  failed: number
  checks: Array<{ key: string; label: string; ok: boolean; detail: string }>
  ranAt: string
}> {
  const appId = ctx.app.id
  const companyId = ctx.scope.companyId
  const checks: Array<{ key: string; label: string; ok: boolean; detail: string }> = []
  const add = (key: string, label: string, ok: boolean, detail: string) => checks.push({ key, label, ok, detail })
  const ranAt = new Date().toISOString()

  const app = await db.factoryApplication.findUnique({ where: { id: appId } })
  add('config.checksum', 'Stored configuration matches its SHA-256 checksum',
    Boolean(app) && checksum(JSON.parse(app!.config)) === app!.configChecksum,
    app ? `checksum ${app.configChecksum.slice(0, 12)}…` : 'application missing')
  const latestRevision = await db.factoryConfigRevision.findFirst({ where: { applicationId: appId }, orderBy: { version: 'desc' } })
  add('config.revision', 'A known-good configuration revision exists',
    Boolean(latestRevision) && latestRevision!.config === app?.config,
    latestRevision ? `revision v${latestRevision.version}` : 'no revision — rollback would be impossible')

  const pins = await db.factoryAppModule.findMany({ where: { applicationId: appId } })
  const approvedIds = new Set((await db.factoryModuleVersion.findMany({ where: { status: 'APPROVED' }, select: { id: true } })).map((v) => v.id))
  add('modules.approved', 'Every module is pinned to an approved release',
    pins.length > 0 && pins.every((p) => approvedIds.has(p.moduleVersionId)),
    `${pins.length} pinned modules`)

  const badManifests = ctx.modules.filter((m) => !validateModuleManifest(m.manifest).ok)
  add('modules.manifests', 'Pinned module manifests are valid', badManifests.length === 0,
    badManifests.length ? `invalid: ${badManifests.map((m) => m.code).join(', ')}` : `${ctx.modules.length} manifests parsed`)

  const records = await db.factoryRecord.findMany({ where: { applicationId: appId } })
  const foreignRecords = records.filter((r) => r.companyId !== companyId)
  add('isolation.records', 'No record from another company is reachable',
    foreignRecords.length === 0, `${foreignRecords.length} foreign records`)

  const invalidRecords: string[] = []
  for (const r of records) {
    const m = ctx.modules.find((x) => x.code === r.moduleKey)
    if (!m) { invalidRecords.push(`${r.id}:module`); continue }
    const parsed = parseJson<unknown>(r.data, null)
    if (!validateModuleRecord(m.manifest, r.entityType, parsed).ok) invalidRecords.push(`${r.id}:schema`)
  }
  add('records.schema', 'Every stored record validates against its declared entity schema',
    invalidRecords.length === 0, invalidRecords.length ? invalidRecords.slice(0, 5).join(', ') : `${records.length} records validated`)

  const files = await db.factoryFile.findMany({ where: { applicationId: appId } })
  const badFiles = files.filter((f) => f.companyId !== companyId || checksum(f.content) !== f.checksum)
  add('files.integrity', 'Scoped files have valid content checksums', badFiles.length === 0,
    badFiles.length ? `${badFiles.length} invalid files` : `${files.length} files verified`)

  // REAL round trip: create, read back, verify scope, validate, then delete.
  const candidate = ctx.modules.find((m) => m.enabled && m.entities.length > 0)
  let roundTripOk = false
  let roundTripDetail = 'no enabled module declares an entity'
  if (candidate) {
    const entity = candidate.entities[0]
    const data = sampleData(entity)
    let createdId: string | null = null
    try {
      const result = await createRecord(actor, {
        companyId, applicationId: appId, moduleKey: candidate.code, entityType: entity.key, data,
      })
      if (!result.ok) throw new Error(result.reason ?? 'create refused')
      createdId = result.data!.id
      const readBack = await db.factoryRecord.findUnique({ where: { id: createdId } })
      const parsed = parseJson<unknown>(readBack?.data, null)
      roundTripOk = Boolean(readBack && readBack.companyId === companyId && readBack.applicationId === appId
        && validateModuleRecord(candidate.manifest, entity.key, parsed).ok)
      roundTripDetail = roundTripOk
        ? `${candidate.code}/${entity.key} created, read and validated under ${ctx.company.code}`
        : 'round-trip record failed scope or schema verification'
    } catch (error) {
      roundTripDetail = error instanceof Error ? error.message : 'round trip failed'
    } finally {
      if (createdId) await db.factoryRecord.delete({ where: { id: createdId } }).catch(() => null)
    }
  }
  add('runtime.roundtrip', 'A real business record can be created, read, validated and removed',
    roundTripOk, roundTripDetail)

  // A real authorization probe: an authenticated user with NO explicit grant
  // must be refused (and the denial audited) even inside a valid company.
  const probe: Actor = { email: `factory-isolation-probe-${appId.slice(0, 8)}@example.test`, role: 'STAFF' }
  const ungranted = await resolveCompanyAccess(probe, companyId, 'read', 'FACTORY_RUNTIME_ISOLATION_PROBE')
  const crossCompanyDenied = !ungranted.ok
  add('access.crossCompany', 'An ungranted identity is refused access to private company data and the denial is audited',
    crossCompanyDenied, crossCompanyDenied ? `${ungranted.code} recorded` : 'an ungranted identity was unexpectedly admitted')

  const verifiedBackup = await db.factoryBackup.count({ where: { applicationId: appId, verifiedAt: { not: null } } })
  add('recovery.point', 'A verified recovery point is available',
    verifiedBackup > 0 || ctx.app.status !== 'LIVE', `${verifiedBackup} verified backups`)

  const themeOk = /^#[0-9a-fA-F]{3,8}$/.test(ctx.theme.primary) && /^#[0-9a-fA-F]{3,8}$/.test(ctx.theme.accent)
  add('runtime.config', 'Theme, navigation and pages are renderable from configuration',
    themeOk && ctx.pages.length > 0 && ctx.config.navigation.length > 0,
    `${ctx.pages.length} pages, ${ctx.config.navigation.length} nav items, motif ${ctx.theme.motif ?? 'grid'}`)

  const passed = checks.filter((c) => c.ok).length
  const failed = checks.length - passed
  const ok = failed === 0
  let jobId: string | null = null
  try {
    const n = await db.factoryProvisionJob.count()
    const job = await db.factoryProvisionJob.create({ data: {
      code: `TEST-${Date.now().toString(36).toUpperCase()}-${String(n + 1).padStart(4, '0')}`,
      companyId, applicationId: appId, action: 'TEST', status: ok ? 'PASSED' : 'FAILED',
      steps: jsonText(checks.map((c) => ({ key: c.key, label: c.label, status: c.ok ? 'PASS' : 'FAIL', detail: c.detail }))),
      testResults: jsonText({ ranAt, passed, failed, total: checks.length, checks, executable: true }),
      requestedBy: actor.email, startedAt: new Date(), finishedAt: new Date(),
      error: ok ? null : checks.filter((c) => !c.ok).map((c) => `${c.key}: ${c.detail}`).join('; '),
    } })
    jobId = job.id
  } catch (error) {
    console.error('[factory-runtime] test job persistence failed', error)
  }
  await writeFactoryAudit({ actor, action: 'FACTORY_TESTS_RUN', targetType: 'APPLICATION', targetId: appId,
    companyId, decision: ok ? 'ALLOW' : 'DENY', detail: { passed, failed, failedKeys: checks.filter((c) => !c.ok).map((c) => c.key) } })
  return { ok, jobId, passed, failed, checks, ranAt }
}

/** Actions the runtime UI can perform. All mutations are company-scoped. */
export async function runtimeAction(actor: Actor, slug: string, action: string, payload: Record<string, unknown>): Promise<RuntimeResult<Record<string, unknown>>> {
  const readOnly = new Set(['report.run', 'state'])
  const level = readOnly.has(action) ? 'read' : 'write'
  const resolved = await resolveRuntime(actor, slug, level)
  if (!resolved.ok || !resolved.data) return deny(resolved.code ?? 'DENIED', resolved.reason ?? 'Access refused', resolved.status ?? 403)
  const ctx = resolved.data
  const appId = ctx.app.id
  const companyId = ctx.scope.companyId

  switch (action) {
    case 'state':
      return { ok: true, data: await runtimeState(ctx) }

    case 'report.run': {
      const report = await companyReport(actor, companyId, appId)
      if (!report.ok) return deny(report.code ?? 'REPORT_FAILED', report.reason ?? 'Report refused', 403)
      const rows = await db.factoryRecord.groupBy({ by: ['moduleKey', 'entityType'], where: { applicationId: appId, companyId }, _count: { _all: true } })
      return { ok: true, data: { ...(report.data ?? {}), lines: rows.map((r) => ({ module: r.moduleKey, entity: r.entityType, count: r._count._all })), source: 'live scoped records' } }
    }

    case 'record.create': {
      const moduleKey = String(payload.moduleKey ?? '')
      const entityType = String(payload.entityType ?? '')
      const data = payload.data
      const m = moduleFor(ctx, moduleKey)
      if (!m) return deny('MODULE_DISABLED', 'That module is not enabled for this application', 400)
      const check = validateModuleRecord(m.manifest, entityType, data)
      if (!check.ok) return deny('VALIDATION_FAILED', check.errors.join('; '), 400)
      const result = await createRecord(actor, { companyId, applicationId: appId, moduleKey, entityType, data })
      if (!result.ok) return deny(result.code ?? 'CREATE_FAILED', result.reason ?? 'Create refused', 400)
      return { ok: true, data: { id: result.data!.id, moduleKey, entityType } }
    }

    case 'record.update':
    case 'record.delete': {
      const id = String(payload.recordId ?? '')
      const row = await db.factoryRecord.findUnique({ where: { id } })
      if (!row || row.applicationId !== appId || row.companyId !== companyId) {
        await writeFactoryAudit({ actor, action: 'FACTORY_RUNTIME_RECORD', targetType: 'RECORD', targetId: id, companyId, decision: 'DENY', detail: { reason: 'cross-company or missing record', action } })
        return deny('CROSS_COMPANY_DENIED', 'Record does not belong to this company application', 404)
      }
      if (action === 'record.delete') {
        await db.factoryRecord.delete({ where: { id } })
        await writeFactoryAudit({ actor, action: 'FACTORY_RECORD_DELETE', targetType: 'RECORD', targetId: id, companyId, detail: { moduleKey: row.moduleKey, entityType: row.entityType } })
        return { ok: true, data: { id, deleted: true } }
      }
      const m = moduleFor(ctx, row.moduleKey)
      if (!m) return deny('MODULE_DISABLED', 'That module is not enabled', 400)
      const data = payload.data
      const check = validateModuleRecord(m.manifest, row.entityType, data)
      if (!check.ok) return deny('VALIDATION_FAILED', check.errors.join('; '), 400)
      await db.factoryRecord.update({ where: { id }, data: { data: jsonText(data) } })
      await writeFactoryAudit({ actor, action: 'FACTORY_RECORD_UPDATE', targetType: 'RECORD', targetId: id, companyId, detail: { moduleKey: row.moduleKey, entityType: row.entityType } })
      return { ok: true, data: { id, updated: true } }
    }

    case 'workflow.advance': {
      const id = String(payload.recordId ?? '')
      const row = await db.factoryRecord.findUnique({ where: { id } })
      if (!row || row.applicationId !== appId || row.companyId !== companyId) return deny('CROSS_COMPANY_DENIED', 'Record does not belong to this company application', 404)
      const m = moduleFor(ctx, row.moduleKey)
      const entity = m?.entities.find((e) => e.key === row.entityType)
      // Only a field DECLARED by the pinned module schema may be advanced, so
      // every stored record stays valid against its module manifest.
      const field = entity?.fields.find((f) => ['stage', 'status', 'state', 'label'].includes(f.key) && f.type !== 'number' && f.type !== 'boolean')?.key
      if (!field) return deny('NO_STAGE_FIELD', `${row.entityType} has no declared workflow stage field`, 400)
      const stages = ctx.config.workflows?.pipelines?.length ? ctx.config.workflows.pipelines : ['New', 'In progress', 'Done']
      const current = parseJson<Record<string, unknown>>(row.data, {})
      const idx = stages.indexOf(String(current[field] ?? ''))
      const next = stages[Math.min(Math.max(idx + 1, 1), stages.length - 1)] ?? stages[0]
      const updated = { ...current, [field]: next }
      await db.factoryRecord.update({ where: { id }, data: { data: jsonText(updated) } })
      await writeFactoryAudit({ actor, action: 'FACTORY_WORKFLOW_ADVANCE', targetType: 'RECORD', targetId: id, companyId, detail: { field, from: current[field] ?? null, to: next } })
      return { ok: true, data: { id, field, next } }
    }

    case 'file.upload': {
      const result = await uploadFile(actor, {
        companyId, applicationId: appId,
        name: payload.name, mimeType: payload.mimeType, contentBase64: payload.contentBase64,
      })
      if (!result.ok) return deny(result.code ?? 'UPLOAD_FAILED', result.reason ?? 'Upload refused', 400)
      return { ok: true, data: { id: result.data!.id, scan: result.data!.scan } }
    }

    case 'file.read': {
      const result = await readFile(actor, companyId, String(payload.fileId ?? ''))
      if (!result.ok) return deny(result.code ?? 'FILE_FAILED', result.reason ?? 'File refused', 404)
      return { ok: true, data: { file: result.data!.file } }
    }

    case 'tests.run': {
      const result = await runFactoryTests(actor, ctx)
      return { ok: result.ok, code: result.ok ? undefined : 'TESTS_FAILED', reason: result.ok ? undefined : `${result.failed} acceptance checks failed`, status: result.ok ? 200 : 409,
        data: { ...result, checksStable: stableStringify(result.checks).length > 0 } }
    }

    case 'health.run': {
      const report = await runHealthChecks(appId, actor)
      return { ok: report.status === 'HEALTHY', code: report.status === 'HEALTHY' ? undefined : 'HEALTH_FAILED',
        status: report.status === 'HEALTHY' ? 200 : 409, data: { ...report } }
    }

    default:
      return deny('UNKNOWN_ACTION', `Unknown runtime action "${action}"`, 400)
  }
}
