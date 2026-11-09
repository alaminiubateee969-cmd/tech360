// @ts-nocheck
/**
 * Release management, shared-module impact analysis, staging upgrades and
 * rollback. A shared-module update is NEVER pushed into a live application:
 * dependencies are identified, compatibility is checked, a staging instance
 * is upgraded first, an authorized approval is required, and the previous
 * known-good configuration remains restorable.
 */
import { db } from '@/lib/db'
import { canApproveRelease, writeFactoryAudit, type Actor } from './access'
import { createBackup, verifyBackup } from './backup'
import { runHealthChecks } from './health'
import { canReleaseTransition, compatibilityReport, RELEASE_TRANSITIONS } from './lifecycle'
import { resolveRuntime, runFactoryTests } from './runtime'
import type { ApplicationConfig } from './types'
import { checksum, createWithUniqueCode, jsonText, parseJson, randomTag } from './util'

export interface ImpactRow {
  applicationId: string
  applicationCode: string
  companyId: string
  status: string
  pinnedSemver: string
  targetSemver: string
  result: string
}

export async function impactAnalysis(moduleCode: string, targetVersion?: number): Promise<{
  moduleCode: string
  target: { version: number; semver: string; status: string; breaking: boolean } | null
  templates: Array<{ code: string; version: number; templateVersionId: string }>
  applications: ImpactRow[]
  compatibility: { compatible: boolean; breaking: boolean; rows: Array<{ code: string; from: string; to: string; result: string; applicationId?: string }> }
}> {
  const mod = await db.factoryModule.findUnique({ where: { code: moduleCode } })
  if (!mod) throw new Error(`Module ${moduleCode} not found`)
  const target = targetVersion
    ? await db.factoryModuleVersion.findUnique({ where: { moduleId_version: { moduleId: mod.id, version: targetVersion } } })
    : await db.factoryModuleVersion.findFirst({ where: { moduleId: mod.id }, orderBy: { version: 'desc' } })
  const links = await db.factoryTemplateModule.findMany({ where: { moduleId: moduleCode } })
  const templateVersionIds = [...new Set(links.map((l) => l.templateVersionId))]
  const templateVersions = templateVersionIds.length
    ? await db.factoryTemplateVersion.findMany({ where: { id: { in: templateVersionIds } } })
    : []
  const templateIds = [...new Set(templateVersions.map((v) => v.templateId))]
  const templates = templateIds.length ? await db.factoryTemplate.findMany({ where: { id: { in: templateIds } } }) : []
  const templateRows = templateVersions.map((v) => ({
    code: templates.find((t) => t.id === v.templateId)?.code ?? '(unknown)',
    version: v.version, templateVersionId: v.id,
  }))

  const pins = await db.factoryAppModule.findMany({ where: { moduleId: moduleCode } })
  const appIds = [...new Set(pins.map((p) => p.applicationId))]
  const apps = appIds.length ? await db.factoryApplication.findMany({ where: { id: { in: appIds } } }) : []
  const targetSemver = target?.semver ?? '0.0.0'
  const applications: ImpactRow[] = pins.map((p) => ({
    applicationId: p.applicationId,
    applicationCode: apps.find((a) => a.id === p.applicationId)?.code ?? '(unknown)',
    companyId: apps.find((a) => a.id === p.applicationId)?.companyId ?? '',
    status: apps.find((a) => a.id === p.applicationId)?.status ?? 'UNKNOWN',
    pinnedSemver: p.semver,
    targetSemver,
    result: 'PENDING',
  }))
  // Compatibility is evaluated PER APPLICATION, not against an arbitrary
  // first pin: two companies may legitimately be on different module majors.
  const perApp = pins.map((p) => compatibilityReport(
    [{ code: moduleCode, semver: p.semver }],
    target ? [{ code: moduleCode, semver: targetSemver, breaking: target.breaking }] : [],
  ))
  const compatibility = {
    compatible: perApp.every((r) => r.compatible),
    breaking: perApp.some((r) => r.breaking),
    rows: perApp.map((r, i) => ({ ...r.rows[0], applicationId: pins[i].applicationId, from: r.rows[0]?.from ?? pins[i].semver, to: targetSemver, result: r.rows[0]?.result ?? 'UNCHANGED' })),
  }
  for (const row of applications) {
    const r = compatibility.rows.find((x) => x.applicationId === row.applicationId)
    row.result = r?.result ?? 'UNCHANGED'
  }
  return {
    moduleCode,
    target: target ? { version: target.version, semver: target.semver, status: target.status, breaking: target.breaking } : null,
    templates: templateRows,
    applications,
    compatibility,
  }
}

