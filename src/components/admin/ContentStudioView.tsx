'use client'

import { useState } from 'react'
import { Clapperboard, Film, Loader2, Megaphone, PackageOpen, RefreshCw, SearchCheck, Sparkles } from 'lucide-react'

import {
  api,
  fmtDateShort,
  parseMaybeJson,
  prettify,
  useApi,
  type ContentAsset,
  type ContentResponse,
} from '@/lib/admin-client'
import { DataTable } from './shared/DataTable'
import { EmptyState, PageHeader, SectionCard } from './shared/cards'
import { JsonView } from './shared/JsonView'
import { Markdownish } from './shared/Markdownish'
import { StatusBadge } from './shared/StatusBadge'
import { ACCENT, CARD, SCROLL_THIN } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const TYPES = ['MARKETING_KIT', 'SEO_BRIEF', 'SCRIPT', 'VIDEO_PLAN', 'IMAGE_PROMPT', 'HOOK', 'VOICEOVER', 'CAPTIONS'] as const
const ASPECTS = ['16:9', '9:16', '1:1', '4:5'] as const
const LANGS = ['EN', 'BN'] as const

function AssetContent({ asset }: { asset: ContentAsset }) {
  const parsed = parseMaybeJson(asset.content)
  if (parsed && typeof parsed === 'object') return <JsonView value={parsed} maxHeightClass="max-h-64" />
  return <Markdownish text={asset.content} />
}

