/**
 * Company creation wizard engine.
 *
 * Provisioning is REAL but honest about its boundary: it creates an isolated
 * company identity, an application configuration, pinned module versions,
 * initialized roles/records/workflows, integration adapters, a versioned
 * definition, a verified backup and an approval-gated release inside THIS
 * self-hosted platform. It does NOT create a separate server, DNS record or
 * database for a DEDICATED instance; those remain explicit manual steps with
 * recorded evidence (see the deploymentSpec on the release).
 */
import { db } from '@/lib/db'
import { canManageFactory, canApproveRelease, writeFactoryAudit, type Actor } from './access'
import { loadModuleRefs } from './catalog'
import {
  buildApplicationConfig, normalizeDefinition, validateDefinition,
  type TemplateRef, type ValidationResult,
} from './definition'
import { createBackup, verifyBackup } from './backup'
import { runHealthChecks } from './health'
import { ADAPTERS, computeAdapterStatus, missingEnvKeys } from './integrations'
import { canTransition } from './lifecycle'
import type { ApplicationConfig, CompanyDefinition, StepResult, TemplateDefinition } from './types'
import { checksum, createWithUniqueCode, jsonText, parseJson, secretLikeReason, stableStringify, tenantKey } from './util'

export interface ProvisionResult {
  ok: boolean
  companyId: string | null
  applicationId: string | null
  jobId: string | null
  status: string | null
  validation: ValidationResult | null
  steps: StepResult[]
  errors: string[]
  warnings: string[]
  definition: CompanyDefinition | null
  config: ApplicationConfig | null
}

function step(key: string, label: string, ok: boolean, detail: string): StepResult {
  return { key, label, status: ok ? 'PASS' : 'FAIL', detail }
}

async function loadTemplateRef(code: string, version: number): Promise<TemplateRef | null> {
  const tpl = await db.factoryTemplate.findUnique({ where: { code } })
  if (!tpl) return null
  const row = await db.factoryTemplateVersion.findUnique({ where: { templateId_version: { templateId: tpl.id, version } } })
  if (!row) return null
  let definition: TemplateDefinition
  try { definition = JSON.parse(row.definition) as TemplateDefinition } catch { return null }
  return { code, version: row.version, semver: row.semver, status: row.status, definition }
}

export async function previewDefinition(input: unknown, actor: Actor): Promise<ValidationResult & { definition: CompanyDefinition }> {
  const def = normalizeDefinition(input)
  const template = await loadTemplateRef(def.template.code, def.template.version)
  const moduleRefs = await loadModuleRefs(Object.fromEntries(def.modules.map((m) => [m.code, m.version])))
  const [companies] = await Promise.all([db.factoryCompany.findMany({ select: { slug: true, domain: true } })])
  const fallbackTemplate: TemplateRef = template ?? { code: '', version: 0, semver: '0.0.0', status: 'MISSING', definition: {} as TemplateDefinition }
  const result = validateDefinition(def, {
    template: fallbackTemplate,
    modules: moduleRefs,
    existingSlugs: companies.map((c) => c.slug),
    existingDomains: companies.map((c) => c.domain).filter((d): d is string => Boolean(d)),
    allowDedicated: canApproveRelease(actor),
  })
  if (!template) result.errors.unshift(`Template ${def.template.code} v${def.template.version} was not found`)
  return { ...result, definition: def }
}

