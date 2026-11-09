import { db } from '@/lib/db'
import { featureEnabled } from '@/lib/features'

/**
 * Published-blog lookup for crawler-facing surfaces (sitemap, llms.txt).
 *
 * Returns an empty list — never throws — when the blog feature is switched off
 * or the database is unreachable, so `sitemap.xml` always renders instead of
 * failing the whole route.
 */
export type PublishedBlogEntry = {
  slug: string
  updatedAt: Date
}

export async function listPublishedBlogSlugs(limit = 500): Promise<PublishedBlogEntry[]> {
  if (!(await featureEnabled('blog'))) return []

  const posts = await db.blogPost
    .findMany({
      where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: { slug: true, publishedAt: true, updatedAt: true },
    })
    .catch(() => [] as Array<{ slug: string; publishedAt: Date | null; updatedAt: Date | null }>)

  return posts.map((post) => ({
    slug: post.slug,
    updatedAt: post.updatedAt ?? post.publishedAt ?? new Date(),
  }))
}
