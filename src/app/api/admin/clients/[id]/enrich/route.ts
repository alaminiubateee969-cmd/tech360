import { NextRequest } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { featureEnabled } from '@/lib/features'
import { runAgent, rememberMemory } from '@/lib/agents/engine'
import { audit, readJson, sanitizeText } from '@/lib/security'
import { SERVICES } from '@/data/site'

export const dynamic = 'force-dynamic'

// ============================================================
// AI LEAD ENRICHMENT — CRM-003 "Ledger" market-intelligence dossier
//
// GET  : returns the latest stored dossier (if any) + the suggested
//        website URL extracted from the lead record.
// POST : runs the real enrichment agent over real CRM data, with an
//        optional live website fetch (firecrawl-style page_reader)
//        that becomes PRIMARY evidence for the agent. Everything is
//        honest: a failed fetch is reported, never hidden; the client
//        score is deliberately NOT touched (that is the scoring
//        agent's job).
// ============================================================

const MEMORY_SCOPE = 'CLIENT'
const MEMORY_KEY = 'AI_RESEARCH_DOSSIER'
const AGENT_CODE = 'CRM-003'
const THROTTLE_MS = 2 * 60_000 // honest agent-quota protection

type EnrichRecommendedService = { service: string; reasoning: string }

type EnrichDossier = {
  companySnapshot: string
  industryAnalysis: string
  recommendedServices: EnrichRecommendedService[]
  talkingPoints: string[]
  risks: string[]
  budgetExpectation: string
  recommendedPlan: string
  priorityScore: number
  followUpRecommendation: string
  confidenceNote: string
}

type EnrichWebResearch = {
  ok: boolean
  url: string
  fetchedAt?: string
  error?: string
  chars?: number
  title?: string
}

type DossierEnvelope = {
  dossier: EnrichDossier
  executionId: string | null
  generatedAt: string
  webResearch?: EnrichWebResearch
}

// ------------------------------------------------------------
// Website URL validation — public http(s) only, never ourselves
// ------------------------------------------------------------
function parseWebsiteUrl(raw: unknown): { ok: true; url: string } | { ok: false } {
  if (typeof raw !== 'string') return { ok: false }
  const s = raw.trim()
  if (!s || s.length > 300) return { ok: false }
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return { ok: false }
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false }
  const host = u.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local')) return { ok: false }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return { ok: false } // bare IP
  if (host.includes('bdtech360.com')) return { ok: false } // never research ourselves
  return { ok: true, url: u.toString() }
}

// ------------------------------------------------------------
// Live fetch (page_reader) — firecrawl-style evidence gathering
// ------------------------------------------------------------
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000)
}

