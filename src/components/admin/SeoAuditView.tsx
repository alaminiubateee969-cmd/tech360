'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, Loader2, Search, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { fetchJson, ApiError } from '@/lib/admin-client'
import { PageHeader, SectionCard } from './shared/cards'
import { ACCENT, GREEN, AMBER, RED, INPUT } from './shared/styles'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Free, self-hosted SEO audit — no paid data provider. Backed by POST /api/admin/seo/audit.
// Inspired by open-seo's site audit and the marketingskills seo-audit framework (both MIT).

interface Check { id: string; group: string; label: string; status: 'pass' | 'warn' | 'fail' | 'info'; detail: string; fix?: string }
interface AuditResult {
  url: string; fetchedAt: string; ms: number; score: number; pass: number; warn: number; fail: number
  facts: { title?: string; words?: number }
  checks: Check[]
}

const ICON = { pass: CheckCircle2, warn: AlertTriangle, fail: XCircle, info: Info } as const
const TONE = { pass: 'text-emerald-400', warn: 'text-amber-400', fail: 'text-red-400', info: 'text-slate-500' } as const

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? GREEN : score >= 55 ? AMBER : RED
  const r = 42
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-28 shrink-0" role="img" aria-label={`SEO score ${score} out of 100`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1E293B" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-100">{score}</span>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">/ 100</span>
      </div>
    </div>
  )
}

export function SeoAuditView() {
  const [url, setUrl] = useState('https://bdtech360.com')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AuditResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [onlyIssues, setOnlyIssues] = useState(false)

  const run = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      setResult(await fetchJson<AuditResult>('/api/admin/seo/audit', { method: 'POST', body: { url: url.trim() } }))
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Audit failed'
      setError(msg); toast.error(msg)
    } finally { setBusy(false) }
  }

  const groups = result ? Array.from(new Set(result.checks.map((c) => c.group))) : []

  return (
    <div className="space-y-4">
      <PageHeader
        title="SEO Audit"
        description="Free on-page and technical audit of any public URL: indexation, titles, headings, structured data, social tags, speed and security — plus a check that your sitemap URLs actually load. No paid API."
      />
      <SectionCard>
        <form onSubmit={run} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="seo-url" className="sr-only">URL to audit</label>
          <input id="seo-url" className={INPUT} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/page" inputMode="url" autoComplete="off" />
          <Button type="submit" disabled={busy || !url.trim()} className="h-9 shrink-0 gap-2" style={{ backgroundColor: ACCENT }}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} {busy ? 'Auditing…' : 'Run audit'}
          </Button>
        </form>
        {error ? <p role="alert" className="mt-3 rounded-md bg-red-500/10 p-2.5 text-sm text-red-300">{error}</p> : null}
        <p className="mt-2 text-[11px] text-slate-500">Only public web addresses are fetched; private/internal addresses are blocked. Each run is recorded in the audit log.</p>
      </SectionCard>

      {result ? (
        <>
          <SectionCard>
            <div className="flex flex-wrap items-center gap-6">
              <ScoreRing score={result.score} />
              <div className="min-w-0 space-y-1 text-sm">
                <p className="truncate font-medium text-slate-100">{result.url}</p>
                {result.facts.title ? <p className="truncate text-slate-400">“{result.facts.title}”</p> : null}
                <p className="text-slate-500">{result.pass} passed · {result.warn} to improve · {result.fail} failing · {result.ms} ms</p>
                <label className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Show only issues
                </label>
              </div>
            </div>
          </SectionCard>

          {groups.map((g) => {
            const items = result.checks.filter((c) => c.group === g && (!onlyIssues || c.status === 'warn' || c.status === 'fail'))
            if (!items.length) return null
            return (
              <SectionCard key={g} title={g}>
                <ul className="divide-y divide-slate-800/70">
                  {items.map((c) => {
                    const Icon = ICON[c.status]
                    return (
                      <li key={c.id} className="flex gap-3 py-2.5">
                        <Icon className={cn('mt-0.5 size-4 shrink-0', TONE[c.status])} aria-label={c.status} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-200">{c.label}</p>
                          <p className="break-words text-xs text-slate-400">{c.detail}</p>
                          {c.fix && c.status !== 'pass' ? <p className="mt-1 text-xs text-sky-300/90">Fix: {c.fix}</p> : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </SectionCard>
            )
          })}
        </>
      ) : null}
    </div>
  )
}
