import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, readJson, sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, context: RouteContext) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g

  const { id } = await context.params
  const raw = await readJson(req)
  const action = sanitizeText(raw.action, 30).toUpperCase()
  const reviewNote = sanitizeText(raw.reviewNote ?? '', 2000)

  if (!['APPROVE', 'RETURN_TO_DRAFT'].includes(action)) {
    return Response.json({ error: 'action must be APPROVE or RETURN_TO_DRAFT' }, { status: 400 })
  }

  const current = await db.contentAsset.findUnique({ where: { id }, select: { id: true, title: true, status: true, type: true } })
  if (!current) return Response.json({ error: 'Content asset not found' }, { status: 404 })
  if (current.status === 'PUBLISHED') {
    return Response.json({ error: 'Published content cannot be changed through the review endpoint' }, { status: 409 })
  }
  if (action === 'APPROVE' && !['DRAFT', 'FAILED', 'READY'].includes(current.status)) {
    return Response.json({ error: `Cannot approve content in ${current.status} state` }, { status: 409 })
  }

  const item = await db.contentAsset.update({
    where: { id },
    data: action === 'APPROVE'
      ? { status: 'APPROVED' }
      : { status: 'DRAFT' },
    select: { id: true, type: true, language: true, title: true, status: true, updatedAt: true },
  })

  await audit({
    actor: g.user.email,
    action: action === 'APPROVE' ? 'CENTRAL_CONTENT_APPROVED' : 'CENTRAL_CONTENT_RETURNED_TO_DRAFT',
    userId: g.user.id,
    details: { contentId: id, title: current.title, reviewNote: reviewNote || null },
    ip: g.ip,
  })

  return Response.json({ ok: true, item, reviewNote: reviewNote || null })
}
