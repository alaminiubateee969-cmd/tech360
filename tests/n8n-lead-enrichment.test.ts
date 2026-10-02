/**
 * W26 lead-enrichment workflow: the Code nodes are executed here against mocked n8n
 * helpers, so the importable JSON is proven to validate, extract and score correctly.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const wf = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'n8n', 'W26_LEAD_ENRICHMENT.json'), 'utf8'))
const code = (name: string): string => wf.nodes.find((n: { name: string }) => n.name === name).parameters.jsCode

function run(name: string, json: unknown, ctx: Record<string, unknown> = {}) {
  const input = { first: () => ({ json }), all: () => [{ json }] }
  const $ = (n: string) => ({ first: () => ({ json: (ctx as Record<string, unknown>)[n] }) })
  return new Function('$input', '$', code(name))(input, $)[0].json
}

describe('W26 lead enrichment workflow', () => {
  it('is a valid importable workflow with no secrets', () => {
    assert.ok(wf.nodes.length >= 10)
    const names = new Set(wf.nodes.map((n: { name: string }) => n.name))
    for (const [from, c] of Object.entries<{ main: Array<Array<{ node: string }>> }>(wf.connections)) {
      assert.ok(names.has(from), `unknown source ${from}`)
      for (const out of c.main) for (const t of out) assert.ok(names.has(t.node), `unknown target ${t.node}`)
    }
    assert.ok(!/x-n8n-secret"\s*:\s*"[^"]/.test(JSON.stringify(wf)))
  })

  it('rejects SSRF targets and empty input', () => {
    for (const website of ['http://127.0.0.1/admin', 'http://169.254.169.254/latest', 'localhost', 'http://192.168.1.5', 'file:///etc/passwd', 'http://user:pw@example.org']) {
      const r = run('Normalize and Validate', { businessName: 'X', website })
      assert.equal(r.lead.website, '', website)
    }
    assert.equal(run('Normalize and Validate', {}).ok, false)
    assert.equal(run('Normalize and Validate', { businessName: 'Acme' }).ok, false)
    assert.equal(run('Normalize and Validate', { body: { businessName: 'Acme', website: 'acme.com.bd' } }).lead.website, 'https://acme.com.bd')
  })

  it('extracts contacts/tech and scores a contactable lead; refuses an uncontactable one', () => {
    const lead = { name: 'Rahim', businessName: 'Rahim Fashion', website: 'https://rahim.shop', email: '', whatsapp: '', country: 'BD', message: 'need site', businessType: 'fashion store' }
    const html = '<html><head><title>Rahim Fashion</title></head><body><a href="mailto:hello@rahim.shop">mail</a><a href="tel:+8801712345678">call</a><a href="https://facebook.com/rahimfashion">fb</a><img src="x.png"><script src="/wp-content/a.js"></script></body></html>'
    const ok = run('Extract Signals and Score', { statusCode: 200, body: html }, { 'Normalize and Validate': { lead } })
    assert.equal(ok.scoring.contactable, true)
    assert.equal(ok.lead.email, 'hello@rahim.shop')
    assert.equal(ok.lead.whatsapp, '+8801712345678')
    assert.ok(ok.enrichment.tech.includes('WordPress'))
    assert.ok(ok.enrichment.gaps.some((g: string) => /mobile-friendly/.test(g)))
    assert.ok(ok.summary.includes('Opportunities'))
    const bad = run('Extract Signals and Score', { statusCode: 404, body: '' }, { 'Normalize and Validate': { lead: { ...lead, website: '' } } })
    assert.equal(bad.scoring.contactable, false)
    assert.equal(bad.scoring.band, 'REVIEW')
  })
})
