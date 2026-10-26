import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit, logError } from '@/lib/security'
import { createNotification } from '@/lib/notify'
import { scanDocumentBytes, serializeScanResult, normalizeUploadName } from '@/lib/files'
import { extractDocumentText, sha256Hex } from '@/lib/doc-extract'

export const dynamic = 'force-dynamic'

const CLASSIFICATIONS = ['PUBLIC', 'PRIVATE', 'CONFIDENTIAL', 'HIGHLY_SENSITIVE']

// ------------------------------------------------------------
// POST /api/admin/knowledge/upload (multipart: file, title, classification)
//
// Knowledge-base ingestion with REAL text extraction (docGPT-parity:
// "chat with your docs" — PDF, DOCX, CSV, TXT, MD, JSON, HTML).
// The file is scanned with the same deterministic engine as every
// other upload surface, its text is genuinely extracted, and a
// KnowledgeDocument row is created in INDEXED status so the
// AI-ranked knowledge search can immediately recall it. A document
// whose text cannot be extracted is refused — never indexed with
// placeholder content.
// ------------------------------------------------------------
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: 'Multipart form data is required.' }, { status: 400 })
  }

  const file = form.get('file')
  const title = sanitizeText(form.get('title') ?? '', 160).trim()
  const classificationRaw = sanitizeText(form.get('classification') ?? 'PRIVATE', 20).toUpperCase()
  const classification = CLASSIFICATIONS.includes(classificationRaw) ? classificationRaw : 'PRIVATE'

  if (!(file instanceof File)) return Response.json({ error: 'A file is required.' }, { status: 400 })
  if (file.size === 0) return Response.json({ error: 'The file is empty.' }, { status: 400 })

  const originalName = normalizeUploadName(file.name, 'knowledge-document')
  const declaredMime = file.type || ''
  const bytes = Buffer.from(await file.arrayBuffer())

  // ---- same deterministic scanner as the Client Documents Hub ----
  const scan = scanDocumentBytes(bytes, declaredMime, file.name)
  if (scan.verdict !== 'CLEAN') {
    await logError({
      source: 'knowledge-upload',
      message: `Quarantined knowledge upload: ${originalName} (${scan.notes.join('; ')})`,
    })
    return Response.json(
      { error: `The scanner flagged this file (${scan.notes.join('; ')}). It was not indexed.` },
      { status: 415 },
    )
  }

  // ---- real text extraction (the docGPT-parity core) ----
  const extraction = await extractDocumentText(bytes, originalName, declaredMime)
  if (!extraction.ok) {
    return Response.json({ error: extraction.error }, { status: 422 })
  }

  const doc = await db.knowledgeDocument.create({
    data: {
      title: title || originalName.replace(/\.[a-z0-9]+$/i, ''),
      filename: originalName,
      mimeType: declaredMime || 'application/octet-stream',
      size: bytes.length,
      classification,
      status: 'INDEXED',
      extractedText: extraction.text,
      scanResult: serializeScanResult(scan),
      sha256: sha256Hex(bytes),
      uploadedBy: g.user.email,
    },
  })

  await audit({
    actor: g.user.email,
    action: 'KNOWLEDGE_DOCUMENT_UPLOADED',
    userId: g.user.id,
    entityType: 'KNOWLEDGE_DOCUMENT',
    entityId: doc.id,
    details: {
      title: doc.title,
      filename: originalName,
      classification,
      bytes: bytes.length,
      extractedChars: extraction.text.length,
      pages: extraction.pages ?? null,
    },
  })

  await createNotification({
    type: 'KNOWLEDGE_INDEXED',
    title: 'Knowledge document indexed',
    body: `"${doc.title}" was scanned, its text extracted (${extraction.text.length.toLocaleString()} characters) and indexed for AI-ranked search.`,
  }) // notification relay is optional — never fails the upload

  return Response.json({
    ok: true,
    doc: {
      id: doc.id,
      title: doc.title,
      filename: doc.filename,
      classification: doc.classification,
      status: doc.status,
      size: doc.size,
      extractedChars: extraction.text.length,
      pages: extraction.pages ?? null,
      createdAt: doc.createdAt,
    },
  })
}
