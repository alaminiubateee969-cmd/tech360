import { db } from '@/lib/db'

// ============================================================
// BLOG PUBLISH SCHEDULING — posts authored with a future publish
// time go live exactly then. Promotion is belt-and-braces:
//   1) the autonomous ops cycle (PUBLISH_DUE_BLOG_POSTS action)
//      promotes + notifies the admin, and
//   2) the public blog endpoints defensively promote due posts
//      before listing, so content never waits on a scheduler.
// ============================================================

export async function publishDueBlogPosts(): Promise<number> {
  const res = await db.blogPost.updateMany({
    where: { status: 'SCHEDULED', publishedAt: { lte: new Date() } },
    data: { status: 'PUBLISHED' },
  })
  return res.count
}

export function isValidScheduleDate(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false
  const d = new Date(value)
  return !Number.isNaN(d.getTime()) && d.getTime() > Date.now()
}
