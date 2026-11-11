import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit } from '@/lib/security'
import { nextReconstructionCode } from '@/lib/ids'
import { buildFiles, buildPlan, normalizeBrief, summarizeFiles, assertNoSecrets } from '@/lib/factory/blueprint'
import { planReconstruction, CLONE_REFUSAL } from '@/lib/rea/reconstruct'
import { recordObservation } from '@/lib/evolution/observations'
import type { TeardownReport } from '@/lib/rea/teardown'

export const dynamic = 'force-dynamic'

/**
 * POST — "build my own version."
 *
 * Turns a stored teardown into an ORIGINAL application through the platform's
 * existing AI Software Factory. Two things are true at once and both are
 * enforced here:
 *
 *   1. The rebuild is informed by the target's observed information
 *      architecture — which pages exist, what the navigation is called, what a
 *      form collects. Those are structural facts.
 *   2. The rebuild shares NO code, copy, brand, colour, image or asset with the
 *      target. `planReconstruction` derives a brief from signals only; the
 *      generator writes its own content. The refusal list is persisted with the
 *      reconstruction so a reviewer can see the boundary was applied.
 *
 * The result is an INTERNAL PROTOTYPE: it is created unbound (no client, no
 * project, no approved scope), so the factory's delivery gate refuses to export
 * it to a client. Getting it to a client means writing a real scope, getting it
 * approved, and binding it — the same path any factory app takes. REA Studio
 * does not get a shortcut around that, and this route does not offer one.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'ADMIN', rateLimitPerMin: 12 })
  if (isResponse(g)) return g
  const { id } = await params

  const target = await db.reaTarget.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!target) return Response.json({ error: 'REA target not found.' }, { status: 404 })
  if (target.status !== 'ANALYZED' || !target.teardown) {
    return Response.json(
      {
        error: `This target has status ${target.status} and no teardown to reconstruct from.`,
        refusalReason: target.refusalReason ?? null,
        hint: 'A refused or failed capture produces no evidence, so there is nothing to build. Re-analyze a reachable target first.',
      },
      { status: 409 },
    )
  }

  const report = safeParse(target.teardown) as TeardownReport | null
  if (!report || !Array.isArray(report.sections)) {
    return Response.json({ error: 'The stored teardown is not readable, so it cannot be reconstructed from. Re-analyze the target.' }, { status: 409 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  // An explicit request to copy is refused, and the refusal is recorded as an
  // observation so the attempt is visible in the lineage.
  const cloneIntent = sanitizeText(body.intent ?? '', 80).toLowerCase()
  if (/^(clone|copy|replica|mirror|pixel-perfect|same design)$/.test(cloneIntent)) {
    await recordObservation({
      kind: 'GUARD_ATTEMPT',
      detail: `A reconstruction was requested with intent "${cloneIntent}" for ${target.host}. Refused: ${CLONE_REFUSAL}`,
      subject: 'clone-request',
      ref: `${target.code} (${target.host})`,
      refId: target.id,
      actor: g.user.email,
    })
    return Response.json({ refused: true, error: CLONE_REFUSAL }, { status: 422 })
  }

  const appName = sanitizeText(body.appName ?? '', 80)
  if (!appName.trim()) {
    return Response.json(
      {
        error: 'An `appName` is required, and it must be YOUR name for the rebuild — never the target\u2019s.',
        boundary: CLONE_REFUSAL,
      },
      { status: 422 },
    )
  }

  // The target's own brand name must not become the rebuild's name.
  const targetHostWords = target.host.replace(/^www\./, '').split(/[.-]/).filter((w) => w.length > 3)
  const leaksBrand = targetHostWords.some((word) => appName.toLowerCase().includes(word.toLowerCase()))
  if (leaksBrand) {
    return Response.json(
      {
        error: `"${appName}" contains the analyzed target's own brand name. Choose an original name for the rebuild.`,
        boundary: CLONE_REFUSAL,
      },
      { status: 422 },
    )
  }

  const reconstruction = planReconstruction({
    report,
    evidenceId: target.evidenceId ?? target.code,
    capturedAt: target.createdAt.toISOString(),
    operator: {
      appName,
      clientName: sanitizeText(body.clientName ?? 'Internal', 80) || 'Internal',
      primaryColor: sanitizeText(body.primaryColor ?? '', 9),
      currency: sanitizeText(body.currency ?? 'GBP', 3),
      language: (['EN', 'BN', 'BOTH'].includes(String(body.language).toUpperCase()) ? String(body.language).toUpperCase() : 'EN') as 'EN' | 'BN' | 'BOTH',
      primaryContact: sanitizeText(body.primaryContact ?? '', 120),
      notes: sanitizeText(body.notes ?? '', 1000),
    },
  })

  const brief = normalizeBrief(reconstruction.brief as unknown as Record<string, unknown>)
  const plan = buildPlan(brief)
  const files = buildFiles(brief, plan)

  const secrets = assertNoSecrets(files)
  if (!secrets.ok) {
    return Response.json({ error: `Generated file ${secrets.path} contains secret-like content — generation aborted.` }, { status: 500 })
  }
  const { fileCount, totalBytes } = summarizeFiles(files)

  const existingCount = await db.generatedApp.count()
  const appCode = `AF-${String(existingCount + 1).padStart(4, '0')}`

  const app = await db.generatedApp.create({
    data: {
      code: appCode,
      name: brief.appName,
      // Deliberately unbound: no client, no project, no scope snapshot. That is
      // what makes this an internal prototype the delivery gate will not export.
      clientId: null,
      projectId: null,
      scopeId: null,
      scopeVersion: null,
      scopeHash: null,
      vertical: brief.vertical,
      brief: JSON.stringify(brief),
      plan: JSON.stringify({ ...plan, derivedFromRea: { evidenceId: target.evidenceId, targetCode: target.code, targetHost: target.host } }),
      status: 'BUILT',
      stage: 'SCAFFOLD',
      fileCount,
      totalBytes,
      createdBy: g.user.email,
    },
  })

  await db.generatedAppFile.createMany({
    data: files.map((file) => ({
      appId: app.id,
      path: file.path,
      language: file.language,
      bytes: Buffer.byteLength(file.content),
      content: file.content,
    })),
  })

  await db.generatedAppEvent.create({
    data: {
      appId: app.id,
      stage: 'SCAFFOLD',
      status: 'BUILT',
      note: `Scaffolded from REA Studio teardown ${target.code} (${target.host}). Original work: no target code, copy, brand or asset was reused.`,
      actor: g.user.email,
    },
  })

  const code = await nextReconstructionCode()
  const lineage = await db.reaReconstruction.create({
    data: {
      code,
      targetId: target.id,
      appId: app.id,
      appCode: app.code,
      brief: JSON.stringify(brief),
      provenance: JSON.stringify(reconstruction.provenance),
      pages: JSON.stringify(reconstruction.pages),
      confidence: reconstruction.confidence,
      status: 'BUILT',
      statement: reconstruction.statement,
      createdBy: g.user.email,
    },
  })

  await audit({
    actor: g.user.email,
    action: 'REA_RECONSTRUCTION_BUILT',
    entityType: 'ReaReconstruction',
    entityId: lineage.id,
    userId: g.user.id,
    ip: g.ip,
    details: {
      code, targetCode: target.code, host: target.host, appCode: app.code,
      evidenceId: target.evidenceId, confidence: reconstruction.confidence,
      modules: brief.modules, vertical: brief.vertical, fileCount, totalBytes,
    },
  })

  return Response.json({
    reconstruction: {
      code: lineage.code,
      confidence: reconstruction.confidence,
      statement: reconstruction.statement,
      pages: reconstruction.pages,
      provenance: reconstruction.provenance,
    },
    app: {
      id: app.id,
      code: app.code,
      name: app.name,
      vertical: app.vertical,
      status: app.status,
      stage: app.stage,
      fileCount,
      totalBytes,
      plan: { pages: plan.pages.length, models: plan.models.length, endpoints: plan.endpoints.length, agents: plan.agents.length, automations: plan.automations.length, notBuilt: plan.notBuilt },
    },
    deliveryGate: {
      exportable: false,
      code: 'SCOPE_SNAPSHOT_MISSING',
      reason: 'This is an internal prototype, created unbound. The factory\u2019s delivery gate refuses to export it to a client until a FINAL scope is written, approved by the client, and bound to this app. REA Studio does not bypass that gate.',
    },
    endpoints: {
      review: `/api/admin/factory/apps/${app.id}`,
      export: `/api/admin/factory/apps/${app.id}/export`,
    },
  }, { status: 201 })
}

function safeParse(value: string | null): unknown {
  if (!value) return null
  try { return JSON.parse(value) } catch { return null }
}
