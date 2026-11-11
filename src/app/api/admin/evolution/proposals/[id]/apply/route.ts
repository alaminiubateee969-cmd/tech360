import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, sanitizeText } from '@/lib/security'
import {
  IMMUTABLE_CONTROLS,
  SURFACE_SPECS,
  applyOps,
  assertNotSelfApproval,
  touchesImmutableControl,
  validatePatch,
  type EvolutionPatch,
} from '@/lib/evolution/policy'
import { ACCESSORS, assertPatchWritable, previewSurface } from '@/lib/evolution/surfaces'

export const dynamic = 'force-dynamic'

/**
 * POST — apply ONE approved self-modification.
 *
 * This is the only place in the platform where the agent's own behaviour
 * changes, so it is written to be boring, loud and reversible. Every check
 * below runs again here even though it already ran when the proposal was
 * created — a proposal can sit in the queue for days, and apply is never a
 * trusted operation.
 *
 * Order of checks (each one can stop the apply, and each is audited):
 *   1. The proposal exists and is not already applied.
 *   2. A linked ApprovalRequest exists and a human set it to APPROVED.
 *   3. The approver is not the proposer. The loop proposes as
 *      `evolution-loop:gen-N`; a human must decide, and one human identity
 *      cannot be both.
 *   4. The surface's SUPER_ADMIN requirement matches the decider's role.
 *   5. The patch re-validates against its surface bounds.
 *   6. No op targets an immutable control, and no op targets a field that is
 *      not on the surface's editable allowlist.
 *   7. The target still exists and its current value still matches the
 *      before-snapshot the proposal was computed from. If the world moved, the
 *      patch is stale and is refused rather than blindly applied.
 *   8. The proposal is claimed atomically so two concurrent applies cannot both
 *      write.
 *   9. Write, then READ BACK and verify. A write that does not verify is a
 *      failure, not a success.
 *
 * On any failure the proposal is marked FAILED with its reason and the value is
 * left as it was. Nothing is half-applied.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN', rateLimitPerMin: 20 })
  if (isResponse(g)) return g
  const { id } = await params
  const actor = g.user.email

  const proposal = await db.evolutionProposal.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!proposal) return Response.json({ error: 'Evolution proposal not found.' }, { status: 404 })

  if (proposal.status === 'APPLIED') {
    return Response.json({ error: 'This proposal was already applied. Re-applying would double the change.', appliedAt: proposal.appliedAt, rollback: `/api/admin/evolution/proposals/${proposal.id}/rollback` }, { status: 409 })
  }
  if (proposal.status === 'ROLLED_BACK') {
    return Response.json({ error: 'This proposal was rolled back. Open a new generation rather than re-applying a reverted change.' }, { status: 409 })
  }
  if (proposal.status === 'REJECTED') {
    return Response.json({ error: 'This proposal was rejected by a human. It cannot be applied.' }, { status: 409 })
  }

  // ---- 2. a human approval must exist and be APPROVED ----
  if (!proposal.approvalId) {
    return await fail({ proposal, actor, g, code: 'APPROVAL_MISSING', reason: 'This proposal has no linked ApprovalRequest, so nothing authorized it.' })
  }
  const approval = await db.approvalRequest.findUnique({ where: { id: proposal.approvalId } })
  if (!approval) {
    return await fail({ proposal, actor, g, code: 'APPROVAL_MISSING', reason: `ApprovalRequest ${proposal.approvalId} no longer exists.` })
  }
  if (approval.type !== 'EVOLUTION_APPLY') {
    return await fail({ proposal, actor, g, code: 'APPROVAL_TYPE_MISMATCH', reason: `The linked approval is type ${approval.type}, not EVOLUTION_APPLY.` })
  }
  if (approval.status === 'PENDING') {
    return Response.json({
      error: 'This proposal is still awaiting a human decision. Nothing has been approved yet.',
      approvalId: approval.id,
      decideAt: `/api/admin/approvals/${approval.id}/decision`,
    }, { status: 409 })
  }
  if (approval.status !== 'APPROVED') {
    return await fail({ proposal, actor, g, code: 'APPROVAL_NOT_GRANTED', reason: `The linked approval has status ${approval.status}, not APPROVED.` })
  }

  // ---- 3. the proposer may never be the decider ----
  const selfApproval = assertNotSelfApproval({
    proposedBy: proposal.proposedBy ?? '',
    decidedBy: approval.decidedBy ?? '',
  })
  if (!selfApproval.ok) {
    return await fail({ proposal, actor, g, code: selfApproval.code, reason: selfApproval.reason })
  }

  // ---- 4. surface role requirement ----
  const spec = SURFACE_SPECS[proposal.surface as keyof typeof SURFACE_SPECS]
  if (!spec) {
    return await fail({ proposal, actor, g, code: 'SURFACE_UNKNOWN', reason: `Unknown surface "${proposal.surface}".` })
  }
  if (spec.requiresSuperAdmin && g.user.role !== 'SUPER_ADMIN') {
    return await fail({ proposal, actor, g, code: 'ROLE_INSUFFICIENT', reason: `Surface ${proposal.surface} requires SUPER_ADMIN; the deciding session has role ${g.user.role}.` })
  }

  const patch = safeParse(proposal.patch) as EvolutionPatch | null
  if (!patch || !Array.isArray(patch.ops)) {
    return await fail({ proposal, actor, g, code: 'PATCH_UNREADABLE', reason: 'The stored patch is not readable JSON, so it cannot be applied.' })
  }

  // ---- 5. re-validate the patch ----
  const validation = validatePatch(patch)
  if (!validation.ok) {
    return await fail({ proposal, actor, g, code: validation.code, reason: `Re-validation at apply time failed: ${validation.reason}` })
  }

  // ---- 6. immutable controls and the editable-field allowlist ----
  const controlCheck = touchesImmutableControl({
    path: patch.ops.map((o) => o.path).join(' '),
    text: `${proposal.title} ${proposal.rationale}`,
  })
  if (controlCheck.blocked) {
    return await fail({ proposal, actor, g, code: 'CONTROL_IMMUTABLE', reason: controlCheck.reason, controlId: controlCheck.control?.id })
  }
  const writable = assertPatchWritable(proposal.surface as keyof typeof ACCESSORS, patch.ops)
  if (!writable.ok) {
    return await fail({ proposal, actor, g, code: 'FIELD_NOT_EDITABLE', reason: writable.reason })
  }

  // ---- 7. staleness: the world must still match the before-snapshot ----
  const preview = await previewSurface(proposal.surface as keyof typeof ACCESSORS, patch.targetKey, patch.ops)
  if (!preview.ok) {
    return await fail({ proposal, actor, g, code: preview.code, reason: preview.reason })
  }
  const stale = detectStaleness(patch.before, preview.before)
  if (stale.length) {
    return await fail({
      proposal, actor, g,
      code: 'STALE_PROPOSAL',
      reason: `The live value no longer matches the snapshot this proposal was computed from: ${stale.join('; ')}. Re-run the loop to propose against the current state.`,
    })
  }

  // ---- 8. atomic claim ----
  const claimed = await db.evolutionProposal.updateMany({
    where: { id: proposal.id, status: { in: ['PENDING', 'APPROVED'] } },
    data: { status: 'APPLIED', decidedBy: approval.decidedBy, appliedAt: new Date(), updatedAt: new Date() },
  })
  if (claimed.count !== 1) {
    return Response.json({ error: 'This proposal was already claimed by a concurrent apply.' }, { status: 409 })
  }

  // ---- 9. write, then verify ----
  const accessor = ACCESSORS[proposal.surface as keyof typeof ACCESSORS]
  const after = applyOps(preview.before, patch.ops)
  const written = await accessor.write(patch.targetKey, after, patch.ops)
  if (!written.ok) {
    await db.evolutionProposal.update({
      where: { id: proposal.id },
      data: {
        status: 'FAILED',
        validationCode: written.code,
        failureReason: written.reason.slice(0, 1000),
        beforeSnapshot: JSON.stringify(preview.before).slice(0, 60_000),
        updatedAt: new Date(),
      },
    })
    await audit({ actor, action: 'EVOLUTION_APPLY_FAILED', entityType: 'EvolutionProposal', entityId: proposal.id, userId: g.user.id, ip: g.ip, details: { code: proposal.code, surface: proposal.surface, reason: written.reason.slice(0, 300) } })
    return Response.json({ applied: false, code: written.code, error: written.reason, state: 'unchanged' }, { status: 409 })
  }

  // Read the generation's surface list BEFORE the transaction so no await is
  // hidden inside the transaction array.
  const priorSurfaces = parseArray(await readSurfaces(proposal.generation))

  await db.$transaction([
    db.evolutionProposal.update({
      where: { id: proposal.id },
      data: {
        status: 'APPLIED',
        beforeSnapshot: JSON.stringify(preview.before).slice(0, 60_000),
        afterSnapshot: JSON.stringify(written.verified).slice(0, 60_000),
        validationCode: null,
        failureReason: null,
        updatedAt: new Date(),
      },
    }),
    db.evolutionGeneration.update({
      where: { generation: proposal.generation },
      data: {
        applied: { increment: 1 },
        surfaces: JSON.stringify([...new Set([...priorSurfaces, proposal.surface])]),
        closedAt: new Date(),
      },
    }),
    // The approval is consumed by this apply, exactly once.
    db.approvalRequest.update({
      where: { id: approval.id },
      data: { status: 'EXECUTED', executedAt: new Date(), result: JSON.stringify({ proposalCode: proposal.code, surface: proposal.surface, targetKey: patch.targetKey }).slice(0, 4000) },
    }),
  ])

  await audit({
    actor,
    action: 'EVOLUTION_APPLIED',
    entityType: 'EvolutionProposal',
    entityId: proposal.id,
    userId: g.user.id,
    ip: g.ip,
    details: {
      code: proposal.code,
      generation: proposal.generation,
      surface: proposal.surface,
      targetKey: patch.targetKey,
      ops: patch.ops.map((o) => `${o.op} ${o.path}`),
      risk: proposal.risk,
      approvedBy: approval.decidedBy,
      verified: true,
    },
  })

  return Response.json({
    applied: true,
    verified: true,
    code: proposal.code,
    generation: proposal.generation,
    surface: proposal.surface,
    targetKey: patch.targetKey,
    label: preview.label,
    before: preview.before,
    after: written.verified,
    note: written.note,
    rollback: `/api/admin/evolution/proposals/${proposal.id}/rollback`,
    immutableControlsStillIntact: IMMUTABLE_CONTROLS.length,
  })
}

/**
 * Compares the proposal's before-snapshot with the live value. Only keys the
 * snapshot actually asserts are compared — a snapshot records what the proposal
 * depended on, not the whole document.
 */
