import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit } from '@/lib/security'
import { assertPublicUrl, UnsafeUrlError } from '@/lib/safe-fetch'

export const dynamic = 'force-dynamic'

// Feed Hub — public RSS/Atom/JSON sources that the platform reads server-side.
// These are industry sources the team reacts to; the platform never republishes
// third-party text, it records a signal and creates an original content idea.
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g

  const sources = await db.feedSource.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  const recent = await db.feedItem.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
  return Response.json({ sources, recentItems: recent })
}

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const name = sanitizeText(body.name ?? '', 120).trim()
  const rawUrl = String(body.url ?? '').trim()
  const category = sanitizeText(body.category ?? 'INDUSTRY', 40).toUpperCase()
  const autoIdea = body.autoIdea === undefined ? true : Boolean(body.autoIdea)

  if (!name) return Response.json({ error: 'A source name is required.' }, { status: 400 })
  if (!rawUrl) return Response.json({ error: 'A feed URL is required.' }, { status: 400 })

  let url: string
  try {
    // SSRF guard: only public http(s) hosts may be stored as a feed source.
    url = (await assertPublicUrl(rawUrl)).toString()
  } catch (err) {
    const message = err instanceof UnsafeUrlError ? err.message : 'Feed URL is not a public http(s) URL.'
    return Response.json({ error: message }, { status: 400 })
  }

  const existing = await db.feedSource.findFirst({ where: { url } })
  if (existing) return Response.json({ error: 'That feed URL is already registered.', source: existing }, { status: 409 })

  const source = await db.feedSource.create({
    data: { name, url, kind: 'RSS', category, autoIdea, status: 'IDLE' },
  })
  await audit({ actor: g.user.email, action: 'FEED_SOURCE_ADDED', userId: g.user.id, entityId: source.id, details: { name, category } })

  return Response.json({ source, next: `POST /api/admin/feeds/sources/${source.id} with {"action":"ingest"} to fetch it now.` }, { status: 201 })
}
