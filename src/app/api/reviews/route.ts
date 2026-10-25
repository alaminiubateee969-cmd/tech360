<<<<<<< HEAD
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
  let reviews
  try {
    reviews = await db.review.findMany({
      where: { published: true, status: 'APPROVED', consent: true },
      orderBy: { moderatedAt: 'desc' },
      take: 12,
      include: {
        client: { select: { name: true, businessName: true, country: true } },
        project: { select: { name: true, plan: true } },
      },
    })
  } catch {
    // honest degradation: the database did not answer — an empty list with
    // the reason is truthful; a fabricated or half-loaded list is not.
    return Response.json(
      { reviews: [], error: 'Reviews are temporarily unavailable — the database did not answer.' },
      { status: 503 },
    )
  }

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
=======
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER","STAFF"], req);
  if (!auth.ok) return auth.response;
  const reviews = await db.review.findMany({ take: 50, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ reviews });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const review = await db.review.create({ data: { rating: Number(body.rating) || 5, title: body.title || null, content: body.content || null, authorName: body.authorName || null, authorRole: body.authorRole || null, isPublic: Boolean(body.isPublic), isApproved: false } });
  return NextResponse.json({ review }, { status: 201 });
>>>>>>> upload/tech360-production-final
}
