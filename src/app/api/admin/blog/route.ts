import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

const STATUSES = ['DRAFT', 'PUBLISHED']
const MAX_CONTENT = 60_000

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  let slug = base || 'post'
  let suffix = 1
  // collision-safe like Client IDs: retry with -2, -3...
  for (;;) {
    const existing = await db.blogPost.findUnique({ where: { slug } })
    if (!existing || existing.id === ignoreId) return slug
    suffix += 1
    slug = `${base}-${suffix}`.slice(0, 84)
  }
}

// GET /api/admin/blog?q=&status=&take=&skip= — full list including drafts
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const q = sanitizeText(url.searchParams.get('q') ?? '', 120).toLowerCase()
  const status = sanitizeText(url.searchParams.get('status') ?? '', 20).toUpperCase()
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get('take') ?? 50) || 50))
  const skip = Math.max(0, Number(url.searchParams.get('skip') ?? 0) || 0)

  const where = {
    ...(status === 'DRAFT' || status === 'PUBLISHED' ? { status } : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { category: { contains: q } }, { author: { contains: q } }] } : {}),
  }

  const [posts, total, stats] = await Promise.all([
    db.blogPost.findMany({ where, orderBy: { updatedAt: 'desc' }, take, skip }),
    db.blogPost.count({ where }),
    db.blogPost.aggregate({ _count: true, _sum: { views: true } }),
  ])
  const publishedCount = await db.blogPost.count({ where: { status: 'PUBLISHED' } })

  return Response.json({
    posts: posts.map((p) => ({
      id: p.id, slug: p.slug, title: p.title, excerpt: p.excerpt, category: p.category,
      author: p.author, status: p.status, views: p.views, coverImage: p.coverImage,
      contentLength: (p.content ?? '').length, tags: p.tags,
      publishedAt: p.publishedAt, updatedAt: p.updatedAt, createdAt: p.createdAt,
    })),
    total,
    stats: { total: stats._count, published: publishedCount, drafts: stats._count - publishedCount, views: stats._sum.views ?? 0 },
  })
}

// POST /api/admin/blog — create a post (DRAFT or PUBLISHED)
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const raw = await readJson(req)

  const title = sanitizeText(raw.title, 200).trim()
  const content = sanitizeText(raw.content, MAX_CONTENT)
  const status = sanitizeText(raw.status, 20).toUpperCase() || 'DRAFT'
  const excerpt = sanitizeText(raw.excerpt, 400).trim()
  const category = sanitizeText(raw.category, 60).trim()
  const author = sanitizeText(raw.author, 80).trim() || 'Tech360 Team'
  const coverImage = sanitizeText(raw.coverImage, 500).trim()
  const tagsRaw = Array.isArray(raw.tags) ? raw.tags.map((t: unknown) => sanitizeText(String(t), 40)).filter(Boolean) : []

  if (title.length < 5) return Response.json({ error: 'Title must be at least 5 characters' }, { status: 400 })
  if (content.length < 100) return Response.json({ error: 'Content must be at least 100 characters' }, { status: 400 })
  if (!STATUSES.includes(status)) return Response.json({ error: 'status must be DRAFT or PUBLISHED' }, { status: 400 })

  const baseSlug = sanitizeText(raw.slug, 100).trim() || slugify(title)
  const slug = await uniqueSlug(baseSlug || slugify(title))

  const post = await db.blogPost.create({
    data: {
      slug, title, content, status, excerpt: excerpt || content.slice(0, 180).replace(/\s+\S*$/, '…'),
      category: category || 'Engineering', author, coverImage: coverImage || null,
      tags: JSON.stringify(tagsRaw.slice(0, 8)),
      publishedAt: status === 'PUBLISHED' ? new Date() : new Date(0),
    },
  })

  await audit({ actor: g.user.email, action: 'BLOG_POST_CREATED', userId: g.user.id, details: { slug: post.slug, title: post.title.slice(0, 100), status } })
  return Response.json({ ok: true, post: { ...post, contentLength: post.content.length } }, { status: 201 })
}
