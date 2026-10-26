'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Bot,
  Boxes,
  Brain,
  CheckCircle2,
  GitBranch,
  Layers,
  Network,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Workflow,
  XCircle,
} from 'lucide-react'

import { fetchJson, useApi } from '@/lib/admin-client'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { CARD, MONO } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

// ============================================================
// CONFIGURED ORG CHART — generated role profiles, not deployed employees.
//
// /api/admin/workforce is intentionally source-defined/in-memory. Its profile
// and assignment counts must never be presented as persisted agents, employees,
// or production staffing. DB-backed operational records are shown in Core Agents
// and the DCC assessment surface.
//
//   Org-chart profiles → /api/admin/workforce
//   Procedures  → /api/admin/sops
//   Prompts     → /api/admin/prompts
//   Governance  → /api/admin/governance
//   Graph       → /api/admin/knowledge-graph
//   Events      → /api/admin/events
//   Memory      → /api/admin/memory
//   Models      → /api/admin/model-hub
//   Collaboration → /api/admin/collaboration
// ============================================================

type Tab = 'employees' | 'procedures' | 'prompts' | 'governance' | 'graph' | 'events' | 'memory' | 'models' | 'collaboration'

const TABS: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'employees', label: 'Org-chart profiles', icon: Bot },
  { id: 'procedures', label: 'Procedures', icon: Workflow },
  { id: 'prompts', label: 'Prompt Library', icon: Brain },
  { id: 'governance', label: 'Governance', icon: Scale },
  { id: 'graph', label: 'Knowledge Graph', icon: Network },
  { id: 'events', label: 'Event Bus', icon: Activity },
  { id: 'memory', label: 'Memory', icon: BookOpen },
  { id: 'models', label: 'Model Hub', icon: Boxes },
  { id: 'collaboration', label: 'Collaboration', icon: GitBranch },
]

// ------------------------------------------------------------
// Employees
// ------------------------------------------------------------

type WorkforceResponse = {
  stats: {
    total: number
    byLevel: Record<string, number>
    byDivision: Record<string, number>
    departments: number
    divisionCount: number
    sopsAssigned: number
    skillsAssigned: number
    withApprovalRequirement: number
    levels: Array<{ level: number; name: string; label: string; count: number; decisionAuthority: string }>
    divisionList: Array<{ code: string; name: string; count: number; departments: string[] }>
  }
  validation: { valid: boolean; issues: unknown[]; issueCount: number }
  employees: Array<{
    employeeId: string
    name: string
    role: string
    level: number
    levelName: string
    departmentCode: string
    departmentName: string
    divisionCode: string
    managerEmployeeId: string | null
    tools: number
    skills: number
    sops: number
    knowledgeAccess: string[]
    memoryScopes: string[]
    kpis: Array<{ name: string; target: string; direction: string }>
    modelProfile: string
    status: string
  }>
  total: number
  offset: number
  limit: number
}

type EmployeeDetail = {
  employee: {
    employeeId: string
    name: string
    role: string
    level: number
    levelName: string
    departmentCode: string
    departmentName: string
    divisionCode: string
    divisionName: string
    managerEmployeeId: string | null
    reportingPath: string[]
    mission: string
    responsibilities: string[]
    authority: string
    decisionRights: { mayDecide: string[]; mayRecommend: string[]; mustEscalate: string[] }
    tools: string[]
    skills: string[]
    promptStages: string[]
    sops: string[]
    knowledgeAccess: string[]
    memoryScopes: string[]
    kpis: Array<{ name: string; target: string; direction: string }>
    escalationRules: string[]
    collaborationRules: string[]
    behavioralConstraints: string[]
    securityPermissions: string[]
    learningProfile: { learnsFrom: string[]; teaches: string[]; reviewCadence: string }
    configuration: { agentId: string; modelProfile: string; permissions: string[]; approvalRequired: string[]; purpose: string; status: string }
  }
}

