/**
 * TECH360 — REA Studio target admission tests.
 *
 * These are the security tests for the one module that fetches an
 * operator-supplied URL. Every case here is a real bypass technique; the
 * policy must refuse all of them BEFORE any request leaves the process, and
 * `classifyAddress` must refuse them again AFTER DNS resolution, because a
 * public hostname that resolves to a loopback address is the classic way past
 * a literal-only check.
 *
 * No network, no database: admission is pure.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  CAPTURE_CONTRACT,
  REA_LIMITS,
  admitTarget,
  assertSafeAddress,
  classifyAddress,
  hostKey,
  normalizeKind,
  targetKindSupport,
} from '../src/lib/rea/target-policy'

describe('rea: scheme and credential admission', () => {
  it('admits an ordinary public https target', () => {
    const verdict = admitTarget({ rawUrl: 'https://example.com/pricing' })
    assert.equal(verdict.admitted, true)
    if (verdict.admitted) {
      assert.equal(verdict.host, 'example.com')
      assert.equal(verdict.kind, 'WEB_APP')
    }
  })

  it('refuses every non-http scheme', () => {
    for (const url of ['file:///etc/passwd', 'gopher://example.com/', 'data:text/html,<script>', 'javascript:alert(1)', 'ftp://example.com/']) {
      const verdict = admitTarget({ rawUrl: url })
      assert.equal(verdict.admitted, false, url)
      if (!verdict.admitted) assert.equal(verdict.code, 'SCHEME_NOT_ALLOWED')
    }
  })

  it('refuses credentials in the URL', () => {
    const verdict = admitTarget({ rawUrl: 'https://user:pass@example.com/' })
    assert.equal(verdict.admitted, false)
    if (!verdict.admitted) assert.equal(verdict.code, 'CREDENTIALS_IN_URL')
  })

  it('refuses malformed and missing URLs without throwing', () => {
    assert.equal(admitTarget({ rawUrl: '' }).admitted, false)
    assert.equal(admitTarget({ rawUrl: 'not a url' }).admitted, false)
    assert.equal(admitTarget({ rawUrl: {} }).admitted, false)
    assert.equal(admitTarget({ rawUrl: 'x'.repeat(3000) }).admitted, false)
    const code = admitTarget({ rawUrl: 'not a url' })
    if (!code.admitted) assert.equal(code.code, 'URL_MALFORMED')
  })
})

describe('rea: SSRF address refusal', () => {
  const refused: Array<[string, string]> = [
    ['http://127.0.0.1/', 'LOOPBACK_ADDRESS'],
    ['http://127.0.0.1:3000/admin', 'LOOPBACK_ADDRESS'],
    ['http://localhost/', 'LOOPBACK_ADDRESS'],
    ['http://localhost.localdomain/', 'LOOPBACK_ADDRESS'],
    ['https://[::1]/', 'LOOPBACK_ADDRESS'],
    ['http://ip6-localhost/', 'LOOPBACK_ADDRESS'],
    ['http://10.0.0.5/', 'PRIVATE_ADDRESS'],
    ['http://192.168.1.1/', 'PRIVATE_ADDRESS'],
    ['http://172.16.0.1/', 'PRIVATE_ADDRESS'],
    ['http://172.31.255.255/', 'PRIVATE_ADDRESS'],
    ['http://169.254.1.1/', 'LINK_LOCAL_ADDRESS'],
    ['http://169.254.169.254/latest/meta-data/', 'METADATA_ENDPOINT'],
    ['http://metadata.google.internal/', 'METADATA_ENDPOINT'],
    ['http://0.0.0.0/', 'PRIVATE_ADDRESS'],
    ['http://100.64.0.1/', 'PRIVATE_ADDRESS'],
    ['https://internal.service.local/', 'PRIVATE_ADDRESS'],
    ['https://db.internal/', 'PRIVATE_ADDRESS'],
    ['http://224.0.0.1/', 'PRIVATE_ADDRESS'],
    ['http://255.255.255.255/', 'PRIVATE_ADDRESS'],
  ]

  for (const [url, expected] of refused) {
    it(`refuses ${url}`, () => {
      const verdict = admitTarget({ rawUrl: url })
      assert.equal(verdict.admitted, false, `${url} must be refused`)
      if (!verdict.admitted) assert.equal(verdict.code, expected)
    })
  }

  it('refuses non-standard ports unless explicitly enabled', () => {
    const denied = admitTarget({ rawUrl: 'https://example.com:8443/' })
    assert.equal(denied.admitted, false)
    if (!denied.admitted) assert.equal(denied.code, 'PORT_NOT_ALLOWED')

    const allowed = admitTarget({ rawUrl: 'https://example.com:8443/', env: { REA_ALLOW_NONSTANDARD_PORTS: 'on' } })
    assert.equal(allowed.admitted, true)
  })

  it('admits the standard ports, including an explicit :443', () => {
    assert.equal(admitTarget({ rawUrl: 'https://example.com:443/' }).admitted, true)
    assert.equal(admitTarget({ rawUrl: 'http://example.com:80/' }).admitted, true)
    assert.equal(admitTarget({ rawUrl: 'http://example.com/' }).admitted, true)
  })

  it('enforces a host allowlist when one is configured', () => {
    const env = { REA_ALLOWED_HOSTS: 'example.com,shop.example.org' }
    assert.equal(admitTarget({ rawUrl: 'https://example.com/', env }).admitted, true)
    assert.equal(admitTarget({ rawUrl: 'https://sub.example.com/', env }).admitted, true)
    assert.equal(admitTarget({ rawUrl: 'https://shop.example.org/', env }).admitted, true)
    const denied = admitTarget({ rawUrl: 'https://notlisted.com/', env })
    assert.equal(denied.admitted, false)
    // A lookalike suffix must not slip through the allowlist.
    assert.equal(admitTarget({ rawUrl: 'https://evilexample.com/', env }).admitted, false)
  })
})

describe('rea: post-DNS address classification (rebinding defence)', () => {
  it('classifies IPv4 literals correctly', () => {
    assert.equal(classifyAddress('8.8.8.8'), 'PUBLIC')
    assert.equal(classifyAddress('1.1.1.1'), 'PUBLIC')
    assert.equal(classifyAddress('127.0.0.1'), 'LOOPBACK')
    assert.equal(classifyAddress('169.254.169.254'), 'METADATA')
    assert.equal(classifyAddress('10.1.2.3'), 'PRIVATE')
    assert.equal(classifyAddress('192.168.0.1'), 'PRIVATE')
    assert.equal(classifyAddress('224.0.0.1'), 'PRIVATE')
  })

  it('classifies IPv6 literals, including IPv4-mapped forms', () => {
    assert.equal(classifyAddress('::1'), 'LOOPBACK')
    assert.equal(classifyAddress('0:0:0:0:0:0:0:1'), 'LOOPBACK')
    assert.equal(classifyAddress('fe80::1'), 'LINK_LOCAL')
    assert.equal(classifyAddress('fd00::1'), 'PRIVATE')
    assert.equal(classifyAddress('ff02::1'), 'RESERVED')
    // The bypass that matters: an IPv4-mapped IPv6 loopback address.
    assert.equal(classifyAddress('::ffff:127.0.0.1'), 'LOOPBACK')
    assert.equal(classifyAddress('::ffff:169.254.169.254'), 'METADATA')
    assert.equal(classifyAddress('2606:4700:4700::1111'), 'PUBLIC')
  })

  it('refuses a non-IP string rather than treating it as public', () => {
    assert.equal(classifyAddress('example.com'), 'RESERVED')
    assert.equal(assertSafeAddress('example.com').safe, false)
  })

  it('assertSafeAddress refuses every non-public classification with a code', () => {
    for (const ip of ['127.0.0.1', '169.254.169.254', '10.0.0.1', 'fe80::1', '::1']) {
      const verdict = assertSafeAddress(ip)
      assert.equal(verdict.safe, false, ip)
      assert.ok(verdict.code, `${ip} must carry a refusal code`)
      assert.ok(verdict.reason.includes(ip), 'the reason names the address')
    }
    assert.equal(assertSafeAddress('8.8.8.8').safe, true)
  })
})

describe('rea: target kinds are routed honestly', () => {
  it('refuses a target kind this deployment cannot serve', () => {
    for (const kind of ['NATIVE_BINARY', 'ANDROID_APK', 'IOS_IPA', 'DOTNET_ASSEMBLY', 'FIRMWARE_IMAGE', 'MACOS_DESKTOP_APP', 'LIVE_BROWSER_SESSION']) {
      const verdict = admitTarget({ rawUrl: 'https://example.com/', kind })
      assert.equal(verdict.admitted, false, `${kind} must be refused`)
      if (!verdict.admitted) {
        assert.equal(verdict.code, 'TARGET_KIND_UNSUPPORTED')
        assert.ok(verdict.reason.length > 20, 'the refusal explains itself')
      }
    }
  })

  it('detects a web app from its path and host shape', () => {
    assert.equal(normalizeKind(undefined, new URL('https://example.com/')), 'WEBSITE')
    assert.equal(normalizeKind(undefined, new URL('https://example.com/dashboard/settings')), 'WEB_APP')
    assert.equal(normalizeKind(undefined, new URL('https://app.example.com/')), 'WEB_APP')
    assert.equal(normalizeKind(undefined, new URL('https://admin.example.com/')), 'WEB_APP')
    assert.equal(normalizeKind('website', new URL('https://app.example.com/x')), 'WEBSITE')
  })

  it('never invents an unsupported kind from a normalised request', () => {
    // An unknown kind falls back to a supported one rather than being passed
    // through to a producer that cannot handle it.
    assert.equal(normalizeKind('ANDROID_APK', new URL('https://example.com/')), 'WEBSITE')
    assert.equal(normalizeKind('gibberish', new URL('https://example.com/a/b')), 'WEB_APP')
    assert.equal(normalizeKind('html-snippet', undefined), 'HTML_SNIPPET')
  })

  it('reports support per kind, with the upstream tool it corresponds to', () => {
    const website = targetKindSupport('WEBSITE')
    assert.equal(website.supported, true)
    assert.ok(website.upstreamTool.length > 0)

    const native = targetKindSupport('NATIVE_BINARY')
    assert.equal(native.supported, false)
    assert.ok(native.reason.includes('decompiler'), 'says why, not just that')

    const unknown = targetKindSupport('SOMETHING_ELSE')
    assert.equal(unknown.supported, false)
  })
})

describe('rea: capture bounds are declared and finite', () => {
  it('bounds bytes, time, redirects and subresources', () => {
    assert.ok(REA_LIMITS.maxBytes > 0 && REA_LIMITS.maxBytes <= 8 * 1024 * 1024)
    assert.ok(REA_LIMITS.timeoutMs > 0 && REA_LIMITS.timeoutMs <= 60_000)
    assert.ok(REA_LIMITS.maxRedirects >= 0 && REA_LIMITS.maxRedirects <= 10)
    assert.ok(REA_LIMITS.maxSubresources > 0 && REA_LIMITS.maxSubresources <= 100)
    assert.ok(REA_LIMITS.maxSubresourceBytes <= REA_LIMITS.maxBytes)
  })

  it('rate limits both the operator and the target host', () => {
    assert.ok(REA_LIMITS.perOperatorPerMinute > 0)
    assert.ok(REA_LIMITS.perHostPerMinute > 0)
    // The per-host limit must be tighter than the operator limit: the third
    // party being analyzed did not ask to be scanned.
    assert.ok(REA_LIMITS.perHostPerMinute <= REA_LIMITS.perOperatorPerMinute)
  })

  it('publishes a capture contract that states the refusals', () => {
    const joined = CAPTURE_CONTRACT.join(' ').toLowerCase()
    assert.ok(joined.includes('private'), 'names the private-address refusal')
    assert.ok(joined.includes('metadata'), 'names the metadata refusal')
    assert.ok(joined.includes('never executes'), 'states that nothing is executed')
    assert.ok(joined.includes('credentials'), 'states that credentials are not sent')
    assert.ok(joined.includes('rate limited'), 'states the rate limit')
  })

  it('derives a stable host key for the per-host limiter', () => {
    assert.equal(hostKey(new URL('https://Example.COM/path')), 'example.com')
    assert.equal(hostKey(new URL('https://example.com:8443/')), 'example.com')
  })
})
