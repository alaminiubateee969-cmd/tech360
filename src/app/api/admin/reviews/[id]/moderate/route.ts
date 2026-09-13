import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { createNotification } from '@/lib/notify'

export const dynamic = 'force-dynamic'

// POST /api/admin/reviews/[id]/moderate — body { action: PUBLISH | REJECT }
// PUBLISH is consent-enforced: a review cannot go public without the client's
// explicit consent flag captured at submission time.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const { id } = await params
  const raw = await readJson(req)
  const action = sanitizeText(raw.action, 20).toUpperCase()

  const review = await db.review.findUnique({ where: { id: sanitizeText(id, 40) }, include: { client: { select: { clientId: true, name: true } }, project: { select: { code: true } } } })
  if (!review) return Response.json({ error: 'Review not found' }, { status: 404 })

  if (action !== 'PUBLISH' && action !== 'REJECT') {
    return Response.json({ error: 'action must be PUBLISH or REJECT' }, { status: 400 })
  }
  if (action === 'PUBLISH') {
    if (review.status !== 'SUBMITTED') return Response.json({ error: 'Client has not submitted this review yet' }, { status: 400 })
    if (!review.consent) return Response.json({ error: 'Client has not consented to public display — cannot publish' }, { status: 403 })
    if (review.rating == null || !review.content) return Response.json({ error: 'Review has no rating or content' }, { status: 400 })
  }

  const updated = await db.review.update({
    where: { id: review.id },
    data: {
      status: action === 'PUBLISH' ? 'APPROVED' : 'REJECTED',
      published: action === 'PUBLISH',
      moderatedBy: g.user.email,
      moderatedAt: new Date(),
    },
  })

  await audit({
    actor: g.user.email, action: action === 'PUBLISH' ? 'REVIEW_PUBLISHED' : 'REVIEW_REJECTED', userId: g.user.id,
    clientId: review.client.clientId,
    details: { reviewId: review.id, rating: review.rating, consent: review.consent, project: review.project?.code ?? null },
  })

  if (action === 'PUBLISH') {
    await createNotification({
      type: 'REVIEW_PUBLISHED', severity: 'INFO',
      title: 'Review published',
      body: `${review.client.name} (${review.client.clientId}) — ${review.rating ?? '?'}★ review is now live on the website.`,
    })
  }

  return Response.json({ ok: true, review: updated })
}
