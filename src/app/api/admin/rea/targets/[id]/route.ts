import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit } from '@/lib/security'
import { recordObservation } from '@/lib/evolution/observations'

export const dynamic = 'force-dynamic'

/**
 * GET  one teardown in full — Evidence record, report, limitations, unknowns.
 * POST an operator correction, which becomes an Evolution Loop observation.
 *
 * The correction path is what makes the loop evidence-driven rather than
 * speculative: the agent does not invent things to improve, it improves what an
 * operator actually told it was wrong. Corrections never change the stored
 * teardown — the original evidence stays intact and the correction is recorded
 * alongside it, so the record shows both what was claimed and what a human said
 * about it.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const { id } = await params

  const target = await db.reaTarget.findUnique({
    where: { id: sanitizeText(id, 40) },
    include: { reconstructions: { orderBy: { createdAt: 'desc' }, take: 20 } },
  })
  if (!target) return Response.json({ error: 'REA target not found.' }, { status: 404 })

  const corrections = await db.setting.findMany({
    where: { key: { startsWith: `rea.observation.${target.id}.` } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })

  return Response.json({
    target: { ...target, evidence: undefined, teardown: undefined, markdown: undefined },
    evidence: safeParse(target.evidence),
    report: safeParse(target.teardown),
    limitations: safeParse(target.limitations) ?? [],
    unknowns: safeParse(target.unknowns) ?? [],
    corrections: corrections.map((c) => safeParse(c.value)),
    formats: {
      markdown: `/api/admin/rea/targets/${target.id}/teardown?format=markdown`,
      spoken: `/api/admin/rea/targets/${target.id}/teardown?format=spoken`,
      json: `/api/admin/rea/targets/${target.id}/teardown?format=json`,
    },
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'ADMIN', rateLimitPerMin: 30 })
  if (isResponse(g)) return g
  const { id } = await params

  const target = await db.reaTarget.findUnique({ where: { id: sanitizeText(id, 40) }, select: { id: true, code: true, host: true, status: true } })
  if (!target) return Response.json({ error: 'REA target not found.' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const kind = sanitizeText(body.kind ?? 'TEARDOWN_CORRECTED', 48).toUpperCase()
  const detail = sanitizeText(body.detail ?? '', 800)
  const subject = sanitizeText(body.subject ?? '', 120) || null

  if (!detail.trim()) {
    return Response.json({ error: 'A correction needs `detail`: what was wrong, in your words.' }, { status: 422 })
  }

  const observation = await recordObservation({
    kind,
    detail,
    subject,
    ref: `${target.code} (${target.host})`,
    refId: target.id,
    actor: g.user.email,
  })

  await audit({
    actor: g.user.email,
    action: 'REA_CORRECTION_RECORDED',
    entityType: 'ReaTarget',
    entityId: target.id,
    userId: g.user.id,
    ip: g.ip,
    details: { kind, subject, detail: detail.slice(0, 300) },
  })

  return Response.json({
    recorded: true,
    observation,
    note: 'Recorded as an Evolution Loop observation. It changes nothing by itself — it becomes a proposal only when the loop next runs, and a proposal changes nothing until a different human approves it.',
    nextStep: 'POST /api/admin/evolution/proposals to turn pending observations into reviewable proposals.',
  }, { status: 201 })
}

function safeParse(value: string | null): unknown {
  if (!value) return null
  try { return JSON.parse(value) } catch { return null }
}
