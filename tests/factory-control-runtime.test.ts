/**
 * Software Factory — APPLICATION RUNTIME acceptance tests.
 *
 * These tests prove that the factory is more than a control plane: a
 * versioned template configuration is actually consumed by one shared
 * renderer, records/files are real database rows, and the acceptance suite
 * performs real operations instead of reporting a constant "passed".
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { db } from '../src/lib/db'
import type { Actor } from '../src/lib/factory/control/access'
import { bootstrapCatalog, TEMPLATE_SEEDS } from '../src/lib/factory/control/catalog'
import { DESIGN_REFERENCES, TEMPLATE_PREVIEWS } from '../src/lib/factory/control/design-references'
import { buildDeploymentPackage } from '../src/lib/factory/control/deploy-package'
import { provisionCompany, updateApplicationConfig } from '../src/lib/factory/control/provision'
import { resolveRuntime, runFactoryTests, runtimeAction, runtimeState } from '../src/lib/factory/control/runtime'
import { checksum, parseJson } from '../src/lib/factory/control/util'

const HAS_DB = Boolean(process.env.PREVIEW_SQLITE_URL || process.env.DATABASE_URL)
const run = `rt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toLowerCase()
const factory: Actor = { email: 'admin@tech360.local', role: 'SUPER_ADMIN', ip: '127.0.0.1' }
const slug = `${run}-academy`
let companyId = ''
let appId = ''
const createdCompanies: string[] = []

function definition() {
  return {
    identity: {
      name: 'Runtime Acceptance Academy', slug, kind: 'CLIENT', industry: 'Education',
      isolationModel: 'SHARED_TENANT', deploymentModel: 'SHARED_TENANT', environment: 'STAGING',
    },
    template: { code: 'fitness-platform', version: 1 },
    modules: [] as Array<{ code: string; version: number; enabled: boolean }>,
    branding: { primaryColor: '#12123B', accentColor: '#FF6B4A', productName: 'Academy Platform' },
    organization: { departments: ['Coaching'], teams: ['Core'], users: [{ email: `${run}-owner@example.test`, role: 'COMPANY_ADMIN' }] },
    workflows: { pipelines: ['Onboarding', 'Assessment', 'Active', 'Retained'], approvalChains: ['Manager'], slaHours: 24, rules: [] },
    policies: { retentionDays: 180, backupPolicy: 'DAILY' },
    integrations: [], navigation: ['Dashboard', 'Workouts', 'Members'], customFields: [], extensions: [],
  }
}

describe('Software Factory — config-driven runtime', { skip: !HAS_DB }, () => {
  before(async () => {
    const boot = await bootstrapCatalog(factory)
    assert.equal(boot.ok, true, `catalog bootstrap: ${boot.checks.filter((c) => !c.ok).map((c) => c.detail).join(', ')}`)
    const tpl = await db.factoryTemplate.findFirstOrThrow({ where: { code: 'fitness-platform' } })
    const version = await db.factoryTemplateVersion.findFirstOrThrow({ where: { templateId: tpl.id, version: 1 } })
    const def = parseJson<{ modules: Array<{ code: string }> }>(version.definition, { modules: [] })
    const mods = await db.factoryModule.findMany()
    const input = definition()
    input.modules = def.modules.map((m) => ({ code: m.code, version: mods.find((x) => x.code === m.code)?.currentVersion ?? 1, enabled: true }))
    const result = await provisionCompany(input, factory)
    assert.equal(result.ok, true, `provision: ${result.errors.join('; ')}`)
    companyId = result.companyId!
    appId = result.applicationId!
    createdCompanies.push(companyId)
  })

  after(async () => {
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

  it('the private library holds industry templates mapped to all supplied design references', () => {
    assert.equal(DESIGN_REFERENCES.length, 18)
    assert.equal(Object.keys(TEMPLATE_PREVIEWS).length, 11)
    assert.equal(TEMPLATE_SEEDS.length, 15, '4 core + 11 industry templates')
    const registered = new Set(TEMPLATE_SEEDS.map((t) => t.code))
    for (const ref of DESIGN_REFERENCES) assert.ok(registered.has(ref.template), `${ref.file} maps to a registered template`)
    for (const code of Object.keys(TEMPLATE_PREVIEWS)) assert.ok(registered.has(code), `${code} has a preview`)
  })

  it('one renderer consumes the versioned theme and pages from the company configuration', async () => {
    const resolved = await resolveRuntime(factory, slug, 'read')
    assert.equal(resolved.ok, true, resolved.reason ?? '')
    const ctx = resolved.data!
    assert.equal(ctx.app.id, appId)
    assert.equal(ctx.template.code, 'fitness-platform')
    assert.equal(ctx.theme.motif, 'energy', 'the approved template theme is applied to this company')
    assert.equal(ctx.theme.primary, '#12123B', 'company branding overrides the template default')
    assert.equal(ctx.theme.accent, '#FF6B4A')
    assert.ok(ctx.pages.length >= 6, 'template supplies real pages, not navigation placeholders')
    assert.ok(ctx.pages.every((p) => p.key && p.label && p.description && p.kind))
    assert.ok(ctx.modules.length >= 8, 'shared reusable module engine is pinned')
    const stored = await db.factoryApplication.findUniqueOrThrow({ where: { id: appId } })
    const storedConfig = parseJson<{ theme?: unknown; pages?: unknown }>(stored.config, {})
    assert.ok(storedConfig.theme && storedConfig.pages, 'theme and pages are inside the checksummed configuration')
  })

  it('runtime state is real, company-scoped database data', async () => {
    const ctx = (await resolveRuntime(factory, slug, 'read')).data!
    const state = await runtimeState(ctx)
    assert.equal((state as unknown as { ok: boolean }).ok, true)
    const s = state as unknown as { records: unknown[]; modules: unknown[]; counts: { records: number; files: number }; aggregates: { byModule: unknown[] } }
    assert.ok(s.counts.records > 0, 'provisioning initialized real scoped records')
    assert.equal(s.modules.length, ctx.modules.length)
    assert.ok(s.aggregates.byModule.length > 0)
    assert.ok(s.records.every((r) => (r as { companyId: string }).companyId === companyId))
  })

  it('the acceptance suite executes real operations and persists its evidence', async () => {
    const ctx = (await resolveRuntime(factory, slug, 'write')).data!
    const result = await runFactoryTests(factory, ctx)
    assert.equal(result.ok, true, result.checks.filter((c) => !c.ok).map((c) => `${c.key}: ${c.detail}`).join('; '))
    assert.ok(result.checks.length >= 10)
    assert.ok(result.passed >= 10 && result.failed === 0)
    assert.ok(result.checks.some((c) => c.key === 'runtime.roundtrip' && c.ok), 'a real create/read/validate/delete round trip ran')
    assert.ok(result.jobId, 'a test job row was persisted')
    const job = await db.factoryProvisionJob.findUniqueOrThrow({ where: { id: result.jobId! } })
    assert.equal(job.status, 'PASSED')
    assert.equal(job.action, 'TEST')
    const evidence = parseJson<{ executable?: boolean; checks?: unknown[] }>(job.testResults, {})
    assert.equal(evidence.executable, true)
    assert.equal(evidence.checks?.length, result.checks.length)
  })

  it('runtime actions create, advance and remove real company records', async () => {
    const created = await runtimeAction(factory, slug, 'record.create', {
      moduleKey: 'contacts', entityType: 'CONTACT',
      data: { name: 'Runtime Probe', email: 'runtime.probe@example.test', phone: '+8801000000000', organization: 'Academy' },
    })
    assert.equal(created.ok, true, created.reason ?? '')
    const recordId = String((created.data as { id: string }).id)
    const state = await runtimeState((await resolveRuntime(factory, slug, 'read')).data!)
    const rows = (state as unknown as { records: Array<{ id: string; data: { name?: string } }> }).records
    assert.ok(rows.some((r) => r.id === recordId && r.data.name === 'Runtime Probe'))

    const stages = await db.factoryRecord.findMany({ where: { applicationId: appId, moduleKey: 'workflow', entityType: 'PIPELINE_STAGE' } })
    assert.ok(stages.length > 0)
    const advanced = await runtimeAction(factory, slug, 'workflow.advance', { recordId: stages[0].id })
    assert.equal(advanced.ok, true, advanced.reason ?? '')
    const after = await db.factoryRecord.findUniqueOrThrow({ where: { id: stages[0].id } })
    assert.ok(Object.keys(parseJson<Record<string, unknown>>(after.data, {})).every((k) => ['key', 'label', 'position'].includes(k)), 'workflow advance respects the pinned module schema')

    const removed = await runtimeAction(factory, slug, 'record.delete', { recordId })
    assert.equal(removed.ok, true, removed.reason ?? '')
    assert.equal(await db.factoryRecord.count({ where: { id: recordId } }), 0)
  })

  it('files, reports, health and tests are executable through the runtime API surface', async () => {
    const file = await runtimeAction(factory, slug, 'file.upload', {
      name: 'runtime-probe.txt', mimeType: 'text/plain', contentBase64: Buffer.from('BDTECH360 runtime probe').toString('base64'),
    })
    assert.equal(file.ok, true, file.reason ?? '')
    const report = await runtimeAction(factory, slug, 'report.run', {})
    assert.equal(report.ok, true, report.reason ?? '')
    assert.ok(Array.isArray((report.data as { lines: unknown[] }).lines))
    const health = await runtimeAction(factory, slug, 'health.run', {})
    assert.ok(health.data)
    const tests = await runtimeAction(factory, slug, 'tests.run', {})
    assert.equal(tests.ok, true, tests.reason ?? '')
    assert.equal((tests.data as { failed: number }).failed, 0)
  })

  it('an ungranted identity cannot read or write private company data', async () => {
    const outsider: Actor = { email: `${run}-outsider@example.test`, role: 'STAFF' }
    const denied = await resolveRuntime(outsider, slug, 'read')
    assert.equal(denied.ok, false)
    assert.equal(denied.code, 'NO_COMPANY_GRANT')
    const refused = await runtimeAction(outsider, slug, 'record.create', { moduleKey: 'contacts', entityType: 'CONTACT', data: { name: 'Nope' } })
    assert.equal(refused.ok, false)
    const audits = await db.factoryAuditEvent.count({ where: { companyId, decision: 'DENY' } })
    assert.ok(audits > 0, 'every refusal is audited')
  })

  it('a self-hosted deployment package is real, checksummed and credential-free', async () => {
    const pkg = await buildDeploymentPackage(appId)
    assert.equal(pkg.type, 'BDTECH360_FACTORY_DEPLOYMENT_PACKAGE')
    assert.equal(pkg.application.id, appId)
    assert.equal(pkg.company.slug, slug)
    assert.equal(pkg.config.checksum, (await db.factoryApplication.findUniqueOrThrow({ where: { id: appId } })).configChecksum)
    assert.equal(pkg.runtime.renderUrl, `/factory/apps/${slug}`)
    assert.ok(pkg.modulePins.length >= 8)
    assert.ok(pkg.commands.includes('npm run db:deploy') && pkg.commands.includes('npm run build'))
    assert.ok(pkg.boundaries.some((b) => b.includes('does not create')))
    const serial = JSON.stringify(pkg)
    assert.ok(!serial.includes('tenantKey'), 'the tenant identity secret is never exported')
    assert.ok(!serial.includes('Tech360-Demo-2026!'), 'no credential is exported')
    const { packageChecksum, ...rest } = pkg
    assert.equal(checksum(rest), packageChecksum, 'recipient can recompute the package checksum')
  })

  it('configuration-only theme/page changes re-skin the same runtime without new code', async () => {
    const update = await updateApplicationConfig(appId, { theme: { primary: '#004D40', accent: '#FFB300', motif: 'horizon' } }, factory)
    assert.equal(update.ok, true, update.errors.join('; '))
    const ctx = (await resolveRuntime(factory, slug, 'read')).data!
    assert.equal(ctx.theme.primary, '#004D40')
    assert.equal(ctx.theme.accent, '#FFB300')
    assert.equal(ctx.theme.motif, 'horizon')
    assert.equal(ctx.app.id, appId, 'no new application was rebuilt')
    const stored = await db.factoryApplication.findUniqueOrThrow({ where: { id: appId } })
    assert.equal(stored.configChecksum, (await db.factoryConfigRevision.findFirstOrThrow({ where: { applicationId: appId }, orderBy: { version: 'desc' } })).checksum)
  })
})
