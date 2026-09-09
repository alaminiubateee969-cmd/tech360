import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const posts = await db.blogPost.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    select: { slug: true, title: true, excerpt: true, category: true, author: true, publishedAt: true, coverImage: true },
  })
  return Response.json({ posts })
}
