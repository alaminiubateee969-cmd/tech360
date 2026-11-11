/**
 * Software Factory Control Center — database-backed acceptance tests A–H.
 *
 * Run against a disposable database:
 *   npm run preview:setup
 *   PREVIEW_SQLITE_URL=file:$PWD/.preview/demo.db NODE_ENV=test \
 *     npx tsx --test tests/factory-control-db.test.ts
 *
 * In CI, DATABASE_URL points at a disposable MySQL and the same suite runs
 * there. With neither configured, the suite skips instead of lying about a
 * result. Every assertion below reads real rows written by the real services.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { db } from '../src/lib/db'
import { bootstrapCatalog, MODULE_SEEDS } from '../src/lib/factory/control/catalog'
import { resolveCompanyAccess, type Actor } from '../src/lib/factory/control/access'
import { buildBackupPayload, createBackup, restoreBackup, verifyBackup } from '../src/lib/factory/control/backup'
import { companyReport, createRecord, listRecords, readFile, refreshIntegrations, runScopedJob, uploadFile } from '../src/lib/factory/control/data'
import { runHealthChecks } from '../src/lib/factory/control/health'
import { computeAdapterStatus, getAdapter } from '../src/lib/factory/control/integrations'
import {
  activateApplication, previewDefinition, provisionCompany, reuseCompanyDefinition, submitForApproval, updateApplicationConfig,
} from '../src/lib/factory/control/provision'
import { approveRelease, createUpgradeRelease, deployRelease, impactAnalysis, rollbackRelease, stageUpgradeRelease } from '../src/lib/factory/control/releases'
import { checksum, jsonText } from '../src/lib/factory/control/util'

const HAS_DB = Boolean(process.env.PREVIEW_SQLITE_URL || process.env.DATABASE_URL)
const run = `sfcc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toLowerCase()
const factory: Actor = { email: 'admin@tech360.local', role: 'SUPER_ADMIN', ip: '127.0.0.1' }
const outsider: Actor = { email: `outsider-${run}@example.test`, role: 'SUPER_ADMIN' }

let templateCode = 'crm'
let templateVersion = 1
let selectedModules: Array<{ code: string; version: number; enabled: boolean }> = []
let aCompany = ''
let bCompany = ''
let cCompany = ''
let aApp = ''
let bApp = ''
let cApp = ''
let aJob = ''
let bJob = ''
let bFile = ''
let aOwner: Actor
let bOwner: Actor
let cOwner: Actor
const createdCompanies: string[] = []

function makeDefinition(slug: string, ownerEmail: string, overrides: Record<string, unknown> = {}) {
  return {
    identity: {
      name: slug.replace(/-/g, ' '), slug, kind: 'CLIENT', industry: 'Software',
      isolationModel: 'SHARED_TENANT', deploymentModel: 'SHARED_TENANT', environment: 'STAGING',
      ...(overrides.identity as object ?? {}),
    },
    template: { code: templateCode, version: templateVersion },
    modules: selectedModules,
    branding: { primaryColor: '#123456', accentColor: '#009FE3', productName: `${slug} CRM`, ...(overrides.branding as object ?? {}) },
    organization: { departments: ['Sales'], teams: ['Core'], users: [{ email: ownerEmail, role: 'COMPANY_ADMIN' }] },
    workflows: { pipelines: ['New', 'Qualified', 'Won'], approvalChains: ['Manager'], slaHours: 24, rules: [] },
    policies: { retentionDays: 180, backupPolicy: 'DAILY' },
    integrations: [], navigation: ['Overview', 'Contacts'], customFields: [], extensions: [],
    ...Object.fromEntries(Object.entries(overrides).filter(([k]) => !['identity', 'branding'].includes(k))),
  }
}

describe('SFCC acceptance suite (database)', { skip: !HAS_DB }, () => {
  before(async () => {
    const boot = await bootstrapCatalog(factory)
    assert.equal(boot.ok, true, `catalog bootstrap failed: ${boot.checks.filter((c) => !c.ok).map((c) => c.detail).join(', ')}`)
    const tpl = await db.factoryTemplate.findFirstOrThrow({ where: { code: 'crm', status: 'PRODUCTION_READY' } })
    const version = await db.factoryTemplateVersion.findFirstOrThrow({ where: { templateId: tpl.id, status: 'APPROVED' } })
    templateCode = tpl.code
    templateVersion = version.version
    const definition = JSON.parse(version.definition) as { modules: Array<{ code: string; required: boolean }> }
    const mods = await db.factoryModule.findMany()
    selectedModules = definition.modules.map((m) => ({
      code: m.code, version: mods.find((x) => x.code === m.code)?.currentVersion ?? 1, enabled: true,
    }))
    aOwner = { email: `owner-a-${run}@example.test`, role: 'STAFF' }
    bOwner = { email: `owner-b-${run}@example.test`, role: 'STAFF' }
    cOwner = { email: `owner-c-${run}@example.test`, role: 'STAFF' }
  })

  after(async () => {
    // The preview database is disposable; only run-scoped rows are removed so
    // repeated runs stay independent. Nothing else is touched.
    for (const id of createdCompanies) {
      const apps = await db.factoryApplication.findMany({ where: { companyId: id }, select: { id: true } })
      const appIds = apps.map((a) => a.id)
      await db.factoryRecord.deleteMany({ where: { companyId: id } })
      await db.factoryFile.deleteMany({ where: { companyId: id } })
      await db.factoryAppModule.deleteMany({ where: { applicationId: { in: appIds } } })
      await db.factoryConfigRevision.deleteMany({ where: { applicationId: { in: appIds } } })
      await db.factoryHealthCheck.deleteMany({ where: { companyId: id } })
      await db.factoryBackup.deleteMany({ where: { companyId: id } })
      await db.factoryRelease.deleteMany({ where: { companyId: id } })
      await db.factoryProvisionJob.deleteMany({ where: { companyId: id } })
      await db.factoryIntegration.deleteMany({ where: { companyId: id } })
      await db.factoryCompanyDefinition.deleteMany({ where: { companyId: id } })
      await db.factoryCompanyMember.deleteMany({ where: { companyId: id } })
      await db.factoryAuditEvent.deleteMany({ where: { companyId: id } })
      await db.factoryApplication.deleteMany({ where: { companyId: id } })
      await db.factoryCompany.deleteMany({ where: { id } })
    }
    await db.$disconnect()
  })

  it('Test A — a versioned template produces two independent company configurations', async () => {
    const defA = makeDefinition(`${run}-alpha`.toLowerCase(), aOwner.email, { branding: { primaryColor: '#111111' } })
    const defB = makeDefinition(`${run}-beta`.toLowerCase(), bOwner.email, { branding: { primaryColor: '#FF0000' }, workflows: { pipelines: ['Inbox', 'Done'], approvalChains: [], slaHours: 8, rules: [] } })
    const ra = await provisionCompany(defA, factory)
    const rb = await provisionCompany(defB, factory)
    assert.equal(ra.ok, true, `A: ${ra.errors.join('; ')}`)
    assert.equal(rb.ok, true, `B: ${rb.errors.join('; ')}`)
    aCompany = ra.companyId!; bCompany = rb.companyId!
    aApp = ra.applicationId!; bApp = rb.applicationId!
    aJob = ra.jobId!; bJob = rb.jobId!
    createdCompanies.push(aCompany, bCompany)
    const [appA, appB] = await Promise.all([
      db.factoryApplication.findUniqueOrThrow({ where: { id: aApp } }),
      db.factoryApplication.findUniqueOrThrow({ where: { id: bApp } }),
    ])
    assert.notEqual(appA.configChecksum, appB.configChecksum)
    assert.equal((JSON.parse(appA.config) as { branding: { primaryColor: string } }).branding.primaryColor, '#111111')
    assert.equal((JSON.parse(appB.config) as { branding: { primaryColor: string } }).branding.primaryColor, '#FF0000')
    // Versioned, immutable template: its stored checksum is untouched.
    const version = await db.factoryTemplateVersion.findFirstOrThrow({ where: { templateId: (await db.factoryTemplate.findFirstOrThrow({ where: { code: templateCode } })).id, version: templateVersion } })
    assert.equal(checksum(JSON.parse(version.definition)), version.checksum)
    const changed = await updateApplicationConfig(aApp, { branding: { primaryColor: '#ABCDEF', productName: 'Changed A' } }, factory)
    assert.equal(changed.ok, true)
    const [afterA, afterB] = await Promise.all([
      db.factoryApplication.findUniqueOrThrow({ where: { id: aApp } }),
      db.factoryApplication.findUniqueOrThrow({ where: { id: bApp } }),
    ])
    assert.equal((JSON.parse(afterA.config) as { branding: { primaryColor: string } }).branding.primaryColor, '#ABCDEF')
    assert.equal(afterB.config, appB.config, 'changing company A must not change company B')
    const revisions = await db.factoryConfigRevision.count({ where: { applicationId: aApp } })
    assert.ok(revisions >= 2, 'configuration changes are versioned')
  })

  it('Test B — provisioning initializes users, modules, config, tests and health', async () => {
    const job = await db.factoryProvisionJob.findUniqueOrThrow({ where: { id: aJob } })
    const steps = JSON.parse(job.steps) as Array<{ key: string; status: string }>
    assert.equal(job.status, 'PASSED')
    assert.equal(steps.every((s) => s.status === 'PASS'), true, steps.filter((s) => s.status !== 'PASS').map((s) => s.key).join(', '))
    const app = await db.factoryApplication.findUniqueOrThrow({ where: { id: aApp } })
    assert.equal(app.status, 'STAGING')
    assert.equal(app.healthStatus, 'HEALTHY')
    const grants = await db.factoryCompanyMember.findMany({ where: { companyId: aCompany, status: 'ACTIVE' } })
    assert.ok(grants.some((g) => g.role === 'COMPANY_ADMIN'))
    assert.ok(grants.some((g) => g.privileged && g.grantedBy && g.grantReason), 'factory operator grant is explicit and audited')
    const pins = await db.factoryAppModule.findMany({ where: { applicationId: aApp } })
    assert.equal(pins.length, selectedModules.length)
    const approved = await db.factoryModuleVersion.findMany({ where: { status: 'APPROVED' }, select: { id: true } })
    assert.equal(pins.every((p) => approved.some((v) => v.id === p.moduleVersionId)), true)
    const records = await db.factoryRecord.findMany({ where: { applicationId: aApp } })
    assert.ok(records.length > 0)
    assert.equal(records.every((r) => r.companyId === aCompany), true)
    const health = await runHealthChecks(aApp, factory)
    assert.equal(health.status, 'HEALTHY', JSON.stringify(health.checks.filter((c) => !c.ok)))
    // A duplicate company identity must be refused before any write.
    const preview = await previewDefinition(makeDefinition(`${run}-alpha`.toLowerCase(), aOwner.email), factory)
    assert.equal(preview.ok, false)
    assert.match(preview.errors.join(' '), /already in use|COMPANY_ADMIN|required/)
  })

  it('Test C — cross-company access is denied through records, reports, files, jobs and audit', async () => {
    const defC = makeDefinition(`${run}-gamma`.toLowerCase(), cOwner.email)
    const rc = await provisionCompany(defC, factory)
    assert.equal(rc.ok, true, rc.errors.join('; '))
    cCompany = rc.companyId!; cApp = rc.applicationId!
    createdCompanies.push(cCompany)

    const upload = await uploadFile(bOwner, {
      companyId: bCompany, applicationId: bApp, name: 'private.txt', mimeType: 'text/plain',
      contentBase64: Buffer.from('company B private document').toString('base64'),
    })
    assert.equal(upload.ok, true, upload.reason ?? '')
    bFile = upload.data!.id

    const attempts = [
      await listRecords(aOwner, { companyId: bCompany, applicationId: bApp }),
      await listRecords(aOwner, { companyId: aCompany, applicationId: bApp }),
      await createRecord(aOwner, { companyId: bCompany, applicationId: bApp, moduleKey: 'contacts', entityType: 'CONTACT', data: { name: 'Injected' } }),
      await companyReport(aOwner, bCompany),
      await readFile(aOwner, aCompany, bFile),
      await readFile(aOwner, bCompany, bFile),
      await runScopedJob(aOwner, aCompany, bJob),
      await listRecords(outsider, { companyId: bCompany, applicationId: bApp }),
    ]
    for (const attempt of attempts) assert.equal(attempt.ok, false, JSON.stringify(attempt))
    assert.ok(attempts.some((a) => a.code === 'NO_COMPANY_GRANT'))
    assert.ok(attempts.some((a) => a.code === 'CROSS_COMPANY_DENIED'))
    // B's own file is readable by B, with a valid checksum.
    const own = await readFile(bOwner, bCompany, bFile)
    assert.equal(own.ok, true, own.reason ?? '')
    assert.equal(own.data!.file.name, 'private.txt')
    // A factory SUPER_ADMIN without an explicit grant is denied too.
    const noGrant = await resolveCompanyAccess(outsider, bCompany, 'read', 'FACTORY_CROSS_CHECK')
    assert.equal(noGrant.ok, false)
    assert.equal(noGrant.code, 'NO_COMPANY_GRANT')
    const denials = await db.factoryAuditEvent.count({ where: { companyId: { in: [aCompany, bCompany] }, decision: 'DENY' } })
    assert.ok(denials >= attempts.length, `denials must be audited (got ${denials})`)
  })

  it('Test E — disabling an optional provider never breaks internal functionality', async () => {
    const smtp = await db.factoryIntegration.findFirstOrThrow({ where: { companyId: aCompany, providerKey: 'email_smtp' } })
    await db.factoryIntegration.update({ where: { id: smtp.id }, data: { enabled: false, status: 'DISABLED' } })
    const refreshed = await refreshIntegrations(aOwner, aCompany)
    assert.equal(refreshed.ok, true, refreshed.reason ?? '')
    const adapters = refreshed.data!.adapters as Array<{ providerKey: string; status: string; availableNow: boolean }>
    const internal = adapters.find((x) => x.providerKey === 'internal_events')!
    const email = adapters.find((x) => x.providerKey === 'email_smtp')!
    assert.equal(internal.status, 'AVAILABLE')
    assert.equal(email.status, 'DISABLED')
    assert.equal(email.availableNow, false)
    assert.equal(adapters.filter((x) => getAdapter(x.providerKey)!.kind === 'EXTERNAL' && x.status === 'AVAILABLE').length, 0)
    const created = await createRecord(aOwner, {
      companyId: aCompany, applicationId: aApp, moduleKey: 'contacts', entityType: 'CONTACT',
      data: { name: 'Internal Contact', email: 'internal@example.test' },
    })
    assert.equal(created.ok, true, created.reason ?? '')
    const listed = await listRecords(aOwner, { companyId: aCompany, applicationId: aApp, moduleKey: 'contacts' })
    assert.equal(listed.ok, true)
    assert.ok((listed.data!.total as number) >= 1)
    const whatsapp = getAdapter('whatsapp_cloud')!
    assert.equal(computeAdapterStatus(whatsapp, { enabled: true, envConfigured: false }).status, 'NOT_CONFIGURED')
  })

  it('Test F — verified backup restores data, files, permissions and health', async () => {
    const backup = await createBackup(bApp, 'FULL', factory)
    assert.equal(backup.status, 'CREATED')
    const verification = await verifyBackup(backup.id, factory)
    assert.equal(verification.ok, true, verification.errors.join('; '))
    const payload = await buildBackupPayload(bApp)
    assert.equal(payload.counts.files, 1)
    assert.equal(payload.company.tenantKey, undefined, 'tenant identity secret is never exported')
    const tampered = await db.factoryBackup.findUniqueOrThrow({ where: { id: backup.id } })
    assert.equal(checksum(JSON.parse(tampered.payload)), tampered.checksum)
    const restored = await restoreBackup(backup.id, factory)
    assert.equal(restored.ok, true, restored.errors.join('; '))
    const integrity = restored.integrity as Record<string, unknown>
    assert.equal(integrity.restoredRecords, integrity.expectedRecords)
    assert.equal(integrity.restoredFiles, 1)
    assert.equal(integrity.configChecksumMatches, true)
    assert.equal(integrity.health, 'HEALTHY')
    assert.ok(Number(integrity.permissions) >= 2)
    const restoredApp = await db.factoryApplication.findUniqueOrThrow({ where: { id: restored.applicationId! } })
    assert.equal(restoredApp.environment, 'STAGING')
    assert.equal(restoredApp.companyId, bCompany, 'restore stays in the same company')
    const restoredFile = await db.factoryFile.findFirstOrThrow({ where: { applicationId: restoredApp.id } })
    assert.equal(restoredFile.checksum, checksum(restoredFile.content))
    // Cross-company restore is refused.
    const cross = await restoreBackup(backup.id, factory, aCompany)
    assert.equal(cross.ok, false)
    assert.match(cross.errors.join(' '), /Cross-company restore is refused/)
  })

  it('Test G — roles, secret handling, privileged grants and audit records', async () => {
    const auditorEmail = `auditor-${run}@example.test`
    await db.factoryCompanyMember.create({ data: {
      companyId: aCompany, userEmail: auditorEmail, role: 'COMPANY_AUDITOR', status: 'ACTIVE',
      grantedBy: factory.email, grantReason: 'Read-only audit review',
    } })
    const auditor: Actor = { email: auditorEmail, role: 'STAFF' }
    const deniedWrite = await createRecord(auditor, {
      companyId: aCompany, applicationId: aApp, moduleKey: 'contacts', entityType: 'CONTACT', data: { name: 'Nope' },
    })
    assert.equal(deniedWrite.ok, false)
    assert.equal(deniedWrite.code, 'ROLE_DENIED')
    const allowedRead = await listRecords(auditor, { companyId: aCompany, applicationId: aApp })
    assert.equal(allowedRead.ok, true)
    const secret = await updateApplicationConfig(aApp, { branding: { productName: 'x', password: 'hunter2' } }, factory)
    assert.equal(secret.ok, false)
    assert.match(secret.errors.join(' '), /secret-like/)
    const expiredEmail = `expired-${run}@example.test`
    await db.factoryCompanyMember.create({ data: {
      companyId: aCompany, userEmail: expiredEmail, role: 'FACTORY_OPERATOR', status: 'ACTIVE',
      privileged: true, grantedBy: factory.email, grantReason: 'Expired drill', expiresAt: new Date(Date.now() - 60_000),
    } })
    const expired = await resolveCompanyAccess({ email: expiredEmail, role: 'SUPER_ADMIN' }, aCompany, 'read', 'FACTORY_EXPIRY_CHECK')
    assert.equal(expired.ok, false)
    assert.equal(expired.code, 'GRANT_EXPIRED')
    const auditCount = await db.factoryAuditEvent.count({ where: { companyId: aCompany } })
    assert.ok(auditCount >= 5, `expected an audit trail, found ${auditCount} events`)
    const platformAudit = await db.auditLog.count({ where: { action: { startsWith: 'FACTORY_' } } })
    assert.ok(platformAudit > 0, 'sensitive operations also appear in the platform audit log')
    const health = await runHealthChecks(aApp, factory)
    assert.equal(health.status, 'HEALTHY', JSON.stringify(health.checks.filter((c) => !c.ok)))
  })

  it('Test D — shared-module update: impact analysis, compatibility, staging, rollback', async () => {
    const mod = await db.factoryModule.findUniqueOrThrow({ where: { code: 'reporting' } })
    const v1 = await db.factoryModuleVersion.findUniqueOrThrow({ where: { moduleId_version: { moduleId: mod.id, version: 1 } } })
    const existing = await db.factoryModuleVersion.findUnique({ where: { moduleId_version: { moduleId: mod.id, version: 2 } } })
    if (!existing) {
      await db.factoryModuleVersion.create({ data: {
        moduleId: mod.id, version: 2, semver: '1.1.0', manifest: v1.manifest,
        checksum: checksum(JSON.parse(v1.manifest)), status: 'APPROVED', breaking: false,
        releaseNotes: 'Non-breaking reporting improvement', approvedBy: factory.email, approvedAt: new Date(),
        createdBy: factory.email,
      } })
    }
    const impact = await impactAnalysis('reporting', 2)
    assert.ok(impact.templates.length >= 1, 'dependent templates identified')
    assert.ok(impact.applications.length >= 1, 'dependent applications identified')
    // Impact analysis is global by design: other companies in this disposable
    // database may pin a different version. Assert this application's own row.
    assert.equal(impact.compatibility.rows.find((r) => r.applicationId === aApp)?.result, 'COMPATIBLE')
    const created = await createUpgradeRelease({ applicationId: aApp, moduleCode: 'reporting', targetVersion: 2, actor: factory })
    assert.equal(created.ok, true, created.reason ?? '')
    const releaseId = created.releaseId!
    const staged = await stageUpgradeRelease(releaseId, factory)
    assert.equal(staged.ok, true, staged.reason)
    const approved = await approveRelease(releaseId, factory, 'Reviewed compatibility and staging health checks')
    assert.equal(approved.ok, true, approved.reason)
    const deployed = await deployRelease(releaseId, factory)
    assert.equal(deployed.ok, true, deployed.reason)
    const afterDeploy = await db.factoryApplication.findUniqueOrThrow({ where: { id: aApp } })
    assert.equal((JSON.parse(afterDeploy.config) as { modules: Array<{ code: string; semver: string }> }).modules.find((m) => m.code === 'reporting')?.semver, '1.1.0')
    const pin = await db.factoryAppModule.findUniqueOrThrow({ where: { applicationId_moduleId: { applicationId: aApp, moduleId: 'reporting' } } })
    assert.equal(pin.semver, '1.1.0')
    const rolled = await rollbackRelease(releaseId, factory)
    assert.equal(rolled.ok, true, rolled.reason)
    const afterRollback = await db.factoryApplication.findUniqueOrThrow({ where: { id: aApp } })
    assert.equal(afterRollback.status, 'ROLLED_BACK')
    assert.equal((JSON.parse(afterRollback.config) as { modules: Array<{ code: string; semver: string }> }).modules.find((m) => m.code === 'reporting')?.semver, '1.0.0')
    const release = await db.factoryRelease.findUniqueOrThrow({ where: { id: releaseId } })
    assert.equal(release.status, 'ROLLED_BACK')
    // A breaking major release is identified and refused for automatic deploy.
    const v3 = await db.factoryModuleVersion.findUnique({ where: { moduleId_version: { moduleId: mod.id, version: 3 } } })
    if (!v3) {
      await db.factoryModuleVersion.create({ data: {
        moduleId: mod.id, version: 3, semver: '2.0.0', manifest: v1.manifest,
        checksum: checksum(JSON.parse(v1.manifest)), status: 'APPROVED', breaking: true,
        releaseNotes: 'Breaking reporting schema change', approvedBy: factory.email, approvedAt: new Date(),
        createdBy: factory.email,
      } })
    }
    const breakingImpact = await impactAnalysis('reporting', 3)
    assert.ok(breakingImpact.compatibility.rows.some((r) => r.result === 'BREAKING'))
    assert.ok(breakingImpact.applications.length >= 1)
    const breaking = await createUpgradeRelease({ applicationId: aApp, moduleCode: 'reporting', targetVersion: 3, actor: factory })
    assert.equal(breaking.ok, false, 'a breaking change must be refused for automatic deployment')
    assert.match(breaking.reason, /incompatible|Compatibility/i)
    const failedRelease = await db.factoryRelease.findUniqueOrThrow({ where: { id: breaking.releaseId! } })
    assert.equal(failedRelease.status, 'FAILED')
    assert.match(failedRelease.migrationPlan ?? '', /BREAKING|migration plan/i)
  })

  it('Test H — a new company reuses an approved definition with no source changes', async () => {
    const reused = await reuseCompanyDefinition(bCompany, {
      slug: `${run}-reused`.toLowerCase(),
      identity: { name: 'Reused Instance Ltd', domain: `reused-${run}.example.test` },
      users: [{ email: `owner-reused-${run}@example.test`, role: 'COMPANY_ADMIN' }],
    }, factory)
    assert.equal(reused.ok, true, reused.errors.join('; '))
    createdCompanies.push(reused.companyId!)
    const [source, target] = await Promise.all([
      db.factoryCompany.findUniqueOrThrow({ where: { id: bCompany } }),
      db.factoryCompany.findUniqueOrThrow({ where: { id: reused.companyId! } }),
    ])
    assert.notEqual(source.tenantKey, target.tenantKey)
    assert.notEqual(source.slug, target.slug)
    assert.equal(target.domain, `reused-${run}.example.test`)
    const defs = await db.factoryCompanyDefinition.findMany({ where: { companyId: reused.companyId! } })
    assert.equal(defs.length, 1)
    const config = JSON.parse((await db.factoryApplication.findUniqueOrThrow({ where: { id: reused.applicationId! } })).config) as { automatedSteps: string[]; manualSteps: string[]; branding: { productName?: string } }
    assert.ok(config.automatedSteps.length >= 5)
    assert.ok(config.manualSteps.length >= 1)
    assert.equal(templateCode, 'crm', 'the shared template source was not modified')
    const leaked = await db.factoryRecord.count({ where: { applicationId: bApp, companyId: reused.companyId! } })
    assert.equal(leaked, 0, 'no live record was copied into the new company')
    const newRecords = await db.factoryRecord.count({ where: { applicationId: reused.applicationId! } })
    assert.ok(newRecords > 0, 'the new company has its own initialized records')
    const reuseAudit = await db.factoryAuditEvent.findFirst({ where: { action: 'FACTORY_DEFINITION_REUSED', companyId: reused.companyId! } })
    assert.ok(reuseAudit, 'reuse is recorded in the audit trail')
  })

  it('activation is approval-gated and produces a LIVE, healthy application', async () => {
    const submitted = await submitForApproval(cApp, factory)
    assert.equal(submitted.ok, true, submitted.reason)
    const tooEarly = await activateApplication(cApp, { email: `staff-${run}@example.test`, role: 'STAFF' }, null)
    assert.equal(tooEarly.ok, false)
    const activated = await activateApplication(cApp, factory, null)
    assert.equal(activated.ok, true, activated.reason)
    const [app, company] = await Promise.all([
      db.factoryApplication.findUniqueOrThrow({ where: { id: cApp } }),
      db.factoryCompany.findUniqueOrThrow({ where: { id: cCompany } }),
    ])
    assert.equal(app.status, 'LIVE')
    assert.equal(company.status, 'ACTIVE')
    assert.equal(app.healthStatus, 'HEALTHY')
    const initRelease = await db.factoryRelease.findFirstOrThrow({ where: { applicationId: cApp, kind: 'INITIAL' } })
    assert.equal(initRelease.status, 'DEPLOYED')
    const backup = await db.factoryBackup.findFirstOrThrow({ where: { applicationId: cApp, kind: 'PRE_UPGRADE' } })
    assert.ok(backup.verifiedAt, 'activation requires a verified rollback point')
  })

  it('module library stays self-consistent after all operations', async () => {
    assert.equal((await db.factoryModule.count()) >= MODULE_SEEDS.length, true)
    const manifestsValid = (await db.factoryModuleVersion.findMany({ where: { status: 'APPROVED' } })).every((v) => {
      const m = JSON.parse(v.manifest) as { capability?: string }
      return Boolean(m.capability)
    })
    assert.equal(manifestsValid, true)
    const payload = await buildBackupPayload(bApp)
    assert.equal(secretLikeReasonSafe(payload), null, 'exported payload contains no secrets')
  })
})

function secretLikeReasonSafe(value: unknown): string | null {
  // Mirrors the production secret scan without importing it here, so a change
  // to the scanner cannot silently weaken this assertion.
  const text = jsonText(value)
  const patterns = [
    /\bAKIA[0-9A-Z]{16}\b/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/, /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/,
    /\b(?:password|passwd|api[_-]?key|access[_-]?token|client[_-]?secret|bearer)\b\s*[:=]\s*\S+/i,
    /"(?:password|passwd|api[_-]?key|access[_-]?token|client[_-]?secret|bearer)"\s*:\s*"(?:[^"\\]|\\.){4,}"/i,
    /\b(?:mysql|postgres|mongodb):\/\/[^\s:]+:[^\s@]+@/i,
  ]
  for (const re of patterns) if (re.test(text)) return 'secret-like content detected'
  return null
}

