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

/** Resolve a stable extension only when declared MIME and filename agree. */
export function resolveExt(declaredMime: string, filename: string): string | null {
  const byMime = DOC_MIME[declaredMime]
  const basename = filename.replace(/\\/g, '/').split('/').pop() ?? ''
  const fromName = (basename.split('.').pop() ?? '').toLowerCase()
  if (byMime && fromName && byMime !== fromName && !(byMime === 'jpg' && fromName === 'jpeg')) return null
  if (byMime) return byMime
  if (fromName && DOC_EXT_LIST.includes(fromName)) return fromName
  return null
}

/** Display-only basename. Storage names are generated independently from hashes. */
export function normalizeUploadName(filename: string, fallback: string): string {
  const basename = filename.replace(/\\/g, '/').split('/').pop()?.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return (basename || fallback).slice(0, 200)
}

/**
 * Deterministic content scan (same engine as the knowledge base).
 * Text-like files are inspected for executable / secret payloads.
 * Binary formats are classified on trust level — stated honestly in notes.
 */
export function scanDocumentBytes(bytes: Buffer, declaredMime: string, filename: string): ScanVerdict {
  const resolvedExt = resolveExt(declaredMime, filename)
  const basenameExt = (filename.replace(/\\/g, '/').split('/').pop()?.split('.').pop() ?? '').toLowerCase()
  const ext = resolvedExt ?? (DOC_EXT_LIST.includes(basenameExt) ? basenameExt : 'bin')
  const sha256 = createHash('sha256').update(bytes).digest('hex')

  let verdict: 'CLEAN' | 'FLAGGED' = 'CLEAN'
  const notes: string[] = []
  const flag = (note: string) => { verdict = 'FLAGGED'; notes.push(note) }

  if (!resolvedExt) flag('declared MIME and filename extension do not match the allow-list')
  if (bytes.subarray(0, 2).equals(Buffer.from([0x4d, 0x5a]))) flag('executable MZ signature')
  if (bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) flag('executable ELF signature')

  if (['txt', 'md', 'csv', 'json'].includes(ext)) {
    const text = bytes.toString('utf8').slice(0, 64 * 1024)
    if (/<script[\s>]/i.test(text)) flag('contains <script> markup')
    if (/BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY/.test(text)) flag('contains private key material')
    if (/eval\(atob\(/i.test(text)) flag('encoded payload pattern')
  } else {
    const starts = (...values: number[]) => bytes.subarray(0, values.length).equals(Buffer.from(values))
    const structurallyValid =
      (ext === 'pdf' && bytes.subarray(0, 5).toString('ascii') === '%PDF-') ||
      (ext === 'png' && starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) ||
      (['jpg', 'jpeg'].includes(ext) && starts(0xff, 0xd8, 0xff)) ||
      (ext === 'webp' && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') ||
      (['docx', 'xlsx'].includes(ext) && starts(0x50, 0x4b, 0x03, 0x04)) ||
      (ext === 'doc' && starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1))
    if (!structurallyValid) flag('file signature does not match the declared binary format')
    notes.push('structural signature checked; external malware scanning is not configured')
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
    engine: 'deterministic-rules-v2',
    externalMalwareScan: false,
  })
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
