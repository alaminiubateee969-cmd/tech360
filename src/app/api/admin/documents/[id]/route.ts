import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

// ------------------------------------------------------------
// GET /api/admin/documents/[id] — admin downloads any document
// from any client hub (including QUARANTINED files for review).
// Audited every time.
// ------------------------------------------------------------
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g

  const { id } = await params
  const doc = await db.fileRecord.findFirst({
    where: { id, relatedType: { in: ['CLIENT_UPLOAD', 'ADMIN_SHARE'] } },
    select: { id: true, filename: true, originalName: true, mimeType: true, size: true, scanStatus: true, content: true, client: { select: { clientId: true } } },
  })
  if (!doc) return Response.json({ error: 'Document not found.' }, { status: 404 })
  if (!doc.content) return Response.json({ error: 'File content is not available.' }, { status: 410 })

  await db.fileRecord.update({ where: { id: doc.id }, data: { downloads: { increment: 1 } } })
  await audit({
    actor: `user:${g.user.email}`,
    action: 'DOC_DOWNLOADED_BY_ADMIN',
    clientId: doc.client?.clientId,
    details: { docId: doc.id, filename: doc.originalName, scanStatus: doc.scanStatus },
  })

  const inline = req.nextUrl.searchParams.get('inline') === '1'
  return new Response(new Uint8Array(doc.content), {
    headers: {
      'Content-Type': doc.mimeType || 'application/octet-stream',
      'Content-Length': String(doc.size),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${doc.filename}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}
