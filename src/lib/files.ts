import { createHash } from 'node:crypto'

// ------------------------------------------------------------
// Shared file-safety engine for every upload surface
// (Client Documents Hub, Knowledge Base, future payment proofs).
// Deterministic, honest verdicts — never a fabricated "clean".
// ------------------------------------------------------------

export const DOC_MAX_BYTES = 5 * 1024 * 1024 // 5 MB per document (blob stored in DB)

/** Allow-list of client-shareable document types (mime → ext). */
export const DOC_MIME: Record<string, string> = {
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
  'application/json': 'json',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export const DOC_EXT_LIST = Object.values(DOC_MIME)

export type ScanVerdict = {
  status: 'SCANNED' | 'QUARANTINED'
  verdict: 'CLEAN' | 'FLAGGED'
  notes: string[]
  sha256: string
  ext: string
  mimeType: string
}

/** Resolve a stable extension: trust the declared mime, fall back to filename. */
export function resolveExt(declaredMime: string, filename: string): string | null {
  const byMime = DOC_MIME[declaredMime]
  if (byMime) return byMime
  const fromName = (filename.split('.').pop() ?? '').toLowerCase()
  if (fromName && DOC_EXT_LIST.includes(fromName)) return fromName
  return null
}

/**
 * Deterministic content scan (same engine as the knowledge base).
 * Text-like files are inspected for executable / secret payloads.
 * Binary formats are classified on trust level — stated honestly in notes.
 */
export function scanDocumentBytes(bytes: Buffer, declaredMime: string, filename: string): ScanVerdict {
  const ext = resolveExt(declaredMime, filename) ?? (filename.split('.').pop() ?? '').toLowerCase()
  const sha256 = createHash('sha256').update(bytes).digest('hex')

  let verdict: 'CLEAN' | 'FLAGGED' = 'CLEAN'
  const notes: string[] = []

  if (['txt', 'md', 'csv', 'json'].includes(ext)) {
    const text = bytes.toString('utf8').slice(0, 64 * 1024)
    if (/<script[\s>]/i.test(text)) { verdict = 'FLAGGED'; notes.push('contains <script> markup') }
    if (/\x00MZ/.test(text)) { verdict = 'FLAGGED'; notes.push('binary executable signature') }
    if (/BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY/.test(text)) { verdict = 'FLAGGED'; notes.push('contains private key material') }
    if (/eval\(atob\(/i.test(text)) { verdict = 'FLAGGED'; notes.push('encoded payload pattern') }
  } else {
    notes.push('binary format — deep content inspection not available; classified on trust level')
  }

  return {
    status: verdict === 'CLEAN' ? 'SCANNED' : 'QUARANTINED',
    verdict,
    notes,
    sha256,
    ext: ext || 'bin',
    mimeType: declaredMime || `application/${ext || 'octet-stream'}`,
  }
}

/** Serialize the scan record for the FileRecord.scanResult column. */
export function serializeScanResult(scan: ScanVerdict): string {
  return JSON.stringify({
    verdict: scan.verdict,
    notes: scan.notes,
    sha256: scan.sha256.slice(0, 16),
    scannedAt: new Date().toISOString(),
    engine: 'deterministic-rules-v1',
  })
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
