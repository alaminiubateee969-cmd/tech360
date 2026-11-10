import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DOCUMENT_TITLES,
  OFFICIAL_DOCUMENT_KINDS,
  renderOfficialDocumentHtml,
  type OfficialDocumentKind,
  type OfficialDocumentInput,
} from '../src/lib/official-document'
import { getDefaultBranding } from '../src/lib/document-branding'

const base = (kind: OfficialDocumentKind): OfficialDocumentInput => ({
  kind,
  reference: 'DOC-2026-000001',
  issuedAt: new Date('2026-11-10T00:00:00Z'),
  clientId: 'TECH-2026-000123',
  recipientName: 'Test Customer',
  subject: 'Audit fixture',
  sections: [{ heading: 'Overview', paragraphs: ['Body copy.'] }],
})

describe('official document renderer — 17 required types', () => {
  it('covers every required document kind with a real title', () => {
    assert.equal(OFFICIAL_DOCUMENT_KINDS.length, 17)
    assert.equal(new Set(OFFICIAL_DOCUMENT_KINDS).size, 17)
    for (const kind of OFFICIAL_DOCUMENT_KINDS) {
      assert.ok(DOCUMENT_TITLES[kind], `missing title for ${kind}`)
      assert.ok(DOCUMENT_TITLES[kind].length > 3)
    }
  })

  it('renders every kind to a complete HTML document with the letterhead page template', () => {
    for (const kind of OFFICIAL_DOCUMENT_KINDS) {
      const html = renderOfficialDocumentHtml(base(kind))
      assert.match(html, /^<!DOCTYPE html>/, `${kind} not a full document`)
      // Titles are HTML-escaped (e.g. "Delivery &amp; Handover"), so compare escaped.
      const escapedTitle = DOCUMENT_TITLES[kind].replace(/&/g, '&amp;')
      assert.ok(html.includes(`<h1>${escapedTitle}`), `${kind} missing title heading`)
      assert.match(html, /DOC-2026-000001/, `${kind} missing reference`)
      assert.match(html, /TECH-2026-000123/, `${kind} missing Client ID`)
      // The supplied letterhead must be the page background for EVERY type.
      assert.match(html, /background-image:url\("\/brand\/tech360-letterhead-a4\.png"\)/, `${kind} not using letterhead page template`)
    }
  })

  it('never emits inline JavaScript or event handlers (CSP: script-src none)', () => {
    for (const kind of OFFICIAL_DOCUMENT_KINDS) {
      const html = renderOfficialDocumentHtml({
        ...base(kind),
        sections: [
          { heading: 'One', paragraphs: ['x'], bullets: ['y'], fields: [{ label: 'a', value: 'b' }], table: { columns: ['c'], rows: [['d']] } },
        ],
      })
      assert.doesNotMatch(html, /<script/i, `${kind} contains a script tag`)
      assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${kind} contains an inline event handler`)
      assert.doesNotMatch(html, /javascript:/i, `${kind} contains a javascript: URL`)
    }
  })

  it('escapes hostile customer input in every block type', () => {
    const payload = '<script>alert(1)</script>"\' onerror=alert(2)'
    const html = renderOfficialDocumentHtml({
      ...base('SOW'),
      recipientName: payload,
      recipientBusiness: payload,
      recipientEmail: payload,
      subject: payload,
      sections: [
        { heading: payload, paragraphs: [payload], bullets: [payload], fields: [{ label: payload, value: payload }], table: { columns: [payload], rows: [[payload]] } },
      ],
      signatories: [{ name: payload, role: payload }],
      approvals: [{ action: payload, by: payload, at: new Date('2026-11-10T00:00:00Z') }],
    })
    // No tag may survive the payload.
    assert.doesNotMatch(html, /<script/i, 'raw script tag survived escaping')
    // The dangerous property: the payload must not appear inside a TAG as an
    // attribute. It is fine (and expected) as escaped *text* content.
    assert.doesNotMatch(html, /<[^>]*onerror/i, 'event handler landed inside a tag')
    assert.doesNotMatch(html, /<[^>]*alert/i, 'payload landed inside a tag')
    // And the angle brackets must be entity-escaped.
    assert.match(html, /&lt;script&gt;/)
  })

  it('RESERVES a stamp area instead of fabricating a seal when none is approved', () => {
    const branding = getDefaultBranding()
    branding.sealEnabledSOW = false
    const html = renderOfficialDocumentHtml(base('SOW'), branding)
    assert.match(html, /STAMP AREA/, 'stamp area was not reserved')
    assert.match(html, /no approved seal configured/i)
    assert.doesNotMatch(html, /<img[^>]+seal/i, 'a seal image was fabricated')
  })

  it('draws the approved seal only for seal-eligible commercial instruments', () => {
    const branding = getDefaultBranding()
    // Invoice-like and SOW-like instruments are seal-eligible.
    const sealed = renderOfficialDocumentHtml(base('QUOTATION'), branding)
    assert.match(sealed, /tech360-seal-approved\.png/, 'expected the approved seal asset')

    // A progress report must never carry the corporate seal.
    const report = renderOfficialDocumentHtml(base('PROGRESS_REPORT'), branding)
    assert.doesNotMatch(report, /tech360-seal-approved\.png/, 'seal leaked onto a non-commercial report')
    assert.match(report, /STAMP AREA/)
  })

  it('uses the measured brand colours, not the legacy cream literal', () => {
    const html = renderOfficialDocumentHtml(base('SOW'))
    assert.match(html, /--blue:#007BDB/)
    assert.match(html, /--navy:#002077/)
    assert.match(html, /--green:#25B03B/)
    assert.doesNotMatch(html, /#009FE3/i)
  })

  it('has no field for internal notes, so they cannot leak', () => {
    // Structural guarantee: the input type carries no internal-notes field.
    const input = base('SOW') as unknown as Record<string, unknown>
    assert.equal('internalNotes' in input, false)
    const html = renderOfficialDocumentHtml(input as unknown as OfficialDocumentInput)
    assert.doesNotMatch(html, /internalNotes/i)
  })
})
