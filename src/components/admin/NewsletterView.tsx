'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  Mail,
  MailX,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { fetchJson, fmtDateShort, num, useApi, ApiError } from '@/lib/admin-client'
import { DataTable, type Column } from './shared/DataTable'
import { ReviewPanel } from './shared/ReviewPanel'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { ACCENT, AXIS_TICK, GREEN, SCROLL_THIN, SLATE_GRID } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

// ------------------------------------------------------------
// Newsletter studio (Ghost-parity, honest edition)
// Local types mirror the /api/admin/newsletter contract.
// ------------------------------------------------------------

interface SubscriberRow {
  id: string
  email: string
  name?: string | null
  status: string
  source: string
  unsubscribedAt?: string | null
  createdAt?: string | null
}

interface CampaignRow {
  id: string
  name: string
  subject: string
  body: string
  status: string
  sentAt?: string | null
  recipientCount?: number | null
  agentExecId?: string | null
  createdBy?: string | null
  createdAt?: string | null
}

interface NewsletterResponse {
  migrated?: number
  subscribers?: SubscriberRow[]
  campaigns?: CampaignRow[]
  growth?: Array<{ date?: string | null; total?: number | null }>
  stats?: { active?: number | null; unsubscribed?: number | null; total?: number | null; campaignsSent?: number | null }
}

const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#0d1526',
  border: '1px solid #1e293b',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
}

