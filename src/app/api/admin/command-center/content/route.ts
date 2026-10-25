import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, readJson, sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

const CONTENT_TYPES = ['BLOG_DRAFT', 'SEO_BRIEF', 'SOCIAL_POST', 'MARKETING_KIT', 'RESEARCH'] as const
const LANGUAGES = ['EN', 'BN', 'BILINGUAL'] as const

export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g

  const url = new URL(req.url)
  const q = sanitizeText(url.searchParams.get('q') ?? '', 120)
  const status = sanitizeText(url.searchParams.get('status') ?? '', 20).toUpperCase()
  const type = sanitizeText(url.searchParams.get('type') ?? '', 30).toUpperCase()
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
  const perPage = Math.min(100, Math.max(10, Number(url.searchParams.get('perPage') ?? 30) || 30))
  const where = {
    ...(q ? { OR: [{ title: { contains: q } }, { content: { contains: q } }] } : {}),
    ...(status && ['DRAFT', 'APPROVED', 'PRODUCING', 'READY', 'PUBLISHED', 'FAILED'].includes(status) ? { status } : {}),
    ...(CONTENT_TYPES.includes(type as (typeof CONTENT_TYPES)[number]) ? { type } : {}),
  }

  const [items, total] = await Promise.all([
    db.contentAsset.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      select: { id: true, type: true, language: true, voice: true, title: true, content: true, status: true, safeContent: true, createdAt: true, updatedAt: true },
    }),
    db.contentAsset.count({ where }),
  ])

  return Response.json({ items, total, page, perPage })
}

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g

  const raw = await readJson(req)
  const title = sanitizeText(raw.title, 240)
  const type = sanitizeText(raw.type ?? 'BLOG_DRAFT', 30).toUpperCase()
  const language = sanitizeText(raw.language ?? 'EN', 12).toUpperCase()
  const voice = sanitizeText(raw.voice ?? '', 120)
  const brand = sanitizeText(raw.brand ?? '', 80)
  const audience = sanitizeText(raw.audience ?? '', 240)
  const topic = sanitizeText(raw.topic ?? '', 500)
  const body = typeof raw.content === 'string'
    ? raw.content
    : JSON.stringify(raw.content ?? { topic, outline: [], sections: [], seo: {} })

  if (!title) return Response.json({ error: 'title is required' }, { status: 400 })
  if (!CONTENT_TYPES.includes(type as (typeof CONTENT_TYPES)[number])) {
    return Response.json({ error: 'Unsupported content type' }, { status: 400 })
  }
  if (!LANGUAGES.includes(language as (typeof LANGUAGES)[number])) {
    return Response.json({ error: 'language must be EN, BN or BILINGUAL' }, { status: 400 })
  }
  if (!body || body.length > 100_000) {
    return Response.json({ error: 'content is required and must be at most 100 KB' }, { status: 400 })
  }

  let structuredContent: string
  try {
    const parsed = JSON.parse(body)
    structuredContent = JSON.stringify({
      ...((parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : { body: parsed }),
      brand,
      audience,
      topic: topic || title,
      workflow: 'CENTRAL_AI_CONTENT',
      createdBy: g.user.email,
    })
  } catch {
    structuredContent = JSON.stringify({
      body,
      brand,
      audience,
      topic: topic || title,
      workflow: 'CENTRAL_AI_CONTENT',
      createdBy: g.user.email,
    })
  }

  const item = await db.contentAsset.create({
    data: {
      type,
      title,
      content: structuredContent,
      language,
      voice: voice || null,
      status: 'DRAFT',
      safeContent: true,
      metrics: JSON.stringify({ views: 0, clicks: 0, conversions: 0, note: 'No analytics provider connected yet' }),
    },
    select: { id: true, type: true, language: true, voice: true, title: true, content: true, status: true, createdAt: true, updatedAt: true },
  })

  await audit({
    actor: g.user.email,
    action: 'CENTRAL_CONTENT_DRAFT_CREATED',
    userId: g.user.id,
    details: { contentId: item.id, type: item.type, language: item.language, brand: brand || null },
    ip: g.ip,
  })

  return Response.json({ ok: true, item }, { status: 201 })
}
