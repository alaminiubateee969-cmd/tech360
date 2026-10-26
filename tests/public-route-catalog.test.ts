import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { INDUSTRIES, LEGAL_DOCS, SERVICES } from '../src/data/site'
import { getStaticPublicRoutePaths, resolvePublicRoute } from '../src/lib/public-route-catalog'

describe('public clean routes resolve to the existing hash-routed views', () => {
  const staticPaths = new Set(getStaticPublicRoutePaths())

  it('covers all 20 service and industry detail pages without inventing new records', () => {
    assert.equal(SERVICES.length, 20)
    assert.equal(INDUSTRIES.length, 20)
    for (const service of SERVICES) assert.ok(staticPaths.has(`/services/${service.slug}`))
    for (const industry of INDUSTRIES) assert.ok(staticPaths.has(`/industries/${industry.slug}`))
  })

  it('covers all legal policies and the public sections, including design-kit', () => {
    for (const policy of LEGAL_DOCS) assert.ok(staticPaths.has(`/legal/${policy.slug}`))
    for (const path of ['/about', '/services', '/industries', '/work', '/technologies', '/design-kit', '/process', '/blog', '/careers', '/contact', '/faq']) {
      assert.ok(staticPaths.has(path), `${path} should have a clean public path`)
      assert.ok(resolvePublicRoute(path.split('/').filter(Boolean)))
    }
  })

  it('uses no-index for the portal and rejects unimplemented routes rather than rendering the homepage', () => {
    assert.equal(resolvePublicRoute(['portal'])?.noIndex, true)
    assert.equal(resolvePublicRoute(['pricing']), null)
    assert.equal(resolvePublicRoute(['support']), null)
    assert.equal(resolvePublicRoute(['admin']), null)
    assert.equal(resolvePublicRoute(['services', 'not-a-service']), null)
  })

  it('accepts valid published-blog slug shapes for dynamic server lookup', () => {
    assert.equal(resolvePublicRoute(['blog', 'secure-webhooks'])?.kind, 'blog-post')
    assert.equal(resolvePublicRoute(['blog', '../admin']), null)
  })
})
