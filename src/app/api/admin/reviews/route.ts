import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

// GET /api/admin/reviews?status=&take= — reviews with client context for moderation
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const status = sanitizeText(url.searchParams.get('status') ?? '', 20).toUpperCase()
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get('take') ?? 60) || 60))

  const where = ['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN'].includes(status) ? { status } : {}

  const [reviews, referrals, stats] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: 'desc' as const },
      take,
      include: { client: { select: { clientId: true, name: true, businessName: true, country: true } }, project: { select: { code: true, name: true } } },
    }),
    db.referral.findMany({
      orderBy: { createdAt: 'desc' as const },
      take: 50,
      include: { client: { select: { clientId: true, name: true, businessName: true } }, convertedClient: { select: { clientId: true, name: true } } },
    }),
    db.review.groupBy({ by: ['status'], _count: true }),
  ])

  return Response.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      clientId: r.client.clientId,
      clientName: r.client.name,
      businessName: r.client.businessName,
      country: r.client.country,
      projectCode: r.project?.code ?? null,
      projectName: r.project?.name ?? null,
      rating: r.rating, content: r.content, published: r.published, consent: r.consent,
      status: r.status, moderatedBy: r.moderatedBy, moderatedAt: r.moderatedAt,
      createdAt: r.createdAt,
    })),
    referrals: referrals.map((f) => ({
      id: f.id,
      clientId: f.client.clientId,
      clientName: f.client.name,
      businessName: f.client.businessName,
      name: f.name, contact: f.contact, notes: f.notes, status: f.status,
      convertedClientId: f.convertedClientId,
      convertedClientIdCode: f.convertedClient?.clientId ?? null,
      convertedClientName: f.convertedClient?.name ?? null,
      convertedAt: f.convertedAt,
      createdAt: f.createdAt,
    })),
    stats: Object.fromEntries(stats.map((s) => [s.status, s._count])),
  })
}