async function fetchWebsiteText(url: string): Promise<{ result: EnrichWebResearch; text: string | null }> {
  const fetchedAt = new Date().toISOString()
  try {
    const zai = await ZAI.create()
    const page = await zai.functions.invoke('page_reader', { url })
    const html = page?.data?.html
    if (page.code !== 200 || !html) {
      return {
        result: { ok: false, url, fetchedAt, error: `page_reader returned code ${page.code ?? 'unknown'} — no readable page` },
        text: null,
      }
    }
    const text = htmlToText(html)
    if (text.length < 80) {
      return {
        result: { ok: false, url, fetchedAt, error: 'the fetched page contained almost no readable text' },
        text: null,
      }
    }
    return {
      result: {
        ok: true,
        url,
        fetchedAt,
        chars: text.length,
        title: sanitizeText(page.data.title ?? url, 200),
      },
      text,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { result: { ok: false, url, fetchedAt, error: message }, text: null }
  }
}

// ------------------------------------------------------------
// Stored-envelope parsing (defensive — never trust old JSON blindly)
// ------------------------------------------------------------
function parseEnvelope(content: string): DossierEnvelope | null {
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const d = r.dossier
  if (!d || typeof d !== 'object') return null
  const dRec = d as Record<string, unknown>
  if (typeof dRec.companySnapshot !== 'string' || typeof dRec.priorityScore !== 'number') return null
  let webResearch: EnrichWebResearch | undefined
  const w = r.webResearch
  if (
    w && typeof w === 'object' &&
    typeof (w as Record<string, unknown>).url === 'string' &&
    typeof (w as Record<string, unknown>).ok === 'boolean'
  ) {
    webResearch = w as EnrichWebResearch
  }
  return {
    dossier: d as EnrichDossier,
    executionId: typeof r.executionId === 'string' ? r.executionId : null,
    generatedAt: typeof r.generatedAt === 'string' ? r.generatedAt : '',
    webResearch,
  }
}

// ------------------------------------------------------------
// Agent-output validation + sanitization (reject unusable dossiers)
// ------------------------------------------------------------
function validateDossier(raw: Record<string, unknown> | null): EnrichDossier | null {
  if (!raw) return null
  const str = (v: unknown, max: number, required: boolean): string | null => {
    if (typeof v !== 'string') return required ? null : ''
    const s = sanitizeText(v, max)
    return required && !s ? null : s
  }
  const companySnapshot = str(raw.companySnapshot, 4000, true)
  const industryAnalysis = str(raw.industryAnalysis, 4000, true)
  const budgetExpectation = str(raw.budgetExpectation, 2000, true)
  const recommendedPlan = str(raw.recommendedPlan, 4000, true)
  const followUpRecommendation = str(raw.followUpRecommendation, 2000, true)
  const confidenceNote = str(raw.confidenceNote, 1200, true)
  const scoreRaw = raw.priorityScore
  if (
    companySnapshot === null || industryAnalysis === null || budgetExpectation === null ||
    recommendedPlan === null || followUpRecommendation === null || confidenceNote === null
  ) return null
  if (typeof scoreRaw !== 'number' || !Number.isFinite(scoreRaw)) return null
  const priorityScore = Math.max(0, Math.min(100, Math.round(scoreRaw)))

  const recommendedServices = Array.isArray(raw.recommendedServices)
    ? (raw.recommendedServices as unknown[])
        .slice(0, 8)
        .map((s) => {
          const rec = (s ?? {}) as Record<string, unknown>
          return { service: sanitizeText(rec.service, 120), reasoning: sanitizeText(rec.reasoning, 600) }
        })
        .filter((s) => s.service)
    : []
  const talkingPoints = Array.isArray(raw.talkingPoints)
    ? (raw.talkingPoints as unknown[])
        .slice(0, 10)
        .map((t) => sanitizeText(t, 600))
        .filter(Boolean)
    : []
  const risks = Array.isArray(raw.risks)
    ? (raw.risks as unknown[])
        .slice(0, 10)
        .map((t) => sanitizeText(t, 600))
        .filter(Boolean)
    : []

  return {
    companySnapshot,
    industryAnalysis,
    recommendedServices,
    talkingPoints,
    risks,
    budgetExpectation,
    recommendedPlan,
    priorityScore,
    followUpRecommendation,
    confidenceNote,
  }
}

// ------------------------------------------------------------
// GET — latest stored dossier + suggested website URL
// ------------------------------------------------------------
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (isResponse(g)) return g
  const { id } = await params
  const ref = sanitizeText(id, 40)

  const client = await db.client.findFirst({
    where: { OR: [{ id: ref }, { clientId: ref }] },
    include: { lead: true },
  })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  const memory = await db.aiMemory.findFirst({
    where: { scope: MEMORY_SCOPE, key: MEMORY_KEY, clientId: client.id },
    orderBy: { updatedAt: 'desc' },
  })
  const envelope = memory ? parseEnvelope(memory.content) : null

  // suggested website: first http(s) URL found in the lead record, validated
  const hay = `${client.lead?.sourceDetails ?? ''}\n${client.lead?.requirements ?? ''}`
  const m = hay.match(/https?:\/\/[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:[^\s)"'<>]*)?/i)
  const suggested = m ? parseWebsiteUrl(m[0]) : { ok: false as const }

  return Response.json({
    ok: true,
    dossier: envelope?.dossier ?? null,
    agentCode: memory?.agentCode ?? AGENT_CODE,
    executedAt: envelope?.generatedAt || (memory ? memory.updatedAt.toISOString() : null),
    executionId: envelope?.executionId ?? null,
    webResearch: envelope?.webResearch ?? null,
    suggestedWebsiteUrl: suggested.ok ? suggested.url : null,
  })
}

// ------------------------------------------------------------
// POST — run the real enrichment agent (with optional live fetch)
// ------------------------------------------------------------
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (isResponse(g)) return g
  const { id } = await params
  const ref = sanitizeText(id, 40)

  if (!(await featureEnabled('ai_agents'))) {
    return Response.json(
      { error: 'AI agent execution is currently disabled by Super Admin (System → Feature Management) — lead enrichment cannot run.' },
      { status: 403 },
    )
  }

  const client = await db.client.findFirst({
    where: { OR: [{ id: ref }, { clientId: ref }] },
    include: {
      lead: true,
      communications: { orderBy: { createdAt: 'desc' }, take: 3 },
    },
  })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  // honest 2-minute throttle — protects agent quota, returns the fresh dossier
  const existing = await db.aiMemory.findFirst({
    where: { scope: MEMORY_SCOPE, key: MEMORY_KEY, clientId: client.id },
    orderBy: { updatedAt: 'desc' },
  })
  if (existing) {
    const envelope = parseEnvelope(existing.content)
    if (envelope?.generatedAt && Date.now() - new Date(envelope.generatedAt).getTime() < THROTTLE_MS) {
      return Response.json({
        ok: true,
        cached: true,
        dossier: envelope.dossier,
        agentCode: AGENT_CODE,
        executedAt: envelope.generatedAt,
        executionId: envelope.executionId,
        webResearch: envelope.webResearch ?? null,
      })
    }
  }

  const raw = await readJson(req)

  // optional website URL — validated strictly before any fetch is attempted
  let websiteUrl: string | null = null
  if (raw.websiteUrl !== undefined && raw.websiteUrl !== null && String(raw.websiteUrl).trim() !== '') {
    const parsed = parseWebsiteUrl(raw.websiteUrl)
    if (!parsed.ok) {
      return Response.json(
        { error: 'Invalid website URL — must be a public http(s) address (localhost/private/IP and our own domain are rejected).' },
        { status: 400 },
      )
    }
    websiteUrl = parsed.url
  }

  // live web research (firecrawl-style) — failures are reported, never faked
  let webResult: EnrichWebResearch | null = null
  let webText: string | null = null
  if (websiteUrl) {
    const fetched = await fetchWebsiteText(websiteUrl)
    webResult = fetched.result
    webText = fetched.text
  }

  // prompt built from REAL CRM data only
  const emailDomain = client.email?.includes('@') ? client.email.split('@')[1] : ''
  const comms = client.communications
    .map((c) => `[${c.channel} ${c.direction}] ${(c.subject ? `${c.subject} — ` : '') + (c.body ?? '')}`.slice(0, 160))
    .join('\n')
  const services = SERVICES.map((s) => `- ${s.title}: ${s.tagline}`).join('\n')

  const input = [
    'Enrich the following lead record into a market-intelligence dossier.',
    '',
    'CLIENT RECORD',
    `Name: ${client.name}`,
    `Business name: ${client.businessName ?? '—'}`,
    `Business type: ${client.businessType ?? '—'}`,
    `Email domain: ${emailDomain || '—'}`,
    `Country: ${client.country ?? '—'}`,
    `Source: ${client.source}`,
    `Status: ${client.status} · Pipeline stage: ${client.pipelineStage}`,
    `Current lead score (do not recompute, context only): ${client.score}`,
    client.notes ? `Notes: ${sanitizeText(client.notes, 800)}` : 'Notes: —',
    '',
    'LEAD INTAKE',
    `Project type: ${client.lead?.projectType ?? '—'}`,
    `Budget range: ${client.lead?.budgetRange ?? '—'}`,
    `Interest: ${client.lead?.interest ?? '—'}`,
    `Requirements: ${sanitizeText(client.lead?.requirements ?? '', 1500) || '—'}`,
    '',
    'MOST RECENT COMMUNICATIONS',
    comms || '— none recorded —',
    '',
    'TECH360 SERVICE CATALOG (recommendedServices must use these names)',
    services,
  ]
  if (webText) {
    input.push(
      '',
      `WEBSITE CONTENT (fetched live from ${websiteUrl} — PRIMARY evidence; ground companySnapshot and industryAnalysis here first):`,
      '"""',
      webText,
      '"""',
    )
  }
  input.push(
    '',
    'Return STRICT JSON only, exactly this shape:',
    '{',
    '  "companySnapshot": "who this business is and how they sell (≤4000 chars)",',
    '  "industryAnalysis": "their vertical, typical pains, buying behavior (≤4000 chars)",',
    '  "recommendedServices": [{ "service": "exact catalog name", "reasoning": "why, tied to their stated needs (≤600 chars)" }] (max 8),',
    '  "talkingPoints": ["concrete conversation openers"] (max 10, ≤600 chars each),',
    '  "risks": ["deal or delivery risks observed in the record"] (max 10),',
    '  "budgetExpectation": "realistic budget expectation with reasoning (≤2000 chars)",',
    '  "recommendedPlan": "phased engagement plan (≤4000 chars)",',
    '  "priorityScore": 0-100 integer — how urgently TECH360 should follow up,',
    '  "followUpRecommendation": "concrete next step with timing (≤2000 chars)",',
    '  "confidenceNote": "what this dossier is grounded in and what is inferred (≤1200 chars)"',
    '}',
  )
  const prompt = input.join('\n')

  const run = await runAgent(AGENT_CODE, {
    input: prompt,
    expectJson: true,
    clientId: client.id,
    workflow: 'LEAD_ENRICHMENT',
    contextNote:
      'You are Ledger, CRM Keeper Agent, enriching a lead record for TECH360 LLC (enterprise software, automation & digital transformation, bdtech360.com). This is an internal staff-facing dossier — be concrete, honest and commercially useful. Output strict JSON only.',
  })
  if (!run.ok) {
    return Response.json({ error: `AI research failed: ${run.error}` }, { status: 502 })
  }

  const dossier = validateDossier(run.json)
  if (!dossier) {
    return Response.json(
      { error: 'CRM-003 completed but returned no usable dossier (missing or malformed fields) — nothing was saved. Try again.' },
      { status: 502 },
    )
  }

  const generatedAt = new Date().toISOString()
  await rememberMemory({
    scope: MEMORY_SCOPE,
    key: MEMORY_KEY,
    clientId: client.id,
    agentCode: AGENT_CODE,
    importance: 8,
    content: JSON.stringify({
      dossier,
      executionId: run.executionId,
      generatedAt,
      ...(webResult ? { webResearch: webResult } : {}),
    }),
  })

  await audit({
    actor: g.user.email,
    action: 'LEAD_ENRICHED',
    userId: g.user.id,
    clientId: client.id,
    entityType: 'CLIENT',
    entityId: client.id,
    details: {
      agentCode: AGENT_CODE,
      executionId: run.executionId,
      priorityScore: dossier.priorityScore,
      industry: dossier.industryAnalysis.slice(0, 200),
      services: dossier.recommendedServices.map((s) => s.service),
      ...(webResult ? { webResearch: { ok: webResult.ok, url: webResult.url } } : {}),
    },
  })

  return Response.json({
    ok: true,
    dossier,
    agentCode: AGENT_CODE,
    executedAt: generatedAt,
    executionId: run.executionId,
    webResearch: webResult,
  })
}