export async function provisionCompany(input: unknown, actor: Actor): Promise<ProvisionResult> {
  const empty: ProvisionResult = { ok: false, companyId: null, applicationId: null, jobId: null, status: null, validation: null, steps: [], errors: [], warnings: [], definition: null, config: null }
  const def = normalizeDefinition(input)
  const moduleRefs = await loadModuleRefs(Object.fromEntries(def.modules.map((m) => [m.code, m.version])))
  const template = await loadTemplateRef(def.template.code, def.template.version)
  const companies = await db.factoryCompany.findMany({ select: { slug: true, domain: true } })
  const templateRef: TemplateRef = template ?? { code: '', version: 0, semver: '0.0.0', status: 'MISSING', definition: {} as TemplateDefinition }
  const validation = validateDefinition(def, {
    template: templateRef,
    modules: moduleRefs,
    existingSlugs: companies.map((c) => c.slug),
    existingDomains: companies.map((c) => c.domain).filter((d): d is string => Boolean(d)),
    allowDedicated: canApproveRelease(actor),
  })
  if (!template) validation.errors.unshift(`Template ${def.template.code} v${def.template.version} was not found`)

  if (!validation.ok) {
    await writeFactoryAudit({ actor, action: 'FACTORY_COMPANY_PROVISION', targetType: 'COMPANY', targetId: def.identity.slug || '(invalid)', decision: 'DENY', detail: { errors: validation.errors } })
    return { ...empty, validation, errors: validation.errors, warnings: validation.warnings, definition: def }
  }

  const steps: StepResult[] = [step('definition.validate', 'Validate reusable definition and dependencies', true, `${validation.automatedSteps.length} automated steps, ${validation.manualSteps.length} manual/approval steps`)]
  const config = buildApplicationConfig(def, templateRef.definition, moduleRefs)
  config.automatedSteps = validation.automatedSteps
  config.manualSteps = validation.manualSteps
  const configText = jsonText(config)
  const configHash = checksum(config)
  const defText = jsonText(def)
  const defHash = checksum(def)
  const secret = secretLikeReason({ config, definition: def })
  if (secret) {
    return { ...empty, validation, errors: [`Refusing to persist secret-like content (${secret})`], definition: def, config }
  }

  const templateRow = await db.factoryTemplate.findUniqueOrThrow({ where: { code: def.template.code } })
  const templateVersionRow = await db.factoryTemplateVersion.findUniqueOrThrow({
    where: { templateId_version: { templateId: templateRow.id, version: def.template.version } },
  })

  const company = await createWithUniqueCode('CO', () => db.factoryCompany.count(), (code) =>
    db.factoryCompany.create({ data: {
      code, slug: def.identity.slug, name: def.identity.name, legalName: def.identity.legalName ?? null,
      kind: def.identity.kind, industry: def.identity.industry ?? null, status: 'PROVISIONING',
      isolationModel: def.identity.isolationModel, tenantKey: tenantKey(), domain: def.identity.domain ?? null,
      currentDefinitionVersion: 1, retentionDays: def.policies.retentionDays,
      backupPolicy: def.policies.backupPolicy, contractStatus: 'PENDING', supportStatus: 'ONBOARDING',
      createdBy: actor.email,
    } }),
  )
  steps.push(step('identity.create', 'Create isolated company identity', true, `${company.code} / tenant key issued server-side`))

  await db.factoryCompanyDefinition.create({ data: {
    companyId: company.id, version: 1, definition: defText, checksum: defHash,
    status: 'VALIDATED', createdBy: actor.email,
  } })
  steps.push(step('definition.version', 'Store version-controlled company definition', true, `v1 checksum ${defHash.slice(0, 12)}…`))

  for (const user of def.organization.users) {
    await db.factoryCompanyMember.create({ data: {
      companyId: company.id, userEmail: user.email, role: user.role, status: 'ACTIVE',
      privileged: false, grantedBy: actor.email, grantReason: 'Initial company definition (wizard)',
    } })
  }
  // The provisioning operator gets a time-limited, explicit, audited grant.
  // Factory administrators do NOT otherwise gain private-data access.
  const operatorExpiry = new Date(Date.now() + 7 * 24 * 3600 * 1000)
  await db.factoryCompanyMember.create({ data: {
    companyId: company.id, userEmail: actor.email, role: 'FACTORY_OPERATOR', status: 'ACTIVE',
    privileged: true, grantedBy: actor.email,
    grantReason: `Provisioning operator for ${company.code}; time-limited review access`,
    expiresAt: operatorExpiry,
  } })
  steps.push(step('grants.initialize', 'Initialize roles, permissions and explicit grants', true, `${def.organization.users.length} company users + 1 audited operator grant`))

  const job = await createWithUniqueCode('JOB', () => db.factoryProvisionJob.count(), (code) =>
    db.factoryProvisionJob.create({ data: {
      code, companyId: company.id, action: 'PROVISION', status: 'RUNNING',
      steps: jsonText(steps), requestedBy: actor.email, startedAt: new Date(),
    } }),
  )

  const application = await createWithUniqueCode('APP', () => db.factoryApplication.count(), (code) =>
    db.factoryApplication.create({ data: {
      code, companyId: company.id, templateId: templateRow.id,
      templateVersionId: templateVersionRow.id,
      name: def.branding.productName || def.identity.name, environment: def.identity.environment,
      deploymentModel: def.identity.deploymentModel, status: 'PROVISIONING', config: configText,
      configChecksum: configHash, definitionVersion: 1, releaseVersion: '1.0.0',
      domain: def.identity.domain ?? null, healthStatus: 'UNKNOWN', createdBy: actor.email,
    } }),
  )
  steps.push(step('config.generate', 'Generate company-specific configuration from approved template', true, `config checksum ${configHash.slice(0, 12)}…`))

  const enabled = def.modules.filter((m) => m.enabled)
  await db.factoryAppModule.createMany({ data: enabled.map((m) => ({
    applicationId: application.id, moduleId: m.code, moduleVersionId: moduleRefs.get(m.code)!.id,
    semver: moduleRefs.get(m.code)!.semver, enabled: true, config: Object.keys(m.config ?? {}).length ? jsonText(m.config) : null,
  })) })
  await db.factoryConfigRevision.create({ data: {
    applicationId: application.id, version: 1, config: configText, checksum: configHash,
    changeType: 'CREATE', changedBy: actor.email, note: 'Initial provisioning configuration',
  } })
  steps.push(step('modules.pin', 'Pin exact approved module versions', true, `${enabled.length} modules pinned to approved releases`))

  // Initialize real, company-scoped module data. No other company's customer
  // data is ever copied here.
  const records: Array<{ applicationId: string; companyId: string; moduleKey: string; entityType: string; data: string; createdBy: string }> = []
  const has = (code: string) => enabled.some((m) => m.code === code)
  for (const user of def.organization.users) {
    if (has('identity')) records.push({ applicationId: application.id, companyId: company.id, moduleKey: 'identity', entityType: 'USER',
      data: jsonText({ email: user.email, name: user.email.split('@')[0], role: user.role }), createdBy: actor.email })
  }
  if (has('workflow')) {
    const stages = config.workflows.pipelines.length ? config.workflows.pipelines : ['New', 'In progress', 'Done']
    stages.forEach((label, i) => records.push({ applicationId: application.id, companyId: company.id, moduleKey: 'workflow', entityType: 'PIPELINE_STAGE',
      data: jsonText({ key: `stage-${i + 1}`, label, position: i + 1 }), createdBy: actor.email }))
  }
  if (has('notifications')) {
    for (const n of templateRef.definition.notifications) {
      records.push({ applicationId: application.id, companyId: company.id, moduleKey: 'notifications', entityType: 'NOTIFICATION',
        data: jsonText({ subject: n.key, body: n.template, status: 'TEMPLATE' }), createdBy: actor.email })
    }
  }
  if (records.length) await db.factoryRecord.createMany({ data: records })
  steps.push(step('records.initialize', 'Initialize module entities, roles and workflows', true, `${records.length} scoped configuration records initialized`))

  const integrationRows = ADAPTERS.map((adapter) => {
    const enabledAdapter = adapter.kind === 'INTERNAL' || def.integrations.includes(adapter.key)
    const missing = missingEnvKeys(adapter, (name) => Boolean(process.env[name]?.trim()))
    const computed = computeAdapterStatus(adapter, { enabled: enabledAdapter, envConfigured: missing.length === 0 })
    return {
      code: `${company.code}-${adapter.key}`.slice(0, 180), companyId: company.id, providerKey: adapter.key,
      kind: adapter.kind, enabled: enabledAdapter, configured: missing.length === 0,
      status: computed.status, envKeys: adapter.envKeys.join(','), config: null,
      lastCheckedAt: new Date(), lastError: null,
    }
  })
  await db.factoryIntegration.createMany({ data: integrationRows })
  steps.push(step('integrations.register', 'Register replaceable integration adapters', true, `${integrationRows.length} adapters; ${integrationRows.filter((r) => r.status === 'NOT_CONFIGURED' || r.status === 'DISABLED').length} honestly unavailable`))

  // ---- automated setup and acceptance checks (real DB assertions) ----
  const acceptance = await runAcceptanceChecks({ company, application, configText, configHash, enabled: enabled.map((m) => m.code), templateRef })
  steps.push(...acceptance)
  const backup = await createBackup(application.id, 'FULL', actor)
  const verification = await verifyBackup(backup.id, actor)
  steps.push(step('backup.create', 'Create and verify pre-activation backup', verification.ok, verification.ok ? `${backup.code} verified (${backup.sizeBytes} bytes)` : verification.errors.join('; ')))
  const health = await runHealthChecks(application.id, actor)
  steps.push(step('health.check', 'Run real application health checks', health.status === 'HEALTHY', `${health.status}: ${health.checks.filter((c) => c.ok).length}/${health.checks.length} checks passed`))
  const allFailed = steps.filter((s) => s.status === 'FAIL')

  const finalStatus = allFailed.length === 0 ? 'STAGING' : 'TEST_FAILED'
  await db.factoryApplication.update({ where: { id: application.id }, data: { status: finalStatus } })
  await db.factoryCompany.update({ where: { id: company.id }, data: { status: allFailed.length === 0 ? 'CONFIGURED' : 'PROVISIONING' } })
  await db.factoryProvisionJob.update({ where: { id: job.id }, data: {
    applicationId: application.id, status: allFailed.length === 0 ? 'PASSED' : 'FAILED',
    steps: jsonText(steps), testResults: jsonText({ acceptance: steps.filter((s) => s.key.startsWith('acceptance.')), health }),
    error: allFailed.length ? jsonText(allFailed.map((s) => `${s.key}: ${s.detail}`)) : null,
    finishedAt: new Date(),
  } })

  const releaseCode = `REL-${company.code}-1`
  await db.factoryRelease.create({ data: {
    code: releaseCode, applicationId: application.id, companyId: company.id,
    fromVersion: null, toVersion: '1.0.0', kind: 'INITIAL', environment: def.identity.environment,
    status: 'STAGING', moduleVersions: jsonText(enabled.map((m) => ({ code: m.code, semver: moduleRefs.get(m.code)!.semver }))),
    compatibility: jsonText({ compatible: true, rows: enabled.map((m) => ({ code: m.code, result: 'PINNED' })) }),
    migrationPlan: 'No migration required for initial provisioning.',
    deploymentSpec: jsonText({
      model: def.identity.deploymentModel,
      createdByFactory: def.identity.deploymentModel === 'SHARED_TENANT'
        ? 'Isolated tenant configuration and dataset inside the shared, self-hosted platform.'
        : 'Configuration only. A dedicated database, storage, credentials, domain, TLS certificate and runtime were NOT created by the factory.',
      requiredManualSteps: validation.manualSteps,
      honestState: 'STAGING — not deployed to a separate runtime',
    }),
    releaseNotes: 'Initial provisioning from an approved private template.', createdBy: actor.email,
  } })

  await writeFactoryAudit({ actor, action: 'FACTORY_COMPANY_PROVISION', targetType: 'COMPANY', targetId: company.id,
    companyId: company.id, decision: allFailed.length === 0 ? 'ALLOW' : 'DENY',
    detail: { code: company.code, application: application.code, status: finalStatus, failed: allFailed.map((s) => s.key), reusedTemplate: def.template } })

  return {
    ok: allFailed.length === 0,
    companyId: company.id, applicationId: application.id, jobId: job.id, status: finalStatus,
    validation, steps, errors: allFailed.map((s) => `${s.key}: ${s.detail}`), warnings: validation.warnings,
    definition: def, config,
  }
}

