import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const { id } = await params
  const error = await db.errorLog.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!error) return Response.json({ error: 'Error not found' }, { status: 404 })
  const raw = await readJson(req)
  const note = sanitizeText(raw.note, 1000)
  await db.errorLog.update({ where: { id: error.id }, data: { resolved: true, resolvedAt: new Date(), resolvedBy: g.user.email } })
  await audit({ actor: g.user.email, action: 'ERROR_RESOLVED', userId: g.user.id, entityId: error.id, details: { source: error.source, note } })
  return Response.json({ ok: true, message: `Error [${error.source}] marked resolved.` })
}
