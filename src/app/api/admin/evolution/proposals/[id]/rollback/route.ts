import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, sanitizeText } from '@/lib/security'
import type { EvolutionPatch } from '@/lib/evolution/policy'
import { ACCESSORS } from '@/lib/evolution/surfaces'
import { refreshGenerationSummary } from '@/lib/evolution/observations'

export const dynamic = 'force-dynamic'

/**
 * POST — undo an applied self-modification.
 *
 * Every APPLIED proposal stores the exact value it replaced
 * (`beforeSnapshot`, captured by reading the live target at apply time, not
 * from the proposal's own claim). Rollback writes that value back and verifies
 * the read-back, so "reversible" is a tested property rather than a promise.
 *
 * Rollback is available forever and does not expire. If an evolved value turns
 * out to be wrong three weeks later, the operator can still undo it in one call
 * without reconstructing what the previous value was.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN', rateLimitPerMin: 20 })
  if (isResponse(g)) return g
  const { id } = await params
  const actor = g.user.email
  const note = sanitizeText((await req.json().catch(() => ({})) as Record<string, unknown>).note ?? '', 1000)

  const proposal = await db.evolutionProposal.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!proposal) return Response.json({ error: 'Evolution proposal not found.' }, { status: 404 })

  if (proposal.status === 'ROLLED_BACK') {
    return Response.json({ error: 'This proposal was already rolled back.', rolledBackAt: proposal.rolledBackAt }, { status: 409 })
  }
  if (proposal.status !== 'APPLIED') {
    return Response.json(
      { error: `Only an APPLIED proposal can be rolled back; this one is ${proposal.status}. A proposal that was never applied changed nothing, so there is nothing to undo.` },
      { status: 409 },
    )
  }
  if (!proposal.beforeSnapshot) {
    // Should be unreachable: apply always stores the snapshot. Reported rather
    // than silently "succeeded", because a rollback that cannot restore is not
    // a rollback.
    return Response.json({ error: 'This proposal has no stored before-snapshot, so it cannot be reversed automatically. Restore the value manually and record it in the audit trail.' }, { status: 409 })
  }

  const patch = safeParse(proposal.patch) as EvolutionPatch | null
  if (!patch) return Response.json({ error: 'The stored patch is unreadable, so the target key cannot be resolved.' }, { status: 409 })

  const before = safeParse(proposal.beforeSnapshot) as Record<string, unknown> | null
  if (!before) return Response.json({ error: 'The stored before-snapshot is unreadable.' }, { status: 409 })

  const accessor = ACCESSORS[proposal.surface as keyof typeof ACCESSORS]
  if (!accessor) return Response.json({ error: `No accessor is registered for surface ${proposal.surface}.` }, { status: 409 })

  const read = await accessor.read(patch.targetKey)
  if (!read.found) {
    return Response.json({ error: `The target "${patch.targetKey}" no longer exists, so the snapshot cannot be written back. ${read.reason}` }, { status: 409 })
  }

  // Claim first: two concurrent rollbacks must not both write.
  const claimed = await db.evolutionProposal.updateMany({
    where: { id: proposal.id, status: 'APPLIED' },
    data: { status: 'ROLLED_BACK', rolledBackAt: new Date(), decisionNote: note || 'Rolled back by a Super Admin.', updatedAt: new Date() },
  })
  if (claimed.count !== 1) {
    return Response.json({ error: 'This proposal was already claimed by a concurrent rollback.' }, { status: 409 })
  }

  const written = await accessor.write(patch.targetKey, before, [])
  if (!written.ok) {
    // The claim is reversed so the proposal does not read as rolled back when
    // the value is still the evolved one. State must match reality.
    await db.evolutionProposal.update({ where: { id: proposal.id }, data: { status: 'APPLIED', rolledBackAt: null, failureReason: `Rollback failed: ${written.reason}`.slice(0, 1000), updatedAt: new Date() } })
    await audit({ actor, action: 'EVOLUTION_ROLLBACK_FAILED', entityType: 'EvolutionProposal', entityId: proposal.id, userId: g.user.id, ip: g.ip, details: { code: proposal.code, reason: written.reason.slice(0, 300) } })
    return Response.json({ rolledBack: false, code: written.code, error: written.reason, state: 'still evolved' }, { status: 409 })
  }

  await db.$transaction([
    db.evolutionGeneration.update({
      where: { generation: proposal.generation },
      data: { rolledBack: { increment: 1 } },
    }),
  ])

  // A rolled-back change is not an applied one; the summary must say so.
  await refreshGenerationSummary(proposal.generation)

  await audit({
    actor,
    action: 'EVOLUTION_ROLLED_BACK',
    entityType: 'EvolutionProposal',
    entityId: proposal.id,
    userId: g.user.id,
    ip: g.ip,
    details: { code: proposal.code, generation: proposal.generation, surface: proposal.surface, targetKey: patch.targetKey, note: note.slice(0, 300), verified: true },
  })

  return Response.json({
    rolledBack: true,
    verified: true,
    code: proposal.code,
    surface: proposal.surface,
    targetKey: patch.targetKey,
    restored: written.verified,
    note: written.note,
    generation: proposal.generation,
  })
}

function safeParse(value: string | null): unknown {
  if (!value) return null
  try { return JSON.parse(value) } catch { return null }
}
