import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { publishDueBlogPosts } from '@/lib/blog'
import { featureEnabled } from '@/lib/features'

export const dynamic = 'force-dynamic'

// ------------------------------------------------------------
// GET /rss.xml — RSS 2.0 feed of published TECH360 engineering
// insights. The blog feature switch is honored: when the blog is
// off the channel stays valid but ships zero items, with an honest
// XML comment saying exactly why.
// ------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET(req: NextRequest) {
  const blogOn = await featureEnabled('blog')

  // Defensive promotion: scheduled posts whose time arrived go live now
  // (same belt-and-braces as the public blog endpoints).
  let posts: Array<{ slug: string; title: string; excerpt: string | null; publishedAt: Date }> = []
  if (blogOn) {
    await publishDueBlogPosts().catch(() => 0)
    posts = await db.blogPost
      .findMany({
        where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } },
        orderBy: { publishedAt: 'desc' },
        take: 8,
        select: { slug: true, title: true, excerpt: true, publishedAt: true },
      })
      .catch(() => [])
  }

  const origin = (process.env.APP_PUBLIC_URL ?? new URL(req.url).origin).replace(/\/+$/, '')
  const blogLink = `${origin}/#/blog`

  const items = posts
    .map((p) => {
      const link = `${origin}/#/blog/${p.slug}`
      const description = p.excerpt?.trim() || 'An engineering note from the TECH360 team.'
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="false">tech360-blog-${esc(p.slug)}</guid>
      <pubDate>${p.publishedAt.toUTCString()}</pubDate>
      <description>${esc(description)}</description>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
${blogOn ? '' : '  <!-- Honest state: the blog feature is currently switched off by the platform administrator — no items are published to this feed. -->'}
  <channel>
    <title>TECH360 — Engineering insights</title>
    <link>${esc(blogLink)}</link>
    <description>How we build: trust mechanics, automation discipline, architecture choices and the lessons behind our policies.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${esc(origin)}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  })
}
