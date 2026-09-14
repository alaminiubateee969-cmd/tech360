import { featureEnabled } from "@/lib/features"
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Public reviews — ONLY real, client-submitted, admin-approved, consented
// reviews. No seeded or fabricated testimonials. Empty array is the honest
// state until clients submit reviews.
export async function GET() {
  // feature-gate: public website switch + maintenance mode (Super Admin)
  if (!(await featureEnabled('public_website')) || (await featureEnabled('maintenance_mode'))) {
    return Response.json({ reviews: [] })
  }
  const reviews = await db.review.findMany({
    where: { published: true, status: 'APPROVED', consent: true },
    orderBy: { moderatedAt: 'desc' },
    take: 12,
    include: {
      client: { select: { name: true, businessName: true, country: true } },
      project: { select: { name: true, plan: true } },
    },
  })

  return Response.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      name: r.client.name,
      businessName: r.client.businessName,
      country: r.client.country,
      projectName: r.project?.name ?? null,
      serviceType: r.project?.plan ?? null,
      rating: r.rating,
      content: r.content,
      date: r.moderatedAt ?? r.createdAt,
    })),
    count: reviews.length,
    honest: true,
  })
}
