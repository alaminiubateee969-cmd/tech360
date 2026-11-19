// MySQL @db.Text is limited in bytes, not JavaScript UTF-16 characters. Leave
// headroom below its 65,535-byte ceiling. Never slice serialized JSON or evict
// an existing evidence entry to make a new write appear successful.
export const TASK_EVIDENCE_MAX_BYTES = 60_000

export class TaskEvidenceLimitError extends Error {
  constructor() {
    super('Task evidence is at its storage limit. Preserve/export the existing history before adding more evidence.')
    this.name = 'TaskEvidenceLimitError'
  }
}

export function appendTaskEvidence(raw: string | null | undefined, entry: Record<string, unknown>): string {
  let entries: unknown[] = []
  if (raw) {
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { parsed = undefined }
    // A previous version sliced JSON mid-string. Retain those exact bytes and
    // mark them honestly; do not silently turn damaged history into an empty
    // array or claim that the legacy fragment has been reconstructed.
    entries = Array.isArray(parsed) ? parsed : [{
      type: 'LEGACY_UNPARSEABLE_EVIDENCE',
      note: 'Prior evidence was not a valid JSON array. Original content is preserved verbatim; manual review is required.',
      raw,
    }]
  }
  const serialized = JSON.stringify([...entries, entry])
  if (Buffer.byteLength(serialized, 'utf8') > TASK_EVIDENCE_MAX_BYTES) throw new TaskEvidenceLimitError()
  return serialized
}