async function runAcceptanceChecks(args: {
  company: { id: string; code: string; tenantKey: string }
  application: { id: string; companyId: string; config: string; configChecksum: string }
  configText: string
  configHash: string
  enabled: string[]
  templateRef: TemplateRef
}): Promise<StepResult[]> {
  const { company, application, configHash, enabled, templateRef } = args
  const out: StepResult[] = []
  const [app, definition, pins, grants, orphanRecords] = await Promise.all([
    db.factoryApplication.findUnique({ where: { id: application.id } }),
    db.factoryCompanyDefinition.findUnique({ where: { companyId_version: { companyId: company.id, version: 1 } } }),
    db.factoryAppModule.findMany({ where: { applicationId: application.id } }),
    db.factoryCompanyMember.findMany({ where: { companyId: company.id, status: 'ACTIVE' } }),
    db.factoryRecord.count({ where: { applicationId: application.id, companyId: { not: company.id } } }),
  ])
  out.push(step('acceptance.identity', 'Company, definition and application are consistently scoped',
    Boolean(app && definition && app.companyId === company.id && definition.companyId === company.id),
    app && definition ? `${company.code} / ${app.code} / definition v${definition.version}` : 'missing identity records'))
  out.push(step('acceptance.config', 'Configuration checksum and revision are valid',
    Boolean(app && checksum(JSON.parse(app.config)) === configHash && (await db.factoryConfigRevision.count({ where: { applicationId: app.id, checksum: configHash } })) > 0),
    `checksum ${configHash.slice(0, 12)}…`))
  out.push(step('acceptance.modules', 'Required modules pinned to approved versions',
    pins.length === enabled.length && pins.every((p) => p.enabled),
    `${pins.length}/${enabled.length} modules pinned`))
  out.push(step('acceptance.permissions', 'Roles and least-privilege grants initialized',
    grants.some((g) => g.role === 'COMPANY_ADMIN') && grants.every((g) => g.companyId === company.id),
    `${grants.length} active grants`))
  out.push(step('acceptance.isolation', 'No cross-company record leakage',
    orphanRecords === 0, `${orphanRecords} orphan records`))
  const tpl = await db.factoryTemplate.findUnique({ where: { code: templateRef.code } })
  const tplRow = tpl
    ? await db.factoryTemplateVersion.findUnique({ where: { templateId_version: { templateId: tpl.id, version: templateRef.version } } })
    : null
  out.push(step('acceptance.templateIntegrity', 'Shared template was not mutated by company configuration',
    Boolean(tplRow) && checksum(JSON.parse(tplRow?.definition ?? '{}')) === tplRow?.checksum,
    tplRow ? 'template version checksum unchanged' : 'template version row missing'))
  const integrations = await db.factoryIntegration.findMany({ where: { companyId: company.id } })
  out.push(step('acceptance.integrations', 'Unconfigured providers are not reported as connected',
    integrations.every((r) => r.enabled === false || r.kind === 'INTERNAL' || r.status !== 'AVAILABLE'),
    `${integrations.length} adapters checked`))
  return out
}

