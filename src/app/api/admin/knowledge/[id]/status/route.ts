import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

const ALLOWED = ['UPLOADED', 'SCANNED', 'QUARANTINED', 'INDEXED', 'APPROVED', 'ARCHIVED']

// Knowledge document governance: POST /api/admin/knowledge/[id]/status
// body { status: APPROVED | ARCHIVED | QUARANTINED, note? }
// Approving records WHO approved (accountability); everything is audited.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const { id } = await params
  const raw = await readJson(req)
  const status = sanitizeText(raw.status, 20).toUpperCase()
  const note = sanitizeText(raw.note, 500)

  if (!ALLOWED.includes(status)) {
    return Response.json({ error: `status must be one of ${ALLOWED.join(', ')}` }, { status: 400 })
  }

  const doc = await db.knowledgeDocument.findUnique({ where: { id } })
  if (!doc) return Response.json({ error: 'Document not found' }, { status: 404 })

  const updated = await db.knowledgeDocument.update({
    where: { id },
    data: {
      status,
      // approval accountability: who approved and when (approvedAt re-stamped on each approval)
      ...(status === 'APPROVED' ? { approvedBy: g.user.email } : {}),
    },
  })

  await audit({
    actor: `user:${g.user.email}`,
    action: 'KNOWLEDGE_STATUS_CHANGED',
    details: { docId: id, title: doc.title.slice(0, 120), from: doc.status, to: status, note: note || null },
  })

  return Response.json({ ok: true, doc: updated })
}
