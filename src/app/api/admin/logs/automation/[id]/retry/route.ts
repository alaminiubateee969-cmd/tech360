import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { retryAutomationLog } from '@/lib/automation-retry'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const { id } = await params
  const log = await db.automationLog.findUnique({ where: { id }, select: { id: true, workflow: true, status: true, attempts: true } })
  if (!log) return Response.json({ error: 'Automation run not found' }, { status: 404 })
  const outcome = await retryAutomationLog(id, { id: g.user.id, email: g.user.email })
  return Response.json({
    ok: outcome.ok,
    message: outcome.message,
    status: outcome.newStatus ?? log.status,
    attempts: outcome.attempts ?? log.attempts,
  })
}
