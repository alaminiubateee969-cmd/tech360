import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/portal'
import { audit, rateLimit, clientIp } from '@/lib/security'
import { createNotification } from '@/lib/notify'

export const dynamic = 'force-dynamic'

// ============================================================
// POST /api/portal/review/withdraw — the client's RIGHT to be
// forgotten, self-served. Withdrawal:
//   • revokes publish consent (consent=false)
//   • unpublishes immediately (published=false, status=WITHDRAWN)
//   • disappears from the public site at once (filters enforce it)
//   • notifies the admin + writes audit + automation trail
// The review content is retained as a private record unless the
// client asks for deletion (email policy path, documented in Legal).
// ============================================================
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`portal-withdraw:${ip}`, 5, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many attempts, please wait a minute.' }, { status: 429 })

  const store = await cookies()
  const clientId = verifyPortalToken(store.get(PORTAL_COOKIE)?.value)
  if (!clientId) return Response.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })

  const client = await db.client.findFirst({ where: { clientId, deletedAt: null } })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  const review = await db.review.findFirst({ where: { clientId: client.id } })
  if (!review) return Response.json({ error: 'No review on file.' }, { status: 404 })
  if (review.status === 'WITHDRAWN') return Response.json({ error: 'Your review consent is already withdrawn.', status: 'WITHDRAWN' }, { status: 409 })
  if (review.status === 'REJECTED') return Response.json({ error: 'This review is not published — nothing to withdraw.', status: 'REJECTED' }, { status: 409 })
  if (review.status !== 'SUBMITTED' && review.status !== 'APPROVED') {
    return Response.json({ error: 'Nothing to withdraw yet — submit a review first.' }, { status: 400 })
  }

  const wasLive = review.published && review.status === 'APPROVED'
  await db.review.update({
    where: { id: review.id },
    data: {
      consent: false,
      published: false,
      status: 'WITHDRAWN',
      moderatedAt: new Date(),
      moderatedBy: 'client-withdrawal',
    },
  })

  await db.automationLog.create({
    data: {
      workflow: 'REVIEW_WITHDRAWN', trigger: 'PORTAL', correlationId: `withdraw-${review.id}`,
      clientId: client.id,
      input: JSON.stringify({ rating: review.rating, wasLive }).slice(0, 1000),
      output: JSON.stringify({ consent: false, published: false, status: 'WITHDRAWN' }),
      steps: JSON.stringify(['portal session verified', 'consent revoked', 'unpublished', 'admin notified']),
      status: 'SUCCESS', finishedAt: new Date(),
    },
  })
  await audit({ actor: `client:${client.clientId}`, action: 'REVIEW_CONSENT_WITHDRAWN', clientId: client.clientId, details: { reviewId: review.id, wasLive, rating: review.rating } })
  await createNotification({
    type: 'REVIEW', severity: wasLive ? 'WARNING' : 'INFO',
    title: `Review consent withdrawn: ${client.clientId}`,
    body: `${client.name} withdrew their review consent${wasLive ? ' — the review was LIVE on the public site and has been unpublished immediately.' : ' (the review was not yet published).'}`,
    link: 'reviews',
  })

  return Response.json({
    ok: true,
    status: 'WITHDRAWN',
    wasLive,
    message: wasLive
      ? 'Your consent is withdrawn and the review has been removed from the public site immediately.'
      : 'Your consent is withdrawn. Your review will not be published.',
  })
}