/** Configuration-only changes: no shared-core edit, no cross-company effect. */
export async function updateApplicationConfig(applicationId: string, patch: unknown, actor: Actor): Promise<{ ok: boolean; errors: string[]; version: number | null }> {
  const app = await db.factoryApplication.findUnique({ where: { id: applicationId } })
  if (!app) return { ok: false, errors: ['Application not found'], version: null }
  if (app.status === 'RETIRED') return { ok: false, errors: ['A retired application cannot be reconfigured'], version: null }
  const input = parseJson<Record<string, unknown>>(typeof patch === 'string' ? patch : stableStringify(patch), {})
  const ALLOWED = new Set(['branding', 'navigation', 'fields', 'workflows', 'reports', 'integrations', 'retention', 'extensions', 'departments', 'teams', 'theme', 'pages'])
  const unexpected = Object.keys(input).filter((k) => !ALLOWED.has(k))
  if (unexpected.length) return { ok: false, errors: [`Configuration-only keys allowed; unexpected: ${unexpected.join(', ')}`], version: null }
  const current = JSON.parse(app.config) as ApplicationConfig
  const next: ApplicationConfig = { ...current }
  for (const [key, value] of Object.entries(input)) {
    (next as unknown as Record<string, unknown>)[key] = JSON.parse(JSON.stringify(value))
  }
  if (secretLikeReason(next)) return { ok: false, errors: ['Configuration contains secret-like content'], version: null }
  const last = await db.factoryConfigRevision.findFirst({ where: { applicationId }, orderBy: { version: 'desc' } })
  const version = (last?.version ?? 0) + 1
  const text = jsonText(next)
  await db.factoryConfigRevision.create({ data: {
    applicationId, version, config: text, checksum: checksum(next), changeType: 'UPDATE',
    changedBy: actor.email, note: 'Configuration-only change through the control center',
  } })
  await db.factoryApplication.update({ where: { id: applicationId }, data: { config: text, configChecksum: checksum(next) } })
  await runHealthChecks(applicationId, actor)
  await writeFactoryAudit({ actor, action: 'FACTORY_CONFIG_UPDATE', targetType: 'APPLICATION', targetId: applicationId, companyId: app.companyId, detail: { version, keys: Object.keys(input) } })
  return { ok: true, errors: [], version }
}

