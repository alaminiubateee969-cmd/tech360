import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, sanitizeText } from '@/lib/security'
import { nextEvolutionCode } from '@/lib/ids'
import { proposeMutations, summarizeGeneration, EVOLUTION_LOOP_STEPS, type Observation } from '@/lib/evolution/loop'
import {
  EVOLUTION_CONTRACT,
  IMMUTABLE_CONTROLS,
  SURFACE_SPECS,
  UNSUPPORTED_MUTATIONS,
  classifyUnsupported,
} from '@/lib/evolution/policy'
import { ACCESSORS } from '@/lib/evolution/surfaces'
import { keysFor, readCurrentGeneration, readHeuristics, readPendingObservations, writeCurrentGeneration } from '@/lib/evolution/observations'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Evolution Loop — governed, approval-gated self-modification.
//
// GET  the honest state: current generation, lineage, what is evolvable, what
//      is permanently immutable, and what this platform refuses to do at all.
// POST run one cycle: observe → propose → gate. It writes proposals and
//      ApprovalRequests. It changes NO behaviour. Nothing evolves here.
//
// The distinction matters and is enforced structurally: this route has no code
// path that writes a governed value. Applying lives in
// proposals/[id]/apply/route.ts and requires a human approval this route did
// not create and cannot grant.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g

  const status = sanitizeText(new URL(req.url).searchParams.get('status') ?? '', 24).toUpperCase()

  const [generation, heuristics, lineage, proposals, observations] = await Promise.all([
    readCurrentGeneration(),
    readHeuristics(),
    db.evolutionGeneration.findMany({ orderBy: { generation: 'desc' }, take: 25 }),
    db.evolutionProposal.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, code: true, generation: true, surface: true, targetKey: true,
        title: true, risk: true, riskScore: true, status: true, approvalId: true,
        proposedBy: true, decidedBy: true, appliedAt: true, rolledBackAt: true,
        validationCode: true, failureReason: true, createdAt: true, effect: true,
      },
    }),
    readPendingObservations(50),
  ])

  return Response.json({
    generation: {
      current: generation,
      hasEvolved: lineage.some((l) => l.applied > 0),
      lineage: lineage.map((l) => ({
        generation: l.generation,
        parentGeneration: l.parentGeneration,
        observations: l.observations,
        proposed: l.proposed,
        applied: l.applied,
        rejected: l.rejected,
        rolledBack: l.rolledBack,
        surfaces: safeParse(l.surfaces) ?? [],
        summary: l.summary,
        startedAt: l.startedAt,
        closedAt: l.closedAt,
      })),
    },
    heuristics: { value: heuristics.value, tuned: heuristics.tuned, storageKey: 'rea.heuristics' },
    pendingObservations: observations,
    proposals: proposals.map((p) => ({
      ...p,
      approvalUrl: p.approvalId ? `/api/admin/approvals/${p.approvalId}` : null,
    })),
    contract: EVOLUTION_CONTRACT,
    loop: EVOLUTION_LOOP_STEPS,
    surfaces: Object.values(SURFACE_SPECS).map((spec) => ({
      ...spec,
      editableFields: ACCESSORS[spec.surface].editableFields,
      protectedFields: ACCESSORS[spec.surface].protectedFields,
    })),
    immutableControls: IMMUTABLE_CONTROLS,
    unsupportedMutations: UNSUPPORTED_MUTATIONS,
  })
}

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN', rateLimitPerMin: 10 })
  if (isResponse(g)) return g

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  // A free-text request is screened before anything else. If someone asks the
  // loop to edit source code or relax a guard, the refusal is the response —
  // not a proposal, and not a silent no-op.
  const requestText = sanitizeText(body.request ?? '', 1000)
  if (requestText) {
    const screening = classifyUnsupported(requestText)
    if (screening.unsupported) {
      await audit({
        actor: g.user.email,
        action: 'EVOLUTION_UNSUPPORTED_REQUEST_REFUSED',
        entityType: 'EvolutionProposal',
        userId: g.user.id,
        ip: g.ip,
        details: { request: requestText.slice(0, 300), refusalId: screening.id },
      })
      return Response.json({
        refused: true,
        refusalId: screening.id,
        error: screening.refusal,
        contract: EVOLUTION_CONTRACT,
      }, { status: 422 })
    }
  }

  const current = await readCurrentGeneration()
  const generation = current + 1
  const { value: heuristics } = await readHeuristics()

  // Observations may be supplied inline (a dry run) or read from the store.
  // A dry run persists nothing at all, so an operator can see what WOULD be
  // proposed before opening a real generation.
  const dryRun = body.dryRun === true
  const inline = Array.isArray(body.observations) ? (body.observations as unknown[]).slice(0, 100) : []
  const stored = await readPendingObservations(200)

  const observations: Observation[] = [
    ...stored.map((o) => ({
      kind: o.kind,
      detail: o.detail,
      ref: o.ref,
      ...(o.surface ? { surface: o.surface } : {}),
      ...(o.subject ? { subject: o.subject } : {}),
      count: o.count,
      at: o.lastAt,
    })),
    ...inline.map((raw) => normalizeInlineObservation(raw)),
  ].filter((o): o is Observation => Boolean(o))

  if (observations.length === 0) {
    return Response.json({
      ran: false,
      generation,
      reason: 'There are no pending observations. The loop does not invent changes when nothing has been observed — that would be drift, not evolution.',
      howToProduceObservations: [
        'POST /api/admin/rea/targets/{id} with a correction after reviewing a teardown.',
        'Discard a reconstruction brief you did not want.',
        'Pass `observations` inline with `dryRun: true` to preview what a signal would produce.',
      ],
    }, { status: 200 })
  }

  const result = proposeMutations({ observations, heuristics, generation })

  if (dryRun) {
    return Response.json({
      ran: true,
      dryRun: true,
      generation,
      persisted: false,
      observations: observations.length,
      proposals: result.proposals.map((p) => ({
        title: p.title, surface: p.surface, targetKey: p.targetKey,
        risk: p.risk.level, riskScore: p.risk.score, riskReasons: p.risk.reasons,
        rationale: p.rationale, effect: p.effect, rollback: p.rollback,
        evidence: p.evidence, ops: p.patch.ops,
      })),
      declined: result.declined,
      refused: result.refused,
      note: 'Dry run. Nothing was persisted and no approval was created.',
    })
  }

  // ---- persist the generation, then the proposals, then the gates ----
  await db.evolutionGeneration.create({
    data: {
      generation,
      parentGeneration: current > 0 ? current : null,
      observations: observations.length,
      proposed: result.proposals.length,
      applied: 0,
      rejected: 0,
      rolledBack: 0,
      surfaces: JSON.stringify([...new Set(result.proposals.map((p) => p.surface))]),
      summary: `Generation ${generation} observed ${observations.length} signal(s) and proposed ${result.proposals.length} change(s). Nothing is applied until each is approved by a human who did not propose it.`,
      startedAt: new Date(),
    },
  })

  const persisted: Array<{ code: string; id: string; title: string; surface: string; risk: string; approvalId: string }> = []

  for (const proposal of result.proposals) {
    const code = await nextEvolutionCode()
    const approval = await db.approvalRequest.create({
      data: {
        type: 'EVOLUTION_APPLY',
        title: `Evolution gen ${generation}: ${proposal.title}`.slice(0, 200),
        description: `${proposal.rationale} Effect if applied: ${proposal.effect} Undo: ${proposal.rollback}`,
        agentCode: null,
        risk: proposal.risk.level,
        status: 'PENDING',
        // The proposer is recorded as the loop, never as the deciding human, so
        // the self-approval check at apply time has something to compare.
        requestedBy: `evolution-loop:gen-${generation}`,
        payload: JSON.stringify({
          generation,
          surface: proposal.surface,
          targetKey: proposal.targetKey,
          ops: proposal.patch.ops,
          riskScore: proposal.risk.score,
          riskReasons: proposal.risk.reasons,
          evidence: proposal.evidence,
          requiresSuperAdmin: SURFACE_SPECS[proposal.surface].requiresSuperAdmin,
        }).slice(0, 60_000),
      },
    })

    const row = await db.evolutionProposal.create({
      data: {
        code,
        generation,
        surface: proposal.surface,
        targetKey: proposal.targetKey,
        title: proposal.title,
        rationale: proposal.rationale,
        effect: proposal.effect,
        rollbackNote: proposal.rollback,
        patch: JSON.stringify(proposal.patch),
        evidence: JSON.stringify(proposal.evidence),
        risk: proposal.risk.level,
        riskScore: proposal.risk.score,
        riskReasons: JSON.stringify(proposal.risk.reasons),
        status: 'PENDING',
        approvalId: approval.id,
        proposedBy: `evolution-loop:gen-${generation}`,
      },
    })

    persisted.push({ code, id: row.id, title: proposal.title, surface: proposal.surface, risk: proposal.risk.level, approvalId: approval.id })
  }

  await writeCurrentGeneration(generation)
  const consumed = await markConsumed(keysFor(stored), generation)

  await audit({
    actor: g.user.email,
    action: 'EVOLUTION_GENERATION_OPENED',
    entityType: 'EvolutionGeneration',
    entityId: String(generation),
    userId: g.user.id,
    ip: g.ip,
    details: {
      generation,
      observations: observations.length,
      proposed: result.proposals.length,
      declined: result.declined.length,
      refused: result.refused.length,
      consumed,
      surfaces: [...new Set(result.proposals.map((p) => p.surface))],
    },
  })

  return Response.json({
    ran: true,
    dryRun: false,
    persisted: true,
    generation,
    parentGeneration: current > 0 ? current : null,
    observations: observations.length,
    consumedObservations: consumed,
    proposals: persisted,
    declined: result.declined,
    refused: result.refused,
    appliedChanges: 0,
    summary: summarizeGeneration({
      generation,
      parentGeneration: current > 0 ? current : null,
      observations: observations.length,
      proposals: result.proposals.map((p) => ({ status: 'PENDING', surface: p.surface })),
      startedAt: new Date().toISOString(),
    }).summary,
    nextStep: persisted.length
      ? `Decide each proposal in Approvals (type EVOLUTION_APPLY), then POST /api/admin/evolution/proposals/{id}/apply. Nothing has changed yet.`
      : 'No proposal survived validation, so no approval was created. See `declined` and `refused` for why.',
  }, { status: 201 })
}