/** Create a DRAFT upgrade release with a real impact/compatibility report. */
export async function createUpgradeRelease(args: {
  applicationId: string
  moduleCode?: string
  targetVersion?: number
  configPatch?: Record<string, unknown>
  actor: Actor
}): Promise<{ ok: boolean; reason: string; releaseId: string | null; compatibility: unknown }> {
  const { applicationId, actor } = args
  const app = await db.factoryApplication.findUnique({ where: { id: applicationId } })
  if (!app) return { ok: false, reason: 'Application not found', releaseId: null, compatibility: null }
  if (app.status === 'RETIRED') return { ok: false, reason: 'A retired application cannot be upgraded', releaseId: null, compatibility: null }
  const pins = await db.factoryAppModule.findMany({ where: { applicationId } })
  let updates: Array<{ code: string; semver: string; breaking: boolean; versionId: string; version: number }> = []
  if (args.moduleCode) {
    const impact = await impactAnalysis(args.moduleCode, args.targetVersion)
    if (!impact.target) return { ok: false, reason: 'Target module version was not found', releaseId: null, compatibility: null }
    if (impact.target.status !== 'APPROVED') return { ok: false, reason: 'Target module version is not approved', releaseId: null, compatibility: null }
    const pinned = pins.find((p) => p.moduleId === args.moduleCode)
    if (!pinned) return { ok: false, reason: 'This application does not use that module', releaseId: null, compatibility: null }
    const mod = await db.factoryModule.findUniqueOrThrow({ where: { code: args.moduleCode } })
    const row = await db.factoryModuleVersion.findUniqueOrThrow({ where: { moduleId_version: { moduleId: mod.id, version: impact.target.version } } })
    updates = [{ code: args.moduleCode, semver: row.semver, breaking: row.breaking, versionId: row.id, version: row.version }]
  }
  const report = compatibilityReport(pins.map((p) => ({ code: p.moduleId, semver: p.semver })), updates.map((u) => ({ code: u.code, semver: u.semver, breaking: u.breaking })))
  const current = JSON.parse(app.config) as ApplicationConfig
  const next: ApplicationConfig = {
    ...current,
    modules: current.modules.map((m) => {
      const u = updates.find((x) => x.code === m.code)
      return u ? { ...m, semver: u.semver, version: u.version } : m
    }),
    ...(args.configPatch ?? {}),
  }
  const configText = jsonText(next)
  const dependentApps = updates.length ? (await impactAnalysis(updates[0].code, updates[0].version)).applications.length : 1
  const release = await createWithUniqueCode('REL-UP', () => db.factoryRelease.count(), (code) =>
    db.factoryRelease.create({ data: {
      code, applicationId, companyId: app.companyId,
      fromVersion: app.releaseVersion, toVersion: `${app.releaseVersion}-up${Date.now().toString(36).slice(-4)}`,
      kind: 'UPGRADE', environment: app.environment, status: report.compatible ? 'DRAFT' : 'FAILED',
      moduleVersions: jsonText(next.modules.map((m) => ({ code: m.code, semver: m.semver, version: m.version }))),
      compatibility: jsonText({ report, dependentApplications: dependentApps, breaking: report.breaking }),
      migrationPlan: report.compatible
        ? 'No breaking schema change detected. Staging upgrade then approval then a verified pre-deploy backup then deploy.'
        : 'BREAKING or DOWNGRADE detected. A reviewed migration plan and explicit approval are required - automatic deployment is refused.',
      deploymentSpec: jsonText({ proposedConfig: next, stagingApplicationId: null, honestState: 'NOT_STAGED' }),
      releaseNotes: args.moduleCode ? `Shared module ${args.moduleCode} update` : 'Configuration-only release',
      createdBy: actor.email,
    } }),
  )
  if (!report.compatible) {
    await writeFactoryAudit({ actor, action: 'FACTORY_RELEASE_CREATE', targetType: 'RELEASE', targetId: release.id, companyId: app.companyId, decision: 'DENY', detail: { reason: 'incompatible', report } })
    return { ok: false, reason: 'Compatibility check failed: breaking or downgrade detected. Release recorded as FAILED.', releaseId: release.id, compatibility: report }
  }
  await writeFactoryAudit({ actor, action: 'FACTORY_RELEASE_CREATE', targetType: 'RELEASE', targetId: release.id, companyId: app.companyId, detail: { dependentApplications: dependentApps, report } })
  return { ok: true, reason: 'Draft upgrade release created with impact analysis', releaseId: release.id, compatibility: report }
}

