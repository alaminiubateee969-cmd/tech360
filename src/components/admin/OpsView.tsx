'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  Bot,
  CheckCircle2,
  Clock,
  HeartPulse,
  ListChecks,
  Radar,
  RefreshCw,
  ScanSearch,
  Layers,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { SCROLL_THIN } from './shared/styles'

// ============================================================
// OPS MONITOR — full visibility into the autonomous AI operations
// loop. Every number is a real query (/api/admin/ops-status →
// heartbeat setting + AI_OPS_LOOP automation logs + agent stats).
// The view answers: is the loop alive, what did each cycle scan,
// and what real actions did it perform?
// ============================================================

type OpsCycle = {
  id: string
  at: string
  finishedAt: string | null
  status: string
  cycle: number | null
  ok: boolean
  trigger: string | null
  performed: string[]
  actions?: string[]
  scanned: Record<string, unknown>
}

type OpsAgentJob = {
  id: string
  agentCode: string | null
  clientId: string | null
  workflow: string | null
  taskType: string
  toolName: string | null
  status: string
  approvalState: string
  attempts: number
  maxAttempts: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  lastError: string | null
}

type OpsStatus = {
  status: string
  heartbeatAgeSec: number | null
  intervalSec: number
  cycles: number | null
  lastCycleAt: string | null
  recentCycles: OpsCycle[]
  agents: { registered: number; totalExecutions: number; successes: number; failures: number; executions24h: number }
  agentJobs: { counts: Record<string, number>; recent: OpsAgentJob[] }
  unreadAlerts: number
}

type IdentityPreview = {
  rowsScanned: number
  candidatePairs: number
  collisionGroups: number
  clientsInCollisionGroups: number
  byType: Record<'EMAIL' | 'PHONE', { candidatePairs: number; collisionGroups: number; clientsInCollisionGroups: number }>
  collisionSamples: Array<{ type: 'EMAIL' | 'PHONE'; clientRefs: string[] }>
  collisionSamplesTruncated: boolean
  writesPerformed: number
  automaticBackfillEnabled: boolean
  truncated: boolean
  note: string
}

const SCAN_LABELS: Record<string, string> = {
  unscored: 'Unscored leads',
  overdue: 'Overdue leads',
  failedComms: 'Failed comms',
  errors: 'Open errors',
  staleApprovals: 'Stale approvals',
  failedAutomations: 'Failed automations',
  expiredPreviews: 'Expired previews',
  quarantinedDocs: 'Quarantined docs',
}

function fmtAge(sec: number | null): string {
  if (sec == null) return '—'
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  return `${Math.floor(sec / 3600)}h ago`
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)
}

