import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit, logError } from '@/lib/security'
import { createNotification } from '@/lib/notify'
import { DOC_MIME, DOC_EXT_LIST, DOC_MAX_BYTES, scanDocumentBytes, serializeScanResult } from '@/lib/files'

export const dynamic = 'force-dynamic'

const CLASSIFICATIONS = ['PUBLIC', 'PRIVATE', 'CONFIDENTIAL', 'HIGHLY_SENSITIVE']

// ------------------------------------------------------------
// GET /api/admin/documents?clientId=TECH-2026-000001 — list the
// documents hub for a client (client uploads + files shared by
// the team), including scan verdicts and download counters.
// ------------------------------------------------------------
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g

  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return Response.json({ error: 'clientId is required.' }, { status: 400 })

  const client = await db.client.findFirst({ where: { clientId, deletedAt: null }, select: { id: true, clientId: true, name: true } })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  const docs = await db.fileRecord.findMany({
    where: { clientId: client.id, relatedType: { in: ['CLIENT_UPLOAD', 'ADMIN_SHARE'] } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, originalName: true, filename: true, mimeType: true, size: true, note: true,
      classification: true, scanStatus: true, scanResult: true, sha256: true, relatedType: true,
      uploadedBy: true, downloads: true, createdAt: true, updatedAt: true,
    },
  })

  const stats = {
    total: docs.length,
    clean: docs.filter((d) => d.scanStatus === 'CLEAN').length,
    quarantined: docs.filter((d) => d.scanStatus === 'QUARANTINED').length,
    rejected: docs.filter((d) => d.scanStatus === 'REJECTED').length,
    clientUploads: docs.filter((d) => d.relatedType === 'CLIENT_UPLOAD').length,
    adminShares: docs.filter((d) => d.relatedType === 'ADMIN_SHARE').length,
    downloads: docs.reduce((s, d) => s + d.downloads, 0),
    bytes: docs.reduce((s, d) => s + d.size, 0),
  }

  return Response.json({
    client: { clientId: client.clientId, name: client.name },
    documents: docs.map((d) => ({
      ...d,
      scanResult: d.scanResult ? safeParse(d.scanResult) : null,
    })),
    stats,
  })
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s) } catch { return { raw: s.slice(0, 200) } }
}

// ------------------------------------------------------------
// POST /api/admin/documents — the team shares a file with a client
// (contract, invoice PDF, designs). Scanned with the same engine;
// CLEAN files become visible in the client portal immediately.
// ------------------------------------------------------------
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g

  try {
    const form = await req.formData()
    const file = form.get('file')
    const clientId = sanitizeText(form.get('clientId') ?? '', 30)
    const note = sanitizeText(form.get('note') ?? '', 300)
    const classificationRaw = sanitizeText(form.get('classification') ?? 'PRIVATE', 20).toUpperCase()
    const classification = CLASSIFICATIONS.includes(classificationRaw) ? classificationRaw : 'PRIVATE'

    if (!(file instanceof File)) return Response.json({ error: 'A file is required.' }, { status: 400 })
    if (!clientId) return Response.json({ error: 'A Client ID is required.' }, { status: 400 })
    if (file.size === 0) return Response.json({ error: 'The file is empty.' }, { status: 400 })
    if (file.size > DOC_MAX_BYTES) {
      return Response.json({ error: `File exceeds the ${Math.round(DOC_MAX_BYTES / 1024 / 1024)}MB limit.` }, { status: 413 })
    }

    const client = await db.client.findFirst({ where: { clientId, deletedAt: null }, select: { id: true, clientId: true, name: true } })
    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

    const declaredMime = file.type || ''
    const fromName = (file.name.split('.').pop() ?? '').toLowerCase()
    const ext = DOC_MIME[declaredMime] ?? (DOC_EXT_LIST.includes(fromName) ? fromName : null)
    if (!ext) {
      return Response.json({ error: `Unsupported file type. Allowed: ${DOC_EXT_LIST.join(', ')}.` }, { status: 415 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const scan = scanDocumentBytes(bytes, declaredMime, file.name)
    if (scan.status === 'QUARANTINED') {
      // admin-shared files must be CLEAN — a flagged file is refused, not quarantined
      return Response.json(
        { error: `Content scan flagged this file (${scan.notes.join('; ')}). It was NOT shared with the client.` },
        { status: 422 },
      )
    }

    const originalName = sanitizeText(file.name, 200) || `document.${scan.ext}`
    const safeFilename = `${Date.now()}-${scan.sha256.slice(0, 10)}.${scan.ext}`

    const doc = await db.fileRecord.create({
      data: {
        filename: safeFilename,
        originalName,
        mimeType: scan.mimeType,
        size: file.size,
        sha256: scan.sha256,
        classification,
        scanStatus: 'CLEAN',
        scanResult: serializeScanResult(scan),
        content: bytes,
        note: note || null,
        clientId: client.id,
        relatedType: 'ADMIN_SHARE',
        uploadedBy: `user:${g.user.email}`,
      },
      select: { id: true, originalName: true, createdAt: true },
    })

    await audit({
      actor: `user:${g.user.email}`,
      action: 'DOC_SHARED_TO_CLIENT',
      clientId: client.clientId,
      details: { docId: doc.id, originalName, size: file.size, classification, note: note.slice(0, 120) },
    })

    return Response.json({ ok: true, doc, message: `"${originalName}" is now visible in the client's portal.` })
  } catch (e) {
    await logError({ source: 'API', code: 'ADMIN_DOC_SHARE_FAILED', message: e instanceof Error ? e.message : 'unknown' })
    return Response.json({ error: 'Upload failed while processing the file.' }, { status: 500 })
  }
}
