// Marketing post poster (clear, vector-rendered image for the review grid).
//
// GET /api/admin/marketing/posts/:id/poster?format=SQUARE|STORY|LANDSCAPE&download=1
//
// The poster is rendered locally from the post's own copy by
// `renderPosterSvg` — deterministic, inert SVG with escaped text. It is never
// an AI-generated image, and it is not a claim that the post was published:
// the poster carries the post's real status (DRAFT / APPROVED / PUBLISHED …).
// Admin-only, because the copy is internal until it is approved.
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { headlineOf, bodyOf, hashtagsOf } from '@/lib/social/post-grid'
import { isPosterFormat, renderPosterSvg } from '@/lib/social/poster'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'ADMIN', rateLimitPerMin: 240 })
  if (isResponse(g)) return g
  const { id } = await params
  const post = await db.socialPost.findUnique({ where: { id } })
  if (!post) return Response.json({ error: 'Post not found' }, { status: 404 })

  const url = new URL(req.url)
  const requested = url.searchParams.get('format')?.toUpperCase() ?? 'SQUARE'
  const format = isPosterFormat(requested) ? requested : 'SQUARE'
  const download = url.searchParams.get('download') === '1'

  const svg = renderPosterSvg({
    headline: headlineOf(post, 110),
    body: bodyOf(post, 190),
    platform: post.platform,
    status: post.status,
    hashtags: hashtagsOf(post),
    format,
    reference: `#${post.id.slice(-6).toUpperCase()}`,
  })

  const filename = `tech360-${post.platform.toLowerCase()}-${post.id.slice(-6)}-${format.toLowerCase()}.svg`
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'private, max-age=60, must-revalidate',
      'Content-Disposition': download ? `attachment; filename="${filename}"` : 'inline',
      // The document is inert SVG (no script, no external references), but keep
      // the browser from treating it as a document when opened directly.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  })
}
