import { NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit, logError } from '@/lib/security'

export const dynamic = 'force-dynamic'

// ------------------------------------------------------------
// Knowledge upload — multipart (file, title, classification).
// File safety: allow-list of types, hard size cap, sha256 recorded,
// basic content scan → SCANNED (clean) or QUARANTINED (flagged).
// ------------------------------------------------------------
const ALLOWED_MIME: Record<string, string> = {
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
  'application/json': 'json',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const CLASSIFICATIONS = ['PUBLIC', 'PRIVATE', 'CONFIDENTIAL', 'HIGHLY_SENSITIVE']

export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (isResponse(g)) return g

  try {
    const form = await req.formData()
    const file = form.get('file')
    const title = sanitizeText(form.get('title') ?? '', 200)
    const classificationRaw = sanitizeText(form.get('classification') ?? 'PRIVATE', 20).toUpperCase()
    const classification = CLASSIFICATIONS.includes(classificationRaw) ? classificationRaw : 'PRIVATE'

    if (!(file instanceof File)) {
      return Response.json({ error: 'A file is required.' }, { status: 400 })
    }
    if (!title) {
      return Response.json({ error: 'A document title is required.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: `File exceeds the ${Math.round(MAX_BYTES / 1024 / 1024)}MB limit.` }, { status: 413 })
    }

    const ext = ALLOWED_MIME[file.type] ?? (file.name.split('.').pop() ?? '').toLowerCase()
    if (!Object.values(ALLOWED_MIME).includes(ext)) {
      return Response.json({ error: `Unsupported file type "${file.type || ext}". Allowed: pdf, txt, md, csv, json, docx.` }, { status: 415 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const sha256 = createHash('sha256').update(bytes).digest('hex')

    // Basic content scan (honest, deterministic — not a fake verdict):
    // text-like files are inspected for obvious executable payloads.
    let verdict = 'CLEAN'
    const notes: string[] = []
    if (['txt', 'md', 'csv', 'json'].includes(ext)) {
      const text = bytes.toString('utf8').slice(0, 64 * 1024)
      if (/<script[\s>]/i.test(text)) { verdict = 'FLAGGED'; notes.push('contains <script> markup') }
      if (/\x00MZ/.test(text)) { verdict = 'FLAGGED'; notes.push('binary executable signature') }
      if (/BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/.test(text)) { verdict = 'FLAGGED'; notes.push('contains private key material') }
    } else {
      notes.push('binary format — deep content inspection not available; classified on trust level')
    }

    const status = verdict === 'CLEAN' ? 'SCANNED' : 'QUARANTINED'
    const extractedText = ['txt', 'md', 'csv', 'json'].includes(ext)
      ? bytes.toString('utf8').slice(0, 100_000)
      : null

    const doc = await db.knowledgeDocument.create({
      data: {
        title,
        filename: sanitizeText(file.name, 200) || `document.${ext}`,
        mimeType: file.type || `application/${ext}`,
        size: file.size,
        classification,
        status,
        extractedText,
        scanResult: JSON.stringify({ verdict, notes, sha256: sha256.slice(0, 16), scannedAt: new Date().toISOString(), engine: 'deterministic-rules-v1' }),
        sha256,
        uploadedBy: g.user.email,
      },
    })

    await audit({
      actor: `user:${g.user.email}`,
      action: 'KNOWLEDGE_UPLOADED',
      details: { docId: doc.id, title, filename: doc.filename, size: file.size, classification, status },
    })

    return Response.json({
      ok: true,
      doc,
      ...(status === 'QUARANTINED'
        ? { error: 'File was quarantined by the content scan — review it before approving.' }
        : {}),
    })
  } catch (e) {
    await logError({ source: 'API', code: 'KNOWLEDGE_UPLOAD_FAILED', message: e instanceof Error ? e.message : 'unknown' })
    return Response.json({ error: 'Upload failed while processing the file.' }, { status: 500 })
  }
}
