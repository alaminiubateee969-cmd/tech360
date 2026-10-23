import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/compliance-audit
 *
 * Read-only business audit log endpoint accessible to roles holding the
 * `audit.read` capability (`SUPER_ADMIN` and `AUDITOR`). Never exposes AI
 * workforce system prompts, secrets, or session tokens.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { capability: 'audit.read', capabilityOnly: true })
  if (isResponse(g)) return g

  const sp = req.nextUrl.searchParams
  const clientId = sanitizeText(sp.get('clientId') ?? '', 40)
  const entityType = sanitizeText(sp.get('entityType') ?? '', 60)
  const action = sanitizeText(sp.get('action') ?? '', 80)
  const take = Math.min(250, Math.max(1, Number(sp.get('limit') ?? 100) || 100))

  const where: Record<string, unknown> = {}
  if (clientId) where.clientId = clientId
  if (entityType) where.entityType = entityType
  if (action) where.action = action

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      actor: true,
      action: true,
      entityType: true,
      entityId: true,
      clientId: true,
      details: true,
      ip: true,
      createdAt: true,
    },
  })

  return Response.json({ logs })
}
