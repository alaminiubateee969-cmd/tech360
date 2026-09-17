'use client'

// ============================================================
// SHARED AI WRITING REVIEW PANEL — CST-020 "Muse"
//
// Self-contained advisory review UI for any editor (Blog Studio,
// Newsletter). Renders ONLY what the API returned — zero fabricated
// scores, quotes or suggestions. A provider failure surfaces as an
// honest inline amber error.
// ============================================================

import { useState } from 'react'
import { Loader2, ShieldAlert, SpellCheck } from 'lucide-react'

import { fetchJson } from '@/lib/admin-client'
import { CARD } from '@/components/admin/shared/styles'
import { Button } from '@/components/ui/button'

export type ReviewIssueType = 'grammar' | 'tone' | 'clarity' | 'seo' | 'brand'
export type ReviewSeverity = 'high' | 'medium' | 'low'
export type ReviewVerdict = 'approve' | 'approve-with-edits' | 'rewrite'

export interface ReviewIssue {
  type: ReviewIssueType
  severity: ReviewSeverity
  quote: string
  suggestion: string
}

export interface ReviewResult {
  overallScore: number
  verdict: ReviewVerdict
  summary: string
  issues: ReviewIssue[]
}

interface ReviewResponse {
  ok?: boolean
  review?: ReviewResult
  cached?: boolean
  agentCode?: string
  executionId?: string
  executedAt?: string
}

const VERDICT_TONE: Record<ReviewVerdict, { chip: string; label: string }> = {
  approve: { chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', label: 'Approve' },
  'approve-with-edits': { chip: 'border-amber-500/40 bg-amber-500/10 text-amber-300', label: 'Approve with edits' },
  rewrite: { chip: 'border-red-500/40 bg-red-500/10 text-red-300', label: 'Rewrite' },
}

const SEVERITY_TONE: Record<ReviewSeverity, string> = {
  high: 'bg-red-500/15 text-red-300',
  medium: 'bg-amber-500/15 text-amber-300',
  low: 'bg-slate-700/50 text-slate-400',
}

export function ReviewPanel({
  subject,
  body,
  kind,
  onApply,
}: {
  subject?: string
  body: string
  kind: 'blog' | 'newsletter'
  onApply?: (quote: string, suggestion: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [meta, setMeta] = useState<{ cached: boolean; agentCode: string; executionId: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runReview() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetchJson<ReviewResponse>('/api/admin/content/review', {
        method: 'POST',
        body: { subject, body, kind },
      })
      if (!res.review) {
        setError('The review API returned no result — nothing was shown.')
        return
      }
      setResult(res.review)
      setMeta({
        cached: Boolean(res.cached),
        agentCode: res.agentCode ?? 'CST-020',
        executionId: (res.executionId ?? '').slice(0, 8),
      })
    } catch (e) {
      // honest failure — surface the real API error inline
      setResult(null)
      setError(e instanceof Error ? e.message : 'AI review failed.')
    } finally {
      setBusy(false)
    }
  }

  const verdict = result ? VERDICT_TONE[result.verdict] : null

  return (
    <div className="min-w-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={runReview}
        disabled={busy}
        className="h-8 gap-1.5 border-slate-700 bg-slate-900/60 px-2.5 text-xs text-slate-300 hover:border-[#009FE3]/50 hover:bg-[#009FE3]/10 hover:text-[#009FE3]"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <SpellCheck className="size-3.5" aria-hidden="true" />}
        {busy ? 'Muse is reviewing…' : 'AI Review'}
      </Button>

      {error ? (
        <div role="alert" className={`mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-300 ${result ? 'mb-2' : ''}`}>
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      ) : null}

      {result && verdict ? (
        <div className={`${CARD} mt-2 p-3`}>
          {/* verdict header */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md border px-2 py-1 text-xs font-semibold tabular-nums ${verdict.chip}`}>
              {result.overallScore}/100 · {verdict.label}
            </span>
            <span className="text-[11px] text-slate-500">
              {meta?.agentCode ?? 'CST-020'}
              {meta?.executionId ? ` · execution ${meta.executionId}` : ''}
              {meta?.cached ? ' · cached result (identical request within 60s)' : ''}
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{result.summary}</p>

          {/* issues — only what the agent actually quoted */}
          {result.issues.length > 0 ? (
            <ul className="mt-3 space-y-2.5">
              {result.issues.map((issue, i) => (
                <li key={i} className="rounded-md border border-slate-800 bg-slate-950/40 p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                      {issue.type}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_TONE[issue.severity]}`}>
                      {issue.severity}
                    </span>
                  </div>
                  <blockquote className="mt-1.5 border-l-2 border-slate-700 pl-2.5 text-xs italic leading-relaxed text-slate-400">
                    “{issue.quote}”
                  </blockquote>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">→ {issue.suggestion}</p>
                  {onApply ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onApply(issue.quote, issue.suggestion)}
                      className="mt-1.5 h-6 px-2 text-[11px] text-[#7dd3fc] hover:bg-[#009FE3]/10 hover:text-[#7dd3fc]"
                    >
                      Apply suggestion
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-slate-500">No specific issues quoted by the reviewer.</p>
          )}

          <p className="mt-3 border-t border-slate-800 pt-2 text-[11px] text-slate-600">
            Advisory only — you decide what to change.
          </p>
        </div>
      ) : null}
    </div>
  )
}
