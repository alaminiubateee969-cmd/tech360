import { featureEnabled } from "@/lib/features"
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeText } from '@/lib/security'
import { publishDueBlogPosts } from '@/lib/blog'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  // feature-gate: blog switch + maintenance mode (Super Admin)
  if (!(await featureEnabled('blog')) || (await featureEnabled('maintenance_mode'))) {
    return Response.json({ error: 'Blog is currently unavailable.' }, { status: 503 })
  }
  const { slug } = await params
  const clean = sanitizeText(slug, 200)
  // defensive promotion so a due scheduled post is never 404 when its time passed
  await publishDueBlogPosts().catch(() => 0)
  let post
  try {
    post = await db.blogPost.findUnique({ where: { slug: clean } })
  } catch {
    // honest degradation: the database did not answer — say so, never guess
    return Response.json(
      { error: 'This post is temporarily unavailable — the database did not answer.' },
      { status: 503 },
    )
  }
  if (!post || post.status !== 'PUBLISHED' || post.publishedAt > new Date()) {
    return Response.json({ error: 'Post not found' }, { status: 404 })
  }
  await db.blogPost.update({ where: { id: post.id }, data: { views: { increment: 1 } } }).catch(() => null)
  return Response.json({ post })
}
