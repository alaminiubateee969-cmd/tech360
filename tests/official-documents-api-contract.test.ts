import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { OFFICIAL_DOCUMENT_KINDS } from '../src/lib/official-document'

const src = readFileSync('src/app/api/admin/documents/generate/route.ts', 'utf8')

describe('POST /api/admin/documents/generate — contract and safety', () => {
  it('is guarded with a minimum ADMIN role and rate limited', () => {
    assert.match(src, /await guard\(req,\s*\{\s*minRole:\s*'ADMIN'/)
    assert.match(src, /rateLimitPerMin/)
  })

  it('only accepts the 17 declared official document kinds', () => {
    assert.match(src, /OFFICIAL_DOCUMENT_KINDS\.includes\(kind\)/)
    for (const kind of OFFICIAL_DOCUMENT_KINDS) {
      assert.match(src, new RegExp(`${kind}:`), `missing registry mapping for ${kind}`)
    }
  })

  it('refuses an unknown client instead of silently rendering a null client', () => {
    assert.match(src, /Client \$\{clientPublicId\} not found\./)
    assert.match(src, /deletedAt: null/)
  })

  it('refuses a project that belongs to a different customer', () => {
    assert.match(src, /Project does not belong to the supplied Client ID/)
    assert.match(src, /project\.clientId !== clientRow\.id/)
  })

  it('validates the document reference against an allowlist pattern', () => {
    assert.match(src, /\^\[A-Z0-9\]\[A-Z0-9\._\/-\]\{2,59\}\$/i)
  })

  it('serves the rendered document with the locked-down document CSP', () => {
    assert.match(src, /DOCUMENT_HTML_HEADERS/)
    const inv = readFileSync('src/lib/invoice-document.ts', 'utf8')
    assert.match(inv, /script-src 'none'/, 'document CSP must forbid scripts')
  })

  it('records a SHA-256 of the exact rendered bytes', () => {
    assert.match(src, /createHash\('sha256'\)\.update\(bytes\)/)
    assert.match(src, /X-TECH360-Document-Sha256/)
  })

  it('keeps the registry location private, never a public URL', () => {
    assert.match(src, /fileLocation: `private\/documents\//)
    assert.doesNotMatch(src, /fileLocation: `\/brand/)
    assert.doesNotMatch(src, /fileLocation: `https?:/)
  })

  it('maps a duplicate reference+version to 409 rather than a 500', () => {
    // The route returns 409 for a duplicate reference+version.
    assert.ok(src.includes('already exists.'), 'duplicate message missing')
    assert.ok(src.includes(', 409)'), 'duplicate should map to 409')
  })

  it('writes an audit record for every generation', () => {
    assert.match(src, /action: 'DOCUMENT_GENERATED'/)
    assert.match(src, /entityType: 'DOCUMENT'/)
  })

  it('does not expose internal notes to the renderer', () => {
    assert.doesNotMatch(src, /internalNotes/)
  })
})
