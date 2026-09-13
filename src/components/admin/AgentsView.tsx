'use client'

import { useMemo, useState } from 'react'
import {
  Bot,
  ChevronRight,
  Download,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import {
  api,
  fmtDate,
  num,
  parseMaybeJson,
  prettify,
  useApi,
  type AgentDetailResponse,
  type AgentFull,
  type AgentRow,
  type AgentsResponse,
  type DepartmentRow,
  type ExecutionRecord,
} from '@/lib/admin-client'
import { EmptyState, KpiCard, PageHeader } from './shared/cards'
import { JsonView } from './shared/JsonView'
import { Markdownish } from './shared/Markdownish'
import { StatusBadge } from './shared/StatusBadge'
import { ACCENT, CARD, SCROLL_THIN } from './shared/styles'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const CATEGORY_ORDER = [
  'EXECUTIVE', 'REVENUE', 'DELIVERY', 'TECHNOLOGY', 'CONTENT', 'OPERATIONS', 'GOVERNANCE', 'SUPPORT',
]

function statusDot(status?: string | null) {
  const s = (status ?? '').toUpperCase()
  if (s === 'ACTIVE') return 'bg-emerald-400'
  if (s === 'PAUSED') return 'bg-amber-400'
  return 'bg-slate-600'
}

function chipList(v: string | string[] | null | undefined): string[] {
  if (!v) return []
  const parsed = typeof v === 'string' ? parseMaybeJson(v) : v
  if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean)
  if (typeof v === 'string' && v.trim()) return [v.trim()]
  return []
}