export async function submitForApproval(applicationId: string, actor: Actor): Promise<{ ok: boolean; reason: string }> {
  const app = await db.factoryApplication.findUnique({ where: { id: applicationId } })
  if (!app) return { ok: false, reason: 'Application not found' }
  const job = await db.factoryProvisionJob.findFirst({ where: { applicationId }, orderBy: { createdAt: 'desc' } })
  const backup = await db.factoryBackup.findFirst({ where: { applicationId, verifiedAt: { not: null } }, orderBy: { createdAt: 'desc' } })
  const decision = canTransition(app.status, 'AWAITING_APPROVAL', {
    testsPassed: job?.status === 'PASSED', backupVerified: Boolean(backup),
  })
  if (!decision.ok) return decision
  await db.factoryApplication.update({ where: { id: app.id }, data: { status: 'AWAITING_APPROVAL' } })
  await db.factoryProvisionJob.updateMany({ where: { applicationId }, data: { status: 'AWAITING_APPROVAL' } })
  await writeFactoryAudit({ actor, action: 'FACTORY_ACTIVATION_REQUESTED', targetType: 'APPLICATION', targetId: app.id, companyId: app.companyId, detail: { backup: backup?.code ?? null } })
  return { ok: true, reason: 'Awaiting authorized activation approval' }
}

