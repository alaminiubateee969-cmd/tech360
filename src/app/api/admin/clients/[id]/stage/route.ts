import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { PIPELINE_STAGES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

function stageIndex(s: string): number {
  return PIPELINE_STAGES.indexOf(s as (typeof PIPELINE_STAGES)[number])
}

/**
 * PATCH /api/admin/clients/[id]/stage
 * Body: { pipelineStage: string }
 * - STAFF can move forward one stage (or stay); backward or skip requires MANAGER+.
 * - SUPER_ADMIN can move arbitrarily (including CLOSED).
 * - Validates stage exists, prevents duplicate writes, audit-logs, creates AutomationLog entry,
 *   handles concurrent updates via optimistic check on current stage.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g

  const { id } = await params
  const ref = sanitizeText(id, 40)
  const body = await readJson(req).catch(() => ({} as Record<string, unknown>))
  const nextStageRaw = sanitizeText(String(body.pipelineStage ?? body.stage ?? ''), 40).toUpperCase()
  if (!nextStageRaw) return Response.json({ error: 'pipelineStage required' }, { status: 400 })
  if (!PIPELINE_STAGES.includes(nextStageRaw as (typeof PIPELINE_STAGES)[number])) {
    return Response.json({ error: `Invalid stage: ${nextStageRaw}` }, { status: 400 })
  }

  const client = await db.client.findFirst({ where: { OR: [{ id: ref }, { clientId: ref }], select: { id: true, clientId: true, name: true, businessName: true, pipelineStage: true, status: true, updatedAt: true } } })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  const curIdx = stageIndex(client.pipelineStage)
  const nxtIdx = stageIndex(nextStageRaw)
  const curStage = client.pipelineStage
  const nextStage = nextStageRaw

  if (curStage === nextStage) {
    return Response.json({ ok: true, clientId: client.clientId, pipelineStage: curStage, message: 'Already at this stage' })
  }

  // Forward one step allowed for STAFF; larger forward / backward requires MANAGER+, arbitrary requires SUPER_ADMIN
  const isForwardOne = nxtIdx === curIdx + 1
  const isForward = nxtIdx > curIdx
  const isBackward = nxtIdx < curIdx
  const rank: Record<string, number> = { STAFF: 1, MANAGER: 2, ADMIN: 3, SUPER_ADMIN: 4 }
  const roleRank = rank[g.user.role ?? 'STAFF'] ?? 1

  if (isForwardOne) {
    // allowed for all STAFF+
  } else if (isForward && nxtIdx <= curIdx + 3 && roleRank >= 2) {
    // MANAGER can skip up to 3 forward (correction)
  } else if (isBackward && roleRank >= 2) {
    // MANAGER can move backward (reopen)
  } else if (roleRank >= 4) {
    // SUPER_ADMIN arbitrary
  } else {
    return Response.json({ error: `Stage transition from ${curStage} to ${nextStage} requires higher role. STAFF may move forward one stage at a time.` }, { status: 403 })
  }

  // Concurrent update guard: ensure stage hasn't changed since read (re-read)
  const fresh = await db.client.findUnique({ where: { id: client.id }, select: { pipelineStage: true } })
  if (fresh?.pipelineStage !== curStage) {
    return Response.json({ error: `Conflict: stage changed to ${fresh?.pipelineStage} by another user. Please refresh.` }, { status: 409 })
  }

  const updated = await db.client.update({
    where: { id: client.id },
    data: {
      pipelineStage: nextStage,
      status: nextStage === 'COMPLETED' || nextStage === 'CLOSED' ? 'CLOSED' : nxtIdx >= 9 ? (client.status === 'LEAD' ? 'CLIENT' : client.status) : client.status,
    },
  })

  await db.auditLog.create({
    data: {
      actor: g.user.email,
      userId: g.user.id,
      action: 'CLIENT_STAGE_MOVED',
      entityType: 'Client',
      entityId: client.id,
      clientId: client.clientId,
      details: JSON.stringify({ from: curStage, to: nextStage, via: 'kanban', movedBy: g.user.email }),
    },
  }).catch(() => null)

  await db.automationLog.create({
    data: {
      workflow: 'KANBAN_STAGE_MOVE',
      trigger: 'KANBAN',
      correlationId: `kanban-${client.id}-${Date.now()}`,
      clientId: client.id,
      input: JSON.stringify({ from: curStage, to: nextStage }),
      output: JSON.stringify({ ok: true }),
      status: 'SUCCESS',
      steps: JSON.stringify([{ step: 'stage_moved', detail: { from: curStage, to: nextStage, movedBy: g.user.email }, at: new Date().toISOString() }]),
      finishedAt: new Date(),
    },
  }).catch(() => null)

  await audit({ actor: g.user.email, userId: g.user.id, action: 'KANBAN_STAGE_MOVE', clientId: client.clientId, details: { from: curStage, to: nextStage } }).catch(() => null)

  return Response.json({ ok: true, clientId: updated.clientId, pipelineStage: updated.pipelineStage, previousStage: curStage, message: `Moved ${client.clientId} from ${curStage} to ${nextStage}` })
}
