import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { analyzePage, analyzeRobots, parseSitemapUrls, scoreChecks } from '../src/lib/seo-audit-core'
import { isPrivateIp, assertPublicUrl } from '../src/lib/safe-fetch'

const GOOD = `<!doctype html><html lang="en"><head><title>Tech360 — Enterprise Software and Automation</title>
<meta name="description" content="Tech360 builds enterprise websites, CRMs and automation. HTML preview before payment, source code after full payment.">
<meta name="viewport" content="width=device-width"><link rel="canonical" href="https://x.test/"><link rel="icon" href="/f.ico">
<meta property="og:title" content="a"><meta property="og:description" content="b"><meta property="og:image" content="c"><meta name="twitter:card" content="summary">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization"},{"@type":"WebSite"}]}</script></head>
<body><h1>Hello</h1><h2>Sub</h2><img src="a.png" alt="a"><a href="/a">Alpha</a>${'word '.repeat(320)}</body></html>`

const run = (html: string, extra: Partial<Parameters<typeof analyzePage>[0]> = {}) =>
  analyzePage({ url: 'https://x.test/', status: 200, headers: { 'content-encoding': 'gzip', 'strict-transport-security': 'max-age=1' }, html, ms: 300, ...extra })
const status = (r: ReturnType<typeof run>, id: string) => r.checks.find((c) => c.id === id)?.status

describe('SEO audit core', () => {
  it('passes a well-formed page', () => {
    const r = run(GOOD)
    assert.equal(scoreChecks(r.checks).fail, 0)
    assert.equal(status(r, 'json-ld'), 'pass')
    assert.deepEqual(r.facts.jsonLdTypes, ['Organization', 'WebSite'])
  })
  it('flags a bare client-rendered page', () => {
    const r = run('<html><head></head><body><div id="root"></div></body></html>')
    for (const id of ['title', 'description', 'h1', 'viewport', 'content']) assert.equal(status(r, id), 'fail', id)
    assert.equal(status(r, 'open-graph'), 'fail')
    assert.ok(scoreChecks(r.checks).score < 70)
  })
  it('detects noindex via meta and header, and invalid JSON-LD', () => {
    assert.equal(status(run(GOOD.replace('<title>', '<meta name="robots" content="noindex"><title>')), 'noindex'), 'fail')
    assert.equal(status(run(GOOD, { headers: { 'x-robots-tag': 'noindex' } }), 'noindex'), 'fail')
    assert.equal(status(run(GOOD.replace('{"@context"', '{bad'), {}), 'json-ld'), 'fail')
  })
  it('robots + sitemap helpers', () => {
    assert.equal(analyzeRobots({ status: 200, body: 'User-agent: *\nDisallow: /' }, 'https://x.test')[0].status, 'fail')
    assert.equal(analyzeRobots({ status: 200, body: 'User-agent: *\nAllow: /\nSitemap: https://x.test/sitemap.xml' }, 'https://x.test')[1].status, 'pass')
    assert.deepEqual(parseSitemapUrls('<urlset><url><loc>https://x.test/a?x=1&amp;y=2</loc></url></urlset>'), ['https://x.test/a?x=1&y=2'])
  })
})

describe('SSRF guard', () => {
  it('classifies private addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.9', '172.20.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) assert.equal(isPrivateIp(ip), true, ip)
    for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isPrivateIp(ip), false, ip)
  })
  it('rejects unsafe URLs before any request', async () => {
    for (const u of ['http://127.0.0.1', 'http://localhost:3000', 'http://169.254.169.254/latest/meta-data', 'file:///etc/passwd', 'http://user:pw@8.8.8.8', 'http://8.8.8.8:22', 'ftp://8.8.8.8']) {
      await assert.rejects(() => assertPublicUrl(u), u)
    }
    assert.equal((await assertPublicUrl('http://8.8.8.8/')).hostname, '8.8.8.8')
  })
})

import { MARKETING_TEMPLATES, fillTemplate, unfilledKeys, COMMON_FIELDS } from '../src/data/marketing-templates'
describe('marketing templates', () => {
  it('only use declared placeholders and fill cleanly', () => {
    const known = new Set(COMMON_FIELDS.map((f) => f.key))
    for (const t of MARKETING_TEMPLATES) {
      for (const m of (t.body + (t.subject ?? '')).matchAll(/\{\{(\w+)\}\}/g)) assert.ok(known.has(m[1]), `${t.id}: ${m[1]}`)
    }
    assert.equal(new Set(MARKETING_TEMPLATES.map((t) => t.id)).size, MARKETING_TEMPLATES.length)
    assert.equal(fillTemplate('Hi {{firstName}} {{x}}', { firstName: ' Rahim ' }), 'Hi Rahim [x]')
    assert.deepEqual(unfilledKeys('{{a}} {{b}}', { a: 'z' }), ['b'])
  })
})