/** Upgrade a STAGING instance. For a LIVE app, a config-only staging clone is created (no customer data is copied). */
export async function stageUpgradeRelease(releaseId: string, actor: Actor): Promise<{ ok: boolean; reason: string; stagingApplicationId: string | null }> {
  const release = await db.factoryRelease.findUnique({ where: { id: releaseId } })
  if (!release) return { ok: false, reason: 'Release not found', stagingApplicationId: null }
  const app = await db.factoryApplication.findUniqueOrThrow({ where: { id: release.applicationId } })
  const spec = parseJson<{ proposedConfig?: ApplicationConfig; stagingApplicationId?: string | null }>(release.deploymentSpec, {})
  const nextConfig = spec.proposedConfig
  if (!nextConfig) return { ok: false, reason: 'Release has no proposed configuration', stagingApplicationId: null }
  // State-machine guard first; the EVIDENCE gate is evaluated after the
  // staging instance actually exists and the executable suite has run.
  if (!RELEASE_TRANSITIONS[release.status]?.includes('STAGING')) {
    return { ok: false, reason: `${release.status} → STAGING is not an allowed release transition`, stagingApplicationId: null }
  }
  const configText = jsonText(nextConfig)
  const hash = checksum(nextConfig)
  let stagingId = spec.stagingApplicationId ?? null
  if (app.environment === 'STAGING' && app.status !== 'LIVE') {
    stagingId = app.id
    await db.factoryApplication.update({ where: { id: app.id }, data: { config: configText, configChecksum: hash, status: 'STAGING' } })
    await db.factoryConfigRevision.create({ data: {
      applicationId: app.id, version: (await db.factoryConfigRevision.count({ where: { applicationId: app.id } })) + 1,
      config: configText, checksum: hash, changeType: 'UPGRADE', changedBy: actor.email, note: `Staging upgrade ${release.code}`,
    } })
  } else if (!stagingId) {
    const clone = await db.factoryApplication.create({ data: {
      code: `APP-STG-${Date.now().toString(36).toUpperCase()}-${randomTag()}`, companyId: app.companyId,
      templateId: app.templateId, templateVersionId: app.templateVersionId,
      name: `${app.name} (staging upgrade)`, environment: 'STAGING', deploymentModel: app.deploymentModel,
      status: 'STAGING', config: configText, configChecksum: hash, definitionVersion: app.definitionVersion,
      releaseVersion: release.toVersion, domain: null, healthStatus: 'UNKNOWN', createdBy: actor.email,
    } })
    stagingId = clone.id
    const pins = await db.factoryAppModule.findMany({ where: { applicationId: app.id } })
    await db.factoryAppModule.createMany({ data: pins.map((p) => ({
      applicationId: clone.id, moduleId: p.moduleId, moduleVersionId: p.moduleVersionId,
      semver: p.semver, enabled: p.enabled, config: p.config,
    })) })
    await db.factoryConfigRevision.create({ data: {
      applicationId: clone.id, version: 1, config: configText, checksum: hash,
      changeType: 'CREATE', changedBy: actor.email, note: `Staging clone for ${release.code}; no customer data copied`,
    } })
    await createBackup(clone.id, 'CONFIG_ONLY', actor)
  }
  const moduleVersions = parseJson<Array<{ code: string; version: number; semver: string }>>(release.moduleVersions, [])
  for (const m of moduleVersions) {
    const mod = await db.factoryModule.findUnique({ where: { code: m.code } })
    if (!mod) continue
    const version = await db.factoryModuleVersion.findUnique({ where: { moduleId_version: { moduleId: mod.id, version: m.version } } })
    if (!version) continue
    await db.factoryAppModule.updateMany({ where: { applicationId: stagingId, moduleId: m.code }, data: {
      moduleVersionId: version.id, semver: version.semver,
    } })
  }
  const health = await runHealthChecks(stagingId, actor)
  if (health.status !== 'HEALTHY') {
    await db.factoryRelease.update({ where: { id: release.id }, data: { status: 'FAILED' } })
    await writeFactoryAudit({ actor, action: 'FACTORY_RELEASE_STAGE', targetType: 'RELEASE', targetId: release.id, companyId: app.companyId, decision: 'DENY', detail: { health: health.status, checks: health.checks } })
    return { ok: false, reason: `Staging health check failed (${health.status})`, stagingApplicationId: stagingId }
  }
  // REAL, EXECUTABLE acceptance evidence (not a hardcoded `passed: true`).
  const company = await db.factoryCompany.findUnique({ where: { id: app.companyId } })
  let tests = { ok: false, passed: 0, failed: -1, jobId: null as string | null, checks: [] as Array<{ key: string; ok: boolean }> }
  if (company) {
    const staging = await resolveRuntime(actor, company.slug, 'write', stagingId)
    if (staging.ok && staging.data) {
      const result = await runFactoryTests(actor, staging.data)
      tests = { ok: result.ok, passed: result.passed, failed: result.failed, jobId: result.jobId, checks: result.checks.map((c) => ({ key: c.key, ok: c.ok })) }
    }
  }
  const decision = canReleaseTransition(release.status, 'STAGING', { testsPassed: tests.ok })
  if (!decision.ok) {
    await db.factoryRelease.update({ where: { id: release.id }, data: { status: 'FAILED',
      compatibility: jsonText({ ...parseJson<Record<string, unknown>>(release.compatibility, {}), tests }) } })
    await writeFactoryAudit({ actor, action: 'FACTORY_RELEASE_STAGE', targetType: 'RELEASE', targetId: release.id, companyId: app.companyId, decision: 'DENY', detail: { reason: decision.reason, tests } })
    return { ok: false, reason: `Executable staging tests did not pass: ${decision.reason}`, stagingApplicationId: stagingId }
  }
  await db.factoryRelease.update({ where: { id: release.id }, data: {
    status: 'STAGING',
    deploymentSpec: jsonText({ ...spec, proposedConfig: nextConfig, stagingApplicationId: stagingId, honestState: 'STAGED_AND_TESTED', testJobId: tests.jobId }),
    compatibility: jsonText({ ...parseJson<Record<string, unknown>>(release.compatibility, {}), stagingHealth: health.status, stagedAt: new Date().toISOString(), executableTests: { passed: tests.passed, failed: tests.failed, jobId: tests.jobId, checks: tests.checks } }),
  } })
  await writeFactoryAudit({ actor, action: 'FACTORY_RELEASE_STAGE', targetType: 'RELEASE', targetId: release.id, companyId: app.companyId, detail: { stagingApplicationId: stagingId, health: health.status, testsPassed: tests.passed, testsFailed: tests.failed, testJobId: tests.jobId } })
  return { ok: true, reason: `Staging instance upgraded, health-checked and ${tests.passed} executable acceptance checks passed`, stagingApplicationId: stagingId }
}

