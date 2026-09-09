'use client'

import { useState } from 'react'
import { CheckCheck, Loader2, RefreshCw, ShieldAlert, ThumbsDown, ThumbsUp } from 'lucide-react'

import {
  api,
  clientDisplayName,
  fmtDate,
  parseMaybeJson,
  useApi,
  type ApprovalItem,
  type ApprovalsResponse,
} from '@/lib/admin-client'
import { EmptyState, PageHeader } from './shared/cards'
import { JsonView } from './shared/JsonView'
import { Markdownish } from './shared/Markdownish'
import { RiskBadge, StatusBadge } from './shared/StatusBadge'
import { CARD } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

function payloadView(item: ApprovalItem) {
  if (!item.payload) return null
  const parsed = parseMaybeJson(item.payload)
  if (parsed && typeof parsed === 'object') return <JsonView value={parsed} maxHeightClass="max-h-56" />
  if (typeof parsed === 'string') return <Markdownish text={parsed} />
  return <Markdownish text={item.payload} />
}

export function ApprovalsView() {
  const [tab, setTab] = useState('pending')
  const url = tab === 'pending' ? '/api/admin/approvals?status=PENDING' : '/api/admin/approvals'
  const { data, loading, error, refresh } = useApi<ApprovalsResponse>(url)
  const approvals = data?.approvals ?? []

  const [decide, setDecide] = useState<{ item: ApprovalItem; decision: 'APPROVED' | 'REJECTED' } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<Record<string, { ok: boolean; text: string; result?: unknown }>>({})

  async function submitDecision() {
    if (!decide || busy) return
    setBusy(true)
    try {
      const res = await api.approvalDecision(decide.item.id, decide.decision, note.trim() || undefined)
      const text =
        res.message ??
        (res.result
          ? `Decision executed. ${typeof res.result === 'string' ? res.result : 'See execution details on the card.'}`
          : `Decision recorded: ${decide.decision}`)
      setResults((r) => ({ ...r, [decide.item.id]: { ok: true, text, result: res.result } }))
      toast.success(text)
      refresh()
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Decision failed.'
      setResults((r) => ({ ...r, [decide.item.id]: { ok: false, text } }))
      toast.error(text)
    } finally {
      setBusy(false)
      setDecide(null)
      setNote('')
    }
  }

  return (
    <div>
      <PageHeader
        title="Approval Governance"
        description="Sensitive actions queue here before execution. Approve or reject with an optional note — every decision is audit-logged and the execution result is reported exactly as it happened."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
            aria-label="Refresh approvals"
          >
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-900/80 p-1">
          <TabsTrigger value="pending" className="text-xs text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-slate-100">
            Pending
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-slate-100">
            All
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <ApprovalList
            approvals={approvals}
            loading={loading}
            error={error}
            results={results}
            onDecide={(item, decision) => setDecide({ item, decision })}
            emptyTitle="No pending approvals"
            pending
          />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <ApprovalList
            approvals={approvals}
            loading={loading}
            error={error}
            results={results}
            onDecide={(item, decision) => setDecide({ item, decision })}
            emptyTitle="No approval requests"
          />
        </TabsContent>
      </Tabs>

      <Dialog open={decide !== null} onOpenChange={(o) => !o && setDecide(null)}>
        <DialogContent className="border-slate-800 bg-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {decide?.decision === 'APPROVED' ? 'Approve' : 'Reject'}: {decide?.item.title}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {decide?.decision === 'APPROVED'
                ? 'Approving executes the gated action immediately and records the outcome.'
                : 'Rejecting blocks the action and notifies the requesting agent.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="approval-note" className="text-xs font-medium text-slate-400">
              Note (optional)
            </label>
            <Textarea
              id="approval-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason, conditions, or instructions…"
              className="border-slate-800 bg-slate-950/60 text-sm text-slate-200"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDecide(null)} disabled={busy} className="text-slate-400 hover:text-slate-200">
              Cancel
            </Button>
            <Button
              onClick={submitDecision}
              disabled={busy}
              variant={decide?.decision === 'APPROVED' ? 'default' : 'destructive'}
              className={decide?.decision === 'APPROVED' ? 'font-semibold' : undefined}
              style={decide?.decision === 'APPROVED' ? { background: '#18B83A' } : undefined}
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {decide?.decision === 'APPROVED' ? 'Approve & Execute' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ApprovalList({
  approvals,
  loading,
  error,
  results,
  onDecide,
  emptyTitle,
  pending,
}: {
  approvals: ApprovalItem[]
  loading: boolean
  error: string | null
  results: Record<string, { ok: boolean; text: string; result?: unknown }>
  onDecide: (item: ApprovalItem, decision: 'APPROVED' | 'REJECTED') => void
  emptyTitle: string
  pending?: boolean
}) {
  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        Could not load approvals: {error}
      </div>
    )
  }
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full bg-slate-800/50" />
        ))}
      </div>
    )
  }
  if (approvals.length === 0) {
    return (
      <div className={`${CARD} rounded-lg`}>
        <EmptyState
          icon={ShieldAlert}
          title={emptyTitle}
          description={
            pending
              ? 'The governance queue is empty — sensitive actions awaiting your decision will appear here.'
              : 'Approval-gated actions (final scope sends, payment instructions, handovers, agent creation) will appear here.'
          }
        />
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {approvals.map((a) => {
        const result = results[a.id]
        const isPending = (a.status ?? 'PENDING').toUpperCase() === 'PENDING'
        return (
          <article key={a.id} className={CARD} aria-label={`Approval ${a.title}`}>
            <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100">{a.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                  <span className="rounded bg-slate-800/70 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">{a.type}</span>
                  <span>Client: {clientDisplayName(a.client)}</span>
                  {a.agentCode ? <span>Agent: <span className="font-mono">{a.agentCode}</span></span> : null}
                  <span>{fmtDate(a.createdAt)}</span>
                </p>
              </div>
              <RiskBadge risk={a.risk} />
            </header>
            <div className="space-y-3 px-4 py-3">
              {a.description ? <p className="text-[13px] leading-relaxed text-slate-400">{a.description}</p> : null}
              {payloadView(a)}
              {a.status ? <StatusBadge status={a.status} /> : null}
              {result ? (
                <div
                  role="status"
                  className={`rounded-md border p-3 text-xs ${
                    result.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-400'
                  }`}
                >
                  <p className="flex items-center gap-1.5 font-medium">
                    {result.ok ? <CheckCheck className="size-3.5" aria-hidden="true" /> : <ShieldAlert className="size-3.5" aria-hidden="true" />}
                    {result.text}
                  </p>
                  {result.result !== undefined && result.result !== null ? (
                    <div className="mt-2">
                      <JsonView value={result.result} maxHeightClass="max-h-40" />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {isPending ? (
              <footer className="flex justify-end gap-2 border-t border-slate-800 px-4 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDecide(a, 'REJECTED')}
                  className="border-red-500/40 bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20 hover:text-red-300"
                >
                  <ThumbsDown className="size-3.5" aria-hidden="true" /> Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => onDecide(a, 'APPROVED')}
                  className="text-xs font-semibold"
                  style={{ background: '#18B83A' }}
                >
                  <ThumbsUp className="size-3.5" aria-hidden="true" /> Approve
                </Button>
              </footer>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
