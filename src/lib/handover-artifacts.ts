import { createHash } from 'node:crypto'
import { normalizeUploadName } from '@/lib/files'

export const HANDOVER_MAX_FILES = 100
export const HANDOVER_MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024
export const HANDOVER_SOURCE_EXTENSIONS = new Set(['js', 'ts', 'tsx', 'jsx', 'py', 'css', 'html', 'sql'])

export function hasSourceCodeFile(files: readonly { originalName: string }[]): boolean {
  return files.some((file) => HANDOVER_SOURCE_EXTENSIONS.has((file.originalName.split('.').pop() ?? '').toLowerCase()))
}

export type HandoverManifestFile = {
  id: string
  name: string
  mimeType: string
  size: number
  sha256: string
}

export type HandoverManifest = {
  version: 1
  projectId: string
  createdAt: string
  files: HandoverManifestFile[]
}

export type HandoverArtifactRecord = Omit<HandoverManifestFile, 'name' | 'sha256'> & {
  originalName: string
  sha256: string | null
  clientId: string | null
  projectId: string | null
  relatedType: string | null
  scanStatus: string
  classification: string
  content: Uint8Array | null
}

const SHA256_RE = /^[a-f0-9]{64}$/i

export function createHandoverManifest(
  projectId: string,
  files: readonly (Omit<HandoverManifestFile, 'name'> & { originalName: string })[],
  createdAt = new Date().toISOString(),
): HandoverManifest | null {
  if (!projectId || files.length === 0 || files.length > HANDOVER_MAX_FILES || !hasSourceCodeFile(files)) return null
  const seen = new Set<string>()
  const normalized: HandoverManifestFile[] = []
  let totalBytes = 0

  for (const file of files) {
    if (!file.id || seen.has(file.id) || !file.mimeType || !Number.isSafeInteger(file.size) || file.size <= 0 || !SHA256_RE.test(file.sha256)) return null
    seen.add(file.id)
    totalBytes += file.size
    if (totalBytes > HANDOVER_MAX_UNCOMPRESSED_BYTES) return null
    const name = normalizeUploadName(file.originalName, `artifact-${file.id.slice(-8)}`)
    if (!name || name === '.' || name === '..') return null
    normalized.push({ id: file.id, name, mimeType: file.mimeType, size: file.size, sha256: file.sha256.toLowerCase() })
  }

  return { version: 1, projectId, createdAt, files: normalized }
}

export function parseHandoverManifest(contents: string | null | undefined, projectId: string): HandoverManifest | null {
  if (!contents || !projectId) return null
  try {
    const value = JSON.parse(contents) as Partial<HandoverManifest>
    if (value.version !== 1 || value.projectId !== projectId || typeof value.createdAt !== 'string' || !Array.isArray(value.files)) return null
    if (value.files.length === 0 || value.files.length > HANDOVER_MAX_FILES) return null
    const seen = new Set<string>()
    let totalBytes = 0
    const files: HandoverManifestFile[] = []
    for (const item of value.files as Partial<HandoverManifestFile>[]) {
      if (typeof item.id !== 'string' || !item.id || seen.has(item.id)) return null
      if (typeof item.name !== 'string' || !item.name || item.name !== normalizeUploadName(item.name, 'artifact')) return null
      if (typeof item.mimeType !== 'string' || !item.mimeType) return null
      if (typeof item.size !== 'number' || !Number.isSafeInteger(item.size) || item.size <= 0) return null
      if (typeof item.sha256 !== 'string' || !SHA256_RE.test(item.sha256)) return null
      seen.add(item.id)
      totalBytes += item.size
      if (totalBytes > HANDOVER_MAX_UNCOMPRESSED_BYTES) return null
      files.push({ id: item.id, name: item.name, mimeType: item.mimeType, size: item.size, sha256: item.sha256.toLowerCase() })
    }
    if (!hasSourceCodeFile(files.map((file) => ({ originalName: file.name })))) return null
    return { version: 1, projectId, createdAt: value.createdAt, files }
  } catch {
    return null
  }
}

/** Verify both immutable manifest metadata and the bytes stored for each artifact. */
export function verifyHandoverArtifacts(
  manifest: HandoverManifest,
  records: readonly HandoverArtifactRecord[],
  clientId: string,
): boolean {
  if (!clientId || records.length !== manifest.files.length) return false
  const byId = new Map(records.map((record) => [record.id, record]))
  if (byId.size !== records.length) return false

  for (const file of manifest.files) {
    const record = byId.get(file.id)
    if (!record || !record.content) return false
    if (record.clientId !== clientId || record.projectId !== manifest.projectId || record.relatedType !== 'DELIVERY') return false
    if (record.scanStatus !== 'CLEAN' || !['PUBLIC', 'PRIVATE'].includes(record.classification)) return false
    if (!record.sha256 || !SHA256_RE.test(record.sha256)) return false
    if (normalizeUploadName(record.originalName, `artifact-${record.id.slice(-8)}`) !== file.name || record.mimeType !== file.mimeType || record.size !== file.size || record.sha256.toLowerCase() !== file.sha256) return false
    const bytes = Buffer.from(record.content)
    if (bytes.length !== file.size) return false
    if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) return false
  }
  return true
}
