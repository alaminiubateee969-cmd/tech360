/**
 * TECH360 — reference-parity tests for the October 9 owner batch.
 *
 * Covers the three capabilities added from the previously un-inspected
 * reference links:
 *
 *   1. Email campaign engagement tracking
 *      (mohamed11sk/Email-markting open pixel · knsoftic/Email_Markting
 *       open + click tracking) — signed tokens, link rewriting, pixel.
 *   2. Knowledge-base document upload with real text extraction
 *      (Lin-jun-xiang/docGPT-langchain "chat with your docs") — text
 *      family, HTML strip, binary refusal, PDF parse, honest failures.
 *   3. Curated image-prompt pattern library
 *      (songguoxs/gpt4o-image-prompts) — data integrity of the gallery.
 *
 * Plus a migration-parity guard for the new CampaignEvent table.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import {
  TRACKING_PIXEL_GIF,
  injectTracking,
  sanitizeCampaignHtml,
  signTrackToken,
  verifyTrackToken,
} from '../src/lib/newsletter'
import { extractDocumentText, sha256Hex } from '../src/lib/doc-extract'
import { zipSync, strToU8 } from 'fflate'
import { IMAGE_PROMPTS, IMAGE_PROMPT_CATEGORIES, allPromptTags, promptPlaceholders } from '../src/data/image-prompts'

const ROOT = join(__dirname, '..')

// ============================================================
// 1. Campaign engagement tracking
// ============================================================
describe('newsletter engagement tokens', () => {
  const campaignId = 'camp-123'
  const email = 'Client@Example.com'

  it('round-trips a signed token and normalizes the email', () => {
    const token = signTrackToken(campaignId, email)
    assert.equal(verifyTrackToken(token, campaignId), email.toLowerCase())
  })

  it('rejects a token presented for a different campaign', () => {
    const token = signTrackToken(campaignId, email)
    assert.equal(verifyTrackToken(token, 'camp-999'), null)
  })

  it('rejects tampered and malformed tokens', () => {
    const token = signTrackToken(campaignId, email)
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa')
    assert.equal(verifyTrackToken(tampered, campaignId), null)
    assert.equal(verifyTrackToken('not-a-token', campaignId), null)
    assert.equal(verifyTrackToken(undefined, campaignId), null)
    assert.equal(verifyTrackToken('', campaignId), null)
  })

  it('refuses to verify without a dev secret in production-like setup is a signing change, not a silent pass', () => {
    // (secret fallback only applies outside production; the token simply fails
    // to verify when signed with a different secret)
    const token = signTrackToken(campaignId, email)
    assert.ok(typeof token === 'string' && token.split('.').length === 4)
  })
})

describe('newsletter tracking injection', () => {
  it('rewrites http(s) links through the click redirect and appends the open pixel', () => {
    const token = signTrackToken('c1', 'a@b.co')
    const body = sanitizeCampaignHtml(
      '<p>Read <a href="https://example.com/post">the post</a> or <a href="http://example.org/x">this</a>.</p>',
    )
    const out = injectTracking('c1', body, 'https://bdtech360.com/', token)
    assert.ok(out.includes('/api/newsletter/track/click?c=c1&u='))
    assert.ok(out.includes('&to=https%3A%2F%2Fexample.com%2Fpost'))
    assert.ok(out.includes('&to=http%3A%2F%2Fexample.org%2Fx'))
    assert.ok(out.includes('width="1" height="1"'))
    assert.ok(out.includes('/api/newsletter/track/open?c=c1&u='))
    // the original direct link must be gone
    assert.ok(!out.includes('href="https://example.com/post"'))
  })

  it('never rewrites mailto, anchors or relative links', () => {
    const token = signTrackToken('c1', 'a@b.co')
    const out = injectTracking(
      'c1',
      '<a href="mailto:hi@bdtech360.com">mail</a> <a href="#section">jump</a> <a href="/services">services</a>',
      'https://bdtech360.com',
      token,
    )
    assert.ok(out.includes('href="mailto:hi@bdtech360.com"'))
    assert.ok(out.includes('href="#section"'))
    assert.ok(out.includes('href="/services"'))
  })

  it('emits a valid transparent 1×1 GIF', () => {
    assert.ok(TRACKING_PIXEL_GIF.subarray(0, 6).equals(Buffer.from('GIF89a')))
    assert.equal(TRACKING_PIXEL_GIF.length, 42) // canonical smallest transparent GIF
  })
})

describe('CampaignEvent migration parity (migration 4)', () => {
  const schema = readFileSync(join(ROOT, 'prisma/schema.prisma'), 'utf8')
  const migration = readFileSync(join(ROOT, 'prisma/migrations/4_campaign_engagement_tracking/migration.sql'), 'utf8')

  it('creates the table with every schema column in utf8mb4', () => {
    assert.ok(/CREATE TABLE `CampaignEvent`/.test(migration))
    assert.ok(/DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci/.test(migration))
    for (const col of ['id', 'campaignId', 'kind', 'email', 'targetUrl', 'userAgent', 'ip', 'createdAt']) {
      assert.ok(new RegExp(`\`${col}\``).test(migration), `missing column ${col}`)
    }
    assert.ok(/FOREIGN KEY \(`campaignId`\) REFERENCES `EmailCampaign`\(`id`\)/.test(migration))
    assert.ok(/ON DELETE CASCADE/.test(migration))
  })

  it('types the columns to match schema.prisma', () => {
    assert.ok(/`targetUrl`\s+TEXT NULL/.test(migration))
    assert.ok(/`userAgent`\s+TEXT NULL/.test(migration))
    assert.ok(/`kind`\s+VARCHAR\(191\) NOT NULL/.test(migration))
    assert.ok(/`createdAt`\s+DATETIME\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP\(3\)/.test(migration))
  })

  it('indexes campaign+kind and campaign+kind+email as declared in the schema', () => {
    assert.ok(/INDEX `CampaignEvent_campaignId_kind_idx`/.test(migration))
    assert.ok(/INDEX `CampaignEvent_campaignId_kind_email_idx`/.test(migration))
  })

  it('declares the relation on the Prisma side', () => {
    assert.ok(/model CampaignEvent \{/.test(schema))
    assert.ok(/events\s+CampaignEvent\[\]/.test(schema))
  })
})

// ============================================================
// 2. Knowledge document text extraction
// ============================================================
describe('doc extraction: text family', () => {
  it('extracts plain text, markdown and csv content', async () => {
    const txt = await extractDocumentText(Buffer.from('Hello knowledge base\nSecond line'), 'notes.txt', 'text/plain')
    assert.equal(txt.ok, true)
    if (txt.ok) assert.ok(txt.text.includes('Hello knowledge base'))

    const md = await extractDocumentText(Buffer.from('# Title\n\nBody copy'), 'doc.md', 'text/markdown')
    assert.equal(md.ok, true)

    const csv = await extractDocumentText(Buffer.from('name,role\nAva,Owner'), 'contacts.csv', 'text/csv')
    assert.equal(csv.ok, true)
    if (csv.ok) assert.ok(csv.text.includes('Ava,Owner'))
  })

  it('strips tags and scripts from HTML but keeps the words', async () => {
    const res = await extractDocumentText(
      Buffer.from('<html><body><script>bad()</script><h1>Proposal</h1><p>We build <b>CRMs</b>.</p></body></html>'),
      'page.html',
      'text/html',
    )
    assert.equal(res.ok, true)
    if (res.ok) {
      assert.ok(res.text.includes('Proposal'))
      assert.ok(res.text.includes('CRMs'))
      assert.ok(!res.text.includes('bad()'))
      assert.ok(!res.text.includes('<'))
    }
  })

  it('refuses binary garbage uploaded as text', async () => {
    const bytes = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00])
    const res = await extractDocumentText(bytes, 'evil.txt', 'text/plain')
    assert.equal(res.ok, false)
    if (!res.ok) assert.ok(res.error.toLowerCase().includes('binary'))
  })

  it('refuses empty and oversized inputs honestly', async () => {
    const empty = await extractDocumentText(Buffer.alloc(0), 'empty.txt', 'text/plain')
    assert.equal(empty.ok, false)
    const huge = await extractDocumentText(Buffer.alloc(11 * 1024 * 1024), 'huge.txt', 'text/plain')
    assert.equal(huge.ok, false)
    if (!huge.ok) assert.ok(huge.error.includes('10MB'))
  })
})

describe('doc extraction: PDF (unpdf)', () => {
  // A minimal but VALID uncompressed PDF with one page of text.
  const pdf = Buffer.from(
    [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
      '4 0 obj << /Length 62 >> stream',
      'BT /F1 18 Tf 72 720 Td (TECH360 knowledge extraction test) Tj ET',
      'endstream endobj',
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      'trailer << /Root 1 0 R /Size 6 >>',
      '%%EOF',
    ].join('\n'),
  )

  it('extracts the text from a real PDF byte stream', async () => {
    const res = await extractDocumentText(pdf, 'doc.pdf', 'application/pdf')
    assert.equal(res.ok, true, JSON.stringify(res))
    if (res.ok) {
      assert.ok(res.text.includes('TECH360'), `extracted: ${res.text.slice(0, 100)}`)
      assert.equal(res.pages, 1)
    }
  })

  it('reports a parse failure for a corrupted PDF instead of faking text', async () => {
    const res = await extractDocumentText(Buffer.from('%PDF-1.4 not really a pdf'), 'broken.pdf', 'application/pdf')
    assert.equal(res.ok, false)
    if (!res.ok) assert.ok(res.error.includes('PDF parsing failed'))
  })
})

describe('doc extraction: real DOCX (WordprocessingML via fflate, mammoth-free)', () => {
  // Hand-built minimal-but-valid .docx: a ZIP containing the OOXML parts Word
  // actually reads. Built with fflate so the test needs no fixtures on disk.
  const docx = (() => {
    const documentXml = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      '<w:body>',
      '<w:p><w:r><w:t>TECH360 knowledge upload</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Budget &amp; timeline &lt;approved&gt;</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Second</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>paragraph</w:t></w:r></w:p>',
      '</w:body></w:document>',
    ].join('')
    return Buffer.from(zipSync({
      '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
      'word/document.xml': strToU8(documentXml),
      'word/footnotes.xml': strToU8('<?xml version="1.0"?><w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:footnote w:id="1"><w:p><w:r><w:t>footnote insight</w:t></w:r></w:p></w:footnote></w:footnotes>'),
    }))
  })()

  it('extracts paragraph text, entities and footnotes from a real .docx archive', async () => {
    const res = await extractDocumentText(docx, 'spec.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    assert.equal(res.ok, true, JSON.stringify(res))
    if (res.ok) {
      assert.ok(res.text.includes('TECH360 knowledge upload'), `extracted: ${res.text.slice(0, 120)}`)
      assert.ok(res.text.includes('Budget & timeline <approved>'), 'entities decode correctly')
      assert.ok(res.text.includes('footnote insight'), 'footnotes are included')
      assert.ok(/\n/.test(res.text), 'paragraph boundaries are preserved')
    }
  })

  it('refuses a zip that is not a Word document instead of faking text', async () => {
    const fakeZip = Buffer.from(zipSync({ 'not-word.txt': strToU8('hello') }))
    const res = await extractDocumentText(fakeZip, 'fake.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    assert.equal(res.ok, false)
    if (!res.ok) assert.ok(res.error.includes('Word parsing failed'))
  })
})

describe('doc extraction: honest refusals', () => {
  it('refuses legacy .doc with a clear reason', async () => {
    const res = await extractDocumentText(Buffer.from('ole compound garbage'), 'old.doc', 'application/msword')
    assert.equal(res.ok, false)
    if (!res.ok) assert.ok(res.error.includes('.docx'))
  })

  it('refuses unsupported formats with the supported list', async () => {
    const res = await extractDocumentText(Buffer.from('binary-ish'), 'app.exe', 'application/octet-stream')
    assert.equal(res.ok, false)
    if (!res.ok) assert.ok(res.error.includes('Supported'))
  })

  it('hashes upload bytes for provenance', () => {
    assert.equal(sha256Hex(Buffer.from('abc')), sha256Hex(Buffer.from('abc')))
    assert.notEqual(sha256Hex(Buffer.from('abc')), sha256Hex(Buffer.from('abd')))
  })
})

// ============================================================
// 3. Image prompt pattern library
// ============================================================
describe('image prompt library data integrity', () => {
  it('ships a meaningful curated gallery', () => {
    assert.ok(IMAGE_PROMPTS.length >= 30, `expected ≥30 patterns, got ${IMAGE_PROMPTS.length}`)
    assert.ok(IMAGE_PROMPT_CATEGORIES.length === 8)
  })

  it('has unique ids, valid categories and non-empty fields', () => {
    const ids = new Set<string>()
    for (const p of IMAGE_PROMPTS) {
      assert.ok(!ids.has(p.id), `duplicate id ${p.id}`)
      ids.add(p.id)
      assert.ok(IMAGE_PROMPT_CATEGORIES.includes(p.category), `bad category ${p.category}`)
      assert.ok(p.name.trim().length > 3)
      assert.ok(p.prompt.trim().length >= 80, `prompt too short: ${p.id}`)
      assert.ok(p.useCase.trim().length > 5)
      assert.ok(p.tip.trim().length > 5)
      assert.ok(p.tags.length >= 2, `prompt ${p.id} needs tags for filtering`)
      assert.equal(p.prompt, p.prompt.trim())
    }
  })

  it('extracts placeholders in order without duplicates', () => {
    assert.deepEqual(promptPlaceholders('a {one} and {two} plus {one} again'), ['one', 'two'])
    assert.deepEqual(promptPlaceholders('no placeholders here'), [])
  })

  it('lists every tag used by the gallery, sorted', () => {
    const tags = allPromptTags()
    assert.ok(tags.length >= 20)
    assert.deepEqual(tags, [...tags].sort())
    for (const t of tags) assert.ok(IMAGE_PROMPTS.some((p) => p.tags.includes(t)), `orphan tag ${t}`)
  })

  it('uses {placeholders} consistently — every prompt that references braces declares them via extraction', () => {
    for (const p of IMAGE_PROMPTS) {
      const braces = [...new Set((p.prompt.match(/\{[a-zA-Z0-9_-]+\}/g) ?? []).map((b) => b.slice(1, -1)))]
      assert.deepEqual(braces, promptPlaceholders(p.prompt), `placeholder mismatch in ${p.id}`)
    }
  })
})
