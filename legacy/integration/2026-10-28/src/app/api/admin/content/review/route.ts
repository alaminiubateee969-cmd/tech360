import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { featureEnabled } from '@/lib/features'
import { runAgent } from '@/lib/agents/engine'
import { audit, readJson, sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

// ============================================================
// AI WRITING REVIEW — CST-020 "Muse" editorial pass
//
// POST /api/admin/content/review
//   body: { subject?: string (≤200), body: string (≥20 chars), kind: 'blog'|'newsletter'|'email' }
//
// LanguageTool/humanizer parity: the agent reviews the draft against
// the TECH360 brand voice rules, quotes exact problematic text and
// gives a concrete suggestion. Honest cache: an identical request
// within 60s returns the stored review instead of re-running the
// agent. A provider failure is a 502 with the real error — never a
// fabricated review.
// ============================================================

const AGENT_CODE = 'CST-020'
const CACHE_TTL_MS = 60_000

type ReviewIssue = {
  type: 'grammar' | 'tone' | 'clarity' | 'seo' | 'brand'
  severity: 'high' | 'medium' | 'low'
  quote: string
  suggestion: string
}

type ReviewResult = {
  overallScore: number
  verdict: 'approve' | 'approve-with-edits' | 'rewrite'
  summary: string
  issues: ReviewIssue[]
}

type ReviewResponse = {
  ok: true
  review: ReviewResult
  cached: boolean
  agentCode: string
  executionId: string
  executedAt: string
}

const VALID_TYPES = new Set(['grammar', 'tone', 'clarity', 'seo', 'brand'])
const VALID_SEVERITIES = new Set(['high', 'medium', 'low'])
const VALID_VERDICTS = new Set(['approve', 'approve-with-edits', 'rewrite'])
const VALID_KINDS = new Set(['blog', 'newsletter', 'email'])
const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

// honest 60s identical-request cache (module-level, keyed by content hash)
const reviewCache = new Map<string, { at: number; response: ReviewResponse }>()

function cacheKey(subject: string, body: string, kind: string): string {
  return createHash('sha256').update(`${kind}\u0000${subject}\u0000${body}`).digest('hex')
}

function validateReview(raw: Record<string, unknown> | null): ReviewResult | null {
  if (!raw) return null
  const scoreRaw = raw.overallScore
  if (typeof scoreRaw !== 'number' || !Number.isFinite(scoreRaw)) return null
  const overallScore = Math.max(0, Math.min(100, Math.round(scoreRaw)))
  const verdictRaw = raw.verdict
  if (typeof verdictRaw !== 'string' || !VALID_VERDICTS.has(verdictRaw)) return null
  const summary = sanitizeText(raw.summary, 600)
  if (!summary) return null
  const issues: ReviewIssue[] = (Array.isArray(raw.issues) ? (raw.issues as unknown[]) : [])
    .map((i) => {
      const rec = (i ?? {}) as Record<string, unknown>
      return {
        type: typeof rec.type === 'string' ? rec.type : '',
        severity: typeof rec.severity === 'string' ? rec.severity : '',
        quote: sanitizeText(rec.quote, 300),
        suggestion: sanitizeText(rec.suggestion, 600),
      }
    })
    // only keep well-formed, quotable issues — an issue we cannot point at is not an issue
    .filter((i) => VALID_TYPES.has(i.type) && VALID_SEVERITIES.has(i.severity) && i.quote !== '')
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
    .slice(0, 10) as ReviewIssue[]
  return {
    overallScore,
    verdict: verdictRaw as ReviewResult['verdict'],
    summary,
    issues,
  }
}

export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (isResponse(g)) return g

  if (!(await featureEnabled('ai_agents'))) {
    return Response.json(
      { error: 'AI agent execution is currently disabled by Super Admin (System → Feature Management) — writing review cannot run.' },
      { status: 403 },
    )
  }

  const raw = await readJson(req)
  const subject = sanitizeText(raw.subject, 200)
  const body = typeof raw.body === 'string' ? raw.body.trim() : ''
  const kindRaw = typeof raw.kind === 'string' ? raw.kind : ''
  if (!VALID_KINDS.has(kindRaw)) {
    return Response.json({ error: "kind must be one of 'blog', 'newsletter', 'email'." }, { status: 400 })
  }
  const kind = kindRaw as 'blog' | 'newsletter' | 'email'
  if (body.length < 20) {
    return Response.json({ error: 'Content too short to review — write at least a few sentences.' }, { status: 400 })
  }

  // honest cache — identical request within 60s returns the stored review
  const key = cacheKey(subject, body, kind)
  const hit = reviewCache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return Response.json({ ...hit.response, cached: true })
  }

  const input = [
    `Review this ${kind} draft for TECH360 LLC (enterprise software, automation & digital transformation, bdtech360.com).`,
    subject ? `Subject / title: ${subject}` : '',
    '',
    'BRAND VOICE RULES',
    '- Plain, direct language with engineering credibility',
    "- No hype words ('revolutionary', 'game-changing' and similar) — honest claims only",
    '- Active voice, short sentences',
    '- Concrete over vague: numbers, outcomes and mechanisms beat adjectives',
    '',
    'DRAFT',
    '"""',
    body,
    '"""',
    '',
    'Find issues of type grammar | tone | clarity | seo | brand with severity high | medium | low.',
    'Quote the EXACT problematic text from the draft and give a concrete suggestion.',
    'Order issues from most to least severe.',
    '',
    'Return STRICT JSON only, exactly this shape:',
    '{',
    '  "overallScore": 0-100 integer (100 = publish as-is),',
    '  "verdict": "approve" | "approve-with-edits" | "rewrite",',
    '  "summary": "one honest editorial verdict (≤600 chars)",',
    '  "issues": [{ "type": "grammar|tone|clarity|seo|brand", "severity": "high|medium|low", "quote": "exact text from the draft", "suggestion": "concrete fix" }] (max 10)',
    '}',
  ].join('\n')

  const run = await runAgent(AGENT_CODE, {
    input,
    expectJson: true,
    workflow: 'CONTENT_REVIEW',
  })
  if (!run.ok) {
    return Response.json({ error: `AI review failed: ${run.error}` }, { status: 502 })
  }

  const review = validateReview(run.json)
  if (!review) {
    return Response.json(
      { error: 'CST-020 completed but returned no usable review (missing or malformed fields) — nothing was shown. Try again.' },
      { status: 502 },
    )
  }

  const response: ReviewResponse = {
    ok: true,
    review,
    cached: false,
    agentCode: AGENT_CODE,
    executionId: run.executionId,
    executedAt: new Date().toISOString(),
  }
  // keep the cache small — prune expired entries when it grows
  if (reviewCache.size > 100) {
    const now = Date.now()
    for (const [k, v] of reviewCache) {
      if (now - v.at >= CACHE_TTL_MS) reviewCache.delete(k)
    }
  }
  reviewCache.set(key, { at: Date.now(), response })

  await audit({
    actor: g.user.email,
    action: 'CONTENT_REVIEWED',
    userId: g.user.id,
    details: { kind, score: review.overallScore, verdict: review.verdict, issueCount: review.issues.length, executionId: run.executionId },
  })

  return Response.json(response)
}
