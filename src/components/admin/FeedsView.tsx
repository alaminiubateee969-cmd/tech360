'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, RefreshCw, Rss, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { fetchJson, ApiError } from '@/lib/admin-client'
import { PageHeader, SectionCard } from './shared/cards'
import { ACCENT, INPUT } from './shared/styles'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Feed Hub — server-side RSS/Atom/JSON ingestion. Sources are public industry
// feeds; an ingested item becomes an ORIGINAL content idea (never a republish).

interface Source { id: string; name: string; url: string; kind: string; category: string; status: string; lastFetchedAt: string | null; lastError: string | null; itemCount: number; autoIdea: boolean }
interface Item { id: string; title: string; link: string; sourceName: string; sourceCategory: string; publishedAt: string | null; tags: string[]; ideaAssetId: string | null }

export function FeedsView() {
  const [sources, setSources] = useState<Source[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', url: '', category: 'INDUSTRY', autoIdea: true })

  const load = useCallback(async () => {
    try {
      const [s, i] = await Promise.all([
        fetchJson<{ sources: Source[] }>('/api/admin/feeds/sources'),
        fetchJson<{ items: Item[] }>('/api/admin/feeds/items'),
      ])
      setSources(s.sources); setItems(i.items)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load feeds')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null)
    try {
      await fetchJson('/api/admin/feeds/sources', { method: 'POST', body: form })
      toast.success('Feed registered — ingest it to pull the first items.')
      setForm({ name: '', url: '', category: form.category, autoIdea: form.autoIdea })
      await load()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not register the feed'
      setError(msg); toast.error(msg)
    } finally { setBusy(false) }
  }

  const ingest = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetchJson<{ received: number; created: number; skipped: number; ideasCreated: number; kind: string }>(`/api/admin/feeds/sources/${id}`, { method: 'PATCH', body: { action: 'ingest' } })
      toast.success(`${res.kind}: ${res.created} new item(s), ${res.skipped} already known, ${res.ideasCreated} content idea(s) created.`)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Ingest failed')
      await load()
    } finally { setBusyId(null) }
  }

  const remove = async (id: string) => {
    setBusyId(id)
    try {
      await fetchJson(`/api/admin/feeds/sources/${id}`, { method: 'DELETE' })
      toast.success('Feed removed with its stored items.')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed')
    } finally { setBusyId(null) }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Feed Hub"
        description="Register public industry feeds (RSS 2.0, Atom, JSON Feed). The server fetches them directly — SSRF-guarded, size-limited — stores new items once, and turns each new signal into an original content idea in Content Studio."
      />

      <SectionCard title="Register a feed" description="Only public http(s) hosts are accepted; private and loopback addresses are refused.">
        <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
          <label className="text-xs text-slate-400 md:col-span-1">Name
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={cn(INPUT, 'mt-1 w-full')} placeholder="UK immigration news" />
          </label>
          <label className="text-xs text-slate-400 md:col-span-2">Feed URL
            <input required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className={cn(INPUT, 'mt-1 w-full')} placeholder="https://example.com/feed.xml" />
          </label>
          <label className="text-xs text-slate-400">Category
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value.toUpperCase() })} className={cn(INPUT, 'mt-1 w-full')} />
          </label>
          <div className="flex items-center gap-3 md:col-span-4">
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input type="checkbox" checked={form.autoIdea} onChange={(e) => setForm({ ...form, autoIdea: e.target.checked })} />
              Create a content idea for each new item
            </label>
            <Button type="submit" size="sm" disabled={busy} style={{ backgroundColor: ACCENT }}>
              {busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Plus className="mr-1 size-3.5" />}Register
            </Button>
          </div>
        </form>
        {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
      </SectionCard>

      <SectionCard title="Sources" description={`${sources.length} registered`}
        actions={<Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-1 size-3.5" />Refresh</Button>}>
        {sources.length === 0 ? <p className="text-sm text-slate-500">No feeds registered yet.</p> : (
          <ul className="divide-y divide-slate-800">
            {sources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm text-slate-200"><Rss className="size-3.5 text-slate-600" />{s.name}</p>
                  <p className="truncate text-xs text-slate-500">{s.url}</p>
                  <p className="text-xs text-slate-600">
                    {s.kind} · {s.category} · {s.itemCount} item(s) · last fetch {s.lastFetchedAt ? new Date(s.lastFetchedAt).toLocaleString() : 'never'}
                    {s.status === 'ERROR' ? <span className="text-red-400"> · {s.lastError}</span> : null}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" disabled={busyId === s.id} onClick={() => void ingest(s.id)}>
                    {busyId === s.id ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <RefreshCw className="mr-1 size-3.5" />}Ingest
                  </Button>
                  <Button variant="outline" size="sm" disabled={busyId === s.id} onClick={() => void remove(s.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Latest signals" description={`${items.length} item(s) — each is a signal to react to, not text to republish.`}>
        {items.length === 0 ? <p className="text-sm text-slate-500">Nothing ingested yet.</p> : (
          <ul className="divide-y divide-slate-800">
            {items.slice(0, 60).map((i) => (
              <li key={i.id} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a href={i.link || '#'} target="_blank" rel="noreferrer noopener" className="min-w-0 text-sm text-slate-200 hover:text-[#009FE3]">{i.title}</a>
                  <span className="text-[10px] uppercase tracking-wide text-slate-600">{i.sourceName}{i.ideaAssetId ? ' · idea created' : ''}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {i.publishedAt ? new Date(i.publishedAt).toLocaleDateString() : 'undated'} · {i.sourceCategory}
                  {i.tags.length ? ` · ${i.tags.join(', ')}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
