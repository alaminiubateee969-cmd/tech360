import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { buildIdentityBackfillPreview } from '@/lib/identity-policy'

export const dynamic = 'force-dynamic'

/** Read-only diagnostics. Existing unverified contact fields are never linked or returned. */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  try {
    const limit = 10_000
    const rows = await db.client.findMany({
      orderBy: { id: 'asc' },
      take: limit + 1,
      select: { id: true, clientId: true, email: true, phone: true, whatsapp: true },
    })
    const truncated = rows.length > limit
    const preview = buildIdentityBackfillPreview(rows.slice(0, limit))
    return Response.json({ ...preview, truncated }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Identity preview is unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
