'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, Lightbulb, Search, Sparkles, Wand2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  IMAGE_PROMPTS,
  IMAGE_PROMPT_CATEGORIES,
  allPromptTags,
  promptPlaceholders,
  type ImagePromptPattern,
} from '@/data/image-prompts'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { CARD, INPUT } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ------------------------------------------------------------
// Prompt Library — a curated, tag-filterable, copyable gallery of
// proven image-prompt patterns (gpt4o-image-prompts parity) adapted
// to TECH360's business: website heroes, brand work, social ads,
// blog covers, dashboard art, service photography and illustration
// styles. Every prompt is a TEMPLATE: {placeholders} are replaced
// before use. The library renders nothing itself — the platform's
// honest-provider principle applies: prompts are prompts, not
// claims of generated images.
// ------------------------------------------------------------

function PromptCard({ p }: { p: ImagePromptPattern }) {
  const [copied, setCopied] = useState(false)
  const placeholders = promptPlaceholders(p.prompt)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.prompt)
      setCopied(true)
      toast.success(`Copied “${p.name}” to the clipboard`)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Clipboard unavailable — select and copy the text manually.')
    }
  }

  return (
    <article className={cn(CARD, 'flex min-w-0 flex-col p-4')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-200" title={p.name}>
            {p.name}
          </h3>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">{p.category}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={copy}
          aria-label={`Copy prompt: ${p.name}`}
          className="shrink-0 border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
        >
          {copied ? <Check className="size-3.5 text-emerald-400" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-400">{p.useCase}</p>

      <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/60 p-3">
        <p className="max-h-40 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-300 [scrollbar-width:thin]">
          {p.prompt}
        </p>
      </div>

      {placeholders.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Placeholders to replace">
          <span className="text-[10px] uppercase tracking-wide text-slate-600">Replace:</span>
          {placeholders.map((ph) => (
            <code key={ph} className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] text-[#009FE3]">
              {`{${ph}}`}
            </code>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500">
        <Lightbulb className="mt-0.5 size-3 shrink-0 text-amber-400/80" aria-hidden="true" />
        <span>{p.tip}</span>
      </div>

      <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
        {p.tags.map((t) => (
          <span key={t} className="rounded-full border border-slate-800 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-400">
            {t}
          </span>
        ))}
      </div>
    </article>
  )
}

export function PromptLibraryView() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'ALL' | (typeof IMAGE_PROMPT_CATEGORIES)[number]>('ALL')
  const [tag, setTag] = useState<string | null>(null)

  const tags = useMemo(() => allPromptTags(), [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return IMAGE_PROMPTS.filter((p) => {
      if (category !== 'ALL' && p.category !== category) return false
      if (tag && !p.tags.includes(tag)) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.prompt.toLowerCase().includes(q) ||
        p.useCase.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q))
      )
    })
  }, [query, category, tag])

  const tagOptions = useMemo(() => {
    // only offer tags that exist within the current category+query filter
    const inScope = IMAGE_PROMPTS.filter((p) => {
      if (category !== 'ALL' && p.category !== category) return false
      const q = query.trim().toLowerCase()
      if (q && !(p.name.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q) || p.useCase.toLowerCase().includes(q))) return false
      return true
    })
    const s = new Set<string>()
    for (const p of inScope) for (const t of p.tags) s.add(t)
    return [...s].sort()
  }, [category, query])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Prompt Library"
        description="Curated image-prompt patterns for site art, brand work, social ads and content — searchable, tag-filterable, one-click copy."
      />

      {/* KPI chips */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Prompt patterns" value={String(IMAGE_PROMPTS.length)} icon={Sparkles} tone="accent" sub="Curated for agency use cases" />
        <KpiCard label="Categories" value={String(IMAGE_PROMPT_CATEGORIES.length)} icon={Wand2} tone="slate" sub="Hero → illustration styles" />
        <KpiCard label="Tags" value={String(tags.length)} icon={Search} tone="green" sub="Cross-cutting filter chips" />
        <KpiCard label="Matching now" value={String(filtered.length)} icon={Lightbulb} tone={filtered.length > 0 ? 'accent' : 'amber'} sub="After your current filters" />
      </div>

      {/* Controls */}
      <SectionCard
        title="Find a pattern"
        description="Search the library, filter by category or tag, then copy and fill the {placeholders}."
      >
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prompts, use cases, tags…"
              aria-label="Search prompt library"
              className={cn(INPUT, 'h-9 pl-9')}
            />
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
            <button
              type="button"
              onClick={() => setCategory('ALL')}
              aria-pressed={category === 'ALL'}
              className={cn(
                'rounded-full border px-3 py-1 text-[11px] transition-colors',
                category === 'ALL'
                  ? 'border-[#009FE3]/60 bg-[#009FE3]/15 text-[#009FE3]'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200',
              )}
            >
              All categories
            </button>
            {IMAGE_PROMPT_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={cn(
                  'rounded-full border px-3 py-1 text-[11px] transition-colors',
                  category === c
                    ? 'border-[#009FE3]/60 bg-[#009FE3]/15 text-[#009FE3]'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200',
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
            {tag ? (
              <button
                type="button"
                onClick={() => setTag(null)}
                aria-pressed
                className="rounded-full border border-emerald-500/50 bg-emerald-500/15 px-3 py-1 text-[11px] text-emerald-300"
              >
                {tag} ✕
              </button>
            ) : (
              <span className="text-[10px] uppercase tracking-wide text-slate-600">Tags:</span>
            )}
            {tagOptions.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(t === tag ? null : t)}
                aria-pressed={t === tag}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                  t === tag
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-800 bg-slate-900/60 text-slate-500 hover:text-slate-300',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Gallery */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No prompts match"
          description="Try clearing the tag filter or searching for something broader (e.g. “hero”, “brand”, “social”)."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((p) => (
            <PromptCard key={p.id} p={p} />
          ))}
        </div>
      )}

      {/* Honest note */}
      <p className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs leading-relaxed text-slate-500">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-slate-600" aria-hidden="true" />
        <span>
          <span className="font-medium text-slate-400">Prompts, not pixels:</span> this library is a copy-and-adapt starting
          point for image work with any provider or tool. TECH360 renders no images itself — when the media pipeline is
          configured its provider states are reported honestly, and every generated visual used publicly is labelled as a
          concept. Placeholders in {'{curly braces}'} must be replaced before use.
        </span>
      </p>
    </div>
  )
}
