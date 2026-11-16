import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit } from '@/lib/security'
import { nextReaCode } from '@/lib/ids'
import { captureTarget } from '@/lib/rea/fetch-target'
import { buildTeardown } from '@/lib/rea/teardown'
import { admitTarget, CAPTURE_CONTRACT, REA_LIMITS, targetKindSupport } from '@/lib/rea/target-policy'
import { FINGERPRINT_CATALOGUE_SIZE } from '@/lib/rea/fingerprint'
import { REA_TARGET_KINDS, REA_UNSUPPORTED_TARGETS } from '@/lib/rea/evidence'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// REA Studio — target list and analysis.
//
// GET  returns prior teardowns plus this deployment's honest capability matrix.
// POST captures one target and produces one evidence-bound teardown.
//
// A refusal is persisted as a row with status REFUSED and its reason, because
// "we declined to fetch that" is a result an operator needs to see — not an
// error to swallow.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g

  const url = new URL(req.url)
  const q = sanitizeText(url.searchParams.get('q') ?? '', 80)
  const status = sanitizeText(url.searchParams.get('status') ?? '', 24).toUpperCase()

  const targets = await db.reaTarget.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ host: { contains: q } }, { code: { contains: q } }, { url: { contains: q } }] } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, code: true, kind: true, url: true, host: true, status: true,
      httpStatus: true, bytes: true, renderModel: true, evidenceId: true,
      observedCount: true, inferredCount: true, routeCandidates: true,
      endpointCandidates: true, coverageComplete: true, refusalCode: true,
      refusalReason: true, durationMs: true, createdAt: true,
      _count: { select: { reconstructions: true } },
    },
  })

  return Response.json({
    targets,
    capabilities: {
      // Reported, never decorated: what this deployment can and cannot do.
      supportedKinds: REA_TARGET_KINDS.map((kind) => ({ kind, ...targetKindSupport(kind) })),
      unsupportedTargets: REA_UNSUPPORTED_TARGETS,
      fingerprintCatalogueSize: FINGERPRINT_CATALOGUE_SIZE,
      limits: REA_LIMITS,
      captureContract: CAPTURE_CONTRACT,
      engine: {
        browserAttached: false,
        executesJavaScript: false,
        crawls: false,
        decompiles: false,
        recoversSource: false,
        note: 'Static HTTP capture only. The post-hydration DOM, accessibility tree, runtime network calls, console output and workers are UNKNOWN, and are reported as such in every teardown.',
      },
    },
  })
}

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN', rateLimitPerMin: 12 })
  if (isResponse(g)) return g

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const rawUrl = sanitizeText(body.url ?? '', 2048)
  const kind = sanitizeText(body.kind ?? '', 24)
  const question = sanitizeText(body.question ?? '', 500) || null
  // Operator-pasted markup. Analysed with no network access at all.
  const snippet = typeof body.html === 'string' ? body.html.slice(0, REA_LIMITS.maxBytes) : ''

  const actor = g.user.email
  const requestedKind = kind.toUpperCase()
  const isSnippet = requestedKind === 'HTML_SNIPPET'

  // HTML_SNIPPET is the only kind that needs no capture; everything else is
  // admitted through the same SSRF policy before a single byte is requested.
  // The admission result is kept and reused — never recomputed, so the kind we
  // persist is provably the kind we admitted.
  const admission = isSnippet ? null : admitTarget({ rawUrl, kind, env: process.env as Record<string, string | undefined> })

  if (!isSnippet && admission && !admission.admitted) {
    const refused = await persistRefusal({
      actor,
      rawUrl: rawUrl || '(empty)',
      kind: kind || 'WEBSITE',
      question,
      code: admission.code,
      reason: admission.reason,
      ip: g.ip,
    })
    return Response.json({ refused: true, target: refused }, { status: 422 })
  }
  if (isSnippet && !snippet.trim()) {
    return Response.json({ error: 'HTML_SNIPPET requires the markup to analyse in `html`.' }, { status: 422 })
  }

  const resolvedKind = admission?.admitted ? admission.kind : 'HTML_SNIPPET'

  const code = await nextReaCode()
  const startedAt = Date.now()

  let html = snippet
  let headers: Array<[string, string]> = []
  let httpStatus = 0
  let bytes = Buffer.byteLength(snippet)
  let digest: string | null = null
  let finalUrl = rawUrl
  let captureLimitations: Array<{ code: string; detail: string }> = []
  let robots: { fetched: boolean; sitemaps: string[]; disallowCount: number } | null = null
  let sitemap: { fetched: boolean; locs: string[]; truncated: boolean } | null = null
  let subresources: Array<{ url: string; text: string; bytes: number; status: number; error?: string }> = []
  let host = ''

  if (isSnippet) {
    captureLimitations = [
      { code: 'source.operator-supplied', detail: 'The markup was supplied by the operator, not fetched. Its origin, completeness and currency are unknown.' },
      { code: 'network.not-used', detail: 'No network request was made for this target kind.' },
    ]
    finalUrl = `snippet:${code}`
    host = 'operator-supplied'
    httpStatus = 0
  } else {
    const capture = await captureTarget({
      rawUrl,
      kind: admission?.admitted ? admission.kind : undefined,
      operator: actor,
      env: process.env as Record<string, string | undefined>,
    })

    if (!capture.ok && !capture.html) {
      const refused = await persistRefusal({
        actor,
        rawUrl: capture.url || rawUrl,
        kind: kind || 'WEBSITE',
        question,
        code: capture.limitations[0]?.code ?? 'capture.failed',
        reason: capture.error ?? 'Capture failed.',
        ip: g.ip,
        code_: code,
        durationMs: capture.durationMs,
      })
      return Response.json({ refused: true, target: refused, limitations: capture.limitations }, { status: 502 })
    }

    html = capture.html
    headers = capture.headers
    httpStatus = capture.status
    bytes = capture.bytes
    digest = capture.digest
    finalUrl = capture.finalUrl
    captureLimitations = capture.limitations
    robots = capture.robots
    sitemap = capture.sitemap
    subresources = capture.subresources.map((s) => ({ url: s.url, text: s.text, bytes: s.bytes, status: s.status, ...(s.error ? { error: s.error } : {}) }))
    try { host = new URL(capture.finalUrl).hostname } catch { host = sanitizeText(rawUrl, 191) }
  }

  const teardown = buildTeardown({
    kind: resolvedKind,
    url: isSnippet ? `snippet:${code}` : rawUrl,
    finalUrl,
    html,
    headers,
    status: httpStatus,
    bytes,
    digest: digest ?? undefined,
    subresources,
    robots,
    sitemap,
    captureLimitations,
    question: question ?? undefined,
  })

  const findings = teardown.evidence.normalizedResult.findings
  const stack = teardown.evidence.normalizedResult.fingerprints

  const target = await db.reaTarget.create({
    data: {
      code,
      kind: resolvedKind,
      url: isSnippet ? `snippet:${code}` : rawUrl.slice(0, 2000),
      finalUrl: finalUrl.slice(0, 2000),
      host: host.slice(0, 191),
      question,
      status: 'ANALYZED',
      httpStatus,
      bytes,
      digest,
      renderModel: teardown.evidence.normalizedResult.renderModel.model,
      evidenceId: teardown.evidence.evidenceId,
      evidence: JSON.stringify(teardown.evidence),
      teardown: JSON.stringify(teardown.report),
      spoken: teardown.spoken,
      markdown: teardown.markdown,
      limitations: JSON.stringify(teardown.evidence.limitations),
      unknowns: JSON.stringify(teardown.evidence.unknowns),
      observedCount: stack.filter((s) => s.authority === 'OBSERVED').length,
      inferredCount: stack.filter((s) => s.authority === 'INFERRED').length,
      routeCandidates: teardown.report.routeCandidates.length,
      endpointCandidates: teardown.report.endpointCandidates.length,
      coverageComplete: teardown.evidence.coverage.complete,
      durationMs: Date.now() - startedAt,
      createdBy: actor,
    },
  })

  await audit({
    actor,
    action: 'REA_TARGET_ANALYZED',
    entityType: 'ReaTarget',
    entityId: target.id,
    userId: g.user.id,
    ip: g.ip,
    details: {
      code, host, kind: resolvedKind, status: httpStatus, bytes,
      evidenceId: teardown.evidence.evidenceId,
      findings: findings.length,
      observed: stack.filter((s) => s.authority === 'OBSERVED').length,
      inferred: stack.filter((s) => s.authority === 'INFERRED').length,
      limitations: teardown.evidence.limitations.length,
      unknowns: teardown.evidence.unknowns.length,
    },
  })

  return Response.json({
    target,
    evidenceId: teardown.evidence.evidenceId,
    summaryLine: teardown.report.summaryLine,
    report: teardown.report,
    spoken: teardown.spoken,
    endpoints: {
      detail: `/api/admin/rea/targets/${target.id}`,
      markdown: `/api/admin/rea/targets/${target.id}/teardown?format=markdown`,
      spoken: `/api/admin/rea/targets/${target.id}/teardown?format=spoken`,
      reconstruct: `/api/admin/rea/targets/${target.id}/reconstruct`,
    },
  }, { status: 201 })
}

async function persistRefusal(input: {
  actor: string
  rawUrl: string
  kind: string
  question: string | null
  code: string
  reason: string
  ip: string
  code_?: string
  durationMs?: number
}) {
  const code = input.code_ ?? (await nextReaCode())
  let host = ''
  try { host = new URL(input.rawUrl).hostname } catch { host = input.rawUrl.slice(0, 100) }

  const target = await db.reaTarget.create({
    data: {
      code,
      kind: (input.kind || 'WEBSITE').slice(0, 24),
      url: input.rawUrl.slice(0, 2000),
      host: host.slice(0, 191),
      question: input.question,
      status: 'REFUSED',
      refusalCode: input.code.slice(0, 60),
      refusalReason: input.reason.slice(0, 1000),
      durationMs: input.durationMs ?? null,
      createdBy: input.actor,
    },
  })

  await audit({
    actor: input.actor,
    action: 'REA_TARGET_REFUSED',
    entityType: 'ReaTarget',
    entityId: target.id,
    details: { code, host, refusal: input.code, reason: input.reason.slice(0, 300) },
    ip: input.ip,
  })

  return target
}