export function ContentStudioView() {
  const { data, loading, error, refresh } = useApi<ContentResponse>('/api/admin/content')
  const assets = data?.assets ?? []
  const campaigns = data?.campaigns ?? []

  // generate form
  const [type, setType] = useState<string>('MARKETING_KIT')
  const [topic, setTopic] = useState('')
  const [language, setLanguage] = useState('EN')
  const [aspect, setAspect] = useState('16:9')
  const [duration, setDuration] = useState('60')
  const [busy, setBusy] = useState(false)
  const [generated, setGenerated] = useState<ContentAsset | null>(null)
  const [genNote, setGenNote] = useState<string | null>(null)

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!topic.trim()) {
      toast.error('Enter a topic for the content.')
      return
    }
    setBusy(true)
    setGenerated(null)
    setGenNote(null)
    try {
      const res = await api.generateContent({
        type,
        topic: topic.trim(),
        params: {
          language,
          aspect,
          durationSec: Number(duration) || undefined,
        },
      })
      if (res.asset) {
        setGenerated(res.asset)
        toast.success('Asset generated — content below is exactly what the pipeline returned.')
      } else {
        setGenNote(res.message ?? 'Generation did not return an asset.')
        toast.warning(res.message ?? 'Generation did not return an asset.')
      }
      refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed.'
      setGenNote(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Content Studio"
        description="Generate complete marketing kits, SEO briefs, scripts, video plans, and campaign creative — every saved asset is real pipeline output."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
            aria-label="Refresh content"
          >
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
          </Button>
        }
      />

      {error ? (
        <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Could not load content: {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <SectionCard title="Assets" description="Generated content assets" contentClassName="p-0">
            <DataTable
              columns={[
                { key: 'type', header: 'Type', cell: (a) => <span className="rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{a.type || '—'}</span> },
                { key: 'lang', header: 'Lang', cell: (a) => <span className="text-xs text-slate-500">{a.language || '—'}</span> },
                { key: 'title', header: 'Title', cell: (a) => <span className="font-medium text-slate-200">{a.title || '—'}</span> },
                { key: 'status', header: 'Status', cell: (a) => <StatusBadge status={a.status} /> },
                { key: 'duration', header: 'Duration', cell: (a) => <span className="tabular-nums text-slate-400">{a.durationSec ? `${a.durationSec}s` : '—'}</span> },
                { key: 'aspect', header: 'Aspect', cell: (a) => <span className="text-slate-400">{a.aspect || '—'}</span> },
                { key: 'created', header: 'Created', cell: (a) => <span className="text-xs text-slate-500">{fmtDateShort(a.createdAt)}</span> },
              ]}
              rows={assets}
              loading={loading}
              rowKey={(a) => a.id}
              empty={<EmptyState icon={Film} title="No assets yet" description="Generated assets will appear here — use the generator on the right." />}
              aria-label="Content assets"
              maxHeightClass="max-h-[50vh]"
            />
          </SectionCard>

          {generated ? (
            <SectionCard
              title={`Generated: ${generated.title || type}`}
              description={`${prettify(generated.type)} · ${generated.language ?? language} · ${generated.durationSec ? `${generated.durationSec}s · ` : ''}${generated.aspect ?? aspect} · ${prettify(generated.status)}`}
              actions={<StatusBadge status={generated.status} />}
            >
              <AssetContent asset={generated} />
            </SectionCard>
          ) : genNote ? (
            <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
              {genNote}
            </div>
          ) : null}

          <SectionCard title="Campaigns" description="Video/content campaign pipeline" contentClassName="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-slate-800/50" />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <EmptyState icon={Megaphone} title="No campaigns yet" description="Campaigns orchestrate research, scripting, production, and learning." />
            ) : (
              <ul className="divide-y divide-slate-800/60">
                {campaigns.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-200">{c.name || '—'}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {c.goal || 'No goal set'} {c.channel ? `· ${c.channel}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Generate Asset" description="Real AI generation via the content pipeline">
            <div className="mb-3 grid grid-cols-2 gap-2" aria-label="Featured marketing generators">
              <button type="button" onClick={() => setType('MARKETING_KIT')} className={cn('rounded-lg border p-2.5 text-left transition-colors', type === 'MARKETING_KIT' ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200' : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700')}>
                <PackageOpen className="mb-1 size-4" aria-hidden="true" />
                <span className="block text-xs font-semibold">Marketing kit</span>
                <span className="mt-0.5 block text-[9px] leading-snug opacity-70">Positioning, launch, ads, email & KPIs</span>
              </button>
              <button type="button" onClick={() => setType('SEO_BRIEF')} className={cn('rounded-lg border p-2.5 text-left transition-colors', type === 'SEO_BRIEF' ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200' : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700')}>
                <SearchCheck className="mb-1 size-4" aria-hidden="true" />
                <span className="block text-xs font-semibold">SEO brief</span>
                <span className="mt-0.5 block text-[9px] leading-snug opacity-70">Intent, outline, schema & conversion path</span>
              </button>
            </div>
            <form onSubmit={generate} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cs-type" className="text-xs text-slate-400">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger id="cs-type" className="h-9 border-slate-800 bg-slate-950/60 text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{prettify(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cs-topic" className="text-xs text-slate-400">Topic</Label>
                <Input
                  id="cs-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. How small businesses automate with n8n"
                  className="h-9 border-slate-800 bg-slate-950/60 text-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cs-lang" className="text-xs text-slate-400">Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger id="cs-lang" className="h-9 border-slate-800 bg-slate-950/60 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                      {LANGS.map((l) => (
                        <SelectItem key={l} value={l}>{l === 'EN' ? 'English' : 'Bangla'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cs-aspect" className="text-xs text-slate-400">Aspect</Label>
                  <Select value={aspect} onValueChange={setAspect}>
                    <SelectTrigger id="cs-aspect" className="h-9 border-slate-800 bg-slate-950/60 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                      {ASPECTS.map((a) => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cs-duration" className="text-xs text-slate-400">Duration (seconds)</Label>
                <Input
                  id="cs-duration"
                  type="number"
                  min={5}
                  max={600}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="h-9 border-slate-800 bg-slate-950/60 text-slate-200"
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full font-semibold" style={{ background: ACCENT }}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
                {busy ? 'Generating…' : 'Generate'}
              </Button>
            </form>
            <p className={cn(CARD, 'mt-3 rounded-md p-2.5 text-[10px] leading-relaxed text-slate-500')}>
              <Clapperboard className="mr-1 inline size-3" aria-hidden="true" />
              Safe/family-friendly content controls are enforced by the generation pipeline.
            </p>
          </SectionCard>

          {assets.length > 0 ? (
            <SectionCard title="Latest Asset Preview" description="Most recent asset content">
              <div className={cn('max-h-96 overflow-auto', SCROLL_THIN)}>
                <AssetContent asset={assets[0]} />
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  )
}
