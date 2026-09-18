import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { isValidScheduleDate } from '@/lib/blog'

export const dynamic = 'force-dynamic'

const STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED']
const MAX_CONTENT = 60_000

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function uniqueSlug(base: string, ignoreId: string): Promise<string> {
  let slug = base || 'post'
  let suffix = 1
  for (;;) {
    const existing = await db.blogPost.findUnique({ where: { slug } })
    if (!existing || existing.id === ignoreId) return slug
    suffix += 1
    slug = `${base}-${suffix}`.slice(0, 84)
  }
}

// GET /api/admin/blog/[id] — full content for the editor
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const { id } = await params
  const post = await db.blogPost.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!post) return Response.json({ error: 'Post not found' }, { status: 404 })
  return Response.json({ post })
}

// PATCH /api/admin/blog/[id] — edit fields / publish / unpublish
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const { id } = await params
  const raw = await readJson(req)

  const post = await db.blogPost.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!post) return Response.json({ error: 'Post not found' }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (raw.title !== undefined) {
    const title = sanitizeText(raw.title, 200).trim()
    if (title.length < 5) return Response.json({ error: 'Title must be at least 5 characters' }, { status: 400 })
    data.title = title
  }
  if (raw.content !== undefined) {
    const content = sanitizeText(raw.content, MAX_CONTENT)
    if (content.length < 100) return Response.json({ error: 'Content must be at least 100 characters' }, { status: 400 })
    data.content = content
  }
  if (raw.excerpt !== undefined) data.excerpt = sanitizeText(raw.excerpt, 400).trim()
  if (raw.category !== undefined) data.category = sanitizeText(raw.category, 60).trim() || 'Engineering'
  if (raw.author !== undefined) data.author = sanitizeText(raw.author, 80).trim() || 'Tech360 Team'
  if (raw.coverImage !== undefined) data.coverImage = sanitizeText(raw.coverImage, 500).trim() || null
  if (raw.slug !== undefined) {
    const wanted = sanitizeText(raw.slug, 100).trim()
    const base = wanted || slugify(String(data.title ?? post.title))
    data.slug = await uniqueSlug(base, post.id)
  }
  if (Array.isArray(raw.tags)) {
    data.tags = JSON.stringify(raw.tags.map((t: unknown) => sanitizeText(String(t), 40)).filter(Boolean).slice(0, 8))
  }
  if (raw.status !== undefined) {
    const status = sanitizeText(raw.status, 20).toUpperCase()
    if (!STATUSES.includes(status)) return Response.json({ error: 'status must be DRAFT, SCHEDULED or PUBLISHED' }, { status: 400 })
    // scheduling: SCHEDULED requires a valid future publish time (new or already stored)
    if (status === 'SCHEDULED') {
      const candidate = raw.publishedAt !== undefined ? raw.publishedAt : (post.status === 'SCHEDULED' ? post.publishedAt : null)
      if (!isValidScheduleDate(candidate)) {
        return Response.json({ error: 'A valid future publish date is required to schedule (publishedAt).' }, { status: 400 })
      }
      data.status = status
      data.publishedAt = new Date(candidate as string)
    } else {
      data.status = status
      if (status === 'PUBLISHED' && post.status !== 'PUBLISHED') {
        data.publishedAt = new Date() // publishing stamps the real publish time
      }
      if (status === 'DRAFT') data.publishedAt = new Date(0)
    }
  } else if (raw.publishedAt !== undefined && post.status === 'SCHEDULED') {
    // rescheduling a scheduled post: the new date must stay in the future
    if (!isValidScheduleDate(raw.publishedAt)) {
      return Response.json({ error: 'A valid future publish date is required to reschedule.' }, { status: 400 })
    }
    data.publishedAt = new Date(raw.publishedAt as string)
  }

  const updated = await db.blogPost.update({ where: { id: post.id }, data })

  await audit({
    actor: g.user.email, action: 'BLOG_POST_UPDATED', userId: g.user.id,
    details: { slug: updated.slug, from: post.status, to: updated.status, fields: Object.keys(data) },
  })
  return Response.json({ ok: true, post: updated })
}

// DELETE /api/admin/blog/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const { id } = await params
  const post = await db.blogPost.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!post) return Response.json({ error: 'Post not found' }, { status: 404 })

  await db.blogPost.delete({ where: { id: post.id } })
  await audit({ actor: g.user.email, action: 'BLOG_POST_DELETED', userId: g.user.id, details: { slug: post.slug, title: post.title.slice(0, 100), was: post.status } })
  return Response.json({ ok: true })
}
