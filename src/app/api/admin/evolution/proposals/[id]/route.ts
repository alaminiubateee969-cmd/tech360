import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, clientIp, sanitizeText } from '@/lib/security'
import { SURFACE_SPECS, assertNotSelfApproval, type EvolutionPatch } from '@/lib/evolution/policy'
import { refreshGenerationSummary } from '@/lib/evolution/observations'
import { previewSurface } from '@/lib/evolution/surfaces'

export const dynamic = 'force-dynamic'

/**
 * GET  one proposal in full: the patch, its computed risk and why, the
 *      observations behind it, a live before/after preview, and its approval.
 * POST a human decision, delegated to the platform's existing approval
 *      decision route so the RBAC rule, the atomic claim and the audit trail
 *      are literally the same code path as every other sensitive action —
 *      one implementation, not a second one that can drift.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const { id } = await params

  const proposal = await db.evolutionProposal.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!proposal) return Response.json({ error: 'Evolution proposal not found.' }, { status: 404 })

  const approval = proposal.approvalId
    ? await db.approvalRequest.findUnique({ where: { id: proposal.approvalId } })
    : null

  const patch = safeParse(proposal.patch) as EvolutionPatch | null
  // A live preview: what the value is right now, and what it would become.
  // Recomputed on every read, so a stale proposal shows its own staleness.
  const preview = patch
    ? await previewSurface(proposal.surface as never, patch.targetKey, patch.ops)
    : { ok: false as const, code: 'PATCH_UNREADABLE', reason: 'The stored patch is not readable.' }

  const spec = SURFACE_SPECS[proposal.surface as keyof typeof SURFACE_SPECS]

  return Response.json({
    proposal: {
      ...proposal,
      patch: safeParse(proposal.patch),
      evidence: safeParse(proposal.evidence) ?? [],
      riskReasons: safeParse(proposal.riskReasons) ?? [],
      beforeSnapshot: safeParse(proposal.beforeSnapshot),
      afterSnapshot: safeParse(proposal.afterSnapshot),
    },
    surface: spec ?? null,
    preview: preview.ok
      ? { ok: true, label: preview.label, before: preview.before, after: preview.after }
      : { ok: false, code: preview.code, reason: preview.reason },
    approval: approval
      ? {
          id: approval.id,
          type: approval.type,
          status: approval.status,
          risk: approval.risk,
          requestedBy: approval.requestedBy,
          decidedBy: approval.decidedBy,
          decisionNote: approval.decisionNote,
          executedAt: approval.executedAt,
          createdAt: approval.createdAt,
        }
      : null,
    actions: {
      approve: approval && approval.status === 'PENDING' ? `POST /api/admin/evolution/proposals/${proposal.id} {decision:"APPROVED"}` : null,
      reject: approval && approval.status === 'PENDING' ? `POST /api/admin/evolution/proposals/${proposal.id} {decision:"REJECTED"}` : null,
      apply: approval && approval.status === 'APPROVED' ? `POST /api/admin/evolution/proposals/${proposal.id}/apply` : null,
      rollback: proposal.status === 'APPLIED' ? `POST /api/admin/evolution/proposals/${proposal.id}/rollback` : null,
    },
    reminder: 'Deciding a proposal changes nothing by itself. The value changes only when a Super Admin calls /apply, which re-runs every check.',
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  const { id } = await params

  const proposal = await db.evolutionProposal.findUnique({
    where: { id: sanitizeText(id, 40) },
    select: { id: true, approvalId: true, status: true },
  })
  if (!proposal) return Response.json({ error: 'Evolution proposal not found.' }, { status: 404 })
  if (!proposal.approvalId) {
    return Response.json({ error: 'This proposal has no linked ApprovalRequest, so there is nothing to decide.' }, { status: 409 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const decision = sanitizeText(body.decision ?? '', 20).toUpperCase()
  if (decision !== 'APPROVED' && decision !== 'REJECTED') {
    return Response.json({ error: 'decision must be APPROVED or REJECTED.' }, { status: 400 })
  }

  // ---- the proposer may never be the decider ----
  // Enforced HERE, before delegating, so the operator gets an immediate refusal
  // instead of approving successfully and only failing later at apply. Both
  // sides are compared in the same identity space: ApprovalRequest.requestedBy
  // and the session's user id.
  //
  // Rejecting your own proposal is still allowed — refusing your own idea is
  // not a privilege escalation, and blocking it would strand proposals nobody
  // else wants to triage.
  if (decision === 'APPROVED') {
    const linked = await db.approvalRequest.findUnique({
      where: { id: proposal.approvalId },
      select: { requestedBy: true },
    })
    const selfApproval = assertNotSelfApproval({
      proposedBy: linked?.requestedBy ?? '',
      decidedBy: g.user.id,
    })
    if (!selfApproval.ok) {
      await audit({
        actor: g.user.email,
        action: 'EVOLUTION_SELF_APPROVAL_REFUSED',
        entityType: 'EvolutionProposal',
        entityId: proposal.id,
        userId: g.user.id,
        details: { reason: selfApproval.code, requestedBy: linked?.requestedBy ?? null },
        ip: clientIp(req),
      })
      return Response.json({
        error: 'SELF_APPROVAL_FORBIDDEN',
        message: `You ran the cycle that produced ${proposal.id}, so you are the proposing actor and cannot approve it. A different SUPER_ADMIN must decide. Rejecting it yourself is allowed.`,
        requestedBy: linked?.requestedBy ?? null,
        decidedBy: g.user.id,
      }, { status: 409 })
    }
  }

  // Delegate to the existing decision route. Forwarding the original headers
  // keeps the session and CSRF checks authoritative there rather than
  // duplicated here.
  const { POST: decide } = await import('@/app/api/admin/approvals/[id]/decision/route')
  const forwarded = new NextRequest(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({ decision, note: sanitizeText(body.note ?? '', 2000) }),
  })
  const result = await decide(forwarded, { params: Promise.resolve({ id: proposal.approvalId }) })

  // Mirror the human decision onto the proposal row so the lineage reads
  // correctly without joining the approvals table.
  const payload = await result.clone().json().catch(() => ({})) as Record<string, unknown>
  if (decision === 'REJECTED' || payload?.ok) {
    await db.evolutionProposal.updateMany({
      where: { id: proposal.id, status: 'PENDING' },
      data: {
        status: decision === 'REJECTED' ? 'REJECTED' : 'APPROVED',
        decidedBy: g.user.email,
        decisionNote: sanitizeText(body.note ?? '', 2000) || null,
        updatedAt: new Date(),
      },
    })
    if (decision === 'REJECTED') {
      const generation = (await db.evolutionProposal.findUnique({ where: { id: proposal.id }, select: { generation: true } }))!.generation
      await db.evolutionGeneration
        .update({ where: { generation }, data: { rejected: { increment: 1 } } })
        .catch(() => null)
      // Keep the stored summary consistent with the counters it sits beside.
      await refreshGenerationSummary(generation)
    }
  }

  return Response.json({
    ...(payload as object),
    proposalId: proposal.id,
    proposalStatus: decision === 'REJECTED' ? 'REJECTED' : 'APPROVED',
    nextStep: decision === 'REJECTED'
      ? 'Rejected. Nothing was changed and nothing can be applied.'
      : `Approved. The value has NOT changed yet — POST /api/admin/evolution/proposals/${proposal.id}/apply to apply it, which re-runs every check.`,
  }, { status: result.status })
}

function safeParse(value: string | null): unknown {
  if (!value) return null
  try { return JSON.parse(value) } catch { return null }
}
