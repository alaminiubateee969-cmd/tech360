import { createHash } from 'node:crypto'
import { unzipSync, strFromU8 } from 'fflate'

// ============================================================
// KNOWLEDGE-BASE DOCUMENT TEXT EXTRACTION
// (parity with docGPT-style "chat with your docs" references:
//  PDF · WORD · CSV · TXT — plus Markdown, JSON and HTML)
//
// Honest boundaries:
//   - Extraction either really reads the bytes or reports a
//     failure — a document is never indexed with placeholder text.
//   - Scanned/image-only PDFs yield no text; that is reported as
//     an honest warning, not as an empty "success".
//   - Only the extracted TEXT is stored (KnowledgeDocument.
//     extractedText) — the original bytes are not persisted here.
// ============================================================

export const EXTRACT_MAX_BYTES = 10 * 1024 * 1024 // 10 MB per knowledge document

export type ExtractResult =
  | { ok: true; text: string; pages?: number; note?: string }
  | { ok: false; error: string }

const TEXTUAL_EXTS = new Set(['txt', 'md', 'csv', 'json', 'html', 'htm'])

function extOf(filename: string): string {
  const base = filename.replace(/\\/g, '/').split('/').pop() ?? ''
  return (base.split('.').pop() ?? '').toLowerCase()
}

/**
 * Extract readable text from a .docx (Office Open XML WordprocessingML).
 *
 * A .docx is a ZIP archive whose body lives in word/document.xml (plus
 * optional footnotes/endnotes). We unzip with fflate — a tiny, zero-dependency,
 * MIT-licensed library — and reduce the WordprocessingML to plain text:
 * `w:p` closes a paragraph, `w:tab`/`w:br` map to whitespace, everything
 * else is stripped and entities are decoded. This replaces mammoth (whose
 * argparse/sprintf-js chain carried an unpatched DoS advisory,
 * GHSA-hp3w-g68c-fv3c) with a dependency-light path we fully control.
 * Malformed archives throw and are reported honestly by the caller.
 */
function extractDocxText(bytes: Buffer): string {
  const parts = ['word/document.xml', 'word/footnotes.xml', 'word/endnotes.xml']
  const chunks: string[] = []
  for (const part of parts) {
    let xml: string
    try {
      xml = strFromU8(unzipSync(new Uint8Array(bytes))[part])
    } catch {
      continue // part absent — fine; a fully invalid archive surfaces below
    }
    const text = xml
      .replace(/<w:tab\b[^>]*\/?>/g, '\t')
      .replace(/<w:br\b[^>]*\/?>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&#(\d+);/g, (_, d: string) => {
        try { return String.fromCodePoint(Number(d)) } catch { return '' }
      })
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => {
        try { return String.fromCodePoint(parseInt(h, 16)) } catch { return '' }
      })
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    if (text) chunks.push(text)
  }
  if (chunks.length === 0) {
    throw new Error('not a readable .docx archive (missing word/document.xml)')
  }
  return chunks.join('\n\n')
}

/** Strip tags/entities down to readable text (for HTML-ish inputs). */
function htmlToText(html: string): string {  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Decode a UTF-8 text-family buffer, refusing binary garbage. */
function decodeTextBuffer(bytes: Buffer): string | null {
  // Null bytes / high control-byte density ⇒ binary, not text
  let control = 0
  const sample = bytes.subarray(0, 4096)
  for (const b of sample) {
    if (b === 0) return null
    if (b < 9 || (b > 13 && b < 32)) control++
  }
  if (sample.length > 0 && control / sample.length > 0.08) return null
  return bytes.toString('utf8')
}

/**
 * Extract the searchable text from an uploaded knowledge document.
 * PDF is parsed with unpdf (serverless pdf.js), DOCX with the built-in
 * WordprocessingML extractor (fflate unzip); text-family formats are
 * decoded natively.
 */
export async function extractDocumentText(bytes: Buffer, filename: string, mimeType: string): Promise<ExtractResult> {
  if (bytes.length === 0) return { ok: false, error: 'The file is empty.' }
  if (bytes.length > EXTRACT_MAX_BYTES) {
    return { ok: false, error: `File exceeds the ${Math.round(EXTRACT_MAX_BYTES / 1024 / 1024)}MB knowledge-upload limit.` }
  }

  const ext = extOf(filename)
  const mime = (mimeType || '').toLowerCase()

  // ---- text family: txt / md / csv / json / html --------------------------
  if (TEXTUAL_EXTS.has(ext) || mime.startsWith('text/') || mime === 'application/json') {
    const decoded = decodeTextBuffer(bytes)
    if (decoded === null) return { ok: false, error: 'The file is binary — only textual documents can be indexed as knowledge.' }
    const text = ext === 'html' || ext === 'htm' || mime === 'text/html' ? htmlToText(decoded) : decoded
    if (!text) return { ok: false, error: 'No readable text was found in the file.' }
    return { ok: true, text: text.slice(0, 500_000) }
  }

  // ---- PDF (unpdf) ---------------------------------------------------------
  if (ext === 'pdf' || mime === 'application/pdf') {
    try {
      const { extractText, getDocumentProxy } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(bytes))
      const { totalPages, text } = await extractText(pdf, { mergePages: true })
      const merged = (Array.isArray(text) ? text.join('\n\n') : text).replace(/[ \t]+/g, ' ').trim()
      if (!merged) {
        return {
          ok: false,
          error:
            'This PDF contains no extractable text (it is likely a scan or image-only export). ' +
            'OCR is not available on this platform — paste the text or upload a text-based PDF.',
        }
      }
      return { ok: true, text: merged.slice(0, 500_000), pages: totalPages }
    } catch (err) {
      return { ok: false, error: `PDF parsing failed: ${err instanceof Error ? err.message : 'unreadable file'}` }
    }
  }

  // ---- DOCX (self-contained extractor: unzip + WordprocessingML text) ------
  if (ext === 'docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const text = extractDocxText(bytes)
      if (!text) return { ok: false, error: 'The Word document contains no readable text.' }
      return { ok: true, text: text.slice(0, 500_000) }
    } catch (err) {
      return { ok: false, error: `Word parsing failed: ${err instanceof Error ? err.message : 'unreadable file'}` }
    }
  }

  // ---- legacy .doc (binary Word) — honest refusal, no fake parser --------
  if (ext === 'doc' || mime === 'application/msword') {
    return {
      ok: false,
      error: 'Legacy .doc is not supported — re-save the document as .docx (or paste the text).',
    }
  }

  return {
    ok: false,
    error: 'Unsupported knowledge format. Supported: PDF, DOCX, TXT, MD, CSV, JSON, HTML.',
  }
}

/** sha256 of the uploaded bytes — provenance for the knowledge row. */
export function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}
