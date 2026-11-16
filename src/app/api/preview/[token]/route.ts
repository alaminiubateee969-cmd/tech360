import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeText } from '@/lib/security'
import { previewExpiredHtml, previewGoneHtml } from './expired-html'
import { upgradeLegacyPreviewHandler } from '@/lib/preview-client-script'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const clean = sanitizeText(token, 64).replace(/[^a-f0-9]/gi, '')
  const preview = await db.preview.findUnique({ where: { token: clean } })
  if (!preview) {
    return new Response(previewGoneHtml('Preview not found', 'This preview link is invalid or has been removed. Please contact Tech360 for a fresh link.'), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  // Security: tokenized preview links expire. Approved/revision-requested links
  // are terminal states (decision already recorded) and stay accessible as a
  // record; every other state hard-stops after expiresAt.
  const terminal = preview.status === 'APPROVED' || preview.status === 'REVISION_REQUESTED'
  if (!terminal && preview.expiresAt && preview.expiresAt.getTime() < Date.now()) {
    if (preview.status !== 'EXPIRED') {
      const expired = await db.preview.updateMany({ where: { id: preview.id, status: { in: ['GENERATED', 'SENT', 'VIEWED'] }, expiresAt: { lte: new Date() } }, data: { status: 'EXPIRED' } })
      if (expired.count) await db.previewEvent.create({ data: { previewId: preview.id, type: 'EXPIRED' } })
    }
    return new Response(previewExpiredHtml(), { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } })
  }

  return new Response(upgradeLegacyPreviewHandler(preview.html), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } })
}