function EmployeesTab() {
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('ALL')
  const [division, setDivision] = useState('ALL')
  const [offset, setOffset] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const limit = 25

  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (query.trim()) params.set('department', query.trim().toUpperCase())
    if (level !== 'ALL') params.set('level', level)
    if (division !== 'ALL') params.set('division', division)
    return `/api/admin/workforce?${params.toString()}`
  }, [query, level, division, offset])

  const { data, loading, error, refresh } = useApi<WorkforceResponse>(url)
  const detail = useApi<EmployeeDetail>(selectedId ? `/api/admin/workforce?employeeId=${encodeURIComponent(selectedId)}` : null)

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Generated profiles" value={data?.stats.total ?? '—'} icon={Bot} loading={loading} sub="source-defined org chart" />
        <KpiCard label="Department definitions" value={data?.stats.departments ?? '—'} icon={Layers} tone="slate" loading={loading} sub="source catalogue" />
        <KpiCard label="Division definitions" value={data?.stats.divisionCount ?? '—'} icon={Network} tone="slate" loading={loading} sub="generated groupings" />
        <KpiCard label="Skill assignments" value={data?.stats.skillsAssigned ?? '—'} icon={Boxes} tone="green" loading={loading} sub="profile → skill bindings" />
        <KpiCard label="SOP assignments" value={data?.stats.sopsAssigned ?? '—'} icon={Workflow} tone="green" loading={loading} sub="profile → procedure bindings" />
        <KpiCard
          label="Profile validation"
          value={data ? (data.validation.valid ? 'consistent' : `${data.validation.issueCount} issues`) : '—'}
          icon={data?.validation.valid === false ? AlertTriangle : CheckCircle2}
          tone={data?.validation.valid === false ? 'amber' : 'green'}
          loading={loading}
          sub="generated profile validation"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <SectionCard
          title="Organisation"
          description={data ? `${data.total.toLocaleString()} generated profile(s) match — not a database employee/agent count` : 'Loading generated org-chart profiles…'}
          actions={
            <div className="flex items-center gap-2">
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setOffset(0)
                }}
                placeholder="Department code…"
                aria-label="Filter by department code"
                className="h-8 w-36 text-xs"
              />
              <select
                value={level}
                onChange={(event) => {
                  setLevel(event.target.value)
                  setOffset(0)
                }}
                aria-label="Filter by level"
                className="h-8 rounded-md border border-slate-800 bg-slate-950/60 px-2 text-xs text-slate-200"
              >
                <option value="ALL">All levels</option>
                {(data?.stats.levels ?? []).map((entry) => (
                  <option key={entry.name} value={entry.name}>
                    {entry.label} ({entry.count})
                  </option>
                ))}
              </select>
              <select
                value={division}
                onChange={(event) => {
                  setDivision(event.target.value)
                  setOffset(0)
                }}
                aria-label="Filter by division"
                className="h-8 rounded-md border border-slate-800 bg-slate-950/60 px-2 text-xs text-slate-200"
              >
                <option value="ALL">All divisions</option>
                {(data?.stats.divisionList ?? []).map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.name} ({entry.count})
                  </option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh the workforce">
                <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
              </Button>
            </div>
          }
        >
          {error ? (
            <EmptyState icon={XCircle} title="The workforce could not be loaded" description={error} />
          ) : loading && !data ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-md bg-slate-800/50" />
              ))}
            </div>
          ) : data && data.employees.length === 0 ? (
            <EmptyState icon={Search} title="No generated profile matches this filter" description="Try another level, division or department code." />
          ) : (
            <>
              <div className={CARD + ' overflow-x-auto'}>
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Profile</th>
                      <th className="px-3 py-2 font-semibold">Level</th>
                      <th className="px-3 py-2 font-semibold">Department</th>
                      <th className="px-3 py-2 font-semibold">Reports to</th>
                      <th className="px-3 py-2 font-semibold">Held</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.employees.map((employee) => (
                      <tr
                        key={employee.employeeId}
                        className={
                          'border-b border-slate-800/60 last:border-0 ' +
                          (selectedId === employee.employeeId ? 'bg-[#009FE3]/5' : 'hover:bg-slate-800/30')
                        }
                      >
                        <td className="px-3 py-2">
                          <button type="button" className="text-left" onClick={() => setSelectedId(employee.employeeId)}>
                            <span className="text-slate-200">{employee.name}</span>
                            <span className={MONO + ' block'}>{employee.employeeId}</span>
                          </button>
                        </td>
                        <td className="px-3 py-2 text-slate-400">{employee.levelName.replace(/_/g, ' ').toLowerCase()}</td>
                        <td className="px-3 py-2 text-slate-400">
                          {employee.departmentName}
                          <span className={MONO + ' block'}>{employee.departmentCode}</span>
                        </td>
                        <td className={MONO + ' px-3 py-2'}>{employee.managerEmployeeId ?? '—'}</td>
                        <td className="px-3 py-2 text-[11px] text-slate-400">
                          {employee.skills} skills · {employee.sops} procedures · {employee.tools} tools
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
          title="Org-chart profile"
          description="The complete attribute set: identity, authority, decision rights, tools, skills, prompts, procedures, knowledge, memory, KPIs, escalation, collaboration, behaviour, security and learning."
        >
          {!selectedId ? (
            <EmptyState icon={Bot} title="Select a generated profile" description="Choose an org-chart profile to see its source-defined configuration." />
          ) : detail.loading && !detail.data ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-8 animate-pulse rounded-md bg-slate-800/50" />
              ))}
            </div>
          ) : detail.error ? (
            <EmptyState icon={XCircle} title="The profile could not be loaded" description={detail.error} />
          ) : detail.data ? (
            <ProfileDetail detail={detail.data} />
          ) : null}
        </SectionCard>
      </div>
    </>
  )
}

