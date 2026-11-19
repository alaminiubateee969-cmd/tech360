import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText } from '@/lib/security'
import { hasRole, isSuperAdmin } from '@/lib/access-policy'
import { projectClosureEvidence } from '@/lib/lifecycle-gates'

export const dynamic = 'force-dynamic'

const PROJECT_STAGES = ['PLANNING','ACTIVE','DEVELOPMENT','TESTING','CLIENT_REVIEW','DELIVERY','HANDOVER','COMPLETED','ON_HOLD','CANCELLED'] as const

function stageIndex(s: string): number {
  return PROJECT_STAGES.indexOf(s as (typeof PROJECT_STAGES)[number])
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'STAFF', capability: 'project.write' })
  if (isResponse(g)) return g

  const { id } = await params
  const ref = sanitizeText(id, 40)
  const body = await readJson(req).catch(() => ({} as Record<string, unknown>))
  const nextRaw = sanitizeText(String(body.status ?? body.stage ?? ''), 30).toUpperCase()
  if (!nextRaw) return Response.json({ error: 'status required' }, { status: 400 })
  if (!PROJECT_STAGES.includes(nextRaw as (typeof PROJECT_STAGES)[number])) {
    return Response.json({ error: `Invalid status: ${nextRaw}` }, { status: 400 })
  }

  const project = await db.project.findFirst({ where: { OR: [{ id: ref }, { code: ref }] }, select: { id: true, code: true, status: true, updatedAt: true } })
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 })

  const cur = (project.status ?? 'PLANNING').toUpperCase()
  const nxt = nextRaw
  if (cur === nxt) return Response.json({ ok: true, code: project.code, status: cur, message: 'Already at this status' })

  const curIdx = stageIndex(cur)
  const nxtIdx = stageIndex(nxt)
  const manager = hasRole(g.user, 'MANAGER')

  const isForwardOne = curIdx >= 0 && nxtIdx === curIdx + 1
  const isForward = curIdx >= 0 && nxtIdx > curIdx
  const isBackward = curIdx >= 0 && nxtIdx < curIdx

  if (isForwardOne) {
    // capability-authorized project writers can move forward one known stage
  } else if (isForward && nxtIdx <= curIdx + 2 && manager) {
    // MANAGER / PROJECT_MANAGER can skip 2 forward
  } else if (isBackward && manager) {
    // MANAGER / PROJECT_MANAGER can move backward
  } else if (isSuperAdmin(g.user)) {
    // SUPER_ADMIN can also correct an unrecognized legacy status
  } else {
    return Response.json({ error: `Status transition from ${cur} to ${nxt} requires higher role. STAFF may move forward one stage at a time.` }, { status: 403 })
  }

  // Status boards cannot bypass the same persisted evidence required by the
  // journey close action. Validate within the transaction that performs the
  // compare-and-set; cached project totals are not payment evidence.
  const transition = await db.$transaction(async (tx) => {
    if (nxt === 'COMPLETED') {
      const { closure } = await projectClosureEvidence(project.id, tx)
      if (!closure.allowed) return { count: 0, blocked: closure.code }
    }
    const changed = await tx.project.updateMany({
      where: { id: project.id, status: project.status },
      data: { status: nxt, ...(nxt === 'COMPLETED' ? { closedAt: new Date() } : {}) },
    })
    return { count: changed.count, blocked: null }
  }, { isolationLevel: 'Serializable' })
  if (transition.blocked) {
    return Response.json({ error: 'Project completion requires verified full payment, completed tasks, client delivery acceptance and confirmed source handover.', code: transition.blocked }, { status: 409 })
  }
  if (transition.count !== 1) {
    const fresh = await db.project.findUnique({ where: { id: project.id }, select: { status: true } })
    if (!fresh) return Response.json({ error: 'Project not found' }, { status: 404 })
    return Response.json({ error: `Conflict: status changed to ${fresh.status} by another user. Please refresh.` }, { status: 409 })
  }

  const updated = await db.project.findUniqueOrThrow({ where: { id: project.id }, select: { code: true, status: true } })

  await db.auditLog.create({ data: { actor: g.user.email, userId: g.user.id, action: 'PROJECT_STATUS_MOVED', entityType: 'Project', entityId: project.id, details: JSON.stringify({ from: cur, to: nxt, via: 'kanban' }) } }).catch(()=>null)
  await db.automationLog.create({ data: { workflow: 'PROJECT_KANBAN_MOVE', trigger: 'KANBAN', correlationId: `project-kanban-${project.id}-${Date.now()}`, input: JSON.stringify({ from: cur, to: nxt }), output: JSON.stringify({ ok: true }), status: 'SUCCESS', steps: JSON.stringify([{ step: 'status_moved', detail: { from: cur, to: nxt }, at: new Date().toISOString() }]), finishedAt: new Date() } }).catch(()=>null)

  {
    const { emitProjectStatusChanged } = await import('@/lib/automation/domain-events')
    const owner = await db.project.findUnique({ where: { id: project.id }, select: { clientId: true } }).catch(() => null)
    await emitProjectStatusChanged({ projectId: project.id, code: updated.code ?? null, from: cur, to: nxt, clientRowId: owner?.clientId ?? null })
  }

  return Response.json({ ok: true, code: updated.code, status: updated.status, previousStatus: cur, message: `Moved ${project.code ?? project.id} from ${cur} to ${nxt}` })
}
