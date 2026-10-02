import { db } from '@/lib/db'
import { runAgent } from '@/lib/agents/engine'
import { logError } from '@/lib/security'

// ============================================================
// AI-RANKED KNOWLEDGE SEARCH — two honest stages:
//   1. RECALL  — fast keyword scoring over indexed docs (MySQL via Prisma)
//   2. RANK   — Sage (KNW-023) reads candidates + query and
//               returns a 0-100 relevance score with a one-line
//               reason, via a real recorded AiAgentExecution.
// If the AI stage fails, results fall back to keyword order and
// every row is labelled keyword-matched — never faked as AI.
// ============================================================

export type KnowledgeSearchResult = {
  id: string
  title: string
  classification: string
  status: string
  excerpt: string
  keywordScore: number
  relevance: number | null // AI relevance 0-100 (null = keyword-only)
  reason: string | null // why the AI judged it relevant
  rankedBy: 'AI' | 'KEYWORD'
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is',
  'are', 'was', 'were', 'be', 'been', 'it', 'this', 'that', 'as', 'at', 'by',
  'from', 'we', 'our', 'you', 'your', 'their', 'how', 'what', 'when', 'why',
  'does', 'do', 'did', 'can', 'could', 'should', 'would', 'will', 'has', 'have',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
}

// Stage 1 — keyword recall scoring (title hits weigh 3x body hits,
// plus a small prefix/partial-credit bonus for short tokens).
function keywordScore(query: string, title: string, body: string): number {
  const terms = tokenize(query)
  if (terms.length === 0) return 0
  const t = title.toLowerCase()
  const b = body.toLowerCase()
  let score = 0
  for (const term of terms) {
    if (t.includes(term)) score += 3
    else if (b.includes(term)) score += 1
    if (term.length > 4) {
      // crude stem: "payments" also matches "payment"
      const stem = term.replace(/(ies|es|s)$/, '')
      if (stem.length > 3) {
        if (t.includes(stem)) score += 1
        else if (b.includes(stem)) score += 0.5
      }
    }
  }
  return score
}

type Candidate = {
  id: string
  title: string
  classification: string
  status: string
  excerpt: string
  keywordScore: number
}

export async function searchKnowledgeRanked(
  query: string,
  limit = 8,
): Promise<{ results: KnowledgeSearchResult[]; agent: { ok: boolean; executionId: string; error?: string } }> {
  const docs = await db.knowledgeDocument.findMany({
    where: { status: { in: ['INDEXED', 'APPROVED'] } },
    orderBy: { updatedAt: 'desc' },
    take: 200,
    select: {
      id: true, title: true, classification: true, status: true,
      extractedText: true, updatedAt: true,
    },
  })

  const candidates: Candidate[] = docs
    .map((d) => ({
      id: d.id,
      title: d.title,
      classification: d.classification,
      status: d.status,
      excerpt: (d.extractedText ?? '').replace(/\s+/g, ' ').slice(0, 500),
      keywordScore: keywordScore(query, d.title, d.extractedText ?? ''),
    }))
    .filter((c) => c.keywordScore > 0)
    .sort((a, b) => b.keywordScore - a.keywordScore)
    .slice(0, 12)

  if (candidates.length === 0) {
    return { results: [], agent: { ok: true, executionId: '' } }
  }

  // Stage 2 — real AI relevance ranking via Sage (KNW-023).
  const listing = candidates
    .map((c, i) => `[${i}] "${c.title}" :: ${c.excerpt.slice(0, 320)}`)
    .join('\n')
    .slice(0, 8000)

  const run = await runAgent('KNW-023', {
    input: `Query: "${query}"

Candidate documents:
${listing}

Rank every candidate by how well it answers the query. Output STRICT JSON only: {"ranked":[{"i":<candidate index>,"relevance":0-100,"reason":"one short line, max 90 chars"}]}. Order by relevance descending. Include only candidates with relevance >= 20.`,
    expectJson: true,
    workflow: 'KNOWLEDGE_SEARCH',
    contextNote: 'You are ranking knowledge-base documents for relevance to an admin search query. Be strict: exact-topic matches score 80+, related-but-not-answering score 20-60, unrelated score under 20. The reason must say WHAT in the document matches.',
  })

  const agentMeta = { ok: run.ok, executionId: run.executionId, error: run.error }

  if (run.ok && run.json && Array.isArray(run.json.ranked)) {
    const byIndex = new Map<number, { relevance: number; reason: string }>()
    for (const r of run.json.ranked as Array<Record<string, unknown>>) {
      const i = Number(r.i)
      const relevance = Math.max(0, Math.min(100, Math.round(Number(r.relevance) || 0)))
      const reason = String(r.reason ?? '').slice(0, 120)
      if (Number.isInteger(i) && i >= 0 && i < candidates.length && relevance >= 20) {
        byIndex.set(i, { relevance, reason })
      }
    }
    const results: KnowledgeSearchResult[] = []
    for (const [i, rank] of byIndex) {
      const c = candidates[i]
      results.push({
        id: c.id, title: c.title, classification: c.classification, status: c.status,
        excerpt: c.excerpt, keywordScore: c.keywordScore,
        relevance: rank.relevance, reason: rank.reason, rankedBy: 'AI',
      })
    }
    results.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0))
    if (results.length > 0) return { results: results.slice(0, limit), agent: agentMeta }
    // AI ranked nothing >= 20 — fall through to keyword results, honestly labelled.
    await logError({
      source: 'AGENT', code: 'KNOWLEDGE_RANK_EMPTY',
      message: 'Sage ranked no candidate above threshold — returning keyword matches',
      correlationId: run.correlationId,
    })
  }

  // Honest fallback — keyword order, clearly labelled.
  const results: KnowledgeSearchResult[] = candidates.slice(0, limit).map((c) => ({
    id: c.id, title: c.title, classification: c.classification, status: c.status,
    excerpt: c.excerpt, keywordScore: c.keywordScore,
    relevance: null, reason: null, rankedBy: 'KEYWORD' as const,
  }))
  return { results, agent: agentMeta }
}
