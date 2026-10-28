import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DISCOVERY_FIELDS, buildSummary, extractDomainHostingHint, extractDomainNames, hasHostingPlanDetails, isConfirmation, isRevisionRequest } from '../src/lib/discovery'

describe('business discovery and preliminary proposal', () => {
  it('collects the retail operations, marketing and local search requirements', () => {
    const keys = new Set(DISCOVERY_FIELDS.map((field) => field.key))
    for (const key of ['productCatalog', 'salesAndStock', 'upcomingProducts', 'staffOperations', 'marketingAndLeads', 'localSeoLocations', 'existingWebsite', 'domainHosting']) {
      assert.ok(keys.has(key as never), `${key} must be included in discovery`)
    }
  })

  it('captures a customer-mentioned domain as unverified and adds hosting/security detail to the proposal', () => {
    const hint = extractDomainHostingHint('We have thedreamerit.com on shared hosting with cPanel.')
    assert.match(hint ?? '', /thedreamerit\.com/)
    assert.match(hint ?? '', /not verified/)
    assert.deepEqual(extractDomainNames('theDreamerit.com'), ['thedreamerit.com'])
    assert.equal(hasHostingPlanDetails('We use thedreamerit.com'), false, 'bare domains must not complete hosting-fit discovery')
    assert.equal(hasHostingPlanDetails('Shared hosting on cPanel, Node support unknown'), true)
    assert.equal(hasHostingPlanDetails('No'), false)
    assert.equal(hasHostingPlanDetails('not sure how many products'), false, 'unrelated uncertainty must not complete hosting discovery')
    assert.equal(hasHostingPlanDetails('No', true), true, 'explicit absence/unknown is a valid answer when asked')
    const proposal = buildSummary({ domainHosting: hint ?? undefined }, 'Client', 'TECH-2026-000002')
    assert.match(proposal, /hosting provider\/plan evidence/)
    assert.match(proposal, /no framework or deployment choice is final/)
    assert.match(proposal, /preliminary proposal will state this conditional recommendation/)
    assert.match(proposal, /You retain ownership of your domain and hosting accounts/)
    assert.match(proposal, /whole internal AI workforce/)
    assert.equal(extractDomainHostingHint('We need a product catalogue'), null)
    const bengaliProposal = buildSummary({ businessType: 'কম্পিউটার দোকান', domainHosting: hint ?? undefined }, 'গ্রাহক', 'TECH-2026-000003')
    assert.match(bengaliProposal, /প্রাথমিক সমাধান প্রস্তাব/)
    assert.match(bengaliProposal, /ডোমেইন, রেজিস্ট্রার ও হোস্টিং প্ল্যান/)
    assert.match(bengaliProposal, /চূড়ান্ত scope আপনি অনুমোদন করার পরই/)
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

  it('recognizes explicit proposal approval and feedback separately in English and Bangla', () => {
    assert.equal(isConfirmation('APPROVED'), true)
    assert.equal(isConfirmation('I have not approved this yet'), false)
    assert.equal(isConfirmation('অনুমোদিত'), true)
    assert.equal(isConfirmation('অনুমোদিত নই'), false)
    assert.equal(isRevisionRequest('Please add warranty and serial-number tracking'), true)
    assert.equal(isRevisionRequest('কিছু পরিবর্তন করুন'), true)
  })
})
