import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit } from '@/lib/security'
import { safeFetch } from '@/lib/safe-fetch'
import { parseFeed, ideaFromItem } from '@/lib/feeds/parse'

export const dynamic = 'force-dynamic'

const MAX_INGEST = 40

// PATCH /api/admin/feeds/sources/[id]
//   { action: 'ingest' }  → really fetch the feed, store new items, optionally
//                           create an original content idea per new item.
//   { name?, category?, autoIdea?, status? } → edit the source.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const { id } = await params

  const source = await db.feedSource.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!source) return Response.json({ error: 'Feed source not found.' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = sanitizeText(body.action ?? '', 20).toLowerCase()

  if (action !== 'ingest') {
    const updated = await db.feedSource.update({
      where: { id: source.id },
      data: {
        ...(body.name !== undefined ? { name: sanitizeText(body.name, 120) || source.name } : {}),
        ...(body.category !== undefined ? { category: sanitizeText(body.category, 40).toUpperCase() || source.category } : {}),
        ...(body.autoIdea !== undefined ? { autoIdea: Boolean(body.autoIdea) } : {}),
      },
    })
    await audit({ actor: g.user.email, action: 'FEED_SOURCE_UPDATED', userId: g.user.id, entityId: source.id })
    return Response.json({ source: updated })
  }

  // ── real ingest ────────────────────────────────────────────────────────────
  let fetched
  try {
    fetched = await safeFetch(source.url, { maxBytes: 900_000, timeoutMs: 12_000, maxRedirects: 3 })
  } catch (err) {
    const reason = `Fetch failed: ${(err as Error).message}`
    await db.feedSource.update({ where: { id: source.id }, data: { status: 'ERROR', lastError: reason.slice(0, 2000), lastFetchedAt: new Date() } })
    return Response.json({ error: reason, state: 'ERROR' }, { status: 502 })
  }

  if (fetched.status < 200 || fetched.status >= 300) {
    const reason = `Feed responded HTTP ${fetched.status}.`
    await db.feedSource.update({ where: { id: source.id }, data: { status: 'ERROR', lastError: reason, lastFetchedAt: new Date() } })
    return Response.json({ error: reason, state: 'ERROR' }, { status: 502 })
  }

  const contentType = fetched.headers.get('content-type') ?? ''
  const parsed = parseFeed(fetched.body, contentType)
  if (!parsed.ok) {
    await db.feedSource.update({ where: { id: source.id }, data: { status: 'ERROR', lastError: parsed.reason.slice(0, 2000), lastFetchedAt: new Date() } })
    return Response.json({ error: parsed.reason, state: 'ERROR', kind: parsed.kind }, { status: 422 })
  }

  const items = parsed.items.slice(0, MAX_INGEST)
  const guids = items.map((i) => i.guid)
  const already = await db.feedItem.findMany({ where: { sourceId: source.id, guid: { in: guids } }, select: { guid: true } })
  const existing = new Set(already.map((a) => a.guid))
  const fresh = items.filter((i) => !existing.has(i.guid))

  let ideasCreated = 0
  for (const item of fresh) {
    let ideaAssetId: string | null = null
    if (source.autoIdea) {
      const idea = ideaFromItem(item, source.name)
      const asset = await db.contentAsset.create({
        data: {
          type: 'OPPORTUNITY',
          language: 'EN',
          title: idea.title,
          content: JSON.stringify({ kind: 'FEED_SIGNAL', source: source.name, sourceUrl: item.link, angle: idea.angle, body: idea.body, tags: item.tags }),
          status: 'DRAFT',
          safeContent: true,
          metrics: '{}',
        },
      })
      ideaAssetId = asset.id
      ideasCreated += 1
    }
    await db.feedItem.create({
      data: {
        sourceId: source.id,
        guid: item.guid,
        title: item.title,
        link: item.link,
        summary: item.summary,
        publishedAt: item.publishedAt,
        tags: JSON.stringify(item.tags),
        ideaAssetId,
      },
    })
  }

  const total = await db.feedItem.count({ where: { sourceId: source.id } })
  const updated = await db.feedSource.update({
    where: { id: source.id },
    data: {
      status: 'OK',
      kind: parsed.kind,
      lastError: null,
      lastFetchedAt: new Date(),
      itemCount: total,
      ...(parsed.title && parsed.title.length > 0 && source.name.startsWith('http') ? { name: parsed.title.slice(0, 120) } : {}),
    },
  })
  await audit({
    actor: g.user.email,
    action: 'FEED_INGESTED',
    userId: g.user.id,
    entityId: source.id,
    details: { kind: parsed.kind, received: items.length, fresh: fresh.length, ideasCreated },
  })

  return Response.json({ source: updated, kind: parsed.kind, received: items.length, created: fresh.length, skipped: items.length - fresh.length, ideasCreated })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const { id } = await params

  const source = await db.feedSource.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!source) return Response.json({ error: 'Feed source not found.' }, { status: 404 })

  await db.feedItem.deleteMany({ where: { sourceId: source.id } })
  await db.feedSource.delete({ where: { id: source.id } })
  await audit({ actor: g.user.email, action: 'FEED_SOURCE_DELETED', userId: g.user.id, details: { name: source.name } })
  return Response.json({ ok: true, deleted: source.id })
}
