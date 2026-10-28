import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DISCOVERY_FIELDS, buildSummary, isConfirmation, isRevisionRequest } from '../src/lib/discovery'

describe('business discovery and preliminary proposal', () => {
  it('collects the retail operations, marketing and local search requirements', () => {
    const keys = new Set(DISCOVERY_FIELDS.map((field) => field.key))
    for (const key of ['productCatalog', 'salesAndStock', 'upcomingProducts', 'staffOperations', 'marketingAndLeads', 'localSeoLocations', 'existingWebsite']) {
      assert.ok(keys.has(key as never), `${key} must be included in discovery`)
    }
  })

  it('frames the initial proposal as feedback-first and keeps payment behind final scope approval', () => {
    const proposal = buildSummary({
      businessType: 'computer shop',
      productCatalog: '450 SKUs',
      salesAndStock: 'Track sold units and branch stock',
      staffOperations: '8 employees',
      localSeoLocations: 'Elephant Road, Dhaka',
    }, 'Rahim', 'TECH-2026-000001', 'Please add warranty tracking')
    assert.match(proposal, /Preliminary solution proposal/)
    assert.match(proposal, /product catalogue and stock\/sales view/)
    assert.match(proposal, /Please add warranty tracking/)
    assert.match(proposal, /After your feedback, we will prepare a detailed Scope of Work/)
    assert.match(proposal, /Payment is discussed only after you approve that final scope/)
    assert.match(proposal, /No discount, free deliverable, search ranking or sales result is promised/)
  })

  it('recognizes explicit proposal approval and feedback separately', () => {
    assert.equal(isConfirmation('APPROVED'), true)
    assert.equal(isConfirmation('I have not approved this yet'), false)
    assert.equal(isRevisionRequest('Please add warranty and serial-number tracking'), true)
  })
})