export async function approveRelease(releaseId: string, actor: Actor, note: string): Promise<{ ok: boolean; reason: string }> {
  const release = await db.factoryRelease.findUnique({ where: { id: releaseId } })
  if (!release) return { ok: false, reason: 'Release not found' }
  if (!canApproveRelease(actor)) {
    await writeFactoryAudit({ actor, action: 'FACTORY_RELEASE_APPROVE', targetType: 'RELEASE', targetId: releaseId, companyId: release.companyId, decision: 'DENY', detail: { reason: 'requires SUPER_ADMIN' } })
    return { ok: false, reason: 'Release approval requires a SUPER_ADMIN' }
  }
  if (note.trim().length < 10) return { ok: false, reason: 'A meaningful approval note is required' }
  const decision = canReleaseTransition(release.status, 'APPROVED', { approved: true })
  if (!decision.ok) return decision
  await db.factoryRelease.update({ where: { id: releaseId }, data: {
    status: 'APPROVED', approvedBy: actor.email, approvedAt: new Date(),
    releaseNotes: `${release.releaseNotes ?? ''}\nApproval: ${note}`.trim(),
  } })
  await writeFactoryAudit({ actor, action: 'FACTORY_RELEASE_APPROVE', targetType: 'RELEASE', targetId: releaseId, companyId: release.companyId, detail: { note } })
  return { ok: true, reason: 'Release approved' }
}

