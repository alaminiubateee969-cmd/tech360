import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { DOCUMENT_SECURITY_HEADERS, isInlineSafeMime } from '@/lib/files'
import { audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

// ------------------------------------------------------------
// GET /api/admin/documents/[id] — admin downloads any document
// from any client hub. QUARANTINED/REJECTED files require
// SUPER_ADMIN and are NEVER rendered inline.
// Audited every time.
// ------------------------------------------------------------
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g

  const { id } = await params
  const doc = await db.fileRecord.findFirst({
    where: { id, relatedType: { in: ['CLIENT_UPLOAD', 'ADMIN_SHARE', 'DELIVERY'] } },
    select: { id: true, filename: true, originalName: true, mimeType: true, size: true, scanStatus: true, content: true, client: { select: { clientId: true } } },
  })
  if (!doc) return Response.json({ error: 'Document not found.' }, { status: 404 })
  if (!doc.content) return Response.json({ error: 'File content is not available.' }, { status: 410 })
  if ((doc.scanStatus === 'QUARANTINED' || doc.scanStatus === 'REJECTED') && g.user.role !== 'SUPER_ADMIN') {
    return Response.json(
      { error: `File is ${doc.scanStatus.toLowerCase()} — only a Super Admin may inspect quarantined bytes.` },
      { status: 423 },
    )
  }

  await db.fileRecord.update({ where: { id: doc.id }, data: { downloads: { increment: 1 } } })
  await audit({
    actor: `user:${g.user.email}`,
    action: 'DOC_DOWNLOADED_BY_ADMIN',
    clientId: doc.client?.clientId,
    details: { docId: doc.id, filename: doc.originalName, scanStatus: doc.scanStatus },
  })

  const isClean = doc.scanStatus === 'CLEAN' || doc.scanStatus === 'SCANNED' || doc.scanStatus === 'RELEASED'
  const inline = req.nextUrl.searchParams.get('inline') === '1' && isClean && isInlineSafeMime(doc.mimeType)
  const safeFilename = (doc.filename || 'document').replace(/["\\\r\n]/g, '_')
  return new Response(new Uint8Array(doc.content), {
    headers: {
      ...DOCUMENT_SECURITY_HEADERS,
      'Content-Type': inline ? doc.mimeType : 'application/octet-stream',
      'Content-Length': String(doc.size),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeFilename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
