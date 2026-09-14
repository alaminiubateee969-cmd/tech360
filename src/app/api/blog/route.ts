import { featureEnabled } from "@/lib/features"
import { db } from '@/lib/db'
import { publishDueBlogPosts } from '@/lib/blog'

export const dynamic = 'force-dynamic'

export async function GET() {
  // feature-gate: blog switch + maintenance mode (Super Admin)
  if (!(await featureEnabled('blog')) || (await featureEnabled('maintenance_mode'))) {
    return Response.json({ posts: [], disabled: true, maintenance: (await featureEnabled('maintenance_mode')) })
  }
  // defensive promotion: scheduled posts whose time arrived go live now
  // (the ops loop also does this with an admin notification — belt & braces)
  await publishDueBlogPosts().catch(() => 0)

  const posts = await db.blogPost.findMany({
    where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: 'desc' },
    select: { slug: true, title: true, excerpt: true, category: true, author: true, publishedAt: true, coverImage: true },
  })
  return Response.json({ posts })
}