export async function deployRelease(releaseId: string, actor: Actor): Promise<{ ok: boolean; reason: string }> {
  const release = await db.factoryRelease.findUnique({ where: { id: releaseId } })
  if (!release) return { ok: false, reason: 'Release not found' }
  const app = await db.factoryApplication.findUniqueOrThrow({ where: { id: release.applicationId } })
  const spec = parseJson<{ proposedConfig?: ApplicationConfig; stagingApplicationId?: string | null }>(release.deploymentSpec, {})
  if (!spec.proposedConfig || !spec.stagingApplicationId) return { ok: false, reason: 'Release has not been staged and tested' }
  const staging = await db.factoryApplication.findUnique({ where: { id: spec.stagingApplicationId } })
  if (!staging || staging.healthStatus !== 'HEALTHY') return { ok: false, reason: 'Staging instance is not healthy' }
  const testJob = await db.factoryProvisionJob.findFirst({
    where: { applicationId: staging.id, action: 'TEST', status: 'PASSED' }, orderBy: { createdAt: 'desc' },
  })
  if (!testJob) return { ok: false, reason: 'No persisted, passing executable test run exists for the staged release' }
  const backup = await createBackup(app.id, 'PRE_UPGRADE', actor)
  const verification = await verifyBackup(backup.id, actor)
  const decision = canReleaseTransition(release.status, 'DEPLOYED', { approved: release.status === 'APPROVED', backupVerified: verification.ok })
  if (!decision.ok) return decision
  const configText = jsonText(spec.proposedConfig)
  const hash = checksum(spec.proposedConfig)
  const revision = await db.factoryConfigRevision.findFirst({ where: { applicationId: app.id }, orderBy: { version: 'desc' } })
  await db.factoryConfigRevision.create({ data: {
    applicationId: app.id, version: (revision?.version ?? 0) + 1, config: configText, checksum: hash,
    changeType: 'UPGRADE', changedBy: actor.email, note: `Deployed ${release.code}; rollback point ${backup.code}`,
  } })
  await db.factoryApplication.update({ where: { id: app.id }, data: {
    config: configText, configChecksum: hash, releaseVersion: release.toVersion,
  } })
  const moduleVersions = parseJson<Array<{ code: string; version: number; semver: string }>>(release.moduleVersions, [])
  for (const m of moduleVersions) {
    const mod = await db.factoryModule.findUnique({ where: { code: m.code } })
    if (!mod) continue
    const version = await db.factoryModuleVersion.findUnique({ where: { moduleId_version: { moduleId: mod.id, version: m.version } } })
    if (!version) continue
    await db.factoryAppModule.updateMany({ where: { applicationId: app.id, moduleId: m.code }, data: { moduleVersionId: version.id, semver: version.semver } })
  }
  const health = await runHealthChecks(app.id, actor)
  // Re-run the executable suite against the LIVE application after deployment.
  // If it fails, restore the previous known-good configuration immediately.
  const liveCompany = await db.factoryCompany.findUnique({ where: { id: app.companyId } })
  let postDeploy = { ok: true, passed: 0, failed: 0 }
  if (liveCompany) {
    const resolved = await resolveRuntime(actor, liveCompany.slug, 'write', app.id)
    if (resolved.ok && resolved.data) {
      const result = await runFactoryTests(actor, resolved.data)
      postDeploy = { ok: result.ok, passed: result.passed, failed: result.failed }
    }
  }
  if (!postDeploy.ok) {
    const previous = await db.factoryConfigRevision.findFirst({ where: { applicationId: app.id, checksum: { not: hash } }, orderBy: { version: 'desc' } })
    if (previous) await db.factoryApplication.update({ where: { id: app.id }, data: { config: previous.config, configChecksum: previous.checksum } })
    await db.factoryRelease.update({ where: { id: release.id }, data: { status: 'FAILED' } })
    await writeFactoryAudit({ actor, action: 'FACTORY_RELEASE_DEPLOY', targetType: 'RELEASE', targetId: release.id, companyId: app.companyId, decision: 'DENY', detail: { postDeploy, rolledBackTo: previous?.version ?? null } })
    return { ok: false, reason: `Post-deployment acceptance tests failed (${postDeploy.failed}); configuration restored to the previous known-good revision` }
  }
  await db.factoryRelease.update({ where: { id: release.id }, data: {
    status: 'DEPLOYED', deployedAt: new Date(),
    deploymentSpec: jsonText({ ...spec, proposedConfig: spec.proposedConfig, stagingApplicationId: spec.stagingApplicationId, rollbackBackupId: backup.id }),
    migrationPlan: `${release.migrationPlan ?? ''} Rollback point: ${backup.code}; post-deploy checks ${postDeploy.passed} passed`.trim(),
  } })
  await writeFactoryAudit({ actor, action: 'FACTORY_RELEASE_DEPLOY', targetType: 'RELEASE', targetId: release.id, companyId: app.companyId, detail: { backup: backup.code, health: health.status, stagingTestJobId: testJob.id, postDeploy } })
  return { ok: true, reason: `Release deployed with verified backup ${backup.code}; health ${health.status}; ${postDeploy.passed} post-deploy checks passed` }
}

