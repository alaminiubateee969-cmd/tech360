'use client'

import { useMemo, useState } from 'react'
import {
  Bot,
  Check,
  ChevronRight,
  ClipboardList,
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
  type AgentJobRow,
  type AgentJobsResponse,
  type AgentRow,
  type AgentsResponse,
  type DepartmentRow,
  type ExecutionRecord,
  type MeResponse,
  type ProjectSummary,
} from '@/lib/admin-client'
import { AgentProviderNotice } from './AgentProviderNotice'
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

interface TrainingResponse {
  sourceCount: number
  knowledgeApproved: number
  memoryEntries: number
  qualifiedDepartments: number
  note: string
  categories: Array<{
    category: string
    agents: number
    qualified: number
    operational: number
    skills: string[]
    gaps: string[]
    sources: Array<{ name: string; url: string; teaches: string }>
    months: Array<{ month: number; title: string; focus: string; exitCriteria: string }>
  }>
  agents: Array<{ code: string; maturity: string }>
}

export function AgentsView() {
  // Governance (create / evidence export) is Super Admin only; Admin
  // accounts control day-to-day automation (view + run) from here.
  const { data: meData } = useApi<MeResponse>('/api/auth/me')
  const isSuperAdmin = meData?.user?.role === 'SUPER_ADMIN'
  const { data: training } = useApi<TrainingResponse>('/api/admin/agents/training')
  const { data, loading, error, refresh } = useApi<AgentsResponse>('/api/admin/agents')
  const agents = data?.agents ?? []
  const departments = data?.departments ?? []

  const [category, setCategory] = useState('ALL')
  const [query, setQuery] = useState('')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [purpose, setPurpose] = useState('')
  const [description, setDescription] = useState('')
  const [departmentCode, setDepartmentCode] = useState('')
  const [parentCode, setParentCode] = useState('')
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

  function openCreateDialog() {
    const firstParentAgent = agents.find((agent) => agent.status === 'ACTIVE')
    const firstDepartment = firstParentAgent?.dept ?? departments[0]?.code ?? ''
    const firstParent = agents.find((agent) => agent.dept === firstDepartment && agent.status === 'ACTIVE')?.code ?? ''
    setDepartmentCode(firstDepartment)
    setParentCode(firstParent)
    setCreateOpen(true)
  }

  async function createAgent() {
    if (createBusy) return
    if (purpose.trim().length < 10 || description.trim().length < 20 || !departmentCode || !parentCode) {
      toast.error('Provide a purpose, boundary description, persisted department, and active parent agent.')
      return
    }
    setCreateBusy(true)
    try {
      const res = await api.createAgent(purpose.trim(), description.trim(), departmentCode, parentCode)
      toast.success(res.message ?? 'Paused agent draft created.')
      setCreateOpen(false)
      setPurpose('')
      setDescription('')
      setParentCode('')
      setDepartmentCode('')
      refresh()
      if (res.agent?.code) setSelectedCode(res.agent.code)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Creation request failed.')
    } finally {
      setCreateBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Persisted AI Agents"
        description="Database-backed AiAgent rows, department assignments, and execution telemetry. Generated org-chart profiles are shown separately and are not included in these counts."
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
            {isSuperAdmin ? (
            <a
              href="/api/admin/agents/export"
              download
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-800 bg-transparent px-3 text-xs font-medium text-slate-300 transition-colors hover:border-[#18B83A]/50 hover:bg-[#18B83A]/10 hover:text-emerald-400"
              aria-label="Export AI agent execution evidence as CSV"
              title="Download a CSV of every real agent execution — inputs, outputs, status, duration. Proof of real work."
            >
              <Download className="size-4" aria-hidden="true" /> Evidence CSV
            </a>
            ) : null}
            {isSuperAdmin ? (
            <Button size="sm" onClick={() => setCreateOpen(true)} className="font-semibold" style={{ background: ACCENT }}>
              <Plus className="size-4" aria-hidden="true" /> Create Agent
            </Button>
            ) : null}
          </>
        }
      />

      {error ? (
        <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Could not load the workforce registry: {error}
        </div>
      ) : null}

      <AgentProviderNotice status={data?.aiProvider} />

      <section aria-label="Workforce stats" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Departments" value={stats.departments} icon={Sparkles} tone="accent" loading={loading} />
        <KpiCard label="Agents" value={stats.agents} icon={Bot} tone="accent" loading={loading} />
        <KpiCard label="Active" value={stats.active} icon={Bot} tone="green" loading={loading} sub="Ready to execute" />
        <KpiCard label="Total Executions" value={stats.executions.toLocaleString()} icon={Play} tone="slate" loading={loading} />
      </section>

      {training ? (
        <section aria-label="Training curriculum and 3-month roadmap" className="mb-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-100">Training — backup sources, gaps &amp; 3-month roadmap</h2>
            <p className="text-[11px] text-slate-500">
              {training.sourceCount} backup sources · {training.knowledgeApproved} approved knowledge docs · {training.memoryEntries} memory entries · {training.qualifiedDepartments} qualified departments
            </p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{training.note}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {training.categories.filter((c) => c.agents > 0).map((c) => (
              <div key={c.category} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <p className="text-xs font-semibold text-slate-200">{prettify(c.category)} <span className="font-normal text-slate-500">· {c.agents} agents · {c.qualified} qualified · {c.operational} operational</span></p>
                <p className="mt-1.5 text-[11px] text-slate-400"><span className="text-slate-500">Skills:</span> {c.skills.join(', ')}</p>
                <p className="mt-1 text-[11px] text-amber-300/80"><span className="text-slate-500">Gaps:</span> {c.gaps.join(' · ')}</p>
                <p className="mt-1 text-[11px] text-slate-400"><span className="text-slate-500">Learns from:</span> {c.sources.map((src) => src.name).join(' · ')}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {(training.categories[0]?.months ?? []).map((m) => (
              <div key={m.month} className="rounded-lg border border-[#009FE3]/20 bg-[#009FE3]/5 p-3">
                <p className="text-xs font-semibold text-[#009FE3]">Month {m.month} — {m.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{m.focus}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500"><span className="text-slate-400">Exit:</span> {m.exitCriteria}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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

      {selectedCode ? <AgentDetailDialog code={selectedCode} onClose={() => setSelectedCode(null)} onUpdated={refresh} /> : null}
      <AgentJobsPanel />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-100">
              <Plus className="size-4" aria-hidden="true" /> Create Agent
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Creates a PAUSED draft only after a fresh, fully passing persisted DCC assessment. No model drafting call is made when the department is uncertified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ag-department" className="text-xs text-slate-400">Persisted department</Label>
              <select
                id="ag-department"
                value={departmentCode}
                onChange={(event) => {
                  const nextDepartment = event.target.value
                  setDepartmentCode(nextDepartment)
                  setParentCode(agents.find((agent) => agent.dept === nextDepartment && agent.status === 'ACTIVE')?.code ?? '')
                }}
                className="h-9 w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 text-sm text-slate-200"
              >
                <option value="">Select a persisted department…</option>
                {departments.map((department) => <option key={department.code} value={department.code}>{department.code} — {department.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-parent" className="text-xs text-slate-400">Active parent agent (same department)</Label>
              <select
                id="ag-parent"
                value={parentCode}
                onChange={(event) => setParentCode(event.target.value)}
                className="h-9 w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 text-sm text-slate-200"
              >
                <option value="">Select a persisted active parent…</option>
                {agents.filter((agent) => agent.dept === departmentCode && agent.status === 'ACTIVE').map((agent) => <option key={agent.code} value={agent.code}>{agent.code} — {agent.name}</option>)}
              </select>
              {!agents.some((agent) => agent.dept === departmentCode && agent.status === 'ACTIVE') ? <p className="text-[10px] text-amber-300">This department has no active persisted parent agent, so child-agent creation is blocked.</p> : null}
            </div>
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
              DCC requires all nine passing metrics. Parent limits are three direct children and maximum depth two. The saved draft stays PAUSED; it is not executable until a Super Admin reviews and explicitly activates it.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={createBusy} className="text-slate-400 hover:text-slate-200">
              Cancel
            </Button>
            <Button onClick={createAgent} disabled={createBusy || !departmentCode || !parentCode || purpose.trim().length < 10 || description.trim().length < 20} className="font-semibold" style={{ background: ACCENT }}>
              {createBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Create paused draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AgentJobsPanel() {
  const { data, loading, error, refresh } = useApi<AgentJobsResponse>('/api/admin/agents/jobs?limit=25')
  const jobs = data?.jobs ?? []
  const [busyId, setBusyId] = useState<string | null>(null)

  async function decide(job: AgentJobRow, decision: 'APPROVE' | 'REJECT') {
    if (busyId) return
    setBusyId(job.id)
    try {
      await api.decideAgentJob(job.id, decision)
      toast.success(decision === 'APPROVE' ? 'Job approved and queued.' : 'Job rejected and cancelled.')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not record the job decision.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section aria-label="Durable AgentJob history" className={cn(CARD, 'mt-5')}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200"><ClipboardList className="size-4 text-[#009FE3]" aria-hidden="true" /> Durable AgentJobs</h2>
          <p className="mt-0.5 text-xs text-slate-500">MySQL-persisted queue, approval state, retries, lease recovery, inference outcomes, and allowlisted internal task tools. Inference completion is not customer delivery or acceptance.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="border-slate-800 bg-transparent text-slate-300">
          <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} aria-hidden="true" /> Refresh
        </Button>
      </header>
      {error ? <p role="alert" className="p-4 text-xs text-red-400">Could not load AgentJob history: {error}</p> : null}
      {loading && jobs.length === 0 ? <div className="space-y-2 p-4"><Skeleton className="h-14 w-full bg-slate-800/50" /><Skeleton className="h-14 w-full bg-slate-800/50" /></div> : null}
      {!loading && jobs.length === 0 ? <div className="p-3"><EmptyState icon={ClipboardList} title="No durable jobs yet" description="Queue inference or an explicitly supported internal tool from an authorized agent profile. Jobs requiring approval stay blocked until a Super Admin decides." /></div> : null}
      {jobs.length > 0 ? (
        <ul className="divide-y divide-slate-800/70">
          {jobs.map((job) => (
            <li key={job.id} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={job.status} />
                <span className="font-mono text-[11px] text-slate-400">{job.agentCode ?? '—'}</span>
                <span className="text-xs font-medium text-slate-200">{job.agent?.name ?? 'Agent'}</span>
                <span className="text-[10px] text-slate-600">attempt {num(job.attempts)}/{num(job.maxAttempts)}</span>
                <span className="ml-auto text-[10px] text-slate-600">{fmtDate(job.createdAt)}</span>
              </div>
              <p className="text-xs text-slate-400">{job.client?.clientId ? `${job.client.clientId} · ${job.client.name ?? 'Client'} · ` : ''}{job.project?.code ? `${job.project.code} · ` : ''}{job.workflow ?? 'MANUAL'} · {job.taskType === 'TOOL_CALL' ? `tool ${job.toolName ?? 'unknown'}` : 'inference'}</p>
              {job.lastError ? <p className="rounded border border-red-500/20 bg-red-500/5 px-2 py-1.5 text-[11px] text-red-300">{job.lastError}</p> : null}
              {job.output ? <details className="rounded border border-slate-800 bg-slate-950/40 p-2"><summary className="cursor-pointer text-[10px] text-slate-500">View persisted job result</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-slate-300">{job.output}</pre></details> : null}
              {job.status === 'AWAITING_APPROVAL' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-amber-300">Approval required; worker will not claim this job.</span>
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" onClick={() => decide(job, 'APPROVE')} disabled={Boolean(busyId)} className="h-7 bg-emerald-700 text-[11px] text-white hover:bg-emerald-600">
                      {busyId === job.id ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Check className="size-3" aria-hidden="true" />} Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => decide(job, 'REJECT')} disabled={Boolean(busyId)} className="h-7 border-slate-700 text-[11px] text-slate-300">
                      Reject
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
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

function AgentDetailDialog({ code, onClose, onUpdated }: { code: string; onClose: () => void; onUpdated: () => void }) {
  const { data, loading, error, refresh } = useApi<AgentDetailResponse>(`/api/admin/agents/${encodeURIComponent(code)}`)
  const { data: projectData, loading: projectsLoading, error: projectsError } = useApi<{ projects?: ProjectSummary[] }>('/api/admin/projects')
  const agent: AgentFull | undefined = data?.agent
  const executions = data?.executions ?? []
  const eligibleToolProjects = (projectData?.projects ?? []).filter((project) => !['COMPLETED', 'CANCELLED', 'ON_HOLD'].includes((project.status ?? '').toUpperCase()))
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [queueBusy, setQueueBusy] = useState(false)
  const [queuedJob, setQueuedJob] = useState<{ id: string; status: string; approvalState?: string | null } | null>(null)
  const [pendingQueueKey, setPendingQueueKey] = useState<{ payload: string; key: string } | null>(null)
  const [taskToolProjectId, setTaskToolProjectId] = useState('')
  const [taskToolTitle, setTaskToolTitle] = useState('')
  const [taskToolDescription, setTaskToolDescription] = useState('')
  const [taskToolBusy, setTaskToolBusy] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [requestedStatus, setRequestedStatus] = useState<'ACTIVE' | 'PAUSED'>('ACTIVE')
  const [statusReason, setStatusReason] = useState('')
  const [statusConfirmation, setStatusConfirmation] = useState('')
  const [statusBusy, setStatusBusy] = useState(false)
  const [pendingTaskToolKey, setPendingTaskToolKey] = useState<{ signature: string; key: string } | null>(null)
  const [queuedTaskToolJob, setQueuedTaskToolJob] = useState<{ id: string; status: string; approvalState?: string | null } | null>(null)
  const [runResult, setRunResult] = useState<{
    ok?: boolean
    status?: string | null
    output?: string | null
    json?: unknown
    executionId?: string | null
    error?: string | null
  } | null>(null)

  function openStatusDialog(next: 'ACTIVE' | 'PAUSED') {
    setRequestedStatus(next)
    setStatusReason('')
    setStatusConfirmation('')
    setStatusDialogOpen(true)
  }

  async function saveAgentStatus() {
    if (!agent || statusBusy || statusReason.trim().length < 20) return
    setStatusBusy(true)
    try {
      const result = await api.updateAgentStatus(code, requestedStatus, statusReason.trim(), statusConfirmation)
      toast.success(result.message ?? `Agent ${requestedStatus.toLowerCase()}.`)
      setStatusDialogOpen(false)
      refresh()
      onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Agent status change failed.')
    } finally {
      setStatusBusy(false)
    }
  }

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

  async function queueDurableRun() {
    if (queueBusy || running) return
    if (!input.trim()) {
      toast.error('Enter input before queueing an inference job.')
      return
    }
    setQueueBusy(true)
    try {
      const payload = input.trim()
      const idempotencyKey = pendingQueueKey?.payload === payload ? pendingQueueKey.key : `admin-${code}-${crypto.randomUUID()}`
      setPendingQueueKey({ payload, key: idempotencyKey })
      const res = await api.queueAgentJob(code, payload, idempotencyKey, { expectJson: true })
      if (!res.job) throw new Error(res.message ?? 'The server did not return a persisted job.')
      setQueuedJob({ id: res.job.id, status: res.job.status, approvalState: res.job.approvalState })
      setPendingQueueKey(null)
      toast.success(res.job.status === 'AWAITING_APPROVAL' ? 'Job persisted and is awaiting Super Admin approval.' : 'Inference job persisted in the durable queue.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not queue the durable inference job.')
    } finally {
      setQueueBusy(false)
    }
  }

  async function queueHumanTaskTool() {
    if (taskToolBusy) return
    if (!taskToolProjectId || taskToolTitle.trim().length < 3) {
      toast.error('Choose a project and provide a task title of at least 3 characters.')
      return
    }
    const payload = {
      projectId: taskToolProjectId,
      title: taskToolTitle.trim(),
      description: taskToolDescription.trim(),
    }
    const signature = JSON.stringify(payload)
    const idempotencyKey = pendingTaskToolKey?.signature === signature
      ? pendingTaskToolKey.key
      : `task-create-${code}-${crypto.randomUUID()}`
    setPendingTaskToolKey({ signature, key: idempotencyKey })
    setTaskToolBusy(true)
    try {
      const res = await api.queueAgentJob(code, 'Create one human-owned internal project task. Do not claim the work is complete.', idempotencyKey, {
        expectJson: false,
        projectId: payload.projectId,
        toolName: 'task.create',
        toolArgs: { title: payload.title, description: payload.description, priority: 'MEDIUM' },
      })
      if (!res.job) throw new Error(res.message ?? 'The server did not return a persisted tool job.')
      setQueuedTaskToolJob({ id: res.job.id, status: res.job.status, approvalState: res.job.approvalState })
      toast.success(res.job.status === 'AWAITING_APPROVAL'
        ? 'Tool job persisted and is awaiting Super Admin approval.'
        : 'Tool job persisted; the worker may create one human-owned TODO task.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not queue the allowlisted task tool.')
    } finally {
      setTaskToolBusy(false)
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

            {/^AGT-[A-F0-9]{8}$/.test(code) ? (
              <section className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/25 bg-amber-500/5 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-amber-200">Dynamic child agent · parent {agent.parentCode ?? 'missing'}</p>
                  <p className="mt-1 text-[10px] text-slate-500">Activation rechecks current DCC, parent status, department, depth, child cap, and records an audit event.</p>
                </div>
                {agent.status === 'PAUSED' ? (
                  <Button size="sm" onClick={() => openStatusDialog('ACTIVE')} className="bg-emerald-700 text-white hover:bg-emerald-600">
                    <ShieldCheck className="size-3.5" aria-hidden="true" /> Review & activate
                  </Button>
                ) : agent.status === 'ACTIVE' ? (
                  <Button size="sm" variant="outline" onClick={() => openStatusDialog('PAUSED')} className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10">
                    Pause agent
                  </Button>
                ) : null}
              </section>
            ) : null}

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
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] text-slate-600">Run now is synchronous. Queue durable persists an inference request for the scheduled worker; it does not authorize external side effects.</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={queueDurableRun} disabled={running || queueBusy} className="border-slate-700 bg-transparent text-slate-200">
                    {queueBusy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <ClipboardList className="size-3.5" aria-hidden="true" />}
                    Queue durable
                  </Button>
                  <Button size="sm" onClick={run} disabled={running || queueBusy} className="font-semibold" style={{ background: ACCENT }}>
                    {running ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
                    Run now
                  </Button>
                </div>
              </div>
              {queuedJob ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
                  <StatusBadge status={queuedJob.status} />
                  <span className="font-mono text-[10px] text-slate-500">job: {queuedJob.id}</span>
                  {queuedJob.approvalState === 'PENDING' ? <span className="text-[10px] text-amber-300">Awaiting Super Admin approval</span> : <span className="text-[10px] text-slate-500">Refresh Durable inference jobs below for worker updates.</span>}
                </div>
              ) : null}
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

            {chipList(agent.tools).includes('task.create') && chipList(agent.permissions).includes('write:tasks') ? (
              <div className="space-y-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div>
                  <p className="text-xs font-semibold text-emerald-300">Allowlisted internal tool: task.create</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Queues one idempotent tool job for an existing project. The worker creates a human-owned TODO task only; it does not mark work complete or contact the client.</p>
                </div>
                {projectsLoading ? <p className="text-xs text-slate-500">Loading projects…</p> : projectsError ? <p role="alert" className="text-xs text-red-400">Could not load projects: {projectsError}</p> : (
                  <div className="space-y-1.5">
                    <Label htmlFor="agent-task-project" className="text-xs text-slate-400">Project</Label>
                    <select
                      id="agent-task-project"
                      value={taskToolProjectId}
                      onChange={(event) => setTaskToolProjectId(event.target.value)}
                      className="h-9 w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 text-xs text-slate-200"
                    >
                      <option value="">Select a non-completed project…</option>
                      {eligibleToolProjects.map((project) => {
                        const clientLabel = typeof project.client === 'object' && project.client
                          ? ` · ${project.client.clientId ?? project.client.name ?? 'Client'}`
                          : ''
                        return <option key={project.id} value={project.id}>{project.code ?? project.name} — {project.name}{clientLabel}</option>
                      })}
                    </select>
                    {eligibleToolProjects.length === 0 ? <p className="text-[10px] text-amber-300">No eligible projects are currently available.</p> : null}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="agent-task-title" className="text-xs text-slate-400">Human task title</Label>
                  <Input id="agent-task-title" value={taskToolTitle} onChange={(event) => setTaskToolTitle(event.target.value)} maxLength={160} placeholder="e.g. Review the uploaded delivery artifact" className="border-slate-800 bg-slate-950/60 text-sm text-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agent-task-description" className="text-xs text-slate-400">Description (optional)</Label>
                  <Textarea id="agent-task-description" value={taskToolDescription} onChange={(event) => setTaskToolDescription(event.target.value)} maxLength={2000} rows={2} placeholder="Instructions for the assigned human reviewer…" className="border-slate-800 bg-slate-950/60 text-sm text-slate-200" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-600">Server rechecks the project/client relationship and agent grants.</span>
                  <Button size="sm" onClick={queueHumanTaskTool} disabled={taskToolBusy || projectsLoading || Boolean(projectsError) || !taskToolProjectId || !taskToolTitle.trim()} className="bg-emerald-700 text-white hover:bg-emerald-600">
                    {taskToolBusy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <ClipboardList className="size-3.5" aria-hidden="true" />}
                    Queue task tool
                  </Button>
                </div>
                {queuedTaskToolJob ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
                    <StatusBadge status={queuedTaskToolJob.status} />
                    <span className="font-mono text-[10px] text-slate-500">job: {queuedTaskToolJob.id}</span>
                    {queuedTaskToolJob.approvalState === 'PENDING' ? <span className="text-[10px] text-amber-300">Awaiting Super Admin approval</span> : <span className="text-[10px] text-slate-500">A queued job is not proof the task was created; inspect its persisted outcome.</span>}
                  </div>
                ) : null}
              </div>
            ) : null}

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
        <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
          <DialogContent className="border-slate-800 bg-slate-900 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-slate-100">{requestedStatus === 'ACTIVE' ? 'Activate dynamic agent' : 'Pause dynamic agent'}</DialogTitle>
              <DialogDescription className="text-slate-400">
                {requestedStatus === 'ACTIVE'
                  ? 'Activation is a high-impact human decision. The server rechecks DCC and hierarchy, then audits the decision. The agent remains blocked if any required evidence is missing.'
                  : 'Pause prevents future execution and is audited with your reason.'}
              </DialogDescription>
            </DialogHeader>
            {requestedStatus === 'ACTIVE' ? (
              <div className="space-y-1.5">
                <Label htmlFor="agent-activation-confirm" className="text-xs text-slate-400">Type ACTIVATE to confirm</Label>
                <Input id="agent-activation-confirm" value={statusConfirmation} onChange={(event) => setStatusConfirmation(event.target.value)} autoComplete="off" className="border-slate-800 bg-slate-950/60 text-slate-200" />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="agent-status-reason" className="text-xs text-slate-400">Decision reason (at least 20 characters)</Label>
              <Textarea id="agent-status-reason" value={statusReason} onChange={(event) => setStatusReason(event.target.value)} maxLength={500} rows={3} className="border-slate-800 bg-slate-950/60 text-sm text-slate-200" />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStatusDialogOpen(false)} disabled={statusBusy} className="text-slate-400">Cancel</Button>
              <Button
                onClick={saveAgentStatus}
                disabled={statusBusy || statusReason.trim().length < 20 || (requestedStatus === 'ACTIVE' && statusConfirmation !== 'ACTIVATE')}
                className={requestedStatus === 'ACTIVE' ? 'bg-emerald-700 text-white hover:bg-emerald-600' : 'bg-amber-700 text-white hover:bg-amber-600'}
              >
                {statusBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {requestedStatus === 'ACTIVE' ? 'Confirm activation' : 'Pause agent'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
