'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Boxes, CheckCircle2, Download, Eye, FileText, Loader2, Mic, MicOff,
  Radar, RefreshCw, ScanSearch, ShieldAlert, Square, Volume2, VolumeX, Wrench, XCircle,
} from 'lucide-react'

import { ApiError, fetchJson, useApi } from '@/lib/admin-client'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { CARD, INPUT, MONO } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { chunkForSpeech, useVoiceDictation, useVoiceSpeech, voiceCapabilities } from '@/hooks/use-voice'

// ============================================================
// REA STUDIO — reverse engineer a website, get an evidence-bound
// teardown, and derive an ORIGINAL rebuild through the App Factory.
//
// The whole surface is built around one rule: every claim on screen
// carries the authority behind it and the citation that supports it.
// A number here is never a vibe. Where the analysis could not see
// something — the hydrated DOM, runtime calls, the backend stack —
// that is listed as an unknown with what would resolve it, rather
// than being quietly omitted.
//
// Voice runs entirely in the operator's browser (Web Speech API). No
// audio and no teardown text is sent to any third-party speech vendor.
// ============================================================

type Capability = { kind: string; supported: boolean; reason: string; upstreamTool: string }

type TargetSummary = {
  id: string
  code: string
  kind: string
  url: string
  host: string
  status: string
  httpStatus: number
  bytes: number
  renderModel: string
  evidenceId: string | null
  observedCount: number
  inferredCount: number
  routeCandidates: number
  endpointCandidates: number
  coverageComplete: boolean
  refusalCode: string | null
  refusalReason: string | null
  durationMs: number | null
  createdAt: string
  _count?: { reconstructions: number }
}

type StackItem = {
  label: string
  category: string
  authority: string
  signal: string
  source: string
  confidence: number
  caveat?: string
}

type TeardownSection = {
  id: string
  title: string
  observations: Array<{ text: string; authority: string; signal?: string }>
  limits: string[]
}

type TeardownReport = {
  headline: string
  question: string | null
  verdict: string
  sections: TeardownSection[]
  stack: StackItem[]
  routeCandidates: Array<{ path: string; basis: string; authority: string; confidence: number; label?: string }>
  endpointCandidates: Array<{ method: string; path: string; authority: string; confidence: number; source: string }>
  limitations: Array<{ code: string; detail: string; scope?: string }>
  unknowns: Array<{ id: string; question: string; authorityRequired: string }>
  completeness: string[]
  a11y: Record<string, unknown>
  evidenceId: string
  summaryLine: string
}

type ListResponse = {
  targets: TargetSummary[]
  capabilities: {
    supportedKinds: Capability[]
    unsupportedTargets: Array<{ kind: string; reason: string; upstream: string }>
    fingerprintCatalogueSize: number
    limits: Record<string, number>
    captureContract: string[]
    engine: Record<string, unknown>
  }
}

const AUTHORITY_STYLE: Record<string, string> = {
  OBSERVED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  DECLARED: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  INFERRED: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  UNKNOWN: 'border-slate-600/50 bg-slate-700/20 text-slate-400',
}

