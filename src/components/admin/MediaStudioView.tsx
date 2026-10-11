'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clapperboard, Download, Film, Loader2, Mic, RefreshCw, Subtitles, Sparkles, Copy, Wand2, Play } from 'lucide-react'
import { toast } from 'sonner'

import { fetchJson, ApiError } from '@/lib/admin-client'
import { PageHeader, SectionCard } from './shared/cards'
import { ACCENT, AMBER, INPUT, MONO } from './shared/styles'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { IMAGE_PROMPTS, ImagePromptPattern } from '@/data/image-prompts'

// Media Studio — script → timed shots → narration → captions → render spec.
// Rendering and voice are provider-gated; when no provider is configured the
// UI says so and the plan/script/captions remain fully usable.

interface JobRow {
  id: string; code: string; title: string; kind: string; language: string; aspect: string
  durationSec: number; status: string; renderState: string; voiceState: string; createdAt: string
}
interface Providers {
  render: { state: string; detail: string }
  voice: { state: string; detail: string }
  music: { state: string; detail: string }
}
interface Shot { id: string; seq: number; startSec: number; endSec: number; kind: string; visual: string; narration: string; overlay: string | null }

const KINDS = ['VIDEO', 'SHORT', 'AUDIO', 'VOICEOVER'] as const
const ASPECTS = ['16:9', '9:16', '1:1', '4:5'] as const

