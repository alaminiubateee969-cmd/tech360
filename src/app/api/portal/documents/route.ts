import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/portal'
import { sanitizeText, audit, rateLimit, clientIp } from '@/lib/security'
import { createNotification } from '@/lib/notify'
import { DOC_MIME, DOC_EXT_LIST, DOC_MAX_BYTES, scanDocumentBytes, serializeScanResult } from '@/lib/files'

export const dynamic = 'force-dynamic'

// ------------------------------------------------------------
// POST /api/portal/documents — client uploads a document from the
// portal (brand assets, briefs, KYC material). Full file safety:
// allow-list, hard size cap, sha256, deterministic content scan.
// QUARANTINED files stay blocked from download until admin review.
// ------------------------------------------------------------
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`portal-doc:${ip}`, 8, 10 * 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many uploads. Please wait a few minutes.' }, { status: 429 })

  const store = await cookies()
  const clientId = verifyPortalToken(store.get(PORTAL_COOKIE)?.value)
  if (!clientId) return Response.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })

  const client = await db.client.findFirst({ where: { clientId, deletedAt: null } })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  try {
    const form = await req.formData()
    const file = form.get('file')
    const note = sanitizeText(form.get('note') ?? '', 300)

    if (!(file instanceof File)) return Response.json({ error: 'A file is required.' }, { status: 400 })
    if (file.size === 0) return Response.json({ error: 'The file is empty.' }, { status: 400 })
    if (file.size > DOC_MAX_BYTES) {
      return Response.json({ error: `File exceeds the ${Math.round(DOC_MAX_BYTES / 1024 / 1024)}MB limit.` }, { status: 413 })
    }

    const declaredMime = file.type || ''
    const fromName = (file.name.split('.').pop() ?? '').toLowerCase()
    const ext = DOC_MIME[declaredMime] ?? (DOC_EXT_LIST.includes(fromName) ? fromName : null)
    if (!ext) {
      return Response.json({ error: `Unsupported file type. Allowed: ${DOC_EXT_LIST.join(', ')}.` }, { status: 415 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const scan = scanDocumentBytes(bytes, declaredMime, file.name)
    const scanStatus = scan.status === 'SCANNED' ? 'CLEAN' : 'QUARANTINED'

    const originalName = sanitizeText(file.name, 200) || `document.${scan.ext}`
    // stored filename: never trust a raw client filename in disk-facing fields
    const safeFilename = `${Date.now()}-${scan.sha256.slice(0, 10)}.${scan.ext}`

    const doc = await db.fileRecord.create({
      data: {
        filename: safeFilename,
        originalName,
        mimeType: scan.mimeType,
        size: file.size,
        sha256: scan.sha256,
        classification: 'PRIVATE',
        scanStatus,
        scanResult: serializeScanResult(scan),
        content: bytes,
        note: note || null,
        clientId: client.id,
        relatedType: 'CLIENT_UPLOAD',
        uploadedBy: `client:${client.clientId}`,
      },
      select: { id: true, originalName: true, scanStatus: true, createdAt: true },
    })

    await audit({
      actor: `client:${client.clientId}`,
      action: 'DOC_UPLOADED_BY_CLIENT',
      clientId: client.clientId,
      details: { docId: doc.id, originalName, size: file.size, ext: scan.ext, scanStatus, sha256: scan.sha256.slice(0, 16) },
    })

    await createNotification({
      type: 'CLIENT_DOC',
      severity: scanStatus === 'QUARANTINED' ? 'WARNING' : 'INFO',
      title: scanStatus === 'QUARANTINED'
        ? 'Quarantined client upload — review required'
        : `New client document: ${originalName}`,
      body: `${client.clientId} · ${client.name} uploaded "${originalName}" (${file.size} bytes).${
        scanStatus === 'QUARANTINED' ? ` Content scan flagged: ${scan.notes.join('; ') || 'policy'}. Download stays blocked until an admin releases it.` : ' Scan: CLEAN.'
      }`,
      link: 'clients',
    })

    return Response.json({
      ok: true,
      doc,
      ...(scanStatus === 'QUARANTINED'
        ? { warning: 'The file was quarantined by the content scan — our team will review it before it can be downloaded.' }
        : {}),
    })
  } catch (e) {
    console.error('[portal/documents] upload failed:', e)
    return Response.json({ error: 'Upload failed while processing the file.' }, { status: 500 })
  }
}
