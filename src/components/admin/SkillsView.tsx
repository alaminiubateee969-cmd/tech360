'use client'

import { useMemo, useState } from 'react'
import { Boxes, CheckCircle2, Layers, Play, RefreshCw, Search, XCircle } from 'lucide-react'

import { fetchJson, useApi } from '@/lib/admin-client'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { CARD, MONO } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

// ============================================================
// SKILL REGISTRY — the private skill catalogue.
//
// Every number comes from /api/skills, which separates registered /
// implemented / tested / enabled / operational. A catalogue row on its
// own is never presented as a working skill.
//
// "Queue run" really queues the skill on the durable task queue via
// POST /api/tasks — it does not execute anything in the browser.
// ============================================================

type SkillStatus = {
  id: string
  version: string
  status: string
  implemented: boolean
  tested: boolean
  enabled: boolean
  operational: boolean
  reason: string | null
}

type SkillsResponse = {
  total: number
  limit: number
  offset: number
  results: SkillStatus[]
  summary: {
    registered: number
    implemented: number
    tested: number
    enabled: number
    operational: number
    departments: number
    handlers: number
  }
  handlers: string[]
  logicalAgents: { registered: number; departments: number }
}

export default function SkillsView() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('ALL')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<SkillStatus | null>(null)
  const [payload, setPayload] = useState('{}')
  const [running, setRunning] = useState(false)
  const limit = 25

  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (query.trim()) params.set('query', query.trim())
    if (category !== 'ALL') params.set('category', category)
    return `/api/skills?${params.toString()}`
  }, [query, category, offset])

  const { data, loading, error, refresh } = useApi<SkillsResponse>(url)
  const summary = data?.summary

  async function queueRun() {
    if (!selected) return
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(payload) as Record<string, unknown>
    } catch {
      toast.error('The payload is not valid JSON.')
      return
    }
    setRunning(true)
    try {
      const result = await fetchJson<{ task?: { id: string; status: string }; created?: boolean; error?: string }>(
        '/api/tasks',
        {
          method: 'POST',
          headers: { 'Idempotency-Key': `skill-${selected.id}-${Date.now()}` },
          body: { type: 'SKILL', skillId: selected.id, payload: parsed },
        },
      )
      toast.success(
        result.created
          ? `Task queued (${result.task?.status ?? 'QUEUED'}). Track it in the Task Queue.`
          : 'That task already existed — the original was returned.',
      )
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The task could not be queued.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Skill Registry"
        description="Reusable, versioned capabilities. Each one declares its inputs, outputs, permissions and owning department, and each one is bound to a real executable handler."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh the skill registry">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Registered" value={summary?.registered ?? '—'} icon={Layers} loading={loading} sub="catalogue definitions" />
        <KpiCard label="Implemented" value={summary?.implemented ?? '—'} icon={Boxes} tone="green" loading={loading} sub="have a handler" />
        <KpiCard label="Tested" value={summary?.tested ?? '—'} icon={CheckCircle2} tone="green" loading={loading} sub="covered by a test" />
        <KpiCard label="Enabled" value={summary?.enabled ?? '—'} icon={CheckCircle2} tone="accent" loading={loading} sub="lifecycle ACTIVE" />
        <KpiCard label="Operational" value={summary?.operational ?? '—'} icon={CheckCircle2} tone="green" loading={loading} sub="implemented + tested + enabled" />
        <KpiCard label="Departments" value={summary?.departments ?? '—'} icon={Layers} tone="slate" loading={loading} sub="owning departments" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <SectionCard
          title="Catalogue"
          description={
            data
              ? `${data.total.toLocaleString()} skill(s) match · logical agents registered: ${data.logicalAgents.registered.toLocaleString()}`
              : 'Loading the catalogue…'
          }
          actions={
            <div className="flex items-center gap-2">
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setOffset(0)
                }}
                placeholder="Search skills…"
                aria-label="Search skills"
                className="h-8 w-44 text-xs"
              />
              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value)
                  setOffset(0)
                }}
                aria-label="Filter by category"
                className="h-8 rounded-md border border-slate-800 bg-slate-950/60 px-2 text-xs text-slate-200"
              >
                <option value="ALL">All categories</option>
                {['EXECUTIVE', 'REVENUE', 'DELIVERY', 'TECHNOLOGY', 'CONTENT', 'OPERATIONS', 'GOVERNANCE', 'SUPPORT'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          {error ? (
            <EmptyState icon={XCircle} title="The skill registry could not be loaded" description={error} />
          ) : loading && !data ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-md bg-slate-800/50" />
              ))}
            </div>
          ) : data && data.results.length === 0 ? (
            <EmptyState icon={Search} title="No skill matches this filter" description="Try a different search term or category." />
          ) : (
            <>
              <div className={CARD + ' overflow-hidden'}>
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Skill</th>
                      <th className="px-3 py-2 font-semibold">Version</th>
                      <th className="px-3 py-2 font-semibold">State</th>
                      <th className="px-3 py-2 font-semibold">Checks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.results.map((skill) => (
                      <tr
                        key={skill.id}
                        className={
                          'border-b border-slate-800/60 last:border-0 ' +
                          (selected?.id === skill.id ? 'bg-[#009FE3]/5' : 'hover:bg-slate-800/30')
                        }
                      >
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="text-left"
                            onClick={() => {
                              setSelected(skill)
                              setPayload('{}')
                            }}
                          >
                            <span className={MONO}>{skill.id}</span>
                          </button>
                          {skill.reason ? <p className="mt-0.5 text-[11px] text-slate-500">{skill.reason}</p> : null}
                        </td>
                        <td className="px-3 py-2 text-slate-400">{skill.version}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={skill.operational ? 'ACTIVE' : skill.status} />
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-400">
                          <span className={skill.implemented ? 'text-emerald-400' : 'text-amber-400'}>impl</span>
                          {' · '}
                          <span className={skill.tested ? 'text-emerald-400' : 'text-amber-400'}>test</span>
                          {' · '}
                          <span className={skill.enabled ? 'text-emerald-400' : 'text-amber-400'}>enabled</span>
                        </td>
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

        <SectionCard
          title="Queue a run"
          description="The payload must satisfy the skill's declared input schema. The run is queued, not executed in the browser."
        >
          {!selected ? (
            <EmptyState icon={Play} title="Select a skill" description="Choose a skill from the catalogue to queue a run." />
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Skill</p>
                <p className={MONO + ' break-all'}>{selected.id}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  v{selected.version} · {selected.operational ? 'operational' : 'not operational'}
                </p>
              </div>
              <div>
                <label htmlFor="skill-payload" className="text-[11px] uppercase tracking-wider text-slate-500">
                  Input payload (JSON)
                </label>
                <textarea
                  id="skill-payload"
                  value={payload}
                  onChange={(event) => setPayload(event.target.value)}
                  rows={6}
                  spellCheck={false}
                  className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950/60 p-2 font-mono text-[11px] text-slate-200 focus-visible:border-[#009FE3]/60 focus-visible:outline-none"
                />
              </div>
              <Button size="sm" onClick={queueRun} disabled={running || !selected.operational}>
                <Play className="size-4" aria-hidden="true" />
                {running ? 'Queueing…' : 'Queue run'}
              </Button>
              {!selected.operational ? (
                <p className="text-[11px] text-amber-400">This skill is not operational, so it cannot be queued.</p>
              ) : null}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard
          title="Handlers"
          description="The executable primitives every skill is bound to. A skill without one of these is not implemented."
        >
          <div className="flex flex-wrap gap-1.5">
            {(data?.handlers ?? []).map((handler) => (
              <span key={handler} className={CARD + ' px-2 py-1 font-mono text-[11px] text-slate-300'}>
                {handler}
              </span>
            ))}
            {loading && !data ? <span className="text-[11px] text-slate-500">Loading handlers…</span> : null}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
