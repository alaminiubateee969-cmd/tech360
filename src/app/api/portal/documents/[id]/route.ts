import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/portal'
import { audit, rateLimit, clientIp } from '@/lib/security'

export const dynamic = 'force-dynamic'

const INLINE_SAFE_PREFIX = ['image/', 'application/pdf', 'text/']

// ------------------------------------------------------------
// GET /api/portal/documents/[id] — client downloads (or inline-
// views) one of THEIR OWN documents. Ownership enforced; docs
// shared by the admin are downloadable too. QUARANTINED and
// REJECTED files are blocked with an explicit status.
// ------------------------------------------------------------
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = clientIp(req)
  const rl = rateLimit(`portal-doc-dl:${ip}`, 30, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests.' }, { status: 429 })

  const store = await cookies()
  const clientId = verifyPortalToken(store.get(PORTAL_COOKIE)?.value)
  if (!clientId) return Response.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })

  const { id } = await params
  const client = await db.client.findFirst({ where: { clientId, deletedAt: null }, select: { id: true, clientId: true } })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  const doc = await db.fileRecord.findFirst({
    where: { id, clientId: client.id, relatedType: { in: ['CLIENT_UPLOAD', 'ADMIN_SHARE'] } },
    select: { id: true, originalName: true, filename: true, mimeType: true, scanStatus: true, content: true, size: true, uploadedBy: true },
  })
  if (!doc) return Response.json({ error: 'Document not found.' }, { status: 404 })
  if (!doc.content) return Response.json({ error: 'File content is not available.' }, { status: 410 })
  if (doc.scanStatus === 'QUARANTINED') {
    return Response.json({ error: 'This file is quarantined pending review by our team — download is blocked.' }, { status: 403 })
  }
  if (doc.scanStatus === 'REJECTED') {
    return Response.json({ error: 'This file was removed after review.' }, { status: 403 })
  }

  await db.fileRecord.update({ where: { id: doc.id }, data: { downloads: { increment: 1 } } })
  await audit({
    actor: `client:${client.clientId}`,
    action: 'DOC_DOWNLOADED_BY_CLIENT',
    clientId: client.clientId,
    details: { docId: doc.id, filename: doc.originalName, inline: req.nextUrl.searchParams.get('inline') === '1' },
  })

  const inline = req.nextUrl.searchParams.get('inline') === '1' && INLINE_SAFE_PREFIX.some((p) => doc.mimeType.startsWith(p))
  const disposition = inline ? 'inline' : 'attachment'

  return new Response(new Uint8Array(doc.content), {
    headers: {
      'Content-Type': doc.mimeType || 'application/octet-stream',
      'Content-Length': String(doc.size),
      'Content-Disposition': `${disposition}; filename="${doc.filename}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}

// ------------------------------------------------------------
// DELETE /api/portal/documents/[id] — client removes one of their
// own uploads (ADMIN_SHARE files cannot be deleted by clients).
// Always audited; the admin is notified (retention awareness).
// ------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = clientIp(req)
  const rl = rateLimit(`portal-doc-del:${ip}`, 10, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests.' }, { status: 429 })

  const store = await cookies()
  const clientId = verifyPortalToken(store.get(PORTAL_COOKIE)?.value)
  if (!clientId) return Response.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })

  const { id } = await params
  const client = await db.client.findFirst({ where: { clientId, deletedAt: null }, select: { id: true, clientId: true, name: true } })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  const doc = await db.fileRecord.findFirst({
    where: { id, clientId: client.id, relatedType: 'CLIENT_UPLOAD' },
    select: { id: true, originalName: true, scanStatus: true },
  })
  if (!doc) return Response.json({ error: 'Document not found (files shared by Tech360 cannot be deleted).' }, { status: 404 })

  await db.fileRecord.delete({ where: { id: doc.id } })
  await audit({
    actor: `client:${client.clientId}`,
    action: 'DOC_DELETED_BY_CLIENT',
    clientId: client.clientId,
    details: { docId: doc.id, filename: doc.originalName, scanStatus: doc.scanStatus },
  })
  const { createNotification } = await import('@/lib/notify')
  await createNotification({
    type: 'CLIENT_DOC',
    severity: 'INFO',
    title: `Client deleted a document`,
    body: `${client.clientId} · ${client.name} deleted their upload "${doc.originalName}" (previously ${doc.scanStatus}).`,
    link: 'clients',
  })

  return Response.json({ ok: true })
}