async function markConsumed(keys: string[], generation: number): Promise<number> {
  if (!keys.length) return 0
  let updated = 0
  for (const key of keys) {
    const row = await db.setting.findUnique({ where: { key } })
    if (!row) continue
    const value = safeParse(row.value) as { consumedBy?: number | null } | null
    if (!value) continue
    value.consumedBy = generation
    await db.setting.update({ where: { key }, data: { value: JSON.stringify(value) } })
    updated += 1
  }
  return updated
}

function normalizeInlineObservation(raw: unknown): Observation | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const kind = String(value.kind ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_')
  const valid = [
    'TEARDOWN_CORRECTED', 'FINGERPRINT_FALSE_POSITIVE', 'FINGERPRINT_FALSE_NEGATIVE',
    'CAPTURE_REFUSED', 'CAPTURE_FAILED', 'SKILL_RUN_FAILED', 'SKILL_RUN_SLOW',
    'RECONSTRUCTION_REJECTED', 'OPERATOR_FEEDBACK', 'GUARD_ATTEMPT',
  ]
  if (!valid.includes(kind)) return null
  const detail = String(value.detail ?? '').slice(0, 800)
  if (!detail.trim()) return null
  return {
    kind: kind as Observation['kind'],
    detail,
    ref: String(value.ref ?? 'inline').slice(0, 160),
    ...(typeof value.subject === 'string' && value.subject ? { subject: value.subject.slice(0, 120) } : {}),
    count: Number.isFinite(Number(value.count)) ? Math.max(1, Math.min(1000, Math.floor(Number(value.count)))) : 1,
    at: new Date().toISOString(),
  }
}

function safeParse(value: string | null): unknown {
  if (!value) return null
  try { return JSON.parse(value) } catch { return null }
}
