/**
 * Coverage contract for the 4-pillar services catalogue and the enriched
 * service detail pages (AUD-15 / Commit 4).
 *
 * These are guardrails, not feature tests: they fail the moment a new service
 * is added to the catalogue without being placed in a pillar, given an ideal
 * customer profile, industry cross-links and FAQs.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { SERVICES } from '../src/data/site'
import { INDUSTRY_SLUGS } from '../src/data/industries'
import { SOLUTIONS_MEGA_COLUMNS } from '../src/components/site/nav-structure'
import { SERVICE_IDEAL_CUSTOMER, SERVICE_INDUSTRIES, serviceFaqs } from '../src/lib/service-detail-content'
import { PUBLIC_DELIVERY_PROMISES, PUBLIC_JOURNEY } from '../src/lib/public-journey'

const serviceSlugs = SERVICES.map((s) => s.slug)

describe('services catalogue mirrors the four Solutions pillars', () => {
  it('has exactly four pillars', () => {
    assert.equal(SOLUTIONS_MEGA_COLUMNS.length, 4)
    assert.deepEqual(
      SOLUTIONS_MEGA_COLUMNS.map((c) => c.heading),
      ['AI Solutions', 'Software Products', 'CRM & Business Automation', 'Services'],
    )
  })

  it('places every service in exactly one pillar and covers all of them', () => {
    const placed: string[] = []
    for (const column of SOLUTIONS_MEGA_COLUMNS) {
      assert.ok(column.items.length > 0, `${column.heading} must list services`)
      for (const item of column.items) {
        assert.match(item.href, /^#\/services\/[a-z0-9-]+$/)
        placed.push(item.href.replace('#/services/', ''))
      }
    }
    assert.equal(placed.length, new Set(placed).size, 'a service may not appear in two pillars')
    assert.deepEqual([...placed].sort(), [...serviceSlugs].sort())
    assert.equal(serviceSlugs.length, 21)
  })

  it('gives every pillar item a one-line description', () => {
    for (const column of SOLUTIONS_MEGA_COLUMNS) {
      for (const item of column.items) {
        assert.ok(item.description && item.description.length >= 20, `${item.label} needs a real description`)
        assert.ok(item.description.length <= 110, `${item.label} description should stay one line`)
      }
    }
  })
})

describe('service detail content covers all 21 services', () => {
  it('maps an ideal customer profile for every service slug', () => {
    assert.deepEqual(Object.keys(SERVICE_IDEAL_CUSTOMER).sort(), [...serviceSlugs].sort())
    for (const [slug, copy] of Object.entries(SERVICE_IDEAL_CUSTOMER)) {
      assert.ok(copy.length > 60, `${slug} ideal-customer copy is too thin`)
    }
  })

  it('cross-links every service to 2–4 real industry registry slugs', () => {
    assert.deepEqual(Object.keys(SERVICE_INDUSTRIES).sort(), [...serviceSlugs].sort())
    const known = new Set<string>(INDUSTRY_SLUGS)
    for (const [slug, industries] of Object.entries(SERVICE_INDUSTRIES)) {
      assert.ok(industries.length >= 2 && industries.length <= 4, `${slug} needs 2–4 industry links`)
      assert.equal(new Set(industries).size, industries.length, `${slug} has a duplicate industry link`)
      for (const industry of industries) {
        assert.ok(known.has(industry), `${slug} links to unknown industry "${industry}"`)
      }
    }
  })

  it('generates four service FAQs quoting the governed commercial terms', () => {
    for (const service of SERVICES) {
      const faqs = serviceFaqs(service)
      assert.equal(faqs.length, 4)
      for (const faq of faqs) {
        assert.ok(faq.q.length > 10 && faq.a.length > 80, `${service.slug} FAQ is too thin`)
        assert.ok(!/wa\.me|whatsappLink|8801327100297/.test(faq.a), `${service.slug} FAQ links a retired channel`)
      }
      const text = faqs.map((f) => f.a).join(' ')
      assert.match(text, /Scope of Work/, 'must reference the approved SOW')
      assert.match(text, /preview/i, 'must be honest about what a preview proves')
      assert.match(text, /source code/i, 'must state the source-code handover term')
    }
  })

  it('publishes exactly the two delivery promises, each qualified', () => {
    assert.equal(PUBLIC_DELIVERY_PROMISES.length, 2)
    assert.match(PUBLIC_DELIVERY_PROMISES[0], /HTML Preview Before Payment/)
    assert.match(PUBLIC_DELIVERY_PROMISES[0], /Scope of Work includes a preview/)
    assert.match(PUBLIC_DELIVERY_PROMISES[1], /Source Code After Full Payment/)
    assert.match(PUBLIC_DELIVERY_PROMISES[1], /verified and cleared/)
  })

  it('keeps the public journey at seven customer-visible steps', () => {
    assert.equal(PUBLIC_JOURNEY.length, 7)
    assert.deepEqual(
      PUBLIC_JOURNEY.map((s) => s.key),
      ['ENQUIRY', 'DISCOVERY', 'PROPOSAL', 'SOW', 'PREVIEW', 'PAYMENT', 'HANDOVER'],
    )
    for (const step of PUBLIC_JOURNEY) {
      assert.ok(step.delivers.length > 20, `${step.key} must state what the client receives`)
    }
  })
})
