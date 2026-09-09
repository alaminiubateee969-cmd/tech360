'use client'

import { useEffect, useMemo, useState } from 'react'
import { Brain, Loader2, Plus, RefreshCw, Search } from 'lucide-react'

import { api, fmtDate, num, useApi, type ClientRow, type MemoriesResponse } from '@/lib/admin-client'
import { DataTable } from './shared/DataTable'
import { EmptyState, PageHeader } from './shared/cards'
import { ClientPicker } from './shared/Pager'
import { ACCENT } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const SCOPES = [
  'COMPANY', 'BRAND', 'SERVICES', 'PRICING', 'POLICIES', 'CLIENT', 'PROJECT', 'COMMUNICATION',
  'WORKFLOW', 'KNOWLEDGE', 'AGENT', 'TASK', 'LESSON',
] as const

export function MemoryView() {
  const [scope, setScope] = useState('ALL')
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 300)
    return () => clearTimeout(t)
  }, [input])

  const url = useMemo(() => {
    const p = new URLSearchParams()
    if (scope !== 'ALL') p.set('scope', scope)
    if (query) p.set('query', query)
    return `/api/admin/memory?${p.toString()}`
  }, [scope, query])

  const { data, loading, error, refresh } = useApi<MemoriesResponse>(url)
  const memories = data?.memories ?? []

  const [open, setOpen] = useState(false)
  const [mScope, setMScope] = useState<string>('COMPANY')
  const [mKey, setMKey] = useState('')
  const [mContent, setMContent] = useState('')
  const [mImportance, setMImportance] = useState('5')
  const [client, setClient] = useState<ClientRow | null>(null)
  const [busy, setBusy] = useState(false)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!mKey.trim() || !mContent.trim()) {
      toast.error('Key and content are required.')
      return
    }
    setBusy(true)
    try {
      const res = await api.addMemory({
        scope: mScope,
        key: mKey.trim(),
        content: mContent.trim(),
        clientId: client?.id,
        importance: Number(mImportance) || 5,
      })
      toast.success(res.message ?? 'Memory stored.')
      setOpen(false)
      setMKey('')
      setMContent('')
      setClient(null)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to store memory.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="AI Memory"
        description="Durable knowledge the agent workforce recalls across conversations, projects, and clients."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
              aria-label="Refresh memory"
            >
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setOpen(true)} className="font-semibold" style={{ background: ACCENT }}>
              <Plus className="size-4" aria-hidden="true" /> Add Memory
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
          <Input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search memory content…"
            aria-label="Search memory"
            className="h-9 border-slate-800 bg-slate-950/60 pl-9 text-slate-200 placeholder:text-slate-600"
          />
        </div>
        <div>
          <label htmlFor="mem-scope" className="sr-only">Filter by scope</label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger id="mem-scope" className="h-9 w-full border-slate-800 bg-slate-950/60 text-slate-200 sm:w-[190px]">
              <SelectValue placeholder="All scopes" />
            </SelectTrigger>
            <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
              <SelectItem value="ALL">All scopes</SelectItem>
              {SCOPES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <div role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Could not load memory: {error}
        </div>
      ) : null}

      <DataTable
        columns={[
          {
            key: 'scope',
            header: 'Scope',
            cell: (m) => <span className="rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{m.scope || '—'}</span>,
          },
          { key: 'key', header: 'Key', cell: (m) => <span className="font-mono text-xs text-slate-300">{m.key || '—'}</span> },
          {
            key: 'content',
            header: 'Content',
            className: 'max-w-[420px] whitespace-normal',
            cell: (m) => <p className="truncate text-[13px] text-slate-400" title={m.content ?? ''}>{m.content || '—'}</p>,
          },
          { key: 'client', header: 'Client', cell: (m) => <span className="font-mono text-xs text-slate-500">{m.clientId || '—'}</span> },
          { key: 'importance', header: 'Importance', cell: (m) => <span className="tabular-nums text-slate-400">{num(m.importance)}</span> },
          { key: 'updated', header: 'Updated', cell: (m) => <span className="text-xs text-slate-500">{fmtDate(m.updatedAt ?? m.createdAt)}</span> },
        ]}
        rows={memories}
        loading={loading}
        rowKey={(m) => m.id}
        empty={<EmptyState icon={Brain} title="No memories found" description="Stored knowledge will appear here — agents and admins write memories as they work." />}
        aria-label="Memory table"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Add Memory</DialogTitle>
            <DialogDescription className="text-slate-500">
              Store durable knowledge that agents will recall in future work.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={add} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mem-new-scope" className="text-xs text-slate-400">Scope</Label>
                <Select value={mScope} onValueChange={setMScope}>
                  <SelectTrigger id="mem-new-scope" className="h-9 border-slate-800 bg-slate-950/60 text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                    {SCOPES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mem-importance" className="text-xs text-slate-400">Importance (1–10)</Label>
                <Input
                  id="mem-importance"
                  type="number"
                  min={1}
                  max={10}
                  value={mImportance}
                  onChange={(e) => setMImportance(e.target.value)}
                  className="h-9 border-slate-800 bg-slate-950/60 text-slate-200"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mem-key" className="text-xs text-slate-400">Key</Label>
              <Input
                id="mem-key"
                value={mKey}
                onChange={(e) => setMKey(e.target.value)}
                placeholder="e.g. payment_policy_standard"
                className="h-9 border-slate-800 bg-slate-950/60 font-mono text-xs text-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mem-content" className="text-xs text-slate-400">Content</Label>
              <Textarea
                id="mem-content"
                rows={4}
                required
                value={mContent}
                onChange={(e) => setMContent(e.target.value)}
                placeholder="What should be remembered…"
                className="border-slate-800 bg-slate-950/60 text-sm text-slate-200"
              />
            </div>
            <ClientPicker value={client} onChange={setClient} label="Link to client (optional)" />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy} className="text-slate-400 hover:text-slate-200">
                Cancel
              </Button>
              <Button type="submit" disabled={busy} className="font-semibold" style={{ background: ACCENT }}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                Store Memory
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