function AuthorityBadge({ authority }: { authority: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${AUTHORITY_STYLE[authority] ?? AUTHORITY_STYLE.UNKNOWN}`}
      title={`Authority: ${authority}`}
    >
      {authority}
    </span>
  )
}

export function ReaView() {
  const list = useApi<ListResponse>('/api/admin/rea/targets')

  const [url, setUrl] = useState('')
  const [question, setQuestion] = useState('')
  const [kind, setKind] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<TargetSummary | null>(null)
  const [report, setReport] = useState<TeardownReport | null>(null)
  const [spoken, setSpoken] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [showRebuild, setShowRebuild] = useState(false)

  // ---- voice: dictation into the URL/question, and read-aloud of the teardown
  const dictation = useVoiceDictation({ lang: 'en-US' })
  const speech = useVoiceSpeech({ lang: 'en-US' })
  const [dictationTarget, setDictationTarget] = useState<'url' | 'question'>('url')
  const capabilities = voiceCapabilities(dictation.supported, speech.supported, speech.voices.length)

  // What was spoken last, so dictation can append to the right field.
  useEffect(() => {
    if (dictation.state !== 'idle' || !dictation.transcript) return
    const value = dictation.transcript.trim()
    if (!value) return
    if (dictationTarget === 'url') {
      // Dictation yields prose; pull the first URL-shaped token out of it so a
      // spoken "analyse stripe dot com" still lands something usable.
      const found = /https?:\/\/[^\s]+/i.exec(value)?.[0] ?? value.split(/\s+/).find((w) => /\.[a-z]{2,}/i.test(w) && !/\s/.test(w))
      if (found) setUrl(found)
      else setQuestion((prev) => (prev ? `${prev} ${value}` : value))
    } else {
      setQuestion((prev) => (prev ? `${prev} ${value}` : value))
    }
    dictation.reset()
  }, [dictation.state, dictation.transcript, dictationTarget, dictation])

  const analyze = useCallback(async () => {
    if (!url.trim()) { toast.error('Enter a target URL, or dictate one.'); return }
    setBusy(true)
    try {
      const result = await fetchJson<{ refused?: boolean; target: TargetSummary; report?: TeardownReport; spoken?: string; summaryLine?: string }>('/api/admin/rea/targets', {
        method: 'POST',
        body: { url: url.trim(), kind: kind || undefined, question: question.trim() || undefined },
      })
      if (result.refused) {
        toast.error(`Refused at admission: ${result.target.refusalReason ?? 'target not permitted'}`)
        list.refresh()
        setSelected(result.target)
        setReport(null)
        return
      }
      setSelected(result.target)
      setReport(result.report ?? null)
      setSpoken(result.spoken ?? '')
      toast.success(result.summaryLine ?? 'Teardown produced.')
      list.refresh()
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Analysis failed.'
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }, [url, kind, question, list])

  const openTarget = useCallback(async (target: TargetSummary) => {
    setSelected(target)
    setShowRebuild(false)
    if (target.status !== 'ANALYZED') { setReport(null); setSpoken(''); setMarkdown(''); return }
    try {
      const detail = await fetchJson<{ report: TeardownReport }>(`/api/admin/rea/targets/${target.id}/teardown?format=json`)
      setReport(detail.report)
      const [spokenText, md] = await Promise.all([
        fetch(`/api/admin/rea/targets/${target.id}/teardown?format=spoken`).then((r) => r.text()),
        fetch(`/api/admin/rea/targets/${target.id}/teardown?format=markdown`).then((r) => r.text()),
      ])
      setSpoken(spokenText)
      setMarkdown(md)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not load the teardown.')
    }
  }, [])

  const speak = useCallback(async () => {
    const text = spoken || report?.verdict || ''
    if (!text.trim()) { toast.error('There is no teardown to read yet.'); return }
    if (!speech.supported) { toast.error('This browser has no speech synthesis, so read-aloud is unavailable.'); return }
    if (speech.state === 'speaking') { speech.stop(); return }
    const parts = chunkForSpeech(text)
    toast.info(`Reading ${parts.length} part(s) aloud, in your browser only.`)
    await speech.speak(text)
  }, [spoken, report, speech])

  const correct = useCallback(async (kindOfCorrection: string, subject: string) => {
    if (!selected) return
    const detail = window.prompt('What was wrong? Be specific — this becomes evidence for the Evolution Loop.')
    if (!detail?.trim()) return
    try {
      await fetchJson(`/api/admin/rea/targets/${selected.id}`, {
        method: 'POST',
        body: { kind: kindOfCorrection, subject, detail: detail.trim() },
      })
      toast.success('Correction recorded. It changes nothing until the Evolution Loop proposes from it and a human approves.')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not record the correction.')
    }
  }, [selected])

  const observed = report?.stack.filter((s) => s.authority === 'OBSERVED').length ?? 0
  const inferred = report?.stack.filter((s) => s.authority === 'INFERRED').length ?? 0
  const targets = list.data?.targets ?? []

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reverse Engineer Anything"
        description="Capture a public page, get a teardown where every claim carries its authority and citation, then derive an ORIGINAL rebuild through the App Factory. Static analysis only — nothing is executed and nothing is copied."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => list.refresh()} disabled={list.loading}>
              <RefreshCw className={`mr-1.5 size-3.5 ${list.loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <span className={MONO}>{capabilities.voiceCount} voice(s)</span>
          </>
        }
      />

      {/* ---------------- capability honesty ---------------- */}
      <SectionCard
        title="What this deployment can and cannot see"
        description="Reported up front so a teardown is never over-read."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Supported targets</p>
            <ul className="space-y-1.5">
              {(list.data?.capabilities.supportedKinds ?? []).map((c) => (
                <li key={c.kind} className="flex items-start gap-2 text-xs">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
                  <span className="text-slate-300"><span className="font-semibold">{c.kind}</span> — {c.reason}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Refused at admission</p>
            <ul className="space-y-1.5">
              {(list.data?.capabilities.unsupportedTargets ?? []).slice(0, 7).map((u) => (
                <li key={u.kind} className="flex items-start gap-2 text-xs">
                  <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-400" aria-hidden="true" />
                  <span className="text-slate-400"><span className="font-semibold text-slate-300">{u.kind}</span> — {u.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Capture contract</p>
          <ul className="mt-1.5 space-y-1">
            {(list.data?.capabilities.captureContract ?? []).map((line) => (
              <li key={line} className="flex items-start gap-2 text-xs text-slate-400">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-sky-400" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </SectionCard>

      {/* ---------------- voice + target intake ---------------- */}
      <SectionCard
        title="Target"
        description="Speak it or type it. Dictation and read-aloud both run in your browser — no audio or teardown text goes to any third party."
        actions={
          <div className="flex items-center gap-2">
            {dictation.supported ? (
              <Button
                variant={dictation.state === 'listening' ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => (dictation.state === 'listening' ? dictation.stop() : dictation.start())}
              >
                {dictation.state === 'listening' ? <Square className="mr-1.5 size-3.5" /> : <Mic className="mr-1.5 size-3.5" />}
                {dictation.state === 'listening' ? 'Stop dictation' : `Dictate ${dictationTarget}`}
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded border border-slate-800 px-2 py-1 text-[11px] text-slate-500">
                <MicOff className="size-3.5" aria-hidden="true" /> Dictation unsupported
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => setDictationTarget(dictationTarget === 'url' ? 'question' : 'url')}>
              Dictate into: <span className="ml-1.5 font-semibold text-slate-200">{dictationTarget}</span>
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <div>
            <label htmlFor="rea-url" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Target URL</label>
            <Input id="rea-url" className={INPUT} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/pricing" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="rea-kind" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Kind</label>
            <select id="rea-kind" className={INPUT} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Auto-detect</option>
              <option value="WEBSITE">Website</option>
              <option value="WEB_APP">Web application</option>
              <option value="HTML_SNIPPET">Pasted markup (no network)</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={analyze} disabled={busy} className="h-9">
              {busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <ScanSearch className="mr-1.5 size-3.5" />}
              {busy ? 'Capturing…' : 'Reverse engineer'}
            </Button>
          </div>
        </div>

        <div className="mt-3">
          <label htmlFor="rea-question" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            What do you want to learn? (quoted verbatim in the teardown)
          </label>
          <Input id="rea-question" className={INPUT} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="How does their lead capture and pricing flow work?" autoComplete="off" />
        </div>

        {dictation.interim ? <p className="mt-2 text-xs italic text-slate-400">Listening: “{dictation.interim}”</p> : null}
        {dictation.error ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-300">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {dictation.error.message}
          </p>
        ) : null}
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{capabilities.detail}</p>
      </SectionCard>

      {/* ---------------- result ---------------- */}
      {selected?.status === 'REFUSED' ? (
        <SectionCard title={`Refused — ${selected.code}`} className="border-red-500/30">
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-400" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-200">{selected.refusalCode}</p>
              <p className="mt-1 text-xs leading-relaxed text-red-200/80">{selected.refusalReason}</p>
              <p className={MONO}>Refusals are stored as rows, not discarded: {selected.url}</p>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="Observed" value={observed} icon={CheckCircle2} tone="green" sub="Cited from an artifact in the capture" />
            <KpiCard label="Inferred" value={inferred} icon={AlertTriangle} tone="amber" sub="Patterns — candidates, not facts" />
            <KpiCard label="Route candidates" value={report.routeCandidates.length} icon={Radar} tone="accent" sub="Never confirmed reachable" />
            <KpiCard label="Limitations" value={report.limitations.length} icon={Eye} tone="slate" sub="What this analysis cannot see" />
            <KpiCard label="Open unknowns" value={report.unknowns.length} icon={Wrench} tone="red" sub="Each names the authority that would resolve it" />
          </div>

          <SectionCard
            title={report.headline}
            description={<span className={MONO}>Evidence {report.evidenceId} · {report.summaryLine}</span>}
            actions={
              <div className="flex items-center gap-2">
                <Button variant={speech.state === 'speaking' ? 'destructive' : 'outline'} size="sm" onClick={speak}>
                  {speech.state === 'speaking' ? <VolumeX className="mr-1.5 size-3.5" /> : <Volume2 className="mr-1.5 size-3.5" />}
                  {speech.state === 'speaking' ? `Stop (${speech.progress.spoken}/${speech.progress.total})` : 'Read the teardown'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowRebuild((v) => !v)}>
                  <Boxes className="mr-1.5 size-3.5" /> Build my own version
                </Button>
                <a href={`/api/admin/rea/targets/${selected?.id}/teardown?format=markdown`} download>
                  <Button variant="outline" size="sm"><Download className="mr-1.5 size-3.5" /> Markdown</Button>
                </a>
              </div>
            }
          >
            <p className="text-sm leading-relaxed text-slate-300">{report.verdict}</p>
            {report.question ? <p className="mt-2 border-l-2 border-[#009FE3]/50 pl-3 text-xs italic text-slate-400">Your question: {report.question}</p> : null}
            {!speech.supported ? <p className="mt-2 text-[11px] text-amber-300/80">Read-aloud is unavailable in this browser. The full text is below and downloads as Markdown.</p> : null}
          </SectionCard>

          <SectionCard title="Technology stack — each with its citation" description="A fingerprint proves a signal was present. It never proves a version, a licence, or that the feature runs on this page.">
            {report.stack.length === 0 ? (
              <EmptyState icon={ScanSearch} title="No fingerprints matched" description="That is a result, not a failure: the stack may be entirely custom, or the document may be too small to fingerprint." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                    <tr><th className="pb-2 pr-3">Technology</th><th className="pb-2 pr-3">Authority</th><th className="pb-2 pr-3">Signal that produced it</th><th className="pb-2 pr-3">Conf.</th><th className="pb-2">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {report.stack.map((item) => (
                      <tr key={`${item.label}-${item.source}`}>
                        <td className="py-2 pr-3">
                          <span className="font-medium text-slate-200">{item.label}</span>
                          <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-500">{item.category}</span>
                          {item.caveat ? <p className="mt-0.5 max-w-md text-[11px] leading-snug text-amber-300/70">{item.caveat}</p> : null}
                        </td>
                        <td className="py-2 pr-3"><AuthorityBadge authority={item.authority} /></td>
                        <td className={MONO}>
                          <span className="text-slate-500">{item.source}</span> → {item.signal}
                          <button type="button" className="ml-2 text-[10px] text-red-400 underline-offset-2 hover:underline" onClick={() => correct('FINGERPRINT_FALSE_POSITIVE', item.label)}>wrong</button>
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-slate-400">{item.confidence.toFixed(2)}</td>
                        <td className="py-2" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {report.sections.map((section) => (
            <SectionCard key={section.id} title={section.title}>
              <ul className="space-y-1.5">
                {section.observations.map((o, i) => (
                  <li key={`${section.id}-${i}`} className="flex items-start gap-2 text-xs">
                    <AuthorityBadge authority={o.authority} />
                    <span className="min-w-0 flex-1 text-slate-300">
                      {o.text}
                      {o.signal ? <span className={`ml-2 ${MONO}`}>[{o.signal}]</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
              {section.limits.length ? (
                <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/80">What this does not prove</p>
                  <ul className="mt-1 space-y-1">
                    {section.limits.slice(0, 8).map((l, i) => <li key={i} className="text-[11px] leading-relaxed text-amber-200/70">{l}</li>)}
                  </ul>
                </div>
              ) : null}
            </SectionCard>
          ))}

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title={`Route candidates (${report.routeCandidates.length})`} description="Candidates, not routes. Reachability was never tested and this is not the complete route table.">
              <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
                {report.routeCandidates.slice(0, 60).map((c) => (
                  <li key={`${c.path}-${c.basis}`} className="flex items-center gap-2 text-xs">
                    <AuthorityBadge authority={c.authority} />
                    <span className={MONO}>{c.path}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-slate-500">{c.basis} · {c.confidence.toFixed(2)}</span>
                  </li>
                ))}
                {report.routeCandidates.length === 0 ? <li className="text-xs text-slate-500">None visible in this capture.</li> : null}
              </ul>
            </SectionCard>

            <SectionCard title={`Endpoint candidates (${report.endpointCandidates.length})`} description="Inferences from static text. No request was sent to any of them.">
              <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
                {report.endpointCandidates.slice(0, 40).map((c) => (
                  <li key={`${c.method}-${c.path}`} className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 font-semibold text-sky-300">{c.method}</span>
                    <span className={MONO}>{c.path}</span>
                    <AuthorityBadge authority={c.authority} />
                  </li>
                ))}
                {report.endpointCandidates.length === 0 ? <li className="text-xs text-slate-500">None visible in this capture.</li> : null}
              </ul>
            </SectionCard>
          </div>

          <SectionCard title="Limitations" description="Every way this analysis fell short of a full answer.">
            <ul className="space-y-2">
              {report.limitations.map((l) => (
                <li key={l.code} className="flex items-start gap-2 text-xs">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                  <span className="min-w-0 text-slate-400">
                    <span className={MONO}>{l.code}</span>{l.scope ? <span className="text-slate-600"> ({l.scope})</span> : null} — {l.detail}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Open unknowns" description="What is still not known, and the authority that would be needed to know it.">
            <ul className="space-y-2">
              {report.unknowns.map((u) => (
                <li key={u.id} className="rounded-md border border-slate-800 bg-slate-950/40 p-2.5 text-xs">
                  <p className="font-medium text-slate-200">{u.question}</p>
                  <p className="mt-1 text-slate-500"><span className="font-semibold text-slate-400">Would be resolved by:</span> {u.authorityRequired}</p>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => correct('TEARDOWN_CORRECTED', 'teardown')}><FileText className="mr-1.5 size-3.5" /> Report a correction</Button>
              <Button variant="outline" size="sm" onClick={() => correct('FINGERPRINT_FALSE_NEGATIVE', 'missing-technology')}>Something obvious was missed</Button>
            </div>
          </SectionCard>

          {showRebuild ? <RebuildPanel target={selected} onDone={() => list.refresh()} /> : null}
        </>
      ) : null}

      {/* ---------------- history ---------------- */}
      <SectionCard title={`Prior teardowns (${targets.length})`} description="Re-analyzing creates a new row. History is never overwritten in place.">
        {list.loading && targets.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="size-3.5 animate-spin" /> Loading…</p>
        ) : targets.length === 0 ? (
          <EmptyState icon={ScanSearch} title="Nothing analyzed yet" description="Enter a target above. The first capture produces the first evidence-bound teardown." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                <tr><th className="pb-2 pr-3">Code</th><th className="pb-2 pr-3">Target</th><th className="pb-2 pr-3">Status</th><th className="pb-2 pr-3">Render</th><th className="pb-2 pr-3">Obs/Inf</th><th className="pb-2 pr-3">Routes</th><th className="pb-2 pr-3">Rebuilds</th><th className="pb-2">Analyzed</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {targets.map((t) => (
                  <tr key={t.id} className={selected?.id === t.id ? 'bg-[#009FE3]/5' : undefined}>
                    <td className={MONO}>{t.code}</td>
                    <td className="max-w-[240px] truncate pr-3 text-slate-300" title={t.url}>{t.host}</td>
                    <td className="pr-3">
                      <span className={t.status === 'ANALYZED' ? 'text-emerald-300' : t.status === 'REFUSED' ? 'text-red-300' : 'text-slate-400'}>{t.status}</span>
                    </td>
                    <td className={MONO}>{t.renderModel}</td>
                    <td className="pr-3 tabular-nums text-slate-400">{t.observedCount}/{t.inferredCount}</td>
                    <td className="pr-3 tabular-nums text-slate-400">{t.routeCandidates}</td>
                    <td className="pr-3 tabular-nums text-slate-400">{t._count?.reconstructions ?? 0}</td>
                    <td className="pr-3">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openTarget(t)}>Open</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ------------------------------------------------------------ rebuild panel

function RebuildPanel({ target, onDone }: { target: TargetSummary | null; onDone: () => void }) {
  const [appName, setAppName] = useState('')
  const [clientName, setClientName] = useState('Internal')
  const [primaryColor, setPrimaryColor] = useState('#063B8F')
  const [currency, setCurrency] = useState('GBP')
  const [language, setLanguage] = useState<'EN' | 'BN' | 'BOTH'>('EN')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{
    reconstruction: { code: string; confidence: number; statement: string; pages: Array<{ path: string; title: string; purpose: string }>; provenance: { derived: Array<{ decision: string; from: string; authority: string }>; copied: string[]; notReconstructable: string[] } }
    app: { code: string; name: string; fileCount: number; totalBytes: number; vertical: string }
    deliveryGate: { exportable: boolean; code: string; reason: string }
    endpoints: { review: string; export: string }
  } | null>(null)

  const build = useMemo(() => async () => {
    if (!target) return
    if (!appName.trim()) { toast.error('Give the rebuild YOUR name — never the target’s.'); return }
    setBusy(true)
    try {
      const built = await fetchJson<NonNullable<typeof result>>(`/api/admin/rea/targets/${target.id}/reconstruct`, {
        method: 'POST',
        body: { appName: appName.trim(), clientName, primaryColor, currency, language, notes },
      })
      setResult(built)
      toast.success(`${built.app.code} · ${built.app.fileCount} files · confidence ${built.reconstruction.confidence}`)
      onDone()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Reconstruction failed.')
    } finally {
      setBusy(false)
    }
  }, [target, appName, clientName, primaryColor, currency, language, notes, onDone])

  if (!target) return null

  return (
    <SectionCard
      title="Build my own version"
      description="Derives an ORIGINAL application from the observed information architecture, through the App Factory. No code, copy, brand, colour or asset is taken from the target."
    >
      <div className="mb-3 rounded-md border border-sky-500/25 bg-sky-500/5 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">The boundary this enforces</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          Structure is observable; ownership is not transferable. The rebuild may learn <em>that</em> a target has a
          pricing page and a lead form. It may not take the target&rsquo;s words, pictures, logo, palette or code. Asking for a
          clone is refused and the attempt is recorded.
        </p>
      </div>

      {result ? (
        <div className="space-y-3">
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-sm font-semibold text-emerald-200">{result.app.code} — {result.app.name}</p>
            <p className={MONO}>{result.app.fileCount} files · {(result.app.totalBytes / 1024).toFixed(1)} KiB · vertical {result.app.vertical} · confidence {result.reconstruction.confidence}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">{result.reconstruction.statement}</p>
          </div>

          <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Delivery gate</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
              <span className="font-semibold">{result.deliveryGate.exportable ? 'Exportable' : `Not exportable — ${result.deliveryGate.code}`}</span>: {result.deliveryGate.reason}
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Derived pages (original structure)</p>
              <ul className="mt-1.5 space-y-1">
                {result.reconstruction.pages.map((p) => (
                  <li key={p.path} className="text-xs"><span className={MONO}>{p.path}</span> <span className="text-slate-400">— {p.title}. {p.purpose}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Deliberately NOT copied</p>
              <ul className="mt-1.5 space-y-1">
                {result.reconstruction.provenance.copied.map((c) => (
                  <li key={c} className="flex items-start gap-1.5 text-xs text-slate-400">
                    <XCircle className="mt-0.5 size-3 shrink-0 text-red-400/70" aria-hidden="true" /> {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cannot be reconstructed (never observed)</p>
            <ul className="mt-1.5 space-y-1">
              {result.reconstruction.provenance.notReconstructable.map((c) => (
                <li key={c} className="text-xs text-slate-500">• {c}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={`/#/admin/factory`}><Button variant="outline" size="sm"><Boxes className="mr-1.5 size-3.5" /> Review in App Factory</Button></a>
            <a href={result.endpoints.export}><Button variant="outline" size="sm"><Download className="mr-1.5 size-3.5" /> Export attempt (gated)</Button></a>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="rb-name" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Rebuild name (yours, not theirs)</label>
            <Input id="rb-name" className={INPUT} value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="e.g. Meridian Client Hub" />
          </div>
          <div>
            <label htmlFor="rb-client" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Internal owner / client</label>
            <Input id="rb-client" className={INPUT} value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="rb-color" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Brand colour (your own)</label>
            <Input id="rb-color" className={INPUT} value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#063B8F" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rb-cur" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Currency</label>
              <Input id="rb-cur" className={INPUT} value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} />
            </div>
            <div>
              <label htmlFor="rb-lang" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Language</label>
              <select id="rb-lang" className={INPUT} value={language} onChange={(e) => setLanguage(e.target.value as 'EN' | 'BN' | 'BOTH')}>
                <option value="EN">English</option><option value="BN">Bangla</option><option value="BOTH">Both</option>
              </select>
            </div>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="rb-notes" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Notes for the delivery team</label>
            <Input id="rb-notes" className={INPUT} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What we actually want to build, in our words." />
          </div>
          <div className="md:col-span-2">
            <Button onClick={build} disabled={busy}>
              {busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Boxes className="mr-1.5 size-3.5" />}
              {busy ? 'Deriving…' : 'Derive an original rebuild'}
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

export default ReaView
