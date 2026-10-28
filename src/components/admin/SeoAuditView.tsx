'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, Loader2, MapPin, Search, Sparkles, XCircle } from 'lucide-react'
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
interface LocalPlan {
  generatedAt: string
  business: { name: string; type: string; primaryLocation: string; website: string | null; language: string }
  mapMarkers: Array<{ location: string; markerType: string; instruction: string }>
  keywordClusters: Array<{ area: string; service: string; suggestions: string[] }>
  freeSetup: string[]
  landingPages: string[]
  contentIdeas: string[]
  measurement: string[]
  guardrails: string[]
  aiEnhanced: boolean
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
  const [localBusy, setLocalBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [localPlan, setLocalPlan] = useState<LocalPlan | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [primaryLocation, setPrimaryLocation] = useState('')
  const [serviceAreas, setServiceAreas] = useState('')
  const [services, setServices] = useState('')
  const [localWebsite, setLocalWebsite] = useState('')
  const [localLanguage, setLocalLanguage] = useState<'BN' | 'EN' | 'BOTH'>('BOTH')
  const [useAiEnhancement, setUseAiEnhancement] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [aiEnhancementStatus, setAiEnhancementStatus] = useState<string>('NOT_REQUESTED')

  const generateLocalPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalBusy(true); setLocalError(null)
    try {
      const response = await fetchJson<{ plan: LocalPlan; aiSuggestion: string | null; aiEnhancementStatus: string }>('/api/admin/seo/local-plan', {
        method: 'POST',
        body: { businessName, businessType, primaryLocation, serviceAreas, services, website: localWebsite, language: localLanguage, useAi: useAiEnhancement },
      })
      setLocalPlan(response.plan)
      setAiSuggestion(response.aiSuggestion)
      setAiEnhancementStatus(response.aiEnhancementStatus)
      toast.success('Local SEO plan drafted; verify every address and claim before publishing.')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Local SEO plan could not be generated'
      setLocalError(msg); toast.error(msg)
    } finally { setLocalBusy(false) }
  }

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
        title="SEO & Local Discovery"
        description="Free technical SEO audit plus a Bangladesh-focused local-search planner for Google Search and Maps. No paid SEO data APIs; all map locations and recommendations need human verification."
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

      <SectionCard title="Free local SEO agent — Google Search & Maps">
        <p className="mb-3 text-xs leading-relaxed text-slate-400">Build a no-cost draft for real Bangladesh service areas: location × service keyword clusters, verified-location checklist, useful page ideas and free measurement steps. This planner does not scrape Maps, geocode, create pins, publish content or guarantee rankings.</p>
        <form onSubmit={generateLocalPlan} className="grid gap-3 md:grid-cols-2">
          <input className={INPUT} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name (e.g. Rahim Computer & AC)" maxLength={120} />
          <input className={INPUT} required value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder="Business type (e.g. computer and AC shop)" maxLength={100} />
          <input className={INPUT} value={primaryLocation} onChange={(e) => setPrimaryLocation(e.target.value)} placeholder="Real main shop address/area — no invented pin" maxLength={120} />
          <input className={INPUT} value={serviceAreas} onChange={(e) => setServiceAreas(e.target.value)} placeholder="Genuine service areas, comma-separated (e.g. Dhanmondi, Mirpur)" maxLength={1200} />
          <input className={INPUT} value={services} onChange={(e) => setServices(e.target.value)} placeholder="Products/services, comma-separated (e.g. AC repair, laptop sales)" maxLength={1200} />
          <input className={INPUT} value={localWebsite} onChange={(e) => setLocalWebsite(e.target.value)} placeholder="Website URL (optional)" maxLength={200} inputMode="url" />
          <select className={INPUT} value={localLanguage} onChange={(e) => setLocalLanguage(e.target.value as 'BN' | 'EN' | 'BOTH')}>
            <option value="BOTH">Bangla + English</option><option value="BN">Bangla</option><option value="EN">English</option>
          </select>
          <label className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400 md:col-span-2">
            <input type="checkbox" checked={useAiEnhancement} onChange={(e) => setUseAiEnhancement(e.target.checked)} className="mt-0.5" />
            Ask the configured SEO & Discovery AI agent for extra draft ideas. Provider usage may have separate costs; the free plan works without it.
          </label>
          <Button type="submit" disabled={localBusy || !businessType.trim()} className="h-9 justify-self-start gap-2" style={{ backgroundColor: ACCENT }}>
            {localBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {localBusy ? 'Drafting…' : 'Generate free local SEO plan'}
          </Button>
        </form>
        {localError ? <p role="alert" className="mt-3 rounded-md bg-red-500/10 p-2.5 text-sm text-red-300">{localError}</p> : null}
        {localPlan ? (
          <div className="mt-4 space-y-4 border-t border-slate-800 pt-4">
            <p className="text-xs font-semibold text-emerald-300">Free rules-based draft · no paid SEO data API used · generated {new Date(localPlan.generatedAt).toLocaleString()}</p>
            {aiEnhancementStatus === 'GENERATED' && aiSuggestion ? <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3"><p className="text-xs font-semibold text-sky-200">AI-added suggestions · review before use</p><p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{aiSuggestion}</p></div> : null}
            {aiEnhancementStatus === 'UNAVAILABLE' ? <p className="text-xs text-amber-300">AI enhancement was unavailable; the free rules-based plan is still ready.</p> : null}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><MapPin className="size-4 text-sky-300" /> Real map locations to verify — no pins created</h3>
              <ul className="mt-2 space-y-2">{localPlan.mapMarkers.map((marker) => <li key={`${marker.location}-${marker.markerType}`} className="rounded-lg border border-slate-800 p-3"><p className="text-xs font-semibold text-slate-200">{marker.location} · {marker.markerType.replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-slate-400">{marker.instruction}</p></li>)}</ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Local keyword markers</h3>
              <div className="mt-2 grid gap-2 md:grid-cols-2">{localPlan.keywordClusters.map((cluster) => <div key={`${cluster.area}-${cluster.service}`} className="rounded-lg border border-slate-800 p-3"><p className="text-xs font-semibold text-slate-200">{cluster.service} · {cluster.area}</p><p className="mt-1 text-xs leading-relaxed text-slate-400">{cluster.suggestions.join(' · ')}</p></div>)}</div>
            </div>
            {([
              ['Free Google setup checklist', localPlan.freeSetup],
              ['Useful local pages (avoid doorway pages)', localPlan.landingPages],
              ['Content ideas', localPlan.contentIdeas],
              ['Measure actual enquiries and sales', localPlan.measurement],
              ['Trust and accuracy guardrails', localPlan.guardrails],
            ] as Array<[string, string[]]>).map(([heading, items]) => <div key={heading}><h3 className="text-sm font-semibold text-slate-100">{heading}</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-400">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>)}
          </div>
        ) : null}
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
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {groups.map((g) => {
                const gc = result.checks.filter((c) => c.group === g)
                const gPass = gc.filter((c) => c.status === 'pass').length
                const pct = gc.length ? Math.round((gPass / gc.length) * 100) : 0
                const tone = pct >= 80 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : pct >= 55 ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-red-500/30 bg-red-500/10 text-red-300'
                return (
                  <div key={g} className={`rounded-lg border p-3 ${tone}`}>
                    <p className="text-xs font-bold uppercase tracking-wide">{g}</p>
                    <p className="mt-1 text-lg font-bold">{pct}<span className="text-xs">/100</span></p>
                    <p className="text-[11px] opacity-80">{gPass}/{gc.length} checks passed</p>
                  </div>
                )
              })}
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
