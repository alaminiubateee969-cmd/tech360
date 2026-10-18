'use client'

import { useMemo, useState } from 'react'
import { Activity, CheckCircle2, Clock, ListChecks, RefreshCw, XCircle } from 'lucide-react'

import { useApi } from '@/lib/admin-client'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { CARD, MONO } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// ============================================================
// TASK QUEUE — the durable queue that carries BOTH LLM inference
// jobs and skill executions.
//
// There is one queue. A worker leases a task, runs it, and the task
// is recovered automatically if the worker dies mid-run.
// ============================================================

type TaskRow = {
  id: string
  taskType: string
  agentCode: string | null
  status: string
  approvalState: string
  attempts: number
  maxAttempts: number
  correlationId: string
  workflow: string | null
  requestedBy: string | null
  lastError: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

type TasksResponse = {
  total: number
  limit: number
  offset: number
  tasks: TaskRow[]
}

const STATUSES = ['ALL', 'QUEUED', 'RUNNING', 'RETRYING', 'AWAITING_APPROVAL', 'COMPLETED', 'FAILED', 'TIMED_OUT', 'CANCELLED']
const TYPES = ['ALL', 'INFERENCE', 'SKILL', 'WORKFLOW', 'DOCUMENT']

export default function TaskQueueView() {
  const [status, setStatus] = useState('ALL')
  const [type, setType] = useState('ALL')
  const [offset, setOffset] = useState(0)
  const limit = 50

  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (status !== 'ALL') params.set('status', status)
    if (type !== 'ALL') params.set('type', type)
    return `/api/tasks?${params.toString()}`
  }, [status, type, offset])

  const { data, loading, error, refresh } = useApi<TasksResponse>(url)

  const counts = useMemo(() => {
    const rows = data?.tasks ?? []
    return {
      queued: rows.filter((t) => t.status === 'QUEUED' || t.status === 'RETRYING').length,
      running: rows.filter((t) => t.status === 'RUNNING').length,
      awaiting: rows.filter((t) => t.status === 'AWAITING_APPROVAL').length,
      failed: rows.filter((t) => t.status === 'FAILED' || t.status === 'TIMED_OUT').length,
    }
  }, [data])

  return (
    <div>
      <PageHeader
        title="Task Queue"
        description="Every durable task — LLM inference and skill execution alike — with its lease, attempt count and approval state."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh the task queue">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Queued" value={counts.queued} icon={Clock} tone="accent" loading={loading} sub="waiting for a worker" />
        <KpiCard label="Running" value={counts.running} icon={Activity} tone="green" loading={loading} sub="leased by a worker" />
        <KpiCard label="Awaiting approval" value={counts.awaiting} icon={ListChecks} tone="amber" loading={loading} sub="held for a human" />
        <KpiCard label="Failed" value={counts.failed} icon={XCircle} tone="red" loading={loading} sub="in this page of results" />
      </div>

      <SectionCard
        title="Tasks"
        description={data ? `${data.total.toLocaleString()} task(s) match the current filter` : 'Loading the queue…'}
        actions={
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={(value) => { setStatus(value); setOffset(0) }}>
              <SelectTrigger className="h-8 w-40 text-xs" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((value) => (
                  <SelectItem key={value} value={value} className="text-xs">
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(value) => { setType(value); setOffset(0) }}>
              <SelectTrigger className="h-8 w-36 text-xs" aria-label="Filter by task type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((value) => (
                  <SelectItem key={value} value={value} className="text-xs">
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {error ? (
          <EmptyState icon={XCircle} title="The task queue could not be loaded" description={error} />
        ) : loading && !data ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-md bg-slate-800/50" />
            ))}
          </div>
        ) : (data?.tasks.length ?? 0) === 0 ? (
          <EmptyState icon={CheckCircle2} title="No task matches this filter" description="The queue is empty for this filter." />
        ) : (
          <>
            <div className={CARD + ' overflow-x-auto'}>
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Task</th>
                    <th className="px-3 py-2 font-semibold">Type</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Approval</th>
                    <th className="px-3 py-2 font-semibold">Attempts</th>
                    <th className="px-3 py-2 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.tasks.map((task) => (
                    <tr key={task.id} className="border-b border-slate-800/60 last:border-0">
                      <td className="px-3 py-2">
                        <span className={MONO}>{task.id}</span>
                        {task.lastError ? (
                          <p className="mt-0.5 max-w-md truncate text-[11px] text-red-400/80" title={task.lastError}>
                            {task.lastError}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-slate-400">{task.taskType}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-3 py-2 text-slate-400">{task.approvalState}</td>
                      <td className="px-3 py-2 text-slate-400">
                        {task.attempts}/{task.maxAttempts}
                      </td>
                      <td className="px-3 py-2 text-slate-400">{new Date(task.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
                Previous
              </Button>
              <span className="text-[11px] text-slate-500">
                {offset + 1}–{Math.min(offset + limit, data?.total ?? 0)} of {data?.total ?? 0}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!data || offset + limit >= data.total}
                onClick={() => setOffset(offset + limit)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  )
}
