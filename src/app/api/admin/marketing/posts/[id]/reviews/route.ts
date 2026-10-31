// Team reviews for a marketing post — the data behind the review grid.
//
// GET    /api/admin/marketing/posts/:id/reviews  → real reviews + aggregate
// POST   /api/admin/marketing/posts/:id/reviews  → record one review (1..5)
// DELETE /api/admin/marketing/posts/:id/reviews?reviewId=… → remove one
//
// Rules:
//   * The rating must be an integer 1..5. Anything else is rejected, never
//     clamped into a value the reviewer did not choose.
//   * The aggregate is computed from the stored rows only. A post with no
//     reviews returns { average: null, count: 0 } — the UI says "Not rated
//     yet" instead of inventing a score.
//   * Every write is audited with the acting operator's email.
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { isValidRating, summarizeRatings } from '@/lib/social/post-grid'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const { id } = await params
  const post = await db.socialPost.findUnique({ where: { id }, select: { id: true } })
  if (!post) return Response.json({ error: 'Post not found' }, { status: 404 })

  const reviews = await db.postReview.findMany({ where: { postId: id }, orderBy: { createdAt: 'desc' }, take: 200 })
  return Response.json({ reviews, summary: summarizeRatings(reviews) })
}

export async function POST(req: NextRequest, { params }: Params) {
  const g = await guard(req, { minRole: 'ADMIN', limit: { max: 60, windowMs: 60_000 } })
  if (isResponse(g)) return g
  const { id } = await params
  const post = await db.socialPost.findUnique({ where: { id }, select: { id: true, platform: true } })
  if (!post) return Response.json({ error: 'Post not found' }, { status: 404 })

  const raw = await readJson(req)
  const rating = Number(raw.rating)
  if (!isValidRating(rating)) return Response.json({ error: 'rating must be a whole number from 1 to 5' }, { status: 400 })

  const review = await db.postReview.create({
    data: {
      postId: id,
      rating,
      comment: sanitizeText(raw.comment, 2000) || null,
      reviewer: sanitizeText(raw.reviewer, 120) || g.user.name || g.user.email,
    },
  })
  await audit({
    actor: g.user.email,
    action: 'SOCIAL_POST_REVIEWED',
    userId: g.user.id,
    entityId: id,
    details: { platform: post.platform, rating, reviewId: review.id },
  })

  const reviews = await db.postReview.findMany({ where: { postId: id }, orderBy: { createdAt: 'desc' }, take: 200 })
  return Response.json({ ok: true, review, reviews, summary: summarizeRatings(reviews) })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const { id } = await params
  const reviewId = new URL(req.url).searchParams.get('reviewId') ?? ''
  if (!reviewId) return Response.json({ error: 'reviewId required' }, { status: 400 })

  const existing = await db.postReview.findUnique({ where: { id: reviewId } })
  if (!existing || existing.postId !== id) return Response.json({ error: 'Review not found on this post' }, { status: 404 })

  await db.postReview.delete({ where: { id: reviewId } })
  await audit({ actor: g.user.email, action: 'SOCIAL_POST_REVIEW_DELETED', userId: g.user.id, entityId: id, details: { reviewId } })

  const reviews = await db.postReview.findMany({ where: { postId: id }, orderBy: { createdAt: 'desc' }, take: 200 })
  return Response.json({ ok: true, reviews, summary: summarizeRatings(reviews) })
}