export function MediaStudioView() {
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [providers, setProviders] = useState<Providers | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [shots, setShots] = useState<Shot[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '', topic: '', kind: 'VIDEO' as (typeof KINDS)[number], aspect: '16:9' as (typeof ASPECTS)[number],
    durationSec: 60, language: 'EN', audience: '', cta: 'Book a call',
    points: 'the problem we remove\nhow the service works\nthe result the client gets',
  })

  const load = useCallback(async () => {
    try {
      const data = await fetchJson<{ jobs: JobRow[]; providers: Providers }>('/api/admin/media/jobs')
      setJobs(data.jobs); setProviders(data.providers)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load media jobs')
    }
  }, [])

  const openJob = useCallback(async (id: string) => {
    try {
      const data = await fetchJson<{ job: JobRow; shots: Shot[] }>(`/api/admin/media/jobs/${id}`)
      setSelected(id); setShots(data.shots)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load the job')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null)
    try {
      const res = await fetchJson<{ job: JobRow }>('/api/admin/media/jobs', { method: 'POST', body: form })
      toast.success(`${res.job.code} planned — script, shots and captions are ready.`)
      await load(); await openJob(res.job.id)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Planning failed'
      setError(msg); toast.error(msg)
    } finally { setBusy(false) }
  }

  const act = async (action: string) => {
    if (!selected) return
    setBusy(true)
    try {
      const res = await fetchJson<{ note: string }>(`/api/admin/media/jobs/${selected}`, { method: 'PATCH', body: { action } })
      toast.message(res.note)
      await Promise.all([load(), openJob(selected)])
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Action failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Media Studio"
        description="Video, shorts and voiceovers: brief → script → timed shots → narration → captions → render specification. Rendering is provider-gated and reported honestly — Tech360 never presents a file it did not render."
      />

      {providers ? (
        <div className="grid gap-2 md:grid-cols-3">
          {([
            ['Render', providers.render, Film],
            ['Voice / TTS', providers.voice, Mic],
            ['Music', providers.music, Clapperboard],
          ] as const).map(([label, state, Icon]) => (
            <div key={label} className={cn('rounded-lg border p-3', state.state === 'AVAILABLE' ? 'border-emerald-600/40 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/40')}>
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-300"><Icon className="size-3.5" />{label}: <span className={state.state === 'AVAILABLE' ? 'text-emerald-400' : 'text-amber-400'}>{state.state}</span></p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{state.detail}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* ——— Mureka-inspired centered studio ——— */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-[#0B1220] p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Wand2 className="size-4 text-[#009FE3]" /> Creation studio — prompt to shot plan</h3>
          <span className="text-xs text-slate-500">Deterministic • same brief → same timings • <span className={providers?.render.state === 'AVAILABLE' ? 'text-emerald-400' : 'text-amber-400'}>{providers?.render.state ?? '—'}</span></span>
        </div>

        {/* Template carousel — 36 prompts across 8 cats, one-click fill */}
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Template carousel — pick a pattern to prefill the brief</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
            {IMAGE_PROMPTS.slice(0, 12).map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    title: tpl.name,
                    topic: tpl.useCase.slice(0, 80),
                    points: `${tpl.prompt.slice(0, 120)}\nTip: ${tpl.tip}`,
                  }))
                  toast.success(`Template "${tpl.name}" loaded — edit the brief then plan.`)
                }}
                className="group flex w-[220px] shrink-0 flex-col rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-left transition hover:border-[#009FE3]/40 hover:bg-slate-900"
              >
                <span className="text-xs font-semibold text-slate-200 line-clamp-1">{tpl.name}</span>
                <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[#009FE3]">{tpl.category}</span>
                <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-500">{tpl.useCase}</span>
                <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 group-hover:text-[#009FE3]"><Copy className="size-3" /> Use template</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {['All', 'Website & Landing', 'Brand & Identity', 'Social & Ads', 'Content & Blog'].map((c) => (
              <span key={c} className="rounded-full border border-slate-800 bg-slate-900/40 px-2.5 py-1 text-[11px] text-slate-500">{c}</span>
            ))}
            <a href="#/admin/prompt-library" className="text-[11px] font-semibold text-[#009FE3] hover:underline">Open full library (36) →</a>
          </div>
        </div>

        <form onSubmit={create} className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-slate-400">Title
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={cn(INPUT, 'mt-1 w-full')} placeholder="Why UK admissions teams choose Tech360" />
          </label>
          <label className="text-xs text-slate-400">Topic / offer
            <input required value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className={cn(INPUT, 'mt-1 w-full')} placeholder="Student recruitment CRM for UK consultancies" />
          </label>
          <div className="grid grid-cols-4 gap-2">
            <label className="text-xs text-slate-400">Kind
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as (typeof KINDS)[number] })} className={cn(INPUT, 'mt-1 w-full')}>
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-400">Aspect
              <select value={form.aspect} onChange={(e) => setForm({ ...form, aspect: e.target.value as (typeof ASPECTS)[number] })} className={cn(INPUT, 'mt-1 w-full')}>
                {ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-400">Seconds
              <input type="number" min={10} max={600} value={form.durationSec} onChange={(e) => setForm({ ...form, durationSec: Number(e.target.value) })} className={cn(INPUT, 'mt-1 w-full')} />
            </label>
            <label className="text-xs text-slate-400">Language
              <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className={cn(INPUT, 'mt-1 w-full')}>
                <option value="EN">English</option><option value="BN">বাংলা</option>
              </select>
            </label>
          </div>
          <label className="text-xs text-slate-400">Audience
            <input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} className={cn(INPUT, 'mt-1 w-full')} placeholder="Admissions directors in London" />
          </label>
          <label className="text-xs text-slate-400">Call to action
            <input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} className={cn(INPUT, 'mt-1 w-full')} />
          </label>
          <label className="text-xs text-slate-400 md:col-span-2">Key points (one per line, max 6)
            <textarea rows={3} value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} className={cn(INPUT, 'mt-1 w-full')} />
          </label>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy} style={{ backgroundColor: ACCENT }}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
              Plan script, shots and captions
            </Button>
            <span className="text-xs text-slate-500">Output: script → {form.durationSec}s shot plan → narration → SRT/VTT → render spec. Honest <span className="font-semibold text-amber-400">RENDER_NOT_CONFIGURED</span> until provider is connected — never a fake file.</span>
            {error ? <p className="w-full text-xs text-red-400">{error}</p> : null}
          </div>
        </form>
      </div>

      <SectionCard title="Generation history & asset library" description={`${jobs.length} job${jobs.length === 1 ? '' : 's'} — QUEUED → RUNNING → COMPLETED / FAILED, honest render state per job`}
        actions={<Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-1 size-3.5" />Refresh</Button>}>
        {jobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
            <Clapperboard className="mx-auto size-8 text-slate-600" />
            <p className="mt-3 text-sm font-semibold text-slate-200">No media jobs yet — pick a template above to start</p>
            <p className="mt-1 text-xs text-slate-500">Try: “Abstract tech hero background” → Plan → see script + shots + captions before any render. Saved jobs appear here with Save-to-project & export.</p>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((j) => (
              <li key={j.id} className={`rounded-lg border p-3 transition ${selected === j.id ? 'border-[#009FE3]/50 bg-[#009FE3]/5' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'}`}>
                <button type="button" onClick={() => void openJob(j.id)} className="w-full text-left">
                  <span className="block truncate text-sm font-semibold text-slate-200">{j.code} · {j.title}</span>
                  <span className="block text-xs text-slate-500">{j.kind} · {j.aspect} · {j.durationSec}s · {j.language}</span>
                  <span className="mt-1 inline-flex items-center gap-1.5 text-[10px]"><span className={`rounded-full px-2 py-0.5 font-bold ${j.status === 'COMPLETED' || j.status === 'RENDERED' ? 'bg-emerald-500/15 text-emerald-400' : j.status === 'FAILED' ? 'bg-red-500/15 text-red-400' : 'bg-slate-800 text-slate-400'}`}>{j.status}</span><span className="text-slate-600">voice {j.voiceState} · render {j.renderState}</span></span>
                </button>
                <div className="mt-2 flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => void openJob(j.id)}><Play className="mr-1 size-3" />Open</Button>
                  <a href={`/api/admin/media/jobs/${j.id}?format=srt`} className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"><Download className="size-3" />SRT</a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {selected ? (
        <SectionCard
          title="Shot plan"
          description={`${shots.length} shots · renderer state ${jobs.find((j) => j.id === selected)?.renderState ?? '—'}`}
          actions={
            <div className="flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void act('captions')}><Subtitles className="mr-1 size-3.5" />Captions</Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void act('voice')}><Mic className="mr-1 size-3.5" />Voice pass</Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void act('queue-render')}><Film className="mr-1 size-3.5" />Queue render</Button>
              <a href={`/api/admin/media/jobs/${selected}?format=srt`} className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300"><Download className="size-3.5" />SRT</a>
              <a href={`/api/admin/media/jobs/${selected}?format=vtt`} className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300"><Download className="size-3.5" />VTT</a>
              <a href={`/api/admin/media/jobs/${selected}?format=composition`} className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300"><Download className="size-3.5" />Render spec</a>
            </div>
          }>
          <ol className="space-y-2">
            {shots.map((s) => (
              <li key={s.id} className="rounded-md border border-slate-800 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-200">{s.seq}. {s.kind}</span>
                  <span className={cn(MONO, 'text-slate-500')}>{String(s.startSec).padStart(3, '0')}s → {String(s.endSec).padStart(3, '0')}s</span>
                </div>
                <p className="mt-1 text-xs text-slate-400"><span className="text-slate-500">Visual:</span> {s.visual}</p>
                <p className="mt-1 text-xs text-slate-300"><span className="text-slate-500">VO:</span> {s.narration}</p>
                {s.overlay ? <p className="mt-1 text-xs" style={{ color: AMBER }}>On-screen: {s.overlay}</p> : null}
              </li>
            ))}
          </ol>
        </SectionCard>
      ) : null}
    </div>
  )
}
