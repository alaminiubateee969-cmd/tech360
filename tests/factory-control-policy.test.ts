/**
 * Pure policy tests for the Software Factory Control Center.
 * No database, no network. These guard the rules that the DB layer relies on.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { MODULE_SEEDS, TEMPLATE_SEEDS } from '../src/lib/factory/control/catalog'
import {
  buildApplicationConfig, normalizeDefinition, validateDefinition, validateModuleManifest,
  validateModuleRecord, validateTemplateDefinition, type ModuleRef, type TemplateRef,
} from '../src/lib/factory/control/definition'
import { ADAPTERS, computeAdapterStatus, getAdapter, internalOnlyHealthy } from '../src/lib/factory/control/integrations'
import { canReleaseTransition, canTransition, compatibilityReport } from '../src/lib/factory/control/lifecycle'
import type { TemplateDefinition } from '../src/lib/factory/control/types'
import { checksum, compareSemver, isCompatible, mergeConfig, secretLikeReason, stableStringify } from '../src/lib/factory/control/util'

const modules = new Map<string, ModuleRef>(MODULE_SEEDS.map((m) => [m.code, {
  id: `mv-${m.code}`, code: m.code, version: 1, semver: '1.0.0', status: 'APPROVED',
  capability: m.capability, manifest: m.manifest,
}]))
const templateSeed = TEMPLATE_SEEDS.find((t) => t.code === 'crm')!
const template: TemplateRef = { code: templateSeed.code, version: 1, semver: '1.0.0', status: 'APPROVED', definition: templateSeed.definition }

function definition(overrides: Record<string, unknown> = {}) {
  return normalizeDefinition({
    identity: { name: 'Orchid Systems', slug: 'orchid-systems', kind: 'CLIENT', industry: 'Software', isolationModel: 'SHARED_TENANT', deploymentModel: 'SHARED_TENANT', environment: 'STAGING', ...(overrides.identity as object ?? {}) },
    template: { code: 'crm', version: 1 },
    modules: templateSeed.definition.modules.map((m) => ({ code: m.code, version: 1, enabled: true })),
    branding: { primaryColor: '#112233', productName: 'Orchid CRM' },
    organization: { departments: ['Sales'], teams: ['A'], users: [{ email: 'owner@orchid.test', role: 'COMPANY_ADMIN' }] },
    workflows: { pipelines: ['New', 'Won'], approvalChains: ['Manager'], slaHours: 24, rules: [] },
    policies: { retentionDays: 180, backupPolicy: 'DAILY' },
    integrations: [], navigation: ['Overview', 'Contacts'], customFields: [], extensions: [],
    ...overrides,
  })
}

const ctx = (overrides: Record<string, unknown> = {}) => ({
  template,
  modules,
  existingSlugs: [],
  existingDomains: [],
  allowDedicated: true,
  ...overrides,
})

describe('module and template manifests are real, not decorative', () => {
  it('every seeded module declares an implemented capability and passes validation', () => {
    for (const seed of MODULE_SEEDS) {
      assert.equal(validateModuleManifest(seed.manifest).ok, true, `${seed.code}: ${validateModuleManifest(seed.manifest).errors.join(', ')}`)
      assert.equal(seed.manifest.capability, seed.capability)
    }
  })

  it('every seeded template composes approved modules and carries procedures/tests', () => {
    for (const seed of TEMPLATE_SEEDS) {
      const result = validateTemplateDefinition(seed.definition, modules)
      assert.equal(result.ok, true, `${seed.code}: ${result.errors.join(', ')}`)
      assert.ok(seed.definition.acceptanceCriteria.length >= 3)
      assert.ok(seed.definition.rollbackProcedure.length >= 1)
    }
  })

  it('rejects a template whose required module is not an implemented capability', () => {
    const broken = { ...templateSeed.definition, modules: [{ code: 'does-not-exist', required: true }] }
    assert.equal(validateTemplateDefinition(broken, modules).ok, false)
    const fakeCapability = { ...MODULE_SEEDS[0].manifest, capability: 'telepathy' }
    assert.match(validateModuleManifest(fakeCapability).errors.join(' '), /not implemented/)
  })

  it('rejects a template with no security, test or rollback procedures', () => {
    const def = { ...templateSeed.definition, testDefinitions: [], rollbackProcedure: [], security: { requireExplicitGrants: false } }
    const errors = validateTemplateDefinition(def, modules).errors.join(' ')
    assert.match(errors, /testDefinitions/)
    assert.match(errors, /rollbackProcedure/)
    assert.match(errors, /requireExplicitGrants/)
  })
})

describe('company definition validation', () => {
  it('accepts a complete, ordinary configuration-only definition', () => {
    const result = validateDefinition(definition(), ctx())
    assert.equal(result.ok, true, result.errors.join('; '))
    assert.ok(result.automatedSteps.length >= 5)
    assert.ok(result.manualSteps.length >= 1)
    assert.equal(result.requiresEngineering, false)
  })

  it('refuses duplicate identity, missing admin, bad colours and unselected required modules', () => {
    const badSlug = validateDefinition(definition(), ctx({ existingSlugs: ['orchid-systems'], existingDomains: ['orchid.test'] }))
    assert.match(badSlug.errors.join(' '), /already in use/)
    const noAdmin = validateDefinition(definition({ organization: { departments: [], teams: [], users: [] } }), ctx())
    assert.match(noAdmin.errors.join(' '), /COMPANY_ADMIN/)
    const noModules = validateDefinition(definition({ modules: [{ code: 'identity', version: 1, enabled: true }] }), ctx())
    assert.match(noModules.errors.join(' '), /required module/)
    const badColor = validateDefinition(definition({ branding: { primaryColor: 'red' } }), ctx())
    assert.match(badColor.errors.join(' '), /hex/)
  })

  it('refuses secrets and unknown custom fields, and flags engineering work honestly', () => {
    const withSecret = validateDefinition(definition({ extensions: [{ kind: 'CONFIG', note: 'password: hunter2' }] }), ctx())
    assert.match(withSecret.errors.join(' '), /secret-like/i)
    const badField = validateDefinition(definition({ customFields: [{ module: 'contacts', entity: 'CONTACT', key: 'Bad Key!', label: 'x', type: 'text' }] }), ctx())
    assert.match(badField.errors.join(' '), /custom field key/)
    const engineering = validateDefinition(definition({ extensions: [{ kind: 'ENGINEERING', note: 'Custom ledger engine' }] }), ctx())
    assert.equal(engineering.requiresEngineering, true)
    assert.match(engineering.manualSteps.join(' '), /ENGINEERING/)
  })

  it('dedicated deployment is allowed but recorded as manual infrastructure work', () => {
    const dedicated = validateDefinition(definition({ identity: { name: 'Orchid Systems', slug: 'orchid-systems', kind: 'CLIENT', deploymentModel: 'DEDICATED', isolationModel: 'DEDICATED', environment: 'STAGING' } }), ctx())
    assert.equal(dedicated.ok, true, dedicated.errors.join('; '))
    assert.match(dedicated.manualSteps.join(' '), /separate database/)
    const denied = validateDefinition(definition({ identity: { name: 'Orchid Systems', slug: 'orchid-systems', kind: 'CLIENT', deploymentModel: 'DEDICATED' } }), ctx({ allowDedicated: false }))
    assert.match(denied.errors.join(' '), /authorized factory administrator/)
  })

  it('rejects an unapproved template version', () => {
    const result = validateDefinition(definition(), ctx({ template: { ...template, status: 'DRAFT' } }))
    assert.match(result.errors.join(' '), /not approved/)
  })
})

describe('configuration is reused without leaking between companies', () => {
  it('builds two independent configurations from one template', () => {
    const a = definition()
    const b = definition({ branding: { primaryColor: '#FF0000', productName: 'Other CRM' }, workflows: { pipelines: ['A', 'B'], approvalChains: [], slaHours: 8, rules: [] } })
    ;(b.identity as { slug: string }).slug = 'other-crm'
    const ca = buildApplicationConfig(a, templateSeed.definition, modules)
    const cb = buildApplicationConfig(b, templateSeed.definition, modules)
    assert.notDeepEqual(ca.branding, cb.branding)
    assert.notDeepEqual(ca.workflows.pipelines, cb.workflows.pipelines)
    assert.equal(checksum(templateSeed.definition), checksum(templateSeed.definition))
    assert.equal(templateSeed.definition.defaults.branding ? (templateSeed.definition.defaults.branding as Record<string, unknown>).primaryColor : null, '#063B8F')
  })

  it('mergeConfig never mutates the template defaults and blocks prototype pollution', () => {
    const base = { nested: { a: 1, b: 2 }, list: [1, 2] }
    const out = mergeConfig(base, { nested: { a: 9 }, extra: undefined })
    assert.equal((base.nested as { a: number }).a, 1)
    assert.equal((out.nested as { a: number }).a, 9)
    assert.equal((out.nested as { b: number }).b, 2)
    assert.equal('extra' in out, false)
    const polluted = mergeConfig({}, JSON.parse('{"__proto__":{"polluted":true},"safe":1}') as Record<string, unknown>)
    assert.equal(({} as Record<string, unknown>).polluted, undefined)
    assert.equal((polluted as Record<string, unknown>).safe, 1)
  })

  it('validates business records against the module schema', () => {
    const contacts = MODULE_SEEDS.find((m) => m.code === 'contacts')!.manifest
    assert.equal(validateModuleRecord(contacts, 'CONTACT', { name: 'Ada', email: 'ada@example.test' }).ok, true)
    assert.match(validateModuleRecord(contacts, 'CONTACT', { email: 'not-an-email' }).errors.join(' '), /required|email/)
    assert.match(validateModuleRecord(contacts, 'CONTACT', { name: 'Ada', nope: 1 }).errors.join(' '), /not declared/)
    assert.match(validateModuleRecord(contacts, 'CONTACT', { name: 'Ada', password: 'hunter2' }).errors.join(' '), /secret-like/)
  })
})

describe('lifecycle and compatibility gates', () => {
  it('never allows an untested configuration to become LIVE', () => {
    assert.equal(canTransition('DRAFT', 'LIVE').ok, false)
    assert.equal(canTransition('DRAFT', 'VALIDATED', { validationPassed: true }).ok, true)
    assert.equal(canTransition('VALIDATED', 'STAGING').ok, false)
    assert.equal(canTransition('PROVISIONING', 'STAGING', { testsPassed: true }).ok, true)
    assert.equal(canTransition('STAGING', 'AWAITING_APPROVAL', { testsPassed: true }).ok, false, 'a verified backup is mandatory')
    assert.equal(canTransition('STAGING', 'AWAITING_APPROVAL', { testsPassed: true, backupVerified: true }).ok, true)
  })

  it('activation needs approval, a verified backup, health and dedicated evidence', () => {
    const base = { testsPassed: true, approvalRecorded: true, privilegedApproval: true, backupVerified: true, healthStatus: 'HEALTHY' }
    assert.equal(canTransition('AWAITING_APPROVAL', 'LIVE', base).ok, true)
    assert.equal(canTransition('AWAITING_APPROVAL', 'LIVE', { ...base, privilegedApproval: false }).ok, false)
    assert.equal(canTransition('AWAITING_APPROVAL', 'LIVE', { ...base, backupVerified: false }).ok, false)
    assert.equal(canTransition('AWAITING_APPROVAL', 'LIVE', { ...base, healthStatus: 'DOWN' }).ok, false)
    assert.equal(canTransition('AWAITING_APPROVAL', 'LIVE', { ...base, deploymentModel: 'DEDICATED' }).ok, false)
    assert.equal(canTransition('AWAITING_APPROVAL', 'LIVE', { ...base, deploymentModel: 'DEDICATED', deploymentEvidence: 'Separate DB, storage, domain, TLS and凭据 verified by ops on 2026-11-02' }).ok, true)
  })

  it('rollback requires a known-good target and retirement requires approval + backup', () => {
    assert.equal(canTransition('LIVE', 'ROLLED_BACK').ok, false)
    assert.equal(canTransition('LIVE', 'ROLLED_BACK', { rollbackTargetExists: true }).ok, true)
    assert.equal(canTransition('LIVE', 'RETIRED').ok, false)
    assert.equal(canTransition('LIVE', 'RETIRED', { privilegedApproval: true, backupVerified: true }).ok, true)
    assert.equal(canReleaseTransition('DRAFT', 'DEPLOYED').ok, false)
    assert.equal(canReleaseTransition('APPROVED', 'DEPLOYED', { backupVerified: true }).ok, true)
  })

  it('semver compatibility refuses breaking and downgrade changes', () => {
    assert.equal(compareSemver('1.2.0', '1.10.0') < 0, true)
    assert.equal(isCompatible('1.0.0', '1.1.0'), true)
    assert.equal(isCompatible('1.0.0', '2.0.0'), false)
    assert.equal(isCompatible('1.2.0', '1.1.0'), false)
    const report = compatibilityReport([{ code: 'a', semver: '1.0.0' }, { code: 'b', semver: '1.0.0' }], [{ code: 'a', semver: '1.1.0' }, { code: 'b', semver: '2.0.0', breaking: true }])
    assert.equal(report.compatible, false)
    assert.equal(report.rows[0].result, 'COMPATIBLE')
    assert.equal(report.rows[1].result, 'BREAKING')
  })
})

describe('integration hub honesty', () => {
  it('never reports a disabled or unconfigured provider as connected', () => {
    const whatsapp = getAdapter('whatsapp_cloud')!
    const disabled = computeAdapterStatus(whatsapp, { enabled: false, envConfigured: false })
    assert.equal(disabled.status, 'DISABLED')
    assert.equal(disabled.availableNow, false)
    const missing = computeAdapterStatus(whatsapp, { enabled: true, envConfigured: false })
    assert.equal(missing.status, 'NOT_CONFIGURED')
    assert.match(missing.message, /nothing is sent|No delivery/i)
    const credentialsOnly = computeAdapterStatus(whatsapp, { enabled: true, envConfigured: true })
    assert.equal(credentialsOnly.status, 'UNAVAILABLE')
    assert.equal(credentialsOnly.availableNow, false)
    const verified = computeAdapterStatus(whatsapp, { enabled: true, envConfigured: true, externalVerified: true })
    assert.equal(verified.status, 'AVAILABLE')
  })

  it('internal-only functionality stays healthy when external providers are off', () => {
    const statuses = Object.fromEntries(ADAPTERS.map((a) => [a.key, computeAdapterStatus(a, { enabled: a.kind === 'INTERNAL', envConfigured: false })]))
    assert.equal(internalOnlyHealthy(statuses), true)
    assert.equal(statuses.whatsapp_cloud.status, 'DISABLED')
    assert.equal(statuses.payment_gateway.status, 'DISABLED')
  })

  it('every adapter declares its external dependency and limitation', () => {
    for (const a of ADAPTERS) {
      assert.ok(a.limitation.length > 10)
      assert.ok(a.dependencyNote.length > 10)
      if (a.kind === 'EXTERNAL') assert.ok(a.envKeys.length > 0)
    }
  })
})

describe('checksums and secret detection', () => {
  it('is deterministic regardless of key order', () => {
    assert.equal(stableStringify({ b: 2, a: 1 }), stableStringify({ a: 1, b: 2 }))
    assert.equal(checksum({ b: 2, a: { z: 1, y: 2 } }), checksum({ a: { y: 2, z: 1 }, b: 2 }))
    assert.notEqual(checksum({ a: 1 }), checksum({ a: 2 }))
  })

  it('detects credential-shaped content and harmless references pass', () => {
    assert.match(secretLikeReason({ apiKey: 'AKIAIOSFODNN7EXAMPLE' }) ?? '', /aws/)
    assert.match(secretLikeReason({ note: 'password: hunter2' }) ?? '', /assigned credential/i)
    assert.equal(secretLikeReason({ secretRefs: ['DATABASE_URL', 'SESSION_SECRET'] }), null)
  })
})

describe('template version shape', () => {
  it('a versioned definition is immutable in structure and can be branched', () => {
    const v2: TemplateDefinition = { ...templateSeed.definition, description: `${templateSeed.definition.description} (v2)` }
    assert.notEqual(checksum(v2), checksum(templateSeed.definition))
    assert.equal(validateTemplateDefinition(v2, modules).ok, true)
  })
})