export function OpsView() {
  const [ops, setOps] = useState<OpsStatus | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(true)
  const [identityPreview, setIdentityPreview] = useState<IdentityPreview | null>(null)
  const [identityPreviewError, setIdentityPreviewError] = useState(false)
  const [identityPreviewLoading, setIdentityPreviewLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const res = await fetch('/api/admin/ops-status', { headers: { Accept: 'application/json' } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as OpsStatus
        if (!cancelled) { setOps(data); setFailed(false) }
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    const t = live ? setInterval(() => void load(true), 30_000) : null
    return () => {
      cancelled = true
      if (t) clearInterval(t)
    }
  }, [live])

  const refresh = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/ops-status', { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setOps((await res.json()) as OpsStatus)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  const previewIdentityBackfill = async () => {
    setIdentityPreviewLoading(true)
    setIdentityPreviewError(false)
    try {
      const res = await fetch('/api/admin/identity/backfill-preview', { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setIdentityPreview((await res.json()) as IdentityPreview)
    } catch {
      setIdentityPreviewError(true)
    } finally {
      setIdentityPreviewLoading(false)
    }
  }

  const active = ops?.status === 'ACTIVE'
  const successRate = ops && ops.agents.totalExecutions > 0
    ? Math.round((ops.agents.successes / ops.agents.totalExecutions) * 100)
    : null

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ops Monitor"
        description="The autonomous AI operations loop — heartbeat, cycles, what each cycle scanned, and the real actions it performed. No simulated data."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={loading}
              className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
              aria-label="Refresh ops status"
            >
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLive((v) => !v)}
              aria-pressed={live}
              className={cn(
                'border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100',
                live && 'border-[#009FE3]/40 text-[#009FE3] hover:bg-[#009FE3]/10',
              )}
            >
              <HeartPulse className="size-4" aria-hidden="true" /> {live ? 'Live (30s)' : 'Paused'}
            </Button>
          </div>
        }
      />

      {failed ? (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <p className="font-medium">Ops status feed unavailable.</p>
          <p className="mt-1 text-xs text-red-400/70">The API server did not answer — refresh to retry.</p>
        </div>
      ) : null}

      {/* Durable AgentJob queue — reported from persisted rows, never inferred from cycle text */}
      <section aria-label="Durable AgentJob queue" className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200"><Layers className="size-4 text-[#009FE3]" /> Durable AgentJob queue</h3>
          <span className="text-xs text-slate-500">Database-backed statuses · claims · attempts · approval gates</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Counts come from persisted AgentJob rows. Durable jobs currently support model inference and the single allowlisted internal task.create tool; that tool creates a human-owned TODO, not completed work. External provider actions, QA evidence, delivery, and customer acceptance are separate gates; a PM → Architect → Engineer → QA → Delivery handoff is not yet implemented as durable stage jobs.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {['QUEUED', 'RUNNING', 'RETRYING', 'AWAITING_APPROVAL', 'COMPLETED', 'FAILED', 'TIMED_OUT', 'CANCELLED'].map((state) => (
            <div key={state} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
              <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-500">{state.replaceAll('_', ' ')}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-100">{ops ? String(ops.agentJobs.counts[state] ?? 0) : '—'}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/30">
          <h4 className="border-b border-slate-800 px-3 py-2 text-xs font-semibold text-slate-300">Recent persisted jobs</h4>
          {!ops ? <div className="p-3"><Skeleton className="h-12 w-full bg-slate-800/50" /></div> : ops.agentJobs.recent.length === 0 ? (
            <div className="p-2"><EmptyState title="No AgentJobs recorded" description="Queue an inference request from an agent profile to create a durable job record." /></div>
          ) : (
            <ul className="divide-y divide-slate-800/70">
              {ops.agentJobs.recent.map((job) => (
                <li key={job.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <StatusBadge status={job.status} />
                  <span className="font-mono text-[10px] text-slate-400">{job.agentCode ?? '—'}</span>
                  {job.clientId ? <span className="text-[10px] text-slate-500">client row {job.clientId}</span> : null}
                  <span className="text-[10px] text-slate-600">{job.workflow ?? 'MANUAL'} · {job.taskType === 'TOOL_CALL' ? `tool ${job.toolName ?? 'unknown'}` : 'inference'} · attempt {job.attempts}/{job.maxAttempts}</span>
                  <span className="ml-auto text-[10px] text-slate-600">{fmtTime(job.createdAt)}</span>
                  {job.lastError ? <p className="basis-full truncate text-[10px] text-red-400">{job.lastError}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-label="Legacy identity backfill preview" className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Legacy identity backfill preview</h3>
            <p className="mt-1 text-xs text-slate-500">Read-only collision scan of existing contact fields. Nothing is linked automatically.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void previewIdentityBackfill()} disabled={identityPreviewLoading} className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100">
            <RefreshCw className={identityPreviewLoading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            {identityPreviewLoading ? 'Scanning…' : 'Run read-only preview'}
          </Button>
        </div>
        {identityPreviewError ? <p role="alert" className="mt-3 text-xs text-red-400">Preview unavailable. No identity changes were made.</p> : null}
        {identityPreview ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Rows scanned', identityPreview.rowsScanned],
                ['Candidate pairs', identityPreview.candidatePairs],
                ['Collision groups', identityPreview.collisionGroups],
                ['Clients in collisions', identityPreview.clientsInCollisionGroups],
              ].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2"><p className="text-[9px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-lg font-bold tabular-nums text-slate-100">{Number(value).toLocaleString()}</p></div>)}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-slate-500">
              <span>Email candidates: {identityPreview.byType.EMAIL.candidatePairs} · collisions: {identityPreview.byType.EMAIL.collisionGroups}</span>
              <span>Phone candidates: {identityPreview.byType.PHONE.candidatePairs} · collisions: {identityPreview.byType.PHONE.collisionGroups}</span>
              <span>Writes: {identityPreview.writesPerformed}</span>
              {identityPreview.truncated ? <span className="text-amber-400">Scan truncated at the 10,000-row safety limit.</span> : null}
            </div>
            {identityPreview.collisionSamples.length > 0 ? (
              <details className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                <summary className="cursor-pointer text-[10px] text-slate-400">Review potential duplicate client references (contact values hidden)</summary>
                <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-[10px] text-slate-500">
                  {identityPreview.collisionSamples.map((sample, index) => <li key={`${sample.type}-${index}`}><span className="font-semibold text-slate-400">{sample.type}</span> · {sample.clientRefs.join(' · ')}</li>)}
                </ul>
                {identityPreview.collisionSamplesTruncated ? <p className="mt-1 text-[10px] text-amber-400">More collision groups exist; only the first 50 are shown.</p> : null}
              </details>
            ) : null}
            <p className="text-[10px] text-slate-600">{identityPreview.note}</p>
          </div>
        ) : null}
      </section>

      {/* Loop state hero */}
      <section
        aria-label="Autonomous loop state"
        className="relative overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-[#0A1A2E]"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#009FE3]/60 to-transparent" aria-hidden="true" />
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
          <div className="flex min-w-[240px] items-center gap-3">
            <span className="relative flex size-12 shrink-0 items-center justify-center rounded-xl border border-[#009FE3]/25 bg-[#009FE3]/10">
              <Radar className="size-6 text-[#009FE3]" aria-hidden="true" />
              {active ? (
                <span className="absolute -right-1 -top-1 flex size-3.5" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex size-3.5 rounded-full bg-emerald-400" />
                </span>
              ) : null}
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                AI Operations Loop
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                    loading || !ops
                      ? 'bg-slate-800 text-slate-400'
                      : active
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : ops?.status === 'STALE'
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-red-500/15 text-red-400',
                  )}
                >
                  {loading ? '…' : (ops?.status ?? 'OFFLINE')}
                </span>
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-relaxed text-slate-500">
                <Clock className="size-3" aria-hidden="true" />
                {ops
                  ? `Cycle #${ops.cycles ?? '—'} · heartbeat ${fmtAge(ops.heartbeatAgeSec)} · beats every ${Math.max(1, Math.round(ops.intervalSec / 60))} min`
                  : 'Detect → Understand → Decide → Execute → Verify → Log → Learn'}
              </p>
            </div>
          </div>

          {/* agent workforce */}
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Agents', value: ops ? String(ops.agents.registered) : '—', icon: Bot },
              { label: 'Runs (24h)', value: ops ? String(ops.agents.executions24h) : '—', icon: Zap },
              { label: 'Total runs', value: ops ? String(ops.agents.totalExecutions) : '—', icon: Activity },
              { label: 'Success', value: successRate != null ? `${successRate}%` : '—', icon: CheckCircle2 },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2">
                <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  <s.icon className="size-3" aria-hidden="true" /> {s.label}
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums leading-tight text-slate-100">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="min-w-0 lg:max-w-[200px]">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <ListChecks className="size-3" aria-hidden="true" /> Unread alerts
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums leading-tight text-slate-100">
              {ops ? String(ops.unreadAlerts) : '—'}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">Raised by the loop for humans</p>
          </div>
        </div>
      </section>

      {/* Cycle history */}
      <SectionCard
        title="Cycle History"
        description="The last 15 autonomous cycles — what each one scanned and the actions it really performed"
        contentClassName="p-0"
      >
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full bg-slate-800/50" />
            ))}
          </div>
        ) : !ops || ops.recentCycles.length === 0 ? (
          <EmptyState
            icon={Radar}
            title="No cycles recorded yet"
            description="Cycles appear here as soon as the loop runs (every minute in dev via the ai-ops mini-service, every minute in production via Cloud Scheduler)."
          />
        ) : (
          <ul className={`divide-y divide-slate-800 ${SCROLL_THIN}`} aria-label="Autonomous cycle history" style={{ maxHeight: '34rem', overflowY: 'auto' }}>
            {ops.recentCycles.map((c) => {
              const performed = c.performed ?? c.actions ?? []
              const scannedEntries = Object.entries(c.scanned ?? {}).filter(([, v]) => Number(v) > 0)
              const ok = c.ok || c.status === 'SUCCESS'
              return (
                <li key={c.id} className="px-4 py-3 transition-colors hover:bg-slate-800/30">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="font-mono text-xs font-semibold text-[#009FE3]">
                      {c.cycle != null ? `#${c.cycle}` : '—'}
                    </span>
                    <span className="text-xs text-slate-400">{fmtTime(c.at)} (Dhaka)</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider',
                        ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400',
                      )}
                    >
                      {ok ? 'OK' : (c.status || 'FAILED')}
                    </span>
                    {c.trigger ? (
                      <span className="rounded-full bg-slate-800/80 px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wider text-slate-500">
                        {c.trigger}
                      </span>
                    ) : null}
                    <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-slate-600">
                      <ScanSearch className="size-3" aria-hidden="true" />
                      {scannedEntries.length > 0
                        ? `${scannedEntries.reduce((a, [, v]) => a + Number(v), 0)} finding(s)`
                        : 'clean scan'}
                    </span>
                  </div>

                  {/* scanned detail chips */}
                  {scannedEntries.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Scan findings this cycle">
                      {scannedEntries.map(([k, v]) => (
                        <span
                          key={k}
                          title={`${SCAN_LABELS[k] ?? k}: ${String(v)}`}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
                        >
                          {SCAN_LABELS[k] ?? k} · {String(v)}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {/* real actions performed */}
                  <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Actions performed this cycle">
                    {performed.length > 0 ? (
                      performed.slice(0, 8).map((a, i) => (
                        <span
                          key={i}
                          title={a}
                          className="inline-flex max-w-full items-center truncate rounded-md border border-[#009FE3]/25 bg-[#009FE3]/10 px-1.5 py-0.5 text-[10.5px] text-slate-300"
                        >
                          <Zap className="mr-1 size-2.5 shrink-0 text-[#009FE3]" aria-hidden="true" />
                          {a}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-600">
                        No action needed — scan came back clean.
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>

      <p className="pb-2 text-center text-[11px] text-slate-500" aria-hidden="true">
        Data source: /api/admin/ops-status · heartbeat + AI_OPS_LOOP automation logs · auto-refresh {live ? 'every 30s' : 'paused'}
      </p>
    </div>
  )
}
