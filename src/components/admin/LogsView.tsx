'use client'

import { useMemo, useState } from 'react'
import { AlertOctagon, ChevronDown, RefreshCw, RotateCcw, ScrollText, Workflow } from 'lucide-react'
import { toast } from 'sonner'

import {
  api,
  fmtDate,
  num,
  parseMaybeJson,
  prettify,
  useApi,
  type AuditLogRecord,
  type AuditLogsResponse,
  type AutomationLogRecord,
  type ErrorLogRecord,
  type ErrorLogsResponse,
} from '@/lib/admin-client'
import { DataTable } from './shared/DataTable'
import { EmptyState, PageHeader } from './shared/cards'
import { JsonView } from './shared/JsonView'
import { StatusBadge } from './shared/StatusBadge'
import { CARD, MONO, SCROLL_THIN } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

export function LogsView() {
  const [tab, setTab] = useState('audit')
  return (
    <div>
      <PageHeader
        title="System Logs"
        description="Audit trail, error log, and automation runs — the operational memory of the platform."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap gap-1 bg-slate-900/80 p-1">
          <TabsTrigger value="audit" className="gap-1.5 px-3 text-xs text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-slate-100">
            <ScrollText className="size-3.5" aria-hidden="true" /> Audit
          </TabsTrigger>
          <TabsTrigger value="errors" className="gap-1.5 px-3 text-xs text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-slate-100">
            <AlertOctagon className="size-3.5" aria-hidden="true" /> Errors
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-1.5 px-3 text-xs text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-slate-100">
            <Workflow className="size-3.5" aria-hidden="true" /> Automation
          </TabsTrigger>
        </TabsList>
        <TabsContent value="audit" className="mt-4">
          <AuditTab />
        </TabsContent>
        <TabsContent value="errors" className="mt-4">
          <ErrorsTab />
        </TabsContent>
        <TabsContent value="automation" className="mt-4">
          <AutomationTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AuditTab() {
  const [page, setPage] = useState(1)
  const url = `/api/admin/logs/audit?page=${page}`
  const { data, loading, error, refresh } = useApi<AuditLogsResponse>(url)
  const logs = data?.logs ?? []
  const total = data?.total ?? logs.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-slate-500" aria-live="polite">
          {loading ? 'Loading…' : `${total} audit entries`}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
          aria-label="Refresh audit log"
        >
          <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
        </Button>
      </div>
      {error ? (
        <div role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Could not load audit log: {error}
        </div>
      ) : null}
      <DataTable
        columns={[
          { key: 'at', header: 'Time', cell: (l: AuditLogRecord) => <span className="text-xs text-slate-500">{fmtDate(l.createdAt)}</span> },
          { key: 'actor', header: 'Actor', cell: (l: AuditLogRecord) => <span className={MONO}>{l.actor || '—'}</span> },
          { key: 'action', header: 'Action', cell: (l: AuditLogRecord) => <span className="font-mono text-xs text-[#009FE3]">{l.action || '—'}</span> },
          { key: 'entity', header: 'Entity', cell: (l: AuditLogRecord) => <span className="text-xs text-slate-400">{l.entityType ? `${l.entityType} ${l.entityId ?? ''}` : '—'}</span> },
          { key: 'client', header: 'Client', cell: (l: AuditLogRecord) => <span className="font-mono text-[11px] text-slate-500">{l.clientId || '—'}</span> },
          { key: 'ip', header: 'IP', cell: (l: AuditLogRecord) => <span className="font-mono text-[11px] text-slate-600">{l.ip || '—'}</span> },
          {
            key: 'details',
            header: '',
            className: 'w-12 text-right',
            cell: (l: AuditLogRecord) =>
              l.details ? (
                <button
                  type="button"
                  className="text-slate-500 hover:text-slate-300"
                  aria-label={expanded === l.id ? 'Hide details' : 'Show details'}
                  aria-expanded={expanded === l.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded(expanded === l.id ? null : l.id)
                  }}
                >
                  <ChevronDown className={cn('size-4 transition-transform', expanded === l.id && 'rotate-180')} aria-hidden="true" />
                </button>
              ) : null,
          },
        ]}
        rows={logs}
        loading={loading}
        rowKey={(l) => l.id}
        empty={<EmptyState title="No audit entries" description="Every admin action and agent execution is recorded here." />}
        aria-label="Audit log table"
        maxHeightClass="max-h-[70vh]"
      />
      {expanded ? (
        <div className="mt-3">
          <JsonView value={parseMaybeJson(logs.find((l) => l.id === expanded)?.details) ?? logs.find((l) => l.id === expanded)?.details} maxHeightClass="max-h-48" />
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Page {page} / {totalPages}
        </p>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || page <= 1}
            onClick={() => setPage(page - 1)}
            className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60"
            aria-label="Previous page"
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60"
            aria-label="Next page"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

function ErrorsTab() {
  const [resolved, setResolved] = useState('false')
  const url = `/api/admin/logs/errors?resolved=${resolved}`
  const { data, loading, error, refresh } = useApi<ErrorLogsResponse>(url)
  const logs = data?.logs ?? []

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1" role="group" aria-label="Filter errors by resolution">
          {[
            ['false', 'Unresolved'],
            ['true', 'Resolved'],
            ['', 'All'],
          ].map(([v, label]) => (
            <button
              key={v || 'all'}
              type="button"
              aria-pressed={resolved === v}
              onClick={() => setResolved(v)}
              className={cn(
                'h-9 rounded-md border px-3 text-xs font-medium transition-colors',
                resolved === v
                  ? 'border-[#009FE3]/60 bg-[#009FE3]/15 text-[#009FE3]'
                  : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
          aria-label="Refresh error log"
        >
          <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
        </Button>
      </div>
      {error ? (
        <div role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Could not load error log: {error}
        </div>
      ) : null}
      <DataTable
        columns={[
          { key: 'at', header: 'Time', cell: (l: ErrorLogRecord) => <span className="text-xs text-slate-500">{fmtDate(l.createdAt)}</span> },
          { key: 'source', header: 'Source', cell: (l: ErrorLogRecord) => <span className="rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{l.source || '—'}</span> },
          { key: 'code', header: 'Code', cell: (l: ErrorLogRecord) => <span className={MONO}>{l.code || '—'}</span> },
          {
            key: 'message',
            header: 'Message',
            className: 'max-w-[380px] whitespace-normal',
            cell: (l: ErrorLogRecord) => <p className="break-words text-[13px] text-red-400/90" title={l.stack ?? undefined}>{l.message || '—'}</p>,
          },
          { key: 'corr', header: 'Correlation ID', cell: (l: ErrorLogRecord) => <span className="font-mono text-[11px] text-slate-600">{l.correlationId || '—'}</span> },
          {
            key: 'resolved',
            header: 'Resolved',
            cell: (l: ErrorLogRecord) =>
              l.resolved ? (
                <StatusBadge status="SUCCESS" title={l.resolvedAt ? `Resolved ${fmtDate(l.resolvedAt)}` : 'Resolved'} />
              ) : (
                <StatusBadge status="PENDING" title="Unresolved" />
              ),
          },
        ]}
        rows={logs}
        loading={loading}
        rowKey={(l) => l.id}
        empty={<EmptyState icon={AlertOctagon} title="No errors recorded" description="The platform will record API, automation, agent, and comms failures here." />}
        aria-label="Error log table"
        maxHeightClass="max-h-[70vh]"
      />
      <p className="mt-2 text-[11px] text-slate-600">
        Read-only view — error resolution is managed server-side (no resolve endpoint in the current API contract).
      </p>
    </div>
  )
}

function AutomationTab() {
  const [status, setStatus] = useState('ALL')
  const url = status === 'ALL' ? '/api/admin/logs/automation' : `/api/admin/logs/automation?status=${status}`
  const { data, loading, error, refresh } = useApi<{ logs?: AutomationLogRecord[] }>(url)
  const logs = data?.logs ?? []
  const [expanded, setExpanded] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)

  const rows = useMemo(() => logs, [logs])

  const doRetry = async (id: string) => {
    if (retryingId) return
    setRetryingId(id)
    try {
      const res = await api.automationRetry(id)
      if (res.ok) {
        toast.success(res.message ?? 'Automation replayed successfully.')
      } else {
        toast.warning(res.message ?? 'Retry refused by the server.')
      }
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry request failed.')
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="auto-status" className="sr-only">Filter by status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="auto-status" className="h-9 w-[180px] border-slate-800 bg-slate-950/60 text-slate-200">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
              <SelectItem value="ALL">All statuses</SelectItem>
              {['RUNNING', 'SUCCESS', 'FAILED', 'AWAITING_APPROVAL', 'RETRYING'].map((s) => (
                <SelectItem key={s} value={s}>{prettify(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="hidden text-[11px] leading-relaxed text-slate-600 sm:block">
            FAILED runs with a safe replay routine can be retried — the original failure stays in the step history.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
          aria-label="Refresh automation log"
        >
          <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
        </Button>
      </div>
      {error ? (
        <div role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Could not load automation log: {error}
        </div>
      ) : null}
      <DataTable
        columns={[
          { key: 'workflow', header: 'Workflow', cell: (l: AutomationLogRecord) => <span className="font-mono text-xs text-slate-300">{l.workflow || '—'}</span> },
          { key: 'trigger', header: 'Trigger', cell: (l: AutomationLogRecord) => <span className="text-xs text-slate-500">{l.trigger || '—'}</span> },
          { key: 'status', header: 'Status', cell: (l: AutomationLogRecord) => <StatusBadge status={l.status} /> },
          { key: 'attempts', header: 'Attempts', cell: (l: AutomationLogRecord) => <span className="tabular-nums text-slate-400">{num(l.attempts)}</span> },
          { key: 'duration', header: 'Duration', cell: (l: AutomationLogRecord) => <span className="tabular-nums text-xs text-slate-500">{l.durationMs != null ? `${num(l.durationMs)} ms` : '—'}</span> },
          { key: 'corr', header: 'Correlation ID', cell: (l: AutomationLogRecord) => <span className="font-mono text-[11px] text-slate-600">{l.correlationId || '—'}</span> },
          { key: 'at', header: 'Started', cell: (l: AutomationLogRecord) => <span className="text-xs text-slate-500">{fmtDate(l.startedAt ?? l.createdAt)}</span> },
          {
            key: 'steps',
            header: '',
            className: 'w-24 text-right',
            cell: (l: AutomationLogRecord) => (
              <div className="flex items-center justify-end gap-1">
                {l.status === 'FAILED' ? (
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300 transition-colors hover:border-amber-400/60 hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/50 disabled:opacity-50"
                    aria-label={`Retry failed ${l.workflow} run`}
                    title={`Retry ${l.workflow}${l.attempts ? ` (attempt ${l.attempts + 1})` : ''}`}
                    disabled={retryingId !== null}
                    onClick={(e) => {
                      e.stopPropagation()
                      void doRetry(l.id)
                    }}
                  >
                    <RotateCcw className={cn('size-3.5', retryingId === l.id && 'animate-spin')} aria-hidden="true" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-slate-500 hover:text-slate-300"
                  aria-label={expanded === l.id ? 'Collapse steps' : 'Expand steps'}
                  aria-expanded={expanded === l.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded(expanded === l.id ? null : l.id)
                  }}
                >
                  <ChevronDown className={cn('size-4 transition-transform', expanded === l.id && 'rotate-180')} aria-hidden="true" />
                </button>
              </div>
            ),
          },
        ]}
        rows={rows}
        loading={loading}
        rowKey={(l) => l.id}
        onRowClick={(l) => setExpanded(expanded === l.id ? null : l.id)}
        empty={<EmptyState icon={Workflow} title="No automation runs" description="Workflow executions from the journey engine will appear here." />}
        aria-label="Automation log table"
        maxHeightClass="max-h-[70vh]"
      />
      {expanded ? (
        <div className="mt-3">
          <StepsView log={logs.find((l) => l.id === expanded)} />
        </div>
      ) : null}
    </div>
  )
}

function StepsView({ log }: { log?: AutomationLogRecord }) {
  if (!log) return null
  const steps = parseMaybeJson(log.steps)
  const RETRYABLE_WORKFLOWS = ['FINAL_SCOPE', 'PREVIEW_REFRESH_REQUEST', 'AI_OPS_LOOP']
  const RETRY_HINTS: Record<string, string> = {
    FINAL_SCOPE: 'Retry re-sends the approved Final Scope of Work through the real journey engine.',
    PREVIEW_REFRESH_REQUEST: 'Retry regenerates a fresh tokenized preview link for the client.',
    AI_OPS_LOOP: 'Retry runs one autonomous operations cycle immediately.',
  }
  const retryable = log.status === 'FAILED' && RETRYABLE_WORKFLOWS.includes(log.workflow ?? '')
  return (
    <div className={cn(CARD, 'p-4')}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Steps · {log.workflow} · <span className="font-mono normal-case text-slate-600">{log.correlationId}</span>
      </h3>
      {log.error ? (
        <p role="alert" className="mb-2 rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
          {log.error}
        </p>
      ) : null}
      {log.status === 'FAILED' ? (
        <p className={cn(
          'mb-2 rounded-md border p-2.5 text-[11px] leading-relaxed',
          retryable
            ? 'border-amber-500/25 bg-amber-500/[0.07] text-amber-300/90'
            : 'border-slate-700/60 bg-slate-800/30 text-slate-500',
        )}>
          {retryable ? (
            <><RotateCcw className="mr-1 inline size-3 align-[-2px]" aria-hidden="true" /> {RETRY_HINTS[log.workflow ?? '']} Use the retry button on this row — the replay runs the real engine function, and this failure stays in the history.</>
          ) : (
            <>This workflow has no safe replay routine — re-trigger it from its source. The platform refuses to fake a retry.</>
          )}
        </p>
      ) : null}
      {Array.isArray(steps) && steps.length > 0 ? (
        <ol className={`max-h-64 space-y-1.5 overflow-auto ${SCROLL_THIN}`}>
          {steps.map((s, i) => {
            const o = s as Record<string, unknown>
            const status = typeof o.status === 'string' ? o.status : undefined
            return (
              <li key={i} className="flex items-start gap-2 text-[13px]">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#009FE3]/70" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-slate-300">
                    {String(o.step ?? o.name ?? `Step ${i + 1}`)}
                    {status ? <span className="ml-2 text-[11px] text-slate-500">({prettify(status)})</span> : null}
                  </p>
                  {o.detail ? <p className="mt-0.5 break-words text-[11px] text-slate-500">{String(o.detail)}</p> : null}
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="text-xs text-slate-600">
          No step detail recorded{log.steps ? ' — raw:' : '.'}
          {log.steps && !Array.isArray(steps) ? <span className="ml-1 font-mono text-[11px] text-slate-500">{log.steps}</span> : null}
        </p>
      )}
      {log.input || log.output ? (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {log.input ? (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Input</p>
              <JsonView value={parseMaybeJson(log.input) ?? log.input} maxHeightClass="max-h-40" />
            </div>
          ) : null}
          {log.output ? (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Output</p>
              <JsonView value={parseMaybeJson(log.output) ?? log.output} maxHeightClass="max-h-40" />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