/** Plain-text preview of an HTML-ish campaign body. */
function bodyExcerpt(body: string, max = 220): string {
  const text = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function NewsletterView() {
  const { data, loading, error, refresh } = useApi<NewsletterResponse>('/api/admin/newsletter')

  const [subQuery, setSubQuery] = useState('')
  const [draftOpen, setDraftOpen] = useState(false)
  const [draftTopic, setDraftTopic] = useState('')
  const [draftBusy, setDraftBusy] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [editing, setEditing] = useState<CampaignRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)

  useEffect(() => {
    if (draftOpen) {
      setDraftTopic('')
      setDraftError(null)
    }
  }, [draftOpen])

  useEffect(() => {
    if (editing) {
      setEditName(editing.name ?? '')
      setEditSubject(editing.subject ?? '')
      setEditBody(editing.body ?? '')
    }
  }, [editing])

  const subscribers = useMemo(() => data?.subscribers ?? [], [data])
  const campaigns = useMemo(() => data?.campaigns ?? [], [data])
  const stats = data?.stats ?? {}

  const filteredSubscribers = useMemo(() => {
    const q = subQuery.trim().toLowerCase()
    if (!q) return subscribers
    return subscribers.filter((s) => s.email.toLowerCase().includes(q) || (s.name ?? '').toLowerCase().includes(q))
  }, [subscribers, subQuery])

  const growth = useMemo(
    () => (data?.growth ?? []).map((p) => ({ date: (p.date ?? '').slice(5), total: num(p.total) })),
    [data],
  )
  const growth30 = useMemo(() => {
    const g = data?.growth ?? []
    if (g.length < 2) return 0
    return num(g[g.length - 1].total) - num(g[0].total)
  }, [data])

  const subColumns: Column<SubscriberRow>[] = [
    { key: 'email', header: 'Email', cell: (r) => <span className="font-medium text-slate-200">{r.email}</span> },
    { key: 'name', header: 'Name', cell: (r) => <span className="text-slate-400">{r.name || '—'}</span> },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} title={r.status === 'UNSUBSCRIBED' && r.unsubscribedAt ? `Unsubscribed ${fmtDateShort(r.unsubscribedAt)}` : undefined} /> },
    { key: 'source', header: 'Source', cell: (r) => <span className="text-xs text-slate-500">{r.source || '—'}</span> },
    { key: 'created', header: 'Subscribed', cell: (r) => <span className="text-xs text-slate-500">{fmtDateShort(r.createdAt)}</span> },
  ]

  async function createDraft(e: React.FormEvent) {
    e.preventDefault()
    if (draftBusy) return
    setDraftBusy(true)
    setDraftError(null)
    try {
      const res = await fetchJson<{ ok?: boolean; campaign?: CampaignRow; error?: string }>('/api/admin/newsletter/campaigns/draft', {
        method: 'POST',
        body: { topic: draftTopic.trim() || undefined },
      })
      toast.success(`Draft created: “${res.campaign?.subject ?? res.campaign?.name ?? 'new campaign'}”. Review, edit, then send.`)
      setDraftOpen(false)
      refresh()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'AI draft failed.'
      setDraftError(msg)
      toast.error(msg) // honest failure (e.g. provider quota) — shown verbatim
    } finally {
      setDraftBusy(false)
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (draftBusy || !editing) return
    setEditBusy(true)
    try {
      await fetchJson<{ ok?: boolean }>(`/api/admin/newsletter/campaigns/${encodeURIComponent(editing.id)}`, {
        method: 'PUT',
        body: { name: editName.trim(), subject: editSubject.trim(), body: editBody },
      })
      toast.success('Draft updated.')
      setEditing(null)
      refresh()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Update failed.'
      toast.error(msg)
    } finally {
      setEditBusy(false)
    }
  }

  async function sendCampaign(c: CampaignRow) {
    if (sendingId) return
    setSendingId(c.id)
    try {
      const res = await fetchJson<{ ok?: boolean; recipientCount?: number; status?: string }>(`/api/admin/newsletter/campaigns/${encodeURIComponent(c.id)}/send`, {
        method: 'POST',
      })
      toast.success(`Campaign sent to ${res.recipientCount ?? 0} active subscriber(s).`)
      refresh()
    } catch (err) {
      // Expected honest path while SMTP is not configured: 409 with the
      // real reason. Show it verbatim — never pretend a send happened.
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Send failed.'
      toast.error(msg)
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Newsletter"
        description="Subscriber studio — honest growth, AI drafting, one-click honest sends."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
            aria-label="Refresh newsletter data"
          >
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
          </Button>
        }
      />

      {error ? (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Could not load newsletter data: {error}
        </div>
      ) : null}

      {/* KPI chips */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active subscribers" value={num(stats.active)} icon={Users} tone="accent" loading={loading} sub="Confirmed, reachable list members" />
        <KpiCard label="Unsubscribed" value={num(stats.unsubscribed)} icon={MailX} tone="slate" loading={loading} sub="Kept on record — never deleted" />
        <KpiCard label="Campaigns sent" value={num(stats.campaignsSent)} icon={Send} tone="green" loading={loading} sub="Lifetime dispatches via the EMAIL channel" />
        <KpiCard label="30-day growth" value={`${growth30 >= 0 ? '+' : ''}${growth30}`} icon={Mail} tone={growth30 > 0 ? 'green' : 'amber'} loading={loading} sub="Net new subscribers, last 30 days" />
      </div>

      {/* Growth chart */}
      <SectionCard
        title="Subscriber Growth"
        description="Cumulative subscriber count, rolling 30-day window"
        contentClassName="p-2 sm:p-4"
      >
        {loading ? (
          <Skeleton className="w-full bg-slate-800/50" style={{ height: 240 }} />
        ) : growth.length === 0 ? (
          <div style={{ height: 240 }} className="flex items-center justify-center">
            <EmptyState title="No subscribers yet" description="The curve starts moving the moment the first visitor subscribes from the site footer." />
          </div>
        ) : (
          <div style={{ height: 240 }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growth} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="subGrowth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={SLATE_GRID} />
                <XAxis dataKey="date" tick={{ fill: AXIS_TICK, fontSize: 11 }} stroke={SLATE_GRID} />
                <YAxis tick={{ fill: AXIS_TICK, fontSize: 11 }} stroke={SLATE_GRID} allowDecimals={false} width={36} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="total" name="Subscribers" stroke={ACCENT} strokeWidth={2} fill="url(#subGrowth)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* Subscribers table */}
      <SectionCard
        title="Subscribers"
        description={subscribers.length > 0 ? `${subscribers.length} on record — latest 500 shown` : 'Collected from the site footer and legacy newsletter forms'}
        contentClassName="p-0"
      >
        <div className="p-4 pb-3">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
            <Input
              type="search"
              value={subQuery}
              onChange={(e) => setSubQuery(e.target.value)}
              placeholder="Search by email or name…"
              aria-label="Search subscribers"
              className="h-9 border-slate-800 bg-slate-950/60 pl-9 text-slate-200 placeholder:text-slate-600"
            />
          </div>
        </div>
        <DataTable
          columns={subColumns}
          rows={filteredSubscribers}
          loading={loading}
          rowKey={(r) => r.id}
          maxHeightClass="max-h-96"
          empty={
            <EmptyState
              icon={Users}
              title={subQuery ? 'No subscribers match this search' : 'No subscribers yet'}
              description={
                subQuery
                  ? 'Try a different email or name.'
                  : 'This list fills with real opt-ins only — the footer signup writes here the moment someone subscribes.'
              }
            />
          }
          aria-label="Newsletter subscribers table"
        />
      </SectionCard>

      {/* Campaigns */}
      <SectionCard
        title="Campaigns"
        description="AI-drafted, human-edited, honestly sent — DRAFT until the EMAIL channel is live"
        contentClassName="p-4"
        actions={
          <Button size="sm" onClick={() => setDraftOpen(true)} disabled={draftBusy} style={{ background: ACCENT }} aria-label="Draft a new campaign with AI">
            <Sparkles className="size-4" aria-hidden="true" /> New campaign
          </Button>
        }
      >
        {loading ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full bg-slate-800/50" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No campaigns yet"
            description="Start with an AI draft: give it a topic (or let the agent choose), review the copy, edit anything, then send when the EMAIL channel is configured."
            action={
              <Button size="sm" variant="outline" onClick={() => setDraftOpen(true)} className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100">
                <Sparkles className="size-4" aria-hidden="true" /> Draft the first campaign
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {campaigns.map((c) => {
              const isDraft = (c.status ?? '').toUpperCase() === 'DRAFT'
              const isSent = (c.status ?? '').toUpperCase() === 'SENT'
              return (
                <article key={c.id} className="flex min-w-0 flex-col rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-200" title={c.name}>{c.name}</h3>
                      <p className="mt-0.5 truncate text-xs text-[#009FE3]" title={c.subject}>{c.subject}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="mt-2 line-clamp-3 min-h-[2.8rem] text-xs leading-relaxed text-slate-400">{bodyExcerpt(c.body)}</p>
                  <div className="mt-2 space-y-1">
                    {c.agentExecId ? (
                      <p className="font-mono text-[11px] text-emerald-400/90">
                        AI-drafted · execution {c.agentExecId.slice(0, 8)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-600">Human-written draft</p>
                    )}
                    <p className="text-[11px] text-slate-500">
                      Created {fmtDateShort(c.createdAt)}
                      {c.createdBy ? ` · by ${c.createdBy}` : ''}
                      {isSent ? ` · sent ${fmtDateShort(c.sentAt)} to ${c.recipientCount ?? 0} recipient(s)` : ''}
                    </p>
                  </div>
                  {isDraft ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => sendCampaign(c)}
                        disabled={sendingId === c.id}
                        style={{ background: GREEN }}
                        aria-label={`Send campaign ${c.name}`}
                      >
                        {sendingId === c.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                        Send campaign
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(c)}
                        className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
                        aria-label={`Edit campaign ${c.name}`}
                      >
                        <Pencil className="size-4" aria-hidden="true" /> Edit
                      </Button>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </SectionCard>

      {/* Honest note */}
      <p className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs leading-relaxed text-slate-500">
        <Mail className="mt-0.5 size-3.5 shrink-0 text-slate-600" aria-hidden="true" />
        <span>
          <span className="font-medium text-slate-400">Sends are honest:</span> the EMAIL channel must be configured by Super Admin
          before any campaign can go out. Drafting uses the real CST-020 agent execution — when the provider is unavailable the
          failure is shown exactly as it happened, and no draft is created.
        </span>
      </p>

      {/* New campaign dialog */}
      <Dialog open={draftOpen} onOpenChange={(open) => !draftBusy && setDraftOpen(open)}>
        <DialogContent className="border-slate-800 bg-[#0B1F33] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Draft a new campaign</DialogTitle>
            <DialogDescription className="text-slate-500">
              The CST-020 content agent writes a first draft in the TECH360 voice — practical engineering insight, no fluff,
              one clear takeaway. You review and edit before anything is sent.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createDraft} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="draft-topic" className="text-xs text-slate-400">Topic (optional — the agent picks one when empty)</Label>
              <Input
                id="draft-topic"
                value={draftTopic}
                onChange={(e) => setDraftTopic(e.target.value)}
                placeholder="e.g. why we ship previews before payment"
                maxLength={300}
                className="h-9 border-slate-800 bg-slate-950/60 text-slate-200 placeholder:text-slate-600"
              />
            </div>
            {draftError ? (
              <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs leading-relaxed text-red-400">
                {draftError}
              </div>
            ) : null}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setDraftOpen(false)} disabled={draftBusy} className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100">
                Cancel
              </Button>
              <Button type="submit" disabled={draftBusy} style={{ background: ACCENT }}>
                {draftBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
                {draftBusy ? 'Drafting…' : 'Draft with AI'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit draft dialog */}
      <Dialog open={editing !== null} onOpenChange={(open) => !editBusy && !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-800 bg-[#0B1F33] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Edit draft campaign</DialogTitle>
            <DialogDescription className="text-slate-500">
              Only DRAFT campaigns are editable — once a campaign is sent, the record is the proof of what went out.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-xs text-slate-400">Campaign name</Label>
                <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} required maxLength={120} className="h-9 border-slate-800 bg-slate-950/60 text-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-subject" className="text-xs text-slate-400">Email subject</Label>
                <Input id="edit-subject" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} required maxLength={200} className="h-9 border-slate-800 bg-slate-950/60 text-slate-200" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-body" className="text-xs text-slate-400">Body (simple HTML paragraphs)</Label>
              <Textarea
                id="edit-body"
                rows={12}
                required
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className={`border-slate-800 bg-slate-950/60 font-mono text-xs text-slate-200 ${SCROLL_THIN}`}
                aria-label="Campaign body"
              />
              <p className="text-[11px] text-slate-600">
                Scripts, styles, iframes and inline event handlers are stripped server-side on save. Max 20,000 characters.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <ReviewPanel subject={editSubject} body={editBody} kind="newsletter" />
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={editBusy} className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100">
                Cancel
              </Button>
              <Button type="submit" disabled={editBusy} style={{ background: ACCENT }}>
                {editBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                Save draft
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
