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
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
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

type OpsStatus = {
  status: string
  heartbeatAgeSec: number | null
  intervalSec: number
  cycles: number | null
  lastCycleAt: string | null
  recentCycles: OpsCycle[]
  agents: { registered: number; totalExecutions: number; successes: number; failures: number; executions24h: number }
  unreadAlerts: number
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
