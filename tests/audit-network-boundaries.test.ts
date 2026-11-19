import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assertPublicUrl, isPrivateIp } from '../src/lib/safe-fetch'
import { admitTarget, assertSafeAddress, classifyAddress } from '../src/lib/rea/target-policy'

// Admission only: no DNS lookup or HTTP request is made for these IP literals.
// WHATWG URL parsing converts mapped dotted IPv4 to hexadecimal IPv6, so tests
// must cover both spellings rather than only ::ffff:127.0.0.1.
describe('audit: all public-fetch admission paths reject equivalent private IP spellings', () => {
  for (const [ip, classification] of [
    ['::ffff:7f00:1', 'LOOPBACK'],
    ['0:0:0:0:0:ffff:7f00:1', 'LOOPBACK'],
    ['::ffff:127.0.0.1', 'LOOPBACK'],
    ['::ffff:a00:1', 'PRIVATE'],
    ['::ffff:ac10:1', 'PRIVATE'],
    ['::ffff:c0a8:101', 'PRIVATE'],
    ['::ffff:a9fe:a9fe', 'METADATA'],
    ['::ffff:169.254.169.254', 'METADATA'],
    ['::ffff:6440:1', 'PRIVATE'],
    ['100.127.255.254', 'PRIVATE'],
    ['::ffff:c612:1', 'PRIVATE'],
    ['0:0:0:0:0:0:0:0', 'LOOPBACK'],
    ['fe90::1', 'LINK_LOCAL'],
    ['febf::1', 'LINK_LOCAL'],
  ]) {
    it(`rejects ${ip} at literal, URL and post-DNS boundaries`, async () => {
      assert.equal(isPrivateIp(ip), true, 'SEO/feed address policy')
      assert.equal(classifyAddress(ip), classification, 'REA address policy')
      assert.equal(assertSafeAddress(ip).safe, false, 'REA post-DNS socket policy')
      const literal = ip.includes(':') ? `[${ip}]` : ip
      const url = `http://${literal}/`
      assert.equal(admitTarget({ rawUrl: url }).admitted, false, 'REA canonical URL admission')
      await assert.rejects(() => assertPublicUrl(url), 'SEO/feed canonical URL admission')
    })
  }

  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '::ffff:808:808']) {
    it(`keeps the public address ${ip} usable`, async () => {
      assert.equal(isPrivateIp(ip), false)
      assert.equal(assertSafeAddress(ip).safe, true)
      const literal = ip.includes(':') ? `[${ip}]` : ip
      assert.equal(admitTarget({ rawUrl: `https://${literal}/` }).admitted, true)
      await assertPublicUrl(`https://${literal}/`)
    })
  }
})
