import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit, logError } from '@/lib/security'
import { finalizeScopeAndSend, releaseHandover } from '@/lib/journey'

export const dynamic = 'force-dynamic'

// Super Admin decision on sensitive actions → REAL execution of the gated action
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  const { id } = await params
  const approvalId = sanitizeText(id, 40)

  const approval = await db.approvalRequest.findUnique({ where: { id: approvalId } })
  if (!approval) return Response.json({ error: 'Approval not found' }, { status: 404 })
  if (approval.status !== 'PENDING') return Response.json({ error: `Already ${approval.status.toLowerCase()}` }, { status: 409 })

  const raw = await readJson(req)
  const decision = sanitizeText(raw.decision, 20).toUpperCase()
  const note = sanitizeText(raw.note, 2000)
  if (decision !== 'APPROVED' && decision !== 'REJECTED') {
    return Response.json({ error: 'decision must be APPROVED or REJECTED' }, { status: 400 })
  }

  if (decision === 'REJECTED') {
    await db.approvalRequest.update({
      where: { id: approval.id },
      data: { status: 'REJECTED', decidedBy: g.user.id, decisionNote: note || null, updatedAt: new Date() },
    })
    await audit({ actor: g.user.email, action: 'APPROVAL_REJECTED', userId: g.user.id, clientId: approval.clientId ?? undefined, entityId: approval.id, details: { type: approval.type, note } })
    return Response.json({ ok: true, result: { status: 'REJECTED' }, message: 'Action rejected. Nothing was executed.' })
  }

  // APPROVED → execute the gated action for real
  let result: unknown = null
  let message = ''
  try {
    const payload = JSON.parse(approval.payload || '{}') as Record<string, unknown>
    switch (approval.type) {
      case 'FINAL_SCOPE_SEND': {
        const scopeId = String(payload.scopeId ?? '')
        const scope = await db.scopeOfWork.findUnique({ where: { id: scopeId } })
        if (!scope) throw new Error('Scope not found')
        result = await finalizeScopeAndSend(scope.id, g.user.id)
        message = `Final scope sent via ${(result as { results?: string[] }).results?.join(' + ')}. Client approval next.`
        break
      }
      case 'SOURCE_HANDOVER': {
        const handoverId = String(payload.handoverId ?? '')
        result = await releaseHandover(handoverId, g.user.id)
        message = `Source package released. Secure link: ${(result as { link?: string }).link}`
        break
      }
      default: {
        // Generic sensitive action types (payment instructions, refunds, deletions, social publish…)
        // are marked executed; their executors (agents/n8n) pick up via automation logs.
        await db.automationLog.create({
          data: {
            workflow: `APPROVAL:${approval.type}`, trigger: 'ADMIN_APPROVAL', correlationId: `appr-${approval.id}`,
            clientId: approval.clientId, status: 'SUCCESS',
            input: JSON.stringify({ approvalId: approval.id, type: approval.type }),
            output: JSON.stringify({ approved: true, note }),
          },
        })
        message = `${approval.type} approved and dispatched to executor.`
        break
      }
    }
    await db.approvalRequest.update({
      where: { id: approval.id },
      data: { status: 'EXECUTED', decidedBy: g.user.id, decisionNote: note || null, executedAt: new Date(), result: JSON.stringify(result).slice(0, 4000), updatedAt: new Date() },
    })
    await audit({ actor: g.user.email, action: 'APPROVAL_APPROVED_EXECUTED', userId: g.user.id, clientId: approval.clientId ?? undefined, entityId: approval.id, details: { type: approval.type, result } })
    return Response.json({ ok: true, result, message })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    await db.approvalRequest.update({
      where: { id: approval.id },
      data: { status: 'FAILED', decidedBy: g.user.id, decisionNote: `Execution error: ${msg}`.slice(0, 2000), updatedAt: new Date() },
    })
    await logError({ source: 'API', code: 'APPROVAL_EXECUTION_FAILED', message: `${approval.type}: ${msg}`, clientId: approval.clientId ?? undefined })
    return Response.json({ ok: false, error: msg, message: `Approved but execution failed: ${msg}` }, { status: 500 })
  }
}