export function AgentsView() {
  const { data, loading, error, refresh } = useApi<AgentsResponse>('/api/admin/agents')
  const agents = data?.agents ?? []
  const departments = data?.departments ?? []

  const [category, setCategory] = useState('ALL')
  const [query, setQuery] = useState('')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [purpose, setPurpose] = useState('')
  const [description, setDescription] = useState('')
  const [createBusy, setCreateBusy] = useState(false)

  const stats = useMemo(
    () => ({
      departments: departments.length,
      agents: agents.length,
      active: agents.filter((a) => (a.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE').length,
      executions: agents.reduce((sum, a) => sum + num(a.executions), 0),
    }),
    [agents, departments],
  )

  const filteredAgents = useMemo(() => {
    const q = query.trim().toLowerCase()
    return agents.filter((a) => {
      if (category !== 'ALL') {
        const dept = departments.find((d) => d.code === a.dept || d.name === a.dept)
        if ((dept?.category ?? '').toUpperCase() !== category) return false
      }
      if (!q) return true
      return (
        a.name.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        (a.title ?? '').toLowerCase().includes(q) ||
        (a.dept ?? '').toLowerCase().includes(q)
      )
    })
  }, [agents, departments, category, query])

  const grouped = useMemo(() => {
    const matched = new Map<string, AgentRow[]>()
    const unmatched: AgentRow[] = []
    for (const a of filteredAgents) {
      const dept = departments.find((d) => d.code === a.dept || d.name === a.dept)
      if (dept) {
        const list = matched.get(dept.code) ?? []
        list.push(a)
        matched.set(dept.code, list)
      } else {
        unmatched.push(a)
      }
    }
    const cats: Array<{ category: string; depts: Array<{ dept: DepartmentRow; agents: AgentRow[] }> }> = []
    const catSet = new Set<string>()
    for (const d of departments) {
      if (matched.has(d.code)) {
        const c = (d.category ?? 'OTHER').toUpperCase()
        catSet.add(c)
      }
    }
    const ordered = [...CATEGORY_ORDER.filter((c) => catSet.has(c)), ...[...catSet].filter((c) => !CATEGORY_ORDER.includes(c))]
    for (const c of ordered) {
      const depts = departments
        .filter((d) => (d.category ?? 'OTHER').toUpperCase() === c && matched.has(d.code))
        .map((d) => ({ dept: d, agents: matched.get(d.code) ?? [] }))
      cats.push({ category: c, depts })
    }
    return { cats, unmatched }
  }, [filteredAgents, departments])

  async function createAgent() {
    if (createBusy) return
    if (!purpose.trim() || !description.trim()) {
      toast.error('Purpose and description are required.')
      return
    }
    setCreateBusy(true)
    try {
      const res = await api.createAgent(purpose.trim(), description.trim())
      toast.success(res.message ?? 'Agent creation request submitted — queued for Super Admin approval.')
      setCreateOpen(false)
      setPurpose('')
      setDescription('')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Creation request failed.')
    } finally {
      setCreateBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="AI Workforce"
        description="The agent organization — departments, roles, guardrails, and real execution telemetry."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
              aria-label="Refresh agents"
            >
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
            </Button>
            <a
              href="/api/admin/agents/export"
              download
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-800 bg-transparent px-3 text-xs font-medium text-slate-300 transition-colors hover:border-[#18B83A]/50 hover:bg-[#18B83A]/10 hover:text-emerald-400"
              aria-label="Export AI agent execution evidence as CSV"
              title="Download a CSV of every real agent execution — inputs, outputs, status, duration. Proof of real work."
            >
              <Download className="size-4" aria-hidden="true" /> Evidence CSV
            </a>
            <Button size="sm" onClick={() => setCreateOpen(true)} className="font-semibold" style={{ background: ACCENT }}>
              <Plus className="size-4" aria-hidden="true" /> Create Agent
            </Button>
          </>
        }
      />

      {error ? (
        <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Could not load the workforce registry: {error}
        </div>
      ) : null}

      <section aria-label="Workforce stats" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Departments" value={stats.departments} icon={Sparkles} tone="accent" loading={loading} />
        <KpiCard label="Agents" value={stats.agents} icon={Bot} tone="accent" loading={loading} />
        <KpiCard label="Active" value={stats.active} icon={Bot} tone="green" loading={loading} sub="Ready to execute" />
        <KpiCard label="Total Executions" value={stats.executions.toLocaleString()} icon={Play} tone="slate" loading={loading} />
      </section>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents by name, code, role…"
            aria-label="Search agents"
            className="h-9 border-slate-800 bg-slate-950/60 pl-9 text-slate-200 placeholder:text-slate-600"
          />
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by department category">
          {['ALL', ...CATEGORY_ORDER].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={cn(
                'h-9 rounded-md border px-3 text-xs font-medium transition-colors',
                category === c
                  ? 'border-[#009FE3]/60 bg-[#009FE3]/15 text-[#009FE3]'
                  : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200',
              )}
            >
              {c === 'ALL' ? 'All' : prettify(c)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full bg-slate-800/50" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className={CARD}>
          <EmptyState icon={Bot} title="No agents registered" description="The workforce registry is empty — agents appear here once seeded or created." />
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className={CARD}>
          <EmptyState title="No agents match this filter" description="Try another category or search term." />
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.cats.map(({ category: cat, depts }) => (
            <section key={cat} aria-label={`${prettify(cat)} departments`}>
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <span className="h-px w-4 bg-slate-700" aria-hidden="true" />
                {prettify(cat)}
                <span className="rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                  {depts.reduce((n, d) => n + d.agents.length, 0)} agents
                </span>
              </h2>
              <Accordion type="multiple" className={CARD}>
                {depts.map(({ dept, agents: deptAgents }) => (
                  <AccordionItem key={dept.code} value={dept.code} className="border-slate-800/70 px-4">
                    <AccordionTrigger className="py-3 text-sm font-medium text-slate-200 hover:no-underline">
                      <span className="flex items-center gap-2">
                        {dept.name}
                        <span className="text-xs font-normal text-slate-500">
                          {deptAgents.length} agent{deptAgents.length === 1 ? '' : 's'} · <span className="font-mono text-[10px]">{dept.code}</span>
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3">
                      <ul className="space-y-1">
                        {deptAgents.map((a) => (
                          <AgentRowItem key={a.code} agent={a} onClick={() => setSelectedCode(a.code)} />
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
          {grouped.unmatched.length > 0 ? (
            <section aria-label="Unassigned agents">
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <span className="h-px w-4 bg-slate-700" aria-hidden="true" />
                Unassigned
                <span className="rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                  {grouped.unmatched.length} agents
                </span>
              </h2>
              <ul className={cn(CARD, 'space-y-1 p-2')}>
                {grouped.unmatched.map((a) => (
                  <AgentRowItem key={a.code} agent={a} onClick={() => setSelectedCode(a.code)} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      {selectedCode ? <AgentDetailDialog code={selectedCode} onClose={() => setSelectedCode(null)} /> : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-100">
              <Plus className="size-4" aria-hidden="true" /> Create Agent
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Requests a new AI agent. Creation is governed: the request is queued for Super Admin approval before the
              agent is registered.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ag-purpose" className="text-xs text-slate-400">Purpose (e.g. &quot;Analyze failed payments&quot;)</Label>
              <Input
                id="ag-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="h-9 border-slate-800 bg-slate-950/60 text-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-desc" className="text-xs text-slate-400">Description</Label>
              <Textarea
                id="ag-desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this agent should do, which data it reads, what it must never do…"
                className="border-slate-800 bg-slate-950/60 text-sm text-slate-200"
              />
            </div>
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-300">
              Governed operation — the new agent will only become active after Super Admin approval (see Approvals).
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={createBusy} className="text-slate-400 hover:text-slate-200">
              Cancel
            </Button>
            <Button onClick={createAgent} disabled={createBusy} className="font-semibold" style={{ background: ACCENT }}>
              {createBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AgentRowItem({ agent, onClick }: { agent: AgentRow; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-transparent px-3 py-2 text-left hover:border-slate-700 hover:bg-slate-800/40 focus-visible:border-[#009FE3]/50 focus-visible:outline-none"
        aria-label={`Open agent ${agent.code} ${agent.name}`}
      >
        <span className={cn('size-2 shrink-0 rounded-full', statusDot(agent.status))} aria-label={`Status: ${agent.status ?? 'unknown'}`} />
        <span className="font-mono text-[11px] text-slate-500">{agent.code}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-slate-200 group-hover:text-slate-100">{agent.name}</span>
          {agent.title ? <span className="block truncate text-[11px] text-slate-500">{agent.title}</span> : null}
        </span>
        {agent.requiresApproval ? (
          <ShieldCheck className="size-3.5 shrink-0 text-amber-400" aria-label="Requires approval for sensitive actions" />
        ) : null}
        <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
          {num(agent.executions).toLocaleString()} runs
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-emerald-400">{num(agent.successRate)}%</span>
        <span className="shrink-0 rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">L{num(agent.level)}</span>
        <ChevronRight className="size-3.5 shrink-0 text-slate-600 group-hover:text-slate-400" aria-hidden="true" />
      </button>
    </li>
  )
}

function AgentDetailDialog({ code, onClose }: { code: string; onClose: () => void }) {
  const { data, loading, error } = useApi<AgentDetailResponse>(`/api/admin/agents/${encodeURIComponent(code)}`)
  const agent: AgentFull | undefined = data?.agent
  const executions = data?.executions ?? []
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{
    ok?: boolean
    status?: string | null
    output?: string | null
    json?: unknown
    executionId?: string | null
    error?: string | null
  } | null>(null)

  async function run() {
    if (running) return
    if (!input.trim()) {
      toast.error('Enter input for the agent.')
      return
    }
    setRunning(true)
    setRunResult(null)
    try {
      const res = await api.runAgent(code, input.trim(), true)
      setRunResult(res)
      if (res.ok && (res.status ?? '').toUpperCase() !== 'FAILED') toast.success(`Execution ${res.status ?? 'SUCCESS'}.`)
      else toast.error(res.error ?? `Execution ${res.status ?? 'FAILED'}.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Run failed.'
      setRunResult({ ok: false, status: 'FAILED', error: msg })
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn('border-slate-800 bg-slate-900 sm:max-w-2xl', SCROLL_THIN, 'max-h-[85vh] overflow-y-auto')}>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-slate-100">
            <span className={cn('size-2 rounded-full', statusDot(agent?.status))} />
            {agent?.name ?? code}
            <span className="font-mono text-xs font-normal text-slate-500">{code}</span>
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {agent?.title ?? 'AI agent'} {agent?.dept ? `· ${agent.dept}` : ''} · Level {num(agent?.level)}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full bg-slate-800/50" />
            <Skeleton className="h-32 w-full bg-slate-800/40" />
            <Skeleton className="h-24 w-full bg-slate-800/30" />
          </div>
        ) : error ? (
          <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            Could not load agent details: {error}
          </div>
        ) : agent ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatMini label="Executions" value={num(agent.executions ?? agent.executionCount).toLocaleString()} />
              <StatMini label="Success rate" value={`${num(agent.successRate)}%`} />
              <StatMini label="Status" value={prettify(agent.status)} />
              <StatMini label="Approval" value={agent.requiresApproval ? 'Required' : 'Not required'} />
            </div>

            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Purpose</p>
              <p className="text-[13px] leading-relaxed text-slate-400">{agent.purpose || '—'}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tools</p>
                <Chips items={chipList(agent.tools)} emptyLabel="No tools" />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Permissions</p>
                <Chips items={chipList(agent.permissions)} emptyLabel="No permissions" />
              </div>
            </div>

            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200">
                System Prompt
                <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" aria-hidden="true" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className={cn('mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-950/70 p-3 font-mono text-[11px] leading-relaxed text-slate-400', SCROLL_THIN)}>
                  {agent.systemPrompt || '—'}
                </pre>
              </CollapsibleContent>
            </Collapsible>

            {/* RUN panel */}
            <div className="rounded-md border border-[#009FE3]/25 bg-[#009FE3]/5 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#009FE3]">
                <Play className="size-3.5" aria-hidden="true" /> Run Agent
              </p>
              <Textarea
                rows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Input for ${agent.name}…`}
                aria-label={`Input for agent ${code}`}
                className="border-slate-800 bg-slate-950/60 text-sm text-slate-200"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[10px] text-slate-600">Real execution — output and status come from the agent engine.</p>
                <Button size="sm" onClick={run} disabled={running} className="font-semibold" style={{ background: ACCENT }}>
                  {running ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
                  Run
                </Button>
              </div>
              {runResult ? (
                <div className="mt-3 space-y-2 rounded-md border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={runResult.status ?? (runResult.ok ? 'SUCCESS' : 'FAILED')} />
                    {runResult.executionId ? (
                      <span className="font-mono text-[10px] text-slate-600">exec: {runResult.executionId}</span>
                    ) : null}
                  </div>
                  {runResult.error ? (
                    <p className="text-xs text-red-400">{runResult.error}</p>
                  ) : null}
                  {runResult.json !== undefined && runResult.json !== null ? (
                    <JsonView value={runResult.json} maxHeightClass="max-h-56" />
                  ) : runResult.output ? (
                    <Markdownish text={runResult.output} />
                  ) : !runResult.error ? (
                    <p className="text-xs text-slate-500">No output returned.</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* executions */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recent Executions</p>
              {executions.length === 0 ? (
                <p className="rounded-md border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-500">
                  No executions recorded for this agent yet.
                </p>
              ) : (
                <ul className={cn('max-h-64 divide-y divide-slate-800/60 overflow-auto rounded-md border border-slate-800', SCROLL_THIN)}>
                  {executions.map((x: ExecutionRecord) => (
                    <li key={x.id} className="px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <StatusBadge status={x.status} />
                        <span className="text-[11px] tabular-nums text-slate-600">
                          {num(x.tokensUsed).toLocaleString()} tokens · {num(x.durationMs)} ms · {fmtDate(x.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-mono text-[10px] text-slate-600">{x.input || ''}</p>
                      {x.error ? <p className="mt-0.5 truncate text-[11px] text-red-400/80">{x.error}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <EmptyState title="Agent not found" />
        )}
      </DialogContent>
    </Dialog>
  )
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-200">{value}</p>
    </div>
  )
}

function Chips({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) return <p className="text-xs text-slate-600">{emptyLabel}</p>
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((t) => (
        <span key={t} className="rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
          {t}
        </span>
      ))}
    </div>
  )
}
