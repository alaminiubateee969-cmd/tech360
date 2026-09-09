import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const clean = sanitizeText(slug, 200)
  const post = await db.blogPost.findUnique({ where: { slug: clean } })
  if (!post || post.status !== 'PUBLISHED') {
    return Response.json({ error: 'Post not found' }, { status: 404 })
  }
  await db.blogPost.update({ where: { id: post.id }, data: { views: { increment: 1 } } }).catch(() => null)
  return Response.json({ post })
}