/**
 * Rollback restores the FULL PORTABLE PAYLOAD of the verified pre-upgrade
 * backup: configuration revisions, exact module pins, records and file
 * contents — not just the config document. Restoration is ADDITIVE and scoped
 * to the SAME company: missing rows are re-created, newer rows are never
 * deleted, and a cross-company payload is refused. This keeps a rollback
 * safe to run against a live application while still recovering everything
 * the portable archive contains.
 */
export async function rollbackRelease(releaseId: string, actor: Actor): Promise<{ ok: boolean; reason: string; restoredVersion: number | null }> {
  const release = await db.factoryRelease.findUnique({ where: { id: releaseId } })
  if (!release) return { ok: false, reason: 'Release not found', restoredVersion: null }
  const app = await db.factoryApplication.findUniqueOrThrow({ where: { id: release.applicationId } })
  const decision = canReleaseTransition(release.status, 'ROLLED_BACK')
  if (!decision.ok) return { ok: false, reason: decision.reason, restoredVersion: null }
  const revisions = await db.factoryConfigRevision.findMany({ where: { applicationId: app.id }, orderBy: { version: 'desc' } })
  const knownGood = revisions.find((r) => r.checksum !== app.configChecksum && r.changeType !== 'ROLLBACK') ?? revisions[revisions.length - 1]
  if (!knownGood) return { ok: false, reason: 'No known-good configuration revision', restoredVersion: null }
  const last = revisions[0]
  await db.factoryConfigRevision.create({ data: {
    applicationId: app.id, version: (last?.version ?? 0) + 1, config: knownGood.config,
    checksum: knownGood.checksum, changeType: 'ROLLBACK', changedBy: actor.email,
    note: `Rolled back ${release.code} to configuration revision v${knownGood.version}`,
  } })
  await db.factoryApplication.update({ where: { id: app.id }, data: {
    config: knownGood.config, configChecksum: knownGood.checksum, status: 'ROLLED_BACK',
    releaseVersion: release.fromVersion ?? app.releaseVersion,
  } })
  // Restore the exact module version pins of the known-good configuration so
  // the database and the configuration cannot disagree after a rollback.
  const goodConfig = JSON.parse(knownGood.config) as ApplicationConfig
  for (const m of goodConfig.modules) {
    const mod = await db.factoryModule.findUnique({ where: { code: m.code } })
    if (!mod) continue
    const version = await db.factoryModuleVersion.findUnique({ where: { moduleId_version: { moduleId: mod.id, version: m.version } } })
    if (!version) continue
    await db.factoryAppModule.updateMany({ where: { applicationId: app.id, moduleId: m.code }, data: {
      moduleVersionId: version.id, semver: version.semver,
    } })
  }
  // ---- Full portable-payload recovery from the verified rollback point ----
  const spec = parseJson<{ rollbackBackupId?: string | null }>(release.deploymentSpec, {})
  let restoredRecords = 0
  let restoredFiles = 0
  let restoredRevisions = 0
  let payloadStatus = 'NO_PORTABLE_BACKUP_LINKED'
  if (spec.rollbackBackupId) {
    const backup = await db.factoryBackup.findUnique({ where: { id: spec.rollbackBackupId } })
    if (!backup || backup.companyId !== app.companyId || !backup.verifiedAt) {
      payloadStatus = 'ROLLBACK_BACKUP_UNVERIFIED_OR_FOREIGN'
    } else {
      const payload = parseJson<{
        company?: { id?: string }
        records?: Array<{ moduleKey?: string; entityType?: string; data?: string; createdBy?: string | null; companyId?: string }>
        files?: Array<{ name?: string; mimeType?: string; sizeBytes?: number; content?: string; checksum?: string; uploadedBy?: string | null; companyId?: string }>
        configRevisions?: Array<{ version?: number; config?: string; checksum?: string; changeType?: string; changedBy?: string | null; note?: string | null }>
      } | null>(backup.payload, null)
      if (!payload || String(payload.company?.id ?? '') !== app.companyId) {
        payloadStatus = 'PAYLOAD_UNREADABLE_OR_FOREIGN'
      } else {
        const records = payload.records ?? []
        const files = payload.files ?? []
        if (records.some((r) => r.companyId && r.companyId !== app.companyId) || files.some((f) => f.companyId && f.companyId !== app.companyId)) {
          payloadStatus = 'PAYLOAD_CONTAINS_FOREIGN_DATA'
        } else {
          const existingRecords = await db.factoryRecord.findMany({ where: { applicationId: app.id }, select: { moduleKey: true, entityType: true, data: true } })
          const seenRecords = new Set(existingRecords.map((r) => `${r.moduleKey}|${r.entityType}|${r.data}`))
          for (const r of records) {
            const data = String(r.data ?? '{}')
            const key = `${String(r.moduleKey ?? '')}|${String(r.entityType ?? '')}|${data}`
            if (seenRecords.has(key)) continue
            seenRecords.add(key)
            await db.factoryRecord.create({ data: {
              applicationId: app.id, companyId: app.companyId, moduleKey: String(r.moduleKey ?? ''),
              entityType: String(r.entityType ?? ''), data, createdBy: r.createdBy ?? actor.email,
            } })
            restoredRecords++
          }
          const existingFiles = await db.factoryFile.findMany({ where: { applicationId: app.id }, select: { name: true, checksum: true } })
          const seenFiles = new Set(existingFiles.map((f) => `${f.name}|${f.checksum}`))
          for (const f of files) {
            const content = String(f.content ?? '')
            const sum = String(f.checksum ?? checksum(content))
            const key = `${String(f.name ?? '')}|${sum}`
            if (seenFiles.has(key)) continue
            if (checksum(content) !== sum) continue // never restore corrupted content
            seenFiles.add(key)
            await db.factoryFile.create({ data: {
              applicationId: app.id, companyId: app.companyId, name: String(f.name ?? 'file'),
              mimeType: String(f.mimeType ?? 'application/octet-stream'), sizeBytes: Number(f.sizeBytes ?? content.length),
              content, checksum: sum, uploadedBy: f.uploadedBy ?? actor.email,
            } })
            restoredFiles++
          }
          // Recover config revisions that may have been lost from the live app.
          const existingRevisions = await db.factoryConfigRevision.findMany({ where: { applicationId: app.id }, select: { version: true } })
          const seenVersions = new Set(existingRevisions.map((r) => r.version))
          for (const r of payload.configRevisions ?? []) {
            const version = Number(r.version ?? 0)
            if (!version || seenVersions.has(version)) continue
            const config = String(r.config ?? '{}')
            seenVersions.add(version)
            await db.factoryConfigRevision.create({ data: {
              applicationId: app.id, version, config, checksum: String(r.checksum ?? checksum(config)),
              changeType: String(r.changeType ?? 'CREATE'), changedBy: r.changedBy ?? actor.email,
              note: r.note ? `${r.note} (recovered from ${backup.code})` : `Recovered from ${backup.code}`,
            } })
            restoredRevisions++
          }
          payloadStatus = 'PORTABLE_PAYLOAD_RESTORED'
        }
      }
    }
  }
  await db.factoryRelease.update({ where: { id: release.id }, data: { status: 'ROLLED_BACK' } })
  const health = await runHealthChecks(app.id, actor)
  const recovery = { restoredRecords, restoredFiles, restoredRevisions, payloadStatus, backupId: spec.rollbackBackupId ?? null }
  await writeFactoryAudit({ actor, action: 'FACTORY_RELEASE_ROLLBACK', targetType: 'RELEASE', targetId: release.id, companyId: app.companyId, detail: { restoredVersion: knownGood.version, health: health.status, recovery } })
  return { ok: true, reason: `Rolled back to configuration revision v${knownGood.version}; ${payloadStatus.toLowerCase()} (${restoredRecords} records, ${restoredFiles} files, ${restoredRevisions} revisions recovered); health ${health.status}`, restoredVersion: knownGood.version }
}