function detectStaleness(before: Record<string, unknown>, live: Record<string, unknown>): string[] {
  const drift: string[] = []
  for (const [key, expected] of Object.entries(before ?? {})) {
    const actual = readPath(live, key)
    // Notes (e.g. "snapshotted at apply time") are not assertions about value.
    if (typeof expected === 'string' && /snapshotted at apply time/i.test(expected)) continue
    if (actual === undefined && expected === null) continue
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      drift.push(`${key} was ${JSON.stringify(expected)} and is now ${JSON.stringify(actual)}`)
    }
  }
  return drift
}

function readPath(document: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.').filter(Boolean)
  let cursor: unknown = document
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object') return undefined
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  return cursor
}

async function readSurfaces(generation: number): Promise<string | null> {
  const row = await db.evolutionGeneration.findUnique({ where: { generation }, select: { surfaces: true } })
  return row?.surfaces ?? null
}

async function fail(input: {
  proposal: { id: string; code: string; surface: string }
  actor: string
  g: { user: { id: string }; ip: string }
  code: string
  reason: string
  controlId?: string | null
}) {
  await db.evolutionProposal.update({
    where: { id: input.proposal.id },
    data: { status: 'FAILED', validationCode: input.code.slice(0, 60), failureReason: input.reason.slice(0, 1000), updatedAt: new Date() },
  })
  await audit({
    actor: input.actor,
    action: 'EVOLUTION_APPLY_REFUSED',
    entityType: 'EvolutionProposal',
    entityId: input.proposal.id,
    userId: input.g.user.id,
    ip: input.g.ip,
    details: { code: input.proposal.code, surface: input.proposal.surface, refusal: input.code, reason: input.reason.slice(0, 300), ...(input.controlId ? { controlId: input.controlId } : {}) },
  })
  return Response.json({ applied: false, code: input.code, error: input.reason, state: 'unchanged' }, { status: 409 })
}

function safeParse(value: string | null): unknown {
  if (!value) return null
  try { return JSON.parse(value) } catch { return null }
}
function parseArray(value: unknown): string[] {
  if (typeof value !== 'string') return []
  const parsed = safeParse(value)
  return Array.isArray(parsed) ? parsed.map(String) : []
}
