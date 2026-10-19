import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit, logError, readJson } from '@/lib/security'
import { scanDocumentBytes, serializeScanResult, normalizeUploadName } from '@/lib/files'
import { extractDocumentText, sha256Hex } from '@/lib/doc-extract'
import { ingestDocument } from '@/lib/rag/pipeline'
import { isAccessLevel, type AccessLevel } from '@/lib/rag/store'

export const dynamic = 'force-dynamic'

/**
 * POST /api/knowledge/ingest
 *
 * Ingests a document into the private knowledge index.
 *
 * Pipeline: file validation → malware scan → text extraction →
 * validation → classification → chunking → embedding → vector index →
 * provenance record.
 *
 * Two input modes:
 *   multipart  — file=<blob>, title=…, accessLevel=…, source=…,
 *                owner=…, containsStudentRecords=true|false
 *   json       — { title, text, source, owner, accessLevel, … }
 *
 * ACCESS RULE: a document that contains student personal data may NOT
 * be ingested at PUBLIC level. The pipeline refuses it rather than
 * silently widening its audience.
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  const contentType = req.headers.get('content-type') ?? ''
  const isMultipart = contentType.includes('multipart/form-data')

  let title = ''
  let text = ''
  let source = ''
  let owner = ''
  let accessLevel: AccessLevel = 'INTERNAL'
  let containsStudentRecords = false
  let version = '1.0.0'
  let retentionPolicy = 'REVIEW_ANNUALLY'
  let permissionScope = 'TECH360_STAFF'
  let filename = ''
  let mimeType = ''
  let bytes: Buffer | null = null
  let scanResult: unknown = null
  let sha256 = ''

  if (isMultipart) {
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return Response.json(
        { error: 'Multipart form data is required.', code: 'INVALID_REQUEST' },
        { status: 400 },
      )
    }
    const file = form.get('file')
    title = sanitizeText(form.get('title') ?? '', 160).trim()
    source = sanitizeText(form.get('source') ?? 'MANUAL_UPLOAD', 160).trim()
    owner = sanitizeText(form.get('owner') ?? g.user.email, 160).trim()
    const accessRaw = sanitizeText(form.get('accessLevel') ?? 'INTERNAL', 20).toUpperCase()
    accessLevel = isAccessLevel(accessRaw) ? accessRaw : 'INTERNAL'
    containsStudentRecords = String(form.get('containsStudentRecords') ?? 'false').toLowerCase() === 'true'
    version = sanitizeText(form.get('version') ?? '1.0.0', 40) || '1.0.0'
    retentionPolicy = sanitizeText(form.get('retentionPolicy') ?? 'REVIEW_ANNUALLY', 60) || 'REVIEW_ANNUALLY'
    permissionScope = sanitizeText(form.get('permissionScope') ?? 'TECH360_STAFF', 120) || 'TECH360_STAFF'

    if (!(file instanceof File)) {
      return Response.json({ error: 'A file is required.', code: 'INVALID_REQUEST' }, { status: 400 })
    }
    if (file.size === 0) {
      return Response.json({ error: 'The file is empty.', code: 'INVALID_REQUEST' }, { status: 400 })
    }
    filename = normalizeUploadName(file.name, 'knowledge-document')
    mimeType = file.type || 'application/octet-stream'
    bytes = Buffer.from(await file.arrayBuffer())

    const scan = scanDocumentBytes(bytes, mimeType, filename)
    if (scan.verdict !== 'CLEAN') {
      await logError({
        source: 'knowledge-ingest',
        message: `Quarantined knowledge upload: ${filename} (${scan.notes.join('; ')})`,
      })
      return Response.json(
        { error: `The scanner flagged this file (${scan.notes.join('; ')}). It was not indexed.`, code: 'SCAN_REJECTED' },
        { status: 415 },
      )
    }
    scanResult = serializeScanResult(scan)
    sha256 = sha256Hex(bytes)

    const extraction = await extractDocumentText(bytes, filename, mimeType)
    if (!extraction.ok) {
      return Response.json({ error: extraction.error, code: 'EXTRACTION_FAILED' }, { status: 422 })
    }
    text = extraction.text
    title = title || filename.replace(/\.[a-z0-9]+$/i, '')
  } else {
    const raw = await readJson(req)
    title = sanitizeText(raw.title ?? '', 160).trim()
    text = typeof raw.text === 'string' ? raw.text : ''
    source = sanitizeText(raw.source ?? 'MANUAL_ENTRY', 160).trim()
    owner = sanitizeText(raw.owner ?? g.user.email, 160).trim()
    const accessRaw = sanitizeText(raw.accessLevel ?? 'INTERNAL', 20).toUpperCase()
    accessLevel = isAccessLevel(accessRaw) ? accessRaw : 'INTERNAL'
    containsStudentRecords = raw.containsStudentRecords === true
    version = sanitizeText(raw.version ?? '1.0.0', 40) || '1.0.0'
    retentionPolicy = sanitizeText(raw.retentionPolicy ?? 'REVIEW_ANNUALLY', 60) || 'REVIEW_ANNUALLY'
    permissionScope = sanitizeText(raw.permissionScope ?? 'TECH360_STAFF', 120) || 'TECH360_STAFF'
    filename = `${title.replace(/[^a-zA-Z0-9._-]/g, '_') || 'document'}.txt`
    mimeType = 'text/plain'
    sha256 = sha256Hex(Buffer.from(text))
  }

  const doc = await db.knowledgeDocument.create({
    data: {
      title: title || filename.replace(/\.[a-z0-9]+$/i, ''),
      filename,
      mimeType,
      size: bytes?.length ?? Buffer.byteLength(text),
      classification: accessLevel === 'PUBLIC' ? 'PUBLIC' : accessLevel === 'RESTRICTED' ? 'HIGHLY_SENSITIVE' : 'PRIVATE',
      status: 'INDEXED',
      extractedText: text,
      scanResult: scanResult ? JSON.stringify(scanResult) : null,
      sha256,
      uploadedBy: g.user.email,
    },
  })

  const ingest = await ingestDocument({
    documentId: doc.id,
    text,
    source,
    owner,
    accessLevel,
    version,
    retentionPolicy,
    permissionScope,
    containsStudentRecords,
  })

  if (!ingest.ok) {
    await db.knowledgeDocument.update({ where: { id: doc.id }, data: { status: 'REJECTED' } })
    return Response.json(
      { error: ingest.error, code: ingest.errorCode, documentId: doc.id },
      { status: 422 },
    )
  }

  await audit({
    actor: g.user.email,
    action: 'KNOWLEDGE_INGESTED',
    userId: g.user.id,
    entityType: 'KNOWLEDGE_DOCUMENT',
    entityId: doc.id,
    details: {
      chunkCount: ingest.chunkCount,
      accessLevel,
      embedder: ingest.embedder,
      dimensions: ingest.dimensions,
      containsStudentRecords,
      source,
      owner,
    },
  })

  return Response.json(
    {
      ok: true,
      document: {
        id: doc.id,
        title: doc.title,
        filename: doc.filename,
        accessLevel,
        extractedCharacters: text.length,
        createdAt: doc.createdAt,
      },
      index: {
        chunkCount: ingest.chunkCount,
        embedder: ingest.embedder,
        dimensions: ingest.dimensions,
      },
      provenance: {
        source,
        owner,
        accessLevel,
        version,
        retentionPolicy,
        permissionScope,
        containsStudentRecords,
      },
    },
    { status: 201 },
  )
}
