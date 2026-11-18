import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/**
 * Regression: authenticated/visitor-private API responses (admin, client
 * portal, visitor chat, auth) carried no Cache-Control at all, leaving their
 * cacheability to CDN defaults. They must be `no-store` + `noindex`, while
 * public APIs keep their own policy.
 */
type Rule = { source: string; headers: { key: string; value: string }[] }

describe('private API cache headers (next.config.ts)', async () => {
  const config = (await import('../next.config')) as unknown as {
    default: { headers: () => Promise<Rule[]> }
    PRIVATE_API_SOURCES: readonly string[]
  }
  const rules = await config.default.headers()
  const header = (r: Rule, key: string) => r.headers.find((h) => h.key.toLowerCase() === key)?.value

  it('covers the admin, portal, visitor-chat and auth API families', () => {
    assert.deepEqual([...config.PRIVATE_API_SOURCES].sort(), ['/api/admin/:path*', '/api/auth/:path*', '/api/chat/:path*', '/api/portal/:path*'])
  })

  it('every private API family is no-store and noindex', () => {
    for (const source of config.PRIVATE_API_SOURCES) {
      const rule = rules.find((r) => r.source === source)
      assert.ok(rule, `missing header rule for ${source}`)
      assert.equal(header(rule, 'cache-control'), 'no-store, max-age=0')
      assert.equal(header(rule, 'x-robots-tag'), 'noindex, nofollow, noarchive')
    }
  })

  it('public APIs are not swept into the private rule', () => {
    const covered = (path: string) => config.PRIVATE_API_SOURCES.some((s) => path.startsWith(s.replace(':path*', '')))
    for (const path of ['/api/branding/public', '/api/health', '/api/contact']) assert.equal(covered(path), false, path)
  })
})