function ProfileDetail({ detail }: { detail: EmployeeDetail }) {
  const e = detail.employee
  const groups: Array<{ label: string; items: string[] }> = [
    { label: 'Responsibilities', items: e.responsibilities },
    { label: 'May decide', items: e.decisionRights.mayDecide },
    { label: 'Must escalate', items: e.decisionRights.mustEscalate },
    { label: 'Tools', items: e.tools },
    { label: 'Skills', items: e.skills },
    { label: 'Prompt stages', items: e.promptStages },
    { label: 'Procedures', items: e.sops },
    { label: 'Knowledge access', items: e.knowledgeAccess },
    { label: 'Memory scopes', items: e.memoryScopes },
    { label: 'Escalation rules', items: e.escalationRules },
    { label: 'Collaboration rules', items: e.collaborationRules },
    { label: 'Behavioural constraints', items: e.behavioralConstraints },
    { label: 'Security permissions', items: e.securityPermissions },
  ]

  return (
    <div className="space-y-3 text-xs">
      <div>
        <p className="text-sm font-semibold text-slate-100">{e.name}</p>
        <p className={MONO}>{e.employeeId}</p>
        <p className="mt-1 text-slate-400">
          {e.role} · {e.levelName.replace(/_/g, ' ').toLowerCase()} · {e.departmentName} · {e.divisionName}
        </p>
        <p className="mt-1 text-slate-500">Reporting line: {e.reportingPath.join(' → ')}</p>
      </div>
      <div className={CARD + ' p-3'}>
        <p className="text-[10px] uppercase tracking-wider text-slate-500">Mission</p>
        <p className="mt-1 text-slate-300">{e.mission}</p>
        <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Authority</p>
        <p className="mt-1 text-slate-300">{e.authority}</p>
      </div>
      <div className={CARD + ' p-3'}>
        <p className="text-[10px] uppercase tracking-wider text-slate-500">KPIs</p>
        <ul className="mt-1 space-y-1">
          {e.kpis.map((kpi) => (
            <li key={kpi.name} className="flex items-center justify-between gap-2 text-slate-300">
              <span>{kpi.name}</span>
              <span className={MONO}>
                {kpi.target} {kpi.direction === 'UP' ? '↑' : '↓'}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {groups.map((group) => (
        <details key={group.label} className={CARD + ' p-3'}>
          <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-slate-500">
            {group.label} ({group.items.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {group.items.length === 0 ? (
              <li className="text-slate-600">none</li>
            ) : (
              group.items.map((item) => (
                <li key={item} className="text-slate-400">
                  {item}
                </li>
              ))
            )}
          </ul>
        </details>
      ))}
      <div className={CARD + ' p-3'}>
        <p className="text-[10px] uppercase tracking-wider text-slate-500">Learning profile</p>
        <p className="mt-1 text-slate-400">Learns from: {e.learningProfile.learnsFrom.join(', ') || 'nothing recorded'}</p>
        <p className="text-slate-400">Teaches: {e.learningProfile.teaches.join(', ') || 'nothing recorded'}</p>
        <p className="text-slate-400">Review cadence: {e.learningProfile.reviewCadence}</p>
        <p className="mt-2 text-slate-400">
          Model profile: <span className={MONO}>{e.configuration.modelProfile}</span> · status{' '}
          <StatusBadge status={e.configuration.status} />
        </p>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Procedures
// ------------------------------------------------------------

type SopsResponse = {
  total: number
  procedures: Array<{
    key: string
    name: string
    category: string
    departmentCode: string
    level: number
    version: string
    status: string
    trigger: string
    steps: number
    decisionPoints: number
    tools: string[]
    requiresApproval: boolean
    validation: string[]
    output: string
    failurePath: string
    escalation: string
    runs: number
  }>
}

function ProceduresTab() {
  const [department, setDepartment] = useState('')
  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (department.trim()) params.set('department', department.trim().toUpperCase())
    const query = params.toString()
    return query ? `/api/admin/sops?${query}` : '/api/admin/sops'
  }, [department])
  const { data, loading, error, refresh } = useApi<SopsResponse>(url)

  return (
    <SectionCard
      title="Standard operating procedures"
      description={data ? `${data.total.toLocaleString()} procedures registered. The runtime walks them; it does not display them.` : 'Loading the procedures…'}
      actions={
        <div className="flex items-center gap-2">
          <Input
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            placeholder="Department code…"
            aria-label="Filter procedures by department"
            className="h-8 w-36 text-xs"
          />
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh the procedures">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
          </Button>
        </div>
      }
    >
      {error ? (
        <EmptyState icon={XCircle} title="The procedures could not be loaded" description={error} />
      ) : loading && !data ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-md bg-slate-800/50" />
          ))}
        </div>
      ) : data && data.procedures.length === 0 ? (
        <EmptyState icon={Search} title="No procedure matches" description="Try another department code." />
      ) : (
        <div className={CARD + ' overflow-x-auto'}>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Procedure</th>
                <th className="px-3 py-2 font-semibold">Department</th>
                <th className="px-3 py-2 font-semibold">Steps</th>
                <th className="px-3 py-2 font-semibold">Decisions</th>
                <th className="px-3 py-2 font-semibold">Approval</th>
                <th className="px-3 py-2 font-semibold">Runs</th>
              </tr>
            </thead>
            <tbody>
              {data?.procedures.map((procedure) => (
                <tr key={procedure.key} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                  <td className="px-3 py-2">
                    <span className="text-slate-200">{procedure.name}</span>
                    <span className={MONO + ' block'}>{procedure.key}</span>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[10px] text-slate-500">trigger, output, failure path, escalation</summary>
                      <p className="mt-1 text-[11px] text-slate-400">Trigger: {procedure.trigger}</p>
                      <p className="text-[11px] text-slate-400">Output: {procedure.output}</p>
                      <p className="text-[11px] text-slate-400">On failure: {procedure.failurePath}</p>
                      <p className="text-[11px] text-slate-400">Escalation: {procedure.escalation}</p>
                      <p className="text-[11px] text-slate-400">Validation: {procedure.validation.join('; ')}</p>
                      <p className="text-[11px] text-slate-400">Tools: {procedure.tools.join(', ')}</p>
                    </details>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{procedure.departmentCode}</td>
                  <td className="px-3 py-2 text-slate-400">{procedure.steps}</td>
                  <td className="px-3 py-2 text-slate-400">{procedure.decisionPoints}</td>
                  <td className="px-3 py-2">
                    {procedure.requiresApproval ? <StatusBadge status="AWAITING_APPROVAL" /> : <span className="text-slate-500">not required</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{procedure.runs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

// ------------------------------------------------------------
// Prompts
// ------------------------------------------------------------

type PromptsResponse = {
  mode: string
  library: { size: number; departments: number; roles: number; stages: number; languages: number }
  stages: string[]
  roles: Array<{ slug: string; title: string }>
  departments: Array<{ code: string; name: string; category: string }>
  stored: { total: number; shown: number; byStage: Record<string, number> }
  storedTemplates: Array<{
    id: string
    code: string
    name: string
    category: string
    stage: string
    language: string
    departmentCode: string | null
    priority: number
    quality: number
    version: string
    status: string
    usageCount: number
    successCount: number
  }>
}

type PromptsRetrieve = {
  retrieved: Array<{
    code: string
    name: string
    stage: string
    language: string
    score: number
    reasons: string[]
    priority: number
    quality: number
    version: string
    variables: string[]
    template: string
  }>
  stagesUsed: string[]
  count: number
}

function PromptsTab() {
  const [department, setDepartment] = useState('')
  const [role, setRole] = useState('')
  const [complexity, setComplexity] = useState('STANDARD')
  const [language, setLanguage] = useState('en')
  const [limit, setLimit] = useState(12)

  const index = useApi<PromptsResponse>('/api/admin/prompts?mode=index')
  const retrieveUrl = useMemo(() => {
    const params = new URLSearchParams({ mode: 'retrieve', complexity, language, limit: String(limit) })
    if (department.trim()) params.set('department', department.trim().toUpperCase())
    if (role) params.set('role', role)
    return `/api/admin/prompts?${params.toString()}`
  }, [department, role, complexity, language, limit])
  const retrieve = useApi<PromptsRetrieve>(retrieveUrl)

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Prompt slots" value={index.data?.library.size ?? '—'} icon={Brain} loading={index.loading} sub="department × role × stage × language" />
        <KpiCard label="Stages" value={index.data?.library.stages ?? '—'} icon={Layers} tone="slate" loading={index.loading} sub="execution stages" />
        <KpiCard label="Roles" value={index.data?.library.roles ?? '—'} icon={Bot} tone="slate" loading={index.loading} sub="role archetypes" />
        <KpiCard label="Departments" value={index.data?.library.departments ?? '—'} icon={Network} tone="slate" loading={index.loading} sub="covering departments" />
        <KpiCard label="Stored" value={index.data?.stored.total ?? '—'} icon={CheckCircle2} tone="green" loading={index.loading} sub="persisted templates" />
        <KpiCard label="Retrieved" value={retrieve.data?.count ?? '—'} icon={Search} tone="accent" loading={retrieve.loading} sub="what a task would receive" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <SectionCard
          title="Retrieval preview"
          description="This is the retrieval the runtime actually performs. The whole library is never loaded into a context."
          actions={
            <div className="flex items-center gap-2">
              <Input
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                placeholder="Department code…"
                aria-label="Retrieval department"
                className="h-8 w-32 text-xs"
              />
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                aria-label="Retrieval role"
                className="h-8 rounded-md border border-slate-800 bg-slate-950/60 px-2 text-xs text-slate-200"
              >
                <option value="">Any role</option>
                {(index.data?.roles ?? []).map((entry) => (
                  <option key={entry.slug} value={entry.slug}>
                    {entry.title}
                  </option>
                ))}
              </select>
              <select
                value={complexity}
                onChange={(event) => setComplexity(event.target.value)}
                aria-label="Retrieval complexity"
                className="h-8 rounded-md border border-slate-800 bg-slate-950/60 px-2 text-xs text-slate-200"
              >
                {['SIMPLE', 'STANDARD', 'COMPLEX', 'ENTERPRISE'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                aria-label="Retrieval language"
                className="h-8 rounded-md border border-slate-800 bg-slate-950/60 px-2 text-xs text-slate-200"
              >
                <option value="en">English</option>
                <option value="bn">Bangla</option>
              </select>
            </div>
          }
        >
          {retrieve.error ? (
            <EmptyState icon={XCircle} title="The retrieval preview could not be loaded" description={retrieve.error} />
          ) : retrieve.loading && !retrieve.data ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-md bg-slate-800/50" />
              ))}
            </div>
          ) : retrieve.data && retrieve.data.retrieved.length === 0 ? (
            <EmptyState icon={Search} title="Nothing matched" description="Try another department or role." />
          ) : (
            <div className="space-y-2">
              {retrieve.data?.retrieved.map((entry) => (
                <details key={entry.code} className={CARD + ' p-3'}>
                  <summary className="cursor-pointer">
                    <span className="text-xs text-slate-200">{entry.name}</span>
                    <span className={MONO + ' ml-2'}>{entry.code}</span>
                    <span className="ml-2 text-[10px] text-emerald-400">score {entry.score.toFixed(2)}</span>
                  </summary>
                  <p className="mt-2 text-[11px] text-slate-500">
                    stage {entry.stage} · language {entry.language} · priority {entry.priority} · quality {entry.quality} · v{entry.version}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">Why it matched: {entry.reasons.join('; ')}</p>
                  <p className="mt-1 text-[11px] text-slate-400">Variables: {entry.variables.join(', ')}</p>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950/70 p-2 font-mono text-[10px] text-slate-300">
                    {entry.template}
                  </pre>
                </details>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Stored templates" description={index.data ? `${index.data.stored.total} template(s) persisted in the database` : 'Loading…'}>
          {index.data && index.data.storedTemplates.length === 0 ? (
            <EmptyState icon={Brain} title="No templates persisted" description="The seed has not run, or every template has been retired." />
          ) : (
            <div className="space-y-1.5">
              {index.data?.storedTemplates.map((template) => (
                <div key={template.id} className={CARD + ' p-2'}>
                  <p className="text-[11px] text-slate-200">{template.name}</p>
                  <p className={MONO}>{template.code}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {template.stage} · {template.language} · v{template.version} · priority {template.priority} · used {template.usageCount}×
                    {template.successCount > 0 ? ` · ${template.successCount} successful` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </>
  )
}

// ------------------------------------------------------------
// Governance
// ------------------------------------------------------------

type GovernanceResponse = {
  constitution: Array<{ index: number; rule: string; enforcedBy: string }>
  layers: string[]
  rules: Array<{ id: string; layer: string; effect: string; requirement: string; condition?: string }>
  alwaysHuman: Array<{ id: string; description: string }>
  tools: {
    total: number
    byRisk: Record<string, number>
    registryValid: boolean
    issues: Array<{ code: string; message: string }>
    entries: Array<{
      id: string
      category: string
      riskLevel: string
      permission: string
      auth: string
      requiresApproval: boolean
      rateLimitPerMinute: number
      touchesCustomerData: boolean
      autonomous: boolean
      description: string
    }>
  }
  approvals: { pending: number; decided: number }
}

function GovernanceTab() {
  const { data, loading, error, refresh } = useApi<GovernanceResponse>('/api/admin/governance')
  const [toolQuery, setToolQuery] = useState('')

  const tools = useMemo(() => {
    const list = data?.tools.entries ?? []
    if (!toolQuery.trim()) return list
    const term = toolQuery.trim().toLowerCase()
    return list.filter((tool) => tool.id.toLowerCase().includes(term) || tool.category.toLowerCase().includes(term))
  }, [data, toolQuery])

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Constitution" value={data?.constitution.length ?? '—'} icon={ShieldCheck} loading={loading} sub="binding rules" />
        <KpiCard label="Rule layers" value={data?.layers.length ?? '—'} icon={Layers} tone="slate" loading={loading} sub="global → task" />
        <KpiCard label="Human-controlled" value={data?.alwaysHuman.length ?? '—'} icon={Scale} tone="amber" loading={loading} sub="action classes" />
        <KpiCard label="Governed tools" value={data?.tools.total ?? '—'} icon={Boxes} loading={loading} sub="with full metadata" />
        <KpiCard label="Registry check" value={data ? (data.tools.registryValid ? 'consistent' : `${data.tools.issues.length} issues`) : '—'} icon={CheckCircle2} tone={data?.tools.registryValid === false ? 'amber' : 'green'} loading={loading} sub="schema + risk + approval" />
        <KpiCard label="Pending approvals" value={data?.approvals.pending ?? '—'} icon={ShieldCheck} tone="accent" loading={loading} sub="waiting on a human" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Constitution" description="Each rule with the mechanism that enforces it. A rule that is not enforced is a wish.">
          {error ? (
            <EmptyState icon={XCircle} title="Governance could not be loaded" description={error} />
          ) : (
            <ol className="space-y-2">
              {data?.constitution.map((entry) => (
                <li key={entry.index} className={CARD + ' p-3'}>
                  <p className="text-xs text-slate-200">
                    <span className="text-slate-500">{entry.index}.</span> {entry.rule}
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-400">Enforced by: {entry.enforcedBy}</p>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>

        <SectionCard title="Layered rules" description="A higher layer cannot be bypassed by a lower one. A narrower rule may add a requirement; it may never remove one.">
          <div className="space-y-2">
            {data?.rules.map((rule) => (
              <div key={rule.id} className={CARD + ' p-3'}>
                <p className="flex items-center justify-between gap-2 text-xs">
                  <span className={MONO}>{rule.id}</span>
                  <span className="text-[10px] text-slate-400">
                    {rule.layer} · {rule.effect}
                    {rule.condition ? ` · ${rule.condition}` : ''}
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-slate-400">{rule.requirement}</p>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Always a human</p>
            <ul className="mt-1 space-y-1">
              {data?.alwaysHuman.map((action) => (
                <li key={action.id} className="text-[11px] text-slate-400">
                  <span className={MONO}>{action.id}</span> — {action.description}
                </li>
              ))}
            </ul>
          </div>
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard
          title="Tool registry"
          description={data ? `${data.tools.total} tools, each with its schema, permission, risk, authentication, rate limit, approval rule and audit rule` : 'Loading…'}
          actions={
            <div className="flex items-center gap-2">
              <Input
                value={toolQuery}
                onChange={(event) => setToolQuery(event.target.value)}
                placeholder="Filter tools…"
                aria-label="Filter tools"
                className="h-8 w-44 text-xs"
              />
              <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh governance">
                <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
              </Button>
            </div>
          }
        >
          {data && data.tools.issues.length > 0 ? (
            <div className="mb-3">
              <EmptyState
                icon={AlertTriangle}
                title="The tool registry has issues"
                description={data.tools.issues.map((issue) => `${issue.code}: ${issue.message}`).join(' · ')}
              />
            </div>
          ) : null}
          <div className={CARD + ' overflow-x-auto'}>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Tool</th>
                  <th className="px-3 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 font-semibold">Risk</th>
                  <th className="px-3 py-2 font-semibold">Permission</th>
                  <th className="px-3 py-2 font-semibold">Auth</th>
                  <th className="px-3 py-2 font-semibold">Rate</th>
                  <th className="px-3 py-2 font-semibold">Approval</th>
                  <th className="px-3 py-2 font-semibold">Customer data</th>
                </tr>
              </thead>
              <tbody>
                {tools.map((tool) => (
                  <tr key={tool.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                    <td className="px-3 py-2">
                      <span className="text-slate-200">{tool.id}</span>
                      <span className="block text-[10px] text-slate-500">{tool.description}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-400">{tool.category}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={tool.riskLevel} />
                    </td>
                    <td className={MONO + ' px-3 py-2'}>{tool.permission}</td>
                    <td className="px-3 py-2 text-slate-400">{tool.auth}</td>
                    <td className="px-3 py-2 text-slate-400">{tool.rateLimitPerMinute}/min</td>
                    <td className="px-3 py-2">{tool.requiresApproval ? <StatusBadge status="AWAITING_APPROVAL" /> : <span className="text-slate-500">no</span>}</td>
                    <td className="px-3 py-2">{tool.touchesCustomerData ? 'yes' : 'no'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </>
  )
}

// ------------------------------------------------------------
// Knowledge graph
// ------------------------------------------------------------

type GraphResponse = {
  stats: { entities: number; relations: number; verifiedEntities: number }
  entities?: Array<{ key: string; name: string; type: string; description: string | null; accessLevel: string; confidence: number; verified: boolean }>
  neighbours?: Array<{ entity: { key: string; name: string; type: string; confidence: number }; relation: { type: string; direction: string; confidence: number }; score: number }>
  query?: string
}

function GraphTab() {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (search.trim()) params.set('key', search.trim())
    const qs = params.toString()
    return qs ? `/api/admin/knowledge-graph?${qs}` : '/api/admin/knowledge-graph'
  }, [query, search])

  const { data, loading, error, refresh } = useApi<GraphResponse>(url)

  async function rebuild() {
    setBusy(true)
    try {
      await fetchJson<{ entities: number; relations: number }>('/api/admin/knowledge-graph', { method: 'POST' })
      toast.success('The structural graph was rebuilt from the platform structure.')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The graph could not be rebuilt.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Entities" value={data?.stats.entities ?? '—'} icon={Network} loading={loading} sub="nodes in the graph" />
        <KpiCard label="Relations" value={data?.stats.relations ?? '—'} icon={GitBranch} tone="slate" loading={loading} sub="edges in the graph" />
        <KpiCard label="Verified" value={data?.stats.verifiedEntities ?? '—'} icon={CheckCircle2} tone="green" loading={loading} sub="confirmed entities" />
      </div>

      <SectionCard
        title="Knowledge graph"
        description="A second index over the same corpus as the RAG store — not a second corpus. Every entity carries its source, its access level and a confidence that one claim cannot make certain."
        actions={
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search entities…"
              aria-label="Search the graph"
              className="h-8 w-44 text-xs"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Entity key…"
              aria-label="Open an entity"
              className="h-8 w-40 text-xs"
            />
            <Button size="sm" onClick={rebuild} disabled={busy}>
              Rebuild structure
            </Button>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh the graph">
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            </Button>
          </div>
        }
      >
        {error ? (
          <EmptyState icon={XCircle} title="The graph could not be loaded" description={error} />
        ) : data?.neighbours && data.neighbours.length > 0 ? (
          <div className={CARD + ' overflow-x-auto'}>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Neighbour</th>
                  <th className="px-3 py-2 font-semibold">Relation</th>
                  <th className="px-3 py-2 font-semibold">Confidence</th>
                  <th className="px-3 py-2 font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.neighbours.map((neighbour) => (
                  <tr key={`${neighbour.entity.key}-${neighbour.relation.type}-${neighbour.relation.direction}`} className="border-b border-slate-800/60 last:border-0">
                    <td className="px-3 py-2">
                      <span className="text-slate-200">{neighbour.entity.name}</span>
                      <span className={MONO + ' block'}>{neighbour.entity.key}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {neighbour.relation.direction} {neighbour.relation.type}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{neighbour.relation.confidence.toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-400">{neighbour.score.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : data?.entities && data.entities.length > 0 ? (
          <div className={CARD + ' overflow-x-auto'}>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Entity</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Access</th>
                  <th className="px-3 py-2 font-semibold">Confidence</th>
                  <th className="px-3 py-2 font-semibold">Verified</th>
                </tr>
              </thead>
              <tbody>
                {data.entities.map((entity) => (
                  <tr key={entity.key} className="border-b border-slate-800/60 last:border-0">
                    <td className="px-3 py-2">
                      <span className="text-slate-200">{entity.name}</span>
                      <span className={MONO + ' block'}>{entity.key}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-400">{entity.type}</td>
                    <td className="px-3 py-2 text-slate-400">{entity.accessLevel}</td>
                    <td className="px-3 py-2 text-slate-400">{entity.confidence.toFixed(2)}</td>
                    <td className="px-3 py-2">{entity.verified ? 'yes' : 'no'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Network}
            title="The graph is empty"
            description="No entity has been written yet. Rebuild the structural graph to create the organisation, the procedures and the tools as nodes."
          />
        )}
      </SectionCard>
    </>
  )
}

// ------------------------------------------------------------
// Events
// ------------------------------------------------------------

type EventsResponse = {
  events: Array<{ id: string; type: string; source: string; payload: string; severity: string; createdAt: string }>
  total: number
  byType: Record<string, number>
  eventTypes: string[]
  subscribers: Array<{ id: string; types: string[]; owner: string | null }>
}

function EventsTab() {
  const { data, loading, error, refresh } = useApi<EventsResponse>('/api/admin/events?limit=100')

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <SectionCard
        title="Event history"
        description={data ? `${data.total} recorded event(s). This is the AgentEvent table, not a log line.` : 'Loading…'}
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh the event bus">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
          </Button>
        }
      >
        {error ? (
          <EmptyState icon={XCircle} title="The event bus could not be loaded" description={error} />
        ) : data && data.events.length === 0 ? (
          <EmptyState icon={Activity} title="No event has been published" description="The workforce has not published an event yet." />
        ) : (
          <div className={CARD + ' overflow-x-auto'}>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Source</th>
                  <th className="px-3 py-2 font-semibold">Severity</th>
                  <th className="px-3 py-2 font-semibold">Payload</th>
                  <th className="px-3 py-2 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {data?.events.map((event) => (
                  <tr key={event.id} className="border-b border-slate-800/60 last:border-0">
                    <td className={MONO + ' px-3 py-2'}>{event.type}</td>
                    <td className="px-3 py-2 text-slate-400">{event.source}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={event.severity} />
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      <span className="line-clamp-2 font-mono text-[10px]">{event.payload}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{new Date(event.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Subscribers" description="Handlers registered against the bus. An agent subscribes only to the events that matter to it.">
        {data && data.subscribers.length === 0 ? (
          <EmptyState icon={Activity} title="No subscriber is registered" description="Nothing is listening to the bus yet." />
        ) : (
          <div className="space-y-2">
            {data?.subscribers.map((subscriber) => (
              <div key={subscriber.id} className={CARD + ' p-2'}>
                <p className={MONO}>{subscriber.id}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{subscriber.types.join(', ')}</p>
                {subscriber.owner ? <p className="text-[10px] text-slate-500">owner: {subscriber.owner}</p> : null}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Event types ({data?.eventTypes.length ?? 0})</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {(data?.eventTypes ?? []).map((type) => (
              <span key={type} className={CARD + ' px-1.5 py-0.5 font-mono text-[10px] text-slate-400'}>
                {type}
              </span>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// ------------------------------------------------------------
// Memory
// ------------------------------------------------------------

type MemoryResponse = {
  stats: { total: number; byType: Record<string, number>; byScope: Record<string, number>; validated: number; expiringSoon: number }
  types: string[]
  scopes: string[]
  retrieved: Array<{
    id: string
    scope: string
    key: string
    content: string
    memoryType: string
    accessLevel: string
    validated: boolean
    version: number
    source: string
    importance: number
    hits: number
    updatedAt: string
  }>
}

function MemoryTab() {
  const [type, setType] = useState('')
  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: '15' })
    if (type) params.set('type', type)
    return `/api/admin/memory?${params.toString()}`
  }, [type])
  const { data, loading, error, refresh } = useApi<MemoryResponse>(url)

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Memories" value={data?.stats.total ?? '—'} icon={BookOpen} loading={loading} sub="stored records" />
        <KpiCard label="Validated" value={data?.stats.validated ?? '—'} icon={CheckCircle2} tone="green" loading={loading} sub="reviewed and confirmed" />
        <KpiCard label="Expiring" value={data?.stats.expiringSoon ?? '—'} icon={AlertTriangle} tone="amber" loading={loading} sub="within seven days" />
        {(data?.types ?? []).map((memoryType) => (
          <KpiCard key={memoryType} label={memoryType.toLowerCase()} value={data?.stats.byType[memoryType] ?? 0} icon={BookOpen} tone="slate" loading={loading} sub="of this type" />
        ))}
      </div>

      <SectionCard
        title="Memory"
        description="Working, episodic, semantic and procedural memory over the enterprise scopes. Permission-aware, versioned, validated and expiring. Retrieval is capped so a context is never flooded."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              aria-label="Filter by memory type"
              className="h-8 rounded-md border border-slate-800 bg-slate-950/60 px-2 text-xs text-slate-200"
            >
              <option value="">All types</option>
              {(data?.types ?? []).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh memory">
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            </Button>
          </div>
        }
      >
        {error ? (
          <EmptyState icon={XCircle} title="Memory could not be loaded" description={error} />
        ) : data && data.retrieved.length === 0 ? (
          <EmptyState icon={BookOpen} title="No memory is visible" description="Nothing has been written, or nothing matches the access levels of this console." />
        ) : (
          <div className="space-y-2">
            {data?.retrieved.map((memory) => (
              <div key={memory.id} className={CARD + ' p-3'}>
                <p className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-200">{memory.key}</span>
                  <span className="text-[10px] text-slate-500">
                    {memory.memoryType} · {memory.scope} · {memory.accessLevel} · v{memory.version}
                    {memory.validated ? ' · validated' : ' · not validated'}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[11px] text-slate-400">{memory.content}</p>
                <p className="mt-1 text-[10px] text-slate-600">
                  source {memory.source} · importance {memory.importance} · read {memory.hits}×
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  )
}

// ------------------------------------------------------------
// Model hub
// ------------------------------------------------------------

type ModelHubResponse = {
  status: {
    catalogSize: number
    installed: string[]
    unverifiedWeights: string[]
    byCategory: Record<string, string[]>
    providers: Array<{ kind: string; state: string; detail: string }>
  }
  categories: string[]
  catalog: Array<{
    slug: string
    upstreamModel: string
    displayName: string
    parameters: string
    quantization: string
    ramFootprintMb: number
    contextWindow: number
    license: string
    licenseVerified: boolean
    weightsVerified: boolean
    revision: string | null
    weightChecksum: string | null
    languages: string[]
    notes: string
  }>
}

function ModelHubTab() {
  const { data, loading, error, refresh } = useApi<ModelHubResponse>('/api/admin/model-hub')
  const [taskType, setTaskType] = useState('general')
  const [complexity, setComplexity] = useState('STANDARD')
  const routeUrl = useMemo(
    () => `/api/admin/model-hub?route=1&taskType=${taskType}&complexity=${complexity}&language=en`,
    [taskType, complexity],
  )
  const route = useApi<{ decision: { ok: boolean; reason: string; chain: string[]; selected: { upstreamModel: string; displayName: string; parameters: string; quantization: string; ramFootprintMb: number; score: number; reasons: string[]; installed: boolean; measuredFirstTokenMs: number | null; measuredQuality: number | null } | null; candidates: Array<{ upstreamModel: string; score: number; reasons: string[]; installed: boolean }> } }>(
    routeUrl,
  )

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Catalogue" value={data?.status.catalogSize ?? '—'} icon={Boxes} loading={loading} sub="candidate models" />
        <KpiCard label="Installed" value={data?.status.installed.length ?? '—'} icon={CheckCircle2} tone="green" loading={loading} sub="present on this host" />
        <KpiCard label="Unverified weights" value={data?.status.unverifiedWeights.length ?? '—'} icon={AlertTriangle} tone="amber" loading={loading} sub="not checksummed here" />
        <KpiCard label="Categories" value={data?.categories.length ?? '—'} icon={Layers} tone="slate" loading={loading} sub="model categories" />
        <KpiCard label="Providers" value={data?.status.providers.length ?? '—'} icon={Network} tone="slate" loading={loading} sub="configured upstreams" />
        <KpiCard
          label="Routed model"
          value={route.data?.decision.selected?.upstreamModel ?? '—'}
          icon={Scale}
          tone="accent"
          loading={route.loading}
          sub="for the selected task"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <SectionCard
          title="Model catalogue"
          description="A model is only reported as verified when its revision and weight checksum were captured on the host that runs it."
          actions={
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh the model hub">
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            </Button>
          }
        >
          {error ? (
            <EmptyState icon={XCircle} title="The model hub could not be loaded" description={error} />
          ) : (
            <div className={CARD + ' overflow-x-auto'}>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Model</th>
                    <th className="px-3 py-2 font-semibold">Size</th>
                    <th className="px-3 py-2 font-semibold">RAM</th>
                    <th className="px-3 py-2 font-semibold">Context</th>
                    <th className="px-3 py-2 font-semibold">Licence</th>
                    <th className="px-3 py-2 font-semibold">Weights</th>
                    <th className="px-3 py-2 font-semibold">Installed</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.catalog.map((entry) => (
                    <tr key={entry.slug} className="border-b border-slate-800/60 last:border-0">
                      <td className="px-3 py-2">
                        <span className="text-slate-200">{entry.displayName}</span>
                        <span className={MONO + ' block'}>{entry.upstreamModel}</span>
                        <span className="block text-[10px] text-slate-500">{entry.notes}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-400">
                        {entry.parameters} / {entry.quantization}
                      </td>
                      <td className="px-3 py-2 text-slate-400">{entry.ramFootprintMb} MB</td>
                      <td className="px-3 py-2 text-slate-400">{entry.contextWindow}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={entry.licenseVerified ? entry.license : 'UNVERIFIED'} />
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={entry.weightsVerified ? 'VERIFIED' : 'UNVERIFIED'} />
                      </td>
                      <td className="px-3 py-2">{data.status.installed.includes(entry.upstreamModel) ? 'yes' : 'no'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Routing decision"
          description="The model hub chooses the model by task type, complexity, context, tool use, language, latency, quality and cost. An unmeasured value is reported as unmeasured."
          actions={
            <div className="flex items-center gap-2">
              <select
                value={taskType}
                onChange={(event) => setTaskType(event.target.value)}
                aria-label="Task type"
                className="h-8 rounded-md border border-slate-800 bg-slate-950/60 px-2 text-xs text-slate-200"
              >
                {(data?.categories ?? []).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <select
                value={complexity}
                onChange={(event) => setComplexity(event.target.value)}
                aria-label="Complexity"
                className="h-8 rounded-md border border-slate-800 bg-slate-950/60 px-2 text-xs text-slate-200"
              >
                {['SIMPLE', 'STANDARD', 'COMPLEX', 'ENTERPRISE'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          {route.error ? (
            <EmptyState icon={XCircle} title="The routing decision could not be loaded" description={route.error} />
          ) : route.data ? (
            <div className="space-y-3 text-xs">
              <div className={CARD + ' p-3'}>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Selected</p>
                <p className="mt-1 text-slate-200">{route.data.decision.selected?.displayName ?? 'none'}</p>
                <p className={MONO}>{route.data.decision.selected?.upstreamModel}</p>
                <p className="mt-1 text-slate-400">{route.data.decision.reason}</p>
                {route.data.decision.selected ? (
                  <ul className="mt-2 space-y-1">
                    {route.data.decision.selected.reasons.map((reason) => (
                      <li key={reason} className="text-[11px] text-slate-500">
                        · {reason}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {route.data.decision.selected ? (
                  <p className="mt-2 text-[11px] text-slate-500">
                    measured first token: {route.data.decision.selected.measuredFirstTokenMs === null ? 'never measured' : `${route.data.decision.selected.measuredFirstTokenMs} ms`} ·
                    measured quality: {route.data.decision.selected.measuredQuality === null ? 'never measured' : route.data.decision.selected.measuredQuality}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Fallback chain</p>
                <ol className="mt-1 space-y-1">
                  {route.data.decision.chain.map((model, index) => (
                    <li key={model} className={MONO}>
                      {index + 1}. {model}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : null}
        </SectionCard>
      </div>
    </>
  )
}

// ------------------------------------------------------------
// Collaboration
// ------------------------------------------------------------

type CollaborationResponse = {
  delegations: Array<{
    id: string
    requestingAgent: string
    targetAgent: string
    kind: string
    task: string
    objective: string
    priority: string
    deadline: string | null
    permissions: string
    expectedOutput: string
    status: string
    correlationId: string
    createdAt: string
  }>
  total: number
  byStatus: Record<string, number>
  workforceSize: number
}

function CollaborationTab() {
  const { data, loading, error, refresh } = useApi<CollaborationResponse>('/api/admin/collaboration?limit=50')

  return (
    <SectionCard
      title="Agent-to-agent collaboration"
      description={data ? `${data.total} delegation(s) recorded. Every delegation is a contract: requester, target, task, objective, context, priority, deadline, permissions and expected output.` : 'Loading…'}
      actions={
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh collaboration">
          <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
        </Button>
      }
    >
      {error ? (
        <EmptyState icon={XCircle} title="Collaboration could not be loaded" description={error} />
      ) : data && data.delegations.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No delegation has been recorded"
          description="Agents have not delegated to one another yet. The orchestrator creates a delegation whenever one employee hands work to another."
        />
      ) : (
        <div className={CARD + ' overflow-x-auto'}>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Requester → target</th>
                <th className="px-3 py-2 font-semibold">Kind</th>
                <th className="px-3 py-2 font-semibold">Objective</th>
                <th className="px-3 py-2 font-semibold">Priority</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {data?.delegations.map((delegation) => (
                <tr key={delegation.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="px-3 py-2">
                    <span className={MONO}>{delegation.requestingAgent}</span>
                    <span className="text-slate-500"> → </span>
                    <span className={MONO}>{delegation.targetAgent}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{delegation.kind}</td>
                  <td className="px-3 py-2 text-slate-300">
                    {delegation.objective}
                    <span className="block text-[10px] text-slate-500">expects: {delegation.expectedOutput}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{delegation.priority}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={delegation.status} />
                  </td>
                  <td className="px-3 py-2 text-slate-500">{new Date(delegation.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

// ------------------------------------------------------------
// The view
// ------------------------------------------------------------

export default function WorkforceView() {
  const [tab, setTab] = useState<Tab>('employees')
  const [reloadKey, setReloadKey] = useState(0)

  const refresh = useCallback(() => setReloadKey((value) => value + 1), [])

  return (
    <div>
      <PageHeader
        title="Configured Org Chart Profiles"
        description="This view is generated from source definitions in memory; it is not a persisted employee or deployed-agent roster. Profile assignments describe intended configuration, not verified live execution. Use Core Agents for persisted database rows and DCC Certification for evidence-gated department status."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} aria-label="Reload the panel">
            <RefreshCw className="size-4" aria-hidden="true" />
            Reload
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="AI workforce panels">
        {TABS.map((entry) => {
          const Icon = entry.icon
          const active = tab === entry.id
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(entry.id)}
              className={
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ' +
                (active
                  ? 'border-[#009FE3]/60 bg-[#009FE3]/10 text-slate-100'
                  : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200')
              }
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {entry.label}
            </button>
          )
        })}
      </div>

      <div key={`${tab}-${reloadKey}`}>
        {tab === 'employees' ? <EmployeesTab /> : null}
        {tab === 'procedures' ? <ProceduresTab /> : null}
        {tab === 'prompts' ? <PromptsTab /> : null}
        {tab === 'governance' ? <GovernanceTab /> : null}
        {tab === 'graph' ? <GraphTab /> : null}
        {tab === 'events' ? <EventsTab /> : null}
        {tab === 'memory' ? <MemoryTab /> : null}
        {tab === 'models' ? <ModelHubTab /> : null}
        {tab === 'collaboration' ? <CollaborationTab /> : null}
      </div>
    </div>
  )
}
