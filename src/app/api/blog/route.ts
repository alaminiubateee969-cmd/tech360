<<<<<<< HEAD
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

  let posts
  try {
    posts = await db.blogPost.findMany({
      where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } },
      orderBy: { publishedAt: 'desc' },
      select: { slug: true, title: true, excerpt: true, category: true, author: true, publishedAt: true, coverImage: true },
    })
  } catch {
    // honest degradation: the database did not answer — an empty list with
    // the reason, never a crash and never fabricated posts.
    return Response.json(
      { posts: [], error: 'The blog is temporarily unavailable — the database did not answer.' },
      { status: 503 },
    )
  }
  return Response.json({ posts })
=======
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const posts = await db.blogPost.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 20, select: { id: true, slug: true, title: true, excerpt: true, author: true, category: true, publishedAt: true } });
  return NextResponse.json({ posts });
>>>>>>> upload/tech360-production-final
}
