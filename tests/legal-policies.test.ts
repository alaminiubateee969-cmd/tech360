import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { LEGAL_DOCS } from '../src/data/legal-docs'
import { getStaticPublicRoutePaths, resolvePublicRoute } from '../src/lib/public-route-catalog'

const requiredPolicies = [
  'terms', 'privacy', 'refund', 'delivery', 'payment', 'client-approval', 'source-code-handover',
]

function policyText(slug: string): string {
  const policy = LEGAL_DOCS.find((item) => item.slug === slug)
  assert.ok(policy, `Missing policy: ${slug}`)
  return policy.sections.map((section) => `${section.heading}\n${section.body.join('\n')}`).join('\n')
}

describe('TECH360 legal policy suite', () => {
  it('publishes all seven distinct hash-route documents with the effective date and contact', () => {
    assert.deepEqual(LEGAL_DOCS.map((policy) => policy.slug), requiredPolicies)
    const paths = new Set(getStaticPublicRoutePaths())
    for (const slug of requiredPolicies) {
      const route = `/legal/${slug}`
      assert.ok(paths.has(route), `Missing route catalog entry: ${route}`)
      const resolved = resolvePublicRoute(['legal', slug])
      const policy = LEGAL_DOCS.find((item) => item.slug === slug)
      assert.equal(resolved?.title, policy?.title)
      assert.equal(policy?.updated, '29 October 2026')
      assert.ok(policy?.sections.length && policy.sections.length >= 12)
      assert.match(policyText(slug), /info@bdtech360\.com/)
      assert.doesNotMatch(policyText(slug), /98-1940053|LC014737249/)
    }
  })

  it('preserves the evidence-based refund, cleared-payment, and authorization rules', () => {
    const refund = policyText('refund')
    const payment = policyText('payment')
    const handover = policyText('source-code-handover')
    assert.match(refund, /generally non-refundable merely because the Client changes their mind/i)
    assert.match(refund, /applicable law, the project agreement, or relevant payment-provider rules/i)
    assert.match(refund, /IP address and timestamp records/i)
    assert.match(refund, /not conclusive proof/i)
    assert.match(payment, /screenshot, payment instruction, or pending transfer alone is not conclusive proof/i)
    assert.match(payment, /another person's card or payment account/i)
    assert.match(payment, /all required project payments have been received and cleared/i)
    assert.match(handover, /TECH360 API keys, private tokens, passwords, shared infrastructure credentials/i)
    assert.match(handover, /other Clients' credentials/i)
  })

  it('documents conditional preview, scoped terms, and privacy-safe tracking/retention', () => {
    const terms = policyText('terms')
    const delivery = policyText('delivery')
    const privacy = policyText('privacy')
    assert.match(terms, /approved Scope of Work/i)
    assert.match(delivery, /where it is included in the agreed process/i)
    assert.match(delivery, /Client-owned credentials specifically identified in the approved Scope of Work/i)
    assert.match(privacy, /Google Tag Manager and Meta Pixel/i)
    assert.match(privacy, /30 days after project handover/i)
    assert.match(privacy, /unsubscribe choices are respected/i)
  })
})