export async function activateApplication(applicationId: string, actor: Actor, evidence: string | null): Promise<{ ok: boolean; reason: string }> {
  const app = await db.factoryApplication.findUnique({ where: { id: applicationId } })
  if (!app) return { ok: false, reason: 'Application not found' }
  const job = await db.factoryProvisionJob.findFirst({ where: { applicationId }, orderBy: { createdAt: 'desc' } })
  const backup = await db.factoryBackup.findFirst({ where: { applicationId, verifiedAt: { not: null } }, orderBy: { createdAt: 'desc' } })
  const decision = canTransition(app.status, 'LIVE', {
    testsPassed: job?.status === 'PASSED' || job?.status === 'AWAITING_APPROVAL',
    approvalRecorded: app.status === 'AWAITING_APPROVAL',
    privilegedApproval: canApproveRelease(actor),
    backupVerified: Boolean(backup),
    healthStatus: app.healthStatus,
    deploymentModel: app.deploymentModel === 'DEDICATED' ? 'DEDICATED' : 'SHARED_TENANT',
    deploymentEvidence: evidence,
  })
  if (!decision.ok) {
    await writeFactoryAudit({ actor, action: 'FACTORY_ACTIVATION', targetType: 'APPLICATION', targetId: app.id, companyId: app.companyId, decision: 'DENY', detail: { reason: decision.reason } })
    return decision
  }
  const backupRow = await createBackup(applicationId, 'PRE_UPGRADE', actor)
  await verifyBackup(backupRow.id, actor)
  await db.factoryApplication.update({ where: { id: app.id }, data: {
    status: 'LIVE', approvedBy: actor.email, approvedAt: new Date(), activatedAt: new Date(),
  } })
  await db.factoryCompany.update({ where: { id: app.companyId }, data: { status: 'ACTIVE' } })
  await db.factoryRelease.updateMany({ where: { applicationId, kind: 'INITIAL' }, data: { status: 'DEPLOYED', deployedAt: new Date(), approvedBy: actor.email, approvedAt: new Date() } })
  await runHealthChecks(applicationId, actor)
  await writeFactoryAudit({ actor, action: 'FACTORY_ACTIVATION', targetType: 'APPLICATION', targetId: app.id, companyId: app.companyId, detail: { evidence: evidence ?? null, backup: backupRow.code } })
  return { ok: true, reason: 'Application activated after verified tests, backup and authorized approval' }
}

