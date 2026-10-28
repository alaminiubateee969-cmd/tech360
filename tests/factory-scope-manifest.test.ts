import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeBrief } from '../src/lib/factory/blueprint'
import {
  factoryBriefMatchesScopeManifest,
  factoryManifestFromScopeContent,
  normalizeFactoryScopeManifest,
} from '../src/lib/factory/scope-manifest'

const validManifest = {
  applicationName: 'Northwind Client Hub',
  vertical: 'crm',
  modules: ['leads', 'clients', 'projects'],
  language: 'BOTH',
  currency: 'BDT',
  primaryColor: '#063B8F',
  deliveryFormat: 'SOURCE_ZIP',
  hostingAndDeployment: 'TECH360 supplies a source ZIP only. The client manages its own shared-hosting account and production deployment; no domain or DNS status is assumed.',
  clientResponsibilities: 'The client selects hosting and manages domain and provider accounts. Credentials stay in the client account and are never sent through this workflow.',
}

test('factory scope manifest', async (t) => {
  await t.test('normalizes explicit approved software and delivery terms', () => {
    const result = normalizeFactoryScopeManifest(validManifest)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.manifest.deliveryFormat, 'SOURCE_ZIP')
    assert.equal(result.manifest.currency, 'BDT')
    assert.deepEqual(result.manifest.modules, ['leads', 'clients', 'projects'])
  })

  await t.test('refuses missing, unsupported, or ambiguous delivery commitments', () => {
    assert.equal(normalizeFactoryScopeManifest(null).ok, false)
    assert.equal(normalizeFactoryScopeManifest({ ...validManifest, vertical: 'hospital' }).ok, false)
    assert.equal(normalizeFactoryScopeManifest({ ...validManifest, modules: ['leads', 'invented'] }).ok, false)
    assert.equal(normalizeFactoryScopeManifest({ ...validManifest, modules: ['leads', 'leads'] }).ok, false)
    assert.equal(normalizeFactoryScopeManifest({ ...validManifest, deliveryFormat: 'LIVE_DEPLOYMENT' }).ok, false)
    assert.equal(normalizeFactoryScopeManifest({ ...validManifest, hostingAndDeployment: '' }).ok, false)
    assert.equal(normalizeFactoryScopeManifest({ ...validManifest, clientResponsibilities: '' }).ok, false)
  })

  await t.test('requires the client-bound factory brief to exactly match the approved version', () => {
    const parsed = normalizeFactoryScopeManifest(validManifest)
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    const brief = normalizeBrief({
      appName: validManifest.applicationName,
      vertical: validManifest.vertical,
      modules: validManifest.modules,
      language: validManifest.language,
      currency: validManifest.currency,
      primaryColor: validManifest.primaryColor,
    })
    assert.equal(factoryBriefMatchesScopeManifest(brief, parsed.manifest), true)
    assert.equal(factoryBriefMatchesScopeManifest({ ...brief, modules: ['leads'] }, parsed.manifest), false)
    assert.equal(factoryBriefMatchesScopeManifest({ ...brief, notes: 'Add another module' }, parsed.manifest), false)
    assert.equal(factoryBriefMatchesScopeManifest({ ...brief, vertical: 'education' }, parsed.manifest), false)
  })

  await t.test('loads only a valid manifest from scope JSON', () => {
    assert.equal(factoryManifestFromScopeContent(JSON.stringify({ factoryManifest: validManifest })).ok, true)
    assert.equal(factoryManifestFromScopeContent('{broken').ok, false)
    assert.equal(factoryManifestFromScopeContent(JSON.stringify({})).ok, false)
  })
})
