import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'

/** Read-only queue of public intake records withheld from automatic Client linking. */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g

  const where = { status: 'PENDING_REVIEW' }
  const [rows, total] = await Promise.all([
    db.formSubmission.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 101,
      select: {
        id: true,
        clientRequestId: true,
        form: true,
        name: true,
        email: true,
        details: true,
        preferredContact: true,
        createdAt: true,
      },
    }),
    db.formSubmission.count({ where }),
  ])

  const items = rows.slice(0, 100).map((row) => ({
    id: row.id,
    form: row.form,
    requestRef: row.form === 'CHAT'
      ? row.id.replace(/^chat_/, '')
      : row.clientRequestId ?? row.id,
    name: row.name,
    email: row.email,
    details: row.details?.slice(0, 1000) ?? null,
    preferredContact: row.preferredContact,
    createdAt: row.createdAt.toISOString(),
  }))

  return Response.json({ items, total, hasMore: rows.length > 100 }, { headers: { 'Cache-Control': 'no-store' } })
}