export async function retireApplication(applicationId: string, actor: Actor, reason: string): Promise<{ ok: boolean; reason: string }> {
  const app = await db.factoryApplication.findUnique({ where: { id: applicationId } })
  if (!app) return { ok: false, reason: 'Application not found' }
  if (reason.trim().length < 10) return { ok: false, reason: 'A meaningful retirement reason is required' }
  const backup = await createBackup(applicationId, 'FULL', actor)
  const verification = await verifyBackup(backup.id, actor)
  const decision = canTransition(app.status, 'RETIRED', {
    privilegedApproval: canApproveRelease(actor), backupVerified: verification.ok,
  })
  if (!decision.ok) return decision
  await db.factoryApplication.update({ where: { id: app.id }, data: { status: 'RETIRED' } })
  await db.factoryCompany.update({ where: { id: app.companyId }, data: { status: 'RETIRED' } })
  await writeFactoryAudit({ actor, action: 'FACTORY_RETIREMENT', targetType: 'APPLICATION', targetId: app.id, companyId: app.companyId, detail: { reason, finalBackup: backup.code } })
  return { ok: true, reason: 'Retired. Data was exported and preserved; nothing was deleted.' }
}

/** Test H: repeat a definition for another company, with a fresh identity. */
export async function reuseCompanyDefinition(sourceCompanyId: string, overrides: Record<string, unknown>, actor: Actor): Promise<ProvisionResult> {
  const source = await db.factoryCompanyDefinition.findFirst({ where: { companyId: sourceCompanyId, status: { in: ['VALIDATED', 'APPROVED'] } }, orderBy: { version: 'desc' } })
  if (!source) {
    return { ok: false, companyId: null, applicationId: null, jobId: null, status: null, validation: null, steps: [], errors: ['No approved company definition to reuse'], warnings: [], definition: null, config: null }
  }
  const base = JSON.parse(source.definition) as CompanyDefinition
  const identity = { ...base.identity, ...(overrides.identity as Record<string, unknown> ?? {}) }
  const users = Array.isArray(overrides.users) ? overrides.users : []
  if (users.length === 0) {
    return { ok: false, companyId: null, applicationId: null, jobId: null, status: null, validation: null, steps: [], errors: ['A new instance requires its own users/roles; provide `users`'], warnings: [], definition: null, config: null }
  }
  const next: CompanyDefinition = {
    ...base,
    identity: { ...base.identity, ...identity, slug: String(overrides.slug ?? '') },
    organization: { ...base.organization, users: users as CompanyDefinition['organization']['users'] },
  }
  const result = await provisionCompany(next, actor)
  if (result.ok) {
    await writeFactoryAudit({ actor, action: 'FACTORY_DEFINITION_REUSED', targetType: 'COMPANY', targetId: result.companyId!, companyId: result.companyId!, detail: { sourceCompanyId, sourceVersion: source.version, newSlug: next.identity.slug, sourceCodeChanges: 'none' } })
  }
  return result
}

export function deploymentSummary(app: { deploymentModel: string; environment: string; status: string; healthStatus: string }): string {
  if (app.deploymentModel === 'DEDICATED') {
    return `DEDICATED configuration in ${app.environment}; a separate runtime is a manual, evidence-gated step. App status ${app.status}, health ${app.healthStatus}.`
  }
  return `SHARED_TENANT in ${app.environment} with server-enforced isolation. App status ${app.status}, health ${app.healthStatus}.`
}

export const _internal = { loadTemplateRef, canManageFactory }
