'use client'

import { useCallback, useMemo, useState } from 'react'
import { Activity, AlertTriangle, ListChecks, Loader2, Plus, RefreshCw, RotateCcw, ShieldCheck, Trash2, Workflow, X } from 'lucide-react'
import { toast } from 'sonner'

import { fetchJson, useApi, ApiError } from '@/lib/admin-client'
import { EmptyState, PageHeader } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { CARD, INPUT, SCROLL_THIN } from './shared/styles'
import { Button } from '@/components/ui/button'

// ============================================================
// TECH360 — Automation control plane (event-driven rules engine).
// Rules: versioned trigger → conditions → actions (with branches,
// failure policy and approval policy); activation is a Super Admin
// decision. Runs: real step-by-step execution history, retries,
// dead-letter queue and manual replay (a new run; never mutates
// history). Events: the domain event log the engine consumes.
// ============================================================

type ParamSpec = { required: boolean; kind: 'string' | 'number' | 'enum'; values?: readonly string[]; max?: number }
type CatalogAction = { type: string; label: string; highImpact: boolean; params: Record<string, ParamSpec> }
type Catalog = { triggers: Array<{ type: string; label: string }>; actions: CatalogAction[]; conditionOps: string[] }

type Condition = { field: string; op: string; value?: unknown }
type RuleAction = { type: string; params: Record<string, unknown>; when?: Condition[]; onFailure?: 'STOP' | 'CONTINUE' }
type Rule = {
  id: string; key: string; name: string; description: string | null; triggerType: string
  conditions: Condition[]; actions: RuleAction[]; status: 'DRAFT' | 'ACTIVE' | 'DISABLED'; version: number
  requiresApproval: boolean; maxAttempts: number; updatedBy: string | null; updatedAt: string
  needsApproval?: boolean; lastRun?: { status: string; createdAt: string } | null; failedRuns?: number
}
type Step = { index: number; type: string; status: string; detail: string; attempt: number; at: string; output?: Record<string, unknown> }
type Run = {
  id: string; ruleId: string; ruleName: string | null; ruleVersion: number; eventId: string; triggerType: string
  correlationId: string; status: string; attempts: number; maxAttempts: number; nextAttemptAt: string | null
  steps: Step[]; error: string | null; approvalId: string | null; replayOfId: string | null; triggeredBy: string | null
  startedAt: string | null; finishedAt: string | null; createdAt: string
}
type RunDetail = {
  run: Run
  rule: { id: string; name: string; key: string; version: number; status: string } | null
  event: { id: string; type: string; source: string; subjectType: string; subjectId: string; payload: unknown; status: string; createdAt: string; error: string | null } | null
  approval: { id: string; status: string; title: string; decidedBy: string | null; decisionNote: string | null } | null
  n8nExecutions: Array<{ id: string; workflowCode: string; correlationId: string; status: string; attempts: number; httpStatus: number | null; error: string | null; createdAt: string }>
  replays: Array<{ id: string; status: string; createdAt: string; triggeredBy: string | null }>
}
type EventRow = { id: string; type: string; source: string; subjectType: string; subjectId: string; correlationId: string; status: string; error: string | null; createdAt: string; processedAt: string | null; payload: unknown }

const RUN_FILTERS = ['', 'SUCCEEDED', 'SUCCEEDED_WITH_ERRORS', 'FAILED', 'DEAD_LETTER', 'AWAITING_APPROVAL', 'RETRY_SCHEDULED', 'WAITING_EXTERNAL', 'RUNNING', 'SKIPPED'] as const
const SELECT = 'h-9 rounded-md border border-slate-800 bg-slate-950/60 px-2 text-sm text-slate-200 focus-visible:border-[#009FE3]/60 focus-visible:outline-none'
const OUTLINE = 'border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'

function when(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString() : '—'
}
function errMsg(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    const issues = (err.data as { issues?: string[] } | null)?.issues
    if (issues?.length) return `${err.message}: ${issues.join('; ')}`
  }
  return err instanceof Error ? err.message : fallback
}

/** Condition values are typed by operator: lists for `in`, numbers for gt/lt, none for exists. */
function parseConditionValue(op: string, text: string): unknown {
  if (op === 'exists' || op === 'not_exists') return undefined
  if (op === 'in') return text.split(',').map((s) => s.trim()).filter(Boolean)
  if (op === 'gt' || op === 'lt') return Number(text)
  if (text === 'true') return true
  if (text === 'false') return false
  return text
}
function conditionValueText(c: Condition) {
  if (c.value === undefined || c.value === null) return ''
  return Array.isArray(c.value) ? c.value.join(', ') : String(c.value)
}

function ConditionRows({ value, onChange, ops, label }: { value: Condition[]; onChange: (v: Condition[]) => void; ops: string[]; label: string }) {
  return (
    <div className="space-y-1.5">
      {value.map((c, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <input aria-label={`${label} ${i + 1} field`} className={`${INPUT} w-48`} placeholder="payload field, e.g. intent" value={c.field} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))} />
          <select aria-label={`${label} ${i + 1} operator`} className={SELECT} value={c.op} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, op: e.target.value, value: parseConditionValue(e.target.value, conditionValueText(x)) } : x)))}>
            {ops.map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
          {c.op !== 'exists' && c.op !== 'not_exists' && (
            <input aria-label={`${label} ${i + 1} value`} className={`${INPUT} w-48`} placeholder={c.op === 'in' ? 'a, b, c' : 'value'} value={conditionValueText(c)} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, value: parseConditionValue(x.op, e.target.value) } : x)))} />
          )}
          <Button type="button" size="sm" variant="outline" className={OUTLINE} onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove ${label} ${i + 1}`}><Trash2 className="size-3.5" /></Button>
        </div>
      ))}
      <button type="button" className="text-xs text-sky-300 underline" onClick={() => onChange([...value, { field: '', op: 'eq', value: '' }])}>+ Add {label}</button>
    </div>
  )
}

type Draft = { id?: string; key: string; name: string; description: string; triggerType: string; conditions: Condition[]; actions: RuleAction[]; requiresApproval: boolean; maxAttempts: number }
const emptyDraft = (trigger: string): Draft => ({ key: '', name: '', description: '', triggerType: trigger, conditions: [], actions: [], requiresApproval: false, maxAttempts: 3 })

function RuleEditor({ catalog, initial, onSaved, onCancel }: { catalog: Catalog; initial: Draft; onSaved: () => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Draft>(initial)
  const [saving, setSaving] = useState(false)
  const specByType = useMemo(() => new Map(catalog.actions.map((a) => [a.type, a])), [catalog.actions])
  const highImpact = draft.actions.some((a) => specByType.get(a.type)?.highImpact)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetchJson<{ versionCreated?: boolean; rule: Rule }>('/api/admin/automation/rules', { method: 'POST', body: { ...draft, description: draft.description || null } })
      toast.success(draft.id ? (res.versionCreated ? `Saved as version ${res.rule.version}.` : 'Saved (no logic change, same version).') : 'Rule created as DRAFT — a Super Admin activates it.')
      onSaved()
    } catch (err) {
      toast.error(errMsg(err, 'Could not save the rule.'))
    } finally {
      setSaving(false)
    }
  }

  const setAction = (i: number, patch: Partial<RuleAction>) => setDraft((d) => ({ ...d, actions: d.actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) }))

  return (
    <section className={`${CARD} space-y-4 p-4`} aria-label={draft.id ? 'Edit rule' : 'New rule'}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">{draft.id ? `Edit rule — ${draft.key}` : 'New automation rule'}</h2>
        <Button size="sm" variant="outline" className={OUTLINE} onClick={onCancel}><X className="size-4" /> Close</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs text-slate-400">Key (stable id)
          <input className={INPUT} value={draft.key} disabled={Boolean(draft.id)} onChange={(e) => setDraft({ ...draft, key: e.target.value.toLowerCase() })} placeholder="e.g. escalate-billing-chats" />
        </label>
        <label className="space-y-1 text-xs text-slate-400">Name
          <input className={INPUT} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <label className="space-y-1 text-xs text-slate-400 md:col-span-2">Description
          <input className={INPUT} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </label>
        <label className="space-y-1 text-xs text-slate-400">Trigger
          <select className={`${SELECT} w-full`} value={draft.triggerType} onChange={(e) => setDraft({ ...draft, triggerType: e.target.value })}>
            {catalog.triggers.map((t) => <option key={t.type} value={t.type}>{t.label} ({t.type})</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-slate-400">Max attempts per action (retries with backoff)
          <input type="number" min={1} max={10} className={INPUT} value={draft.maxAttempts} onChange={(e) => setDraft({ ...draft, maxAttempts: Number(e.target.value) || 1 })} />
        </label>
      </div>

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Conditions (all must match the event payload)</h3>
        <ConditionRows value={draft.conditions} onChange={(conditions) => setDraft({ ...draft, conditions })} ops={catalog.conditionOps} label="condition" />
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actions (run in order)</h3>
        {draft.actions.map((a, i) => {
          const spec = specByType.get(a.type)
          return (
            <div key={i} className="space-y-2 rounded-md border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">#{i + 1}</span>
                <select aria-label={`Action ${i + 1} type`} className={SELECT} value={a.type} onChange={(e) => setAction(i, { type: e.target.value, params: {} })}>
                  {catalog.actions.map((x) => <option key={x.type} value={x.type}>{x.label}</option>)}
                </select>
                {spec?.highImpact && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">HIGH IMPACT — approval required</span>}
                <select aria-label={`Action ${i + 1} on failure`} className={SELECT} value={a.onFailure ?? 'STOP'} onChange={(e) => setAction(i, { onFailure: e.target.value as 'STOP' | 'CONTINUE' })}>
                  <option value="STOP">On failure: stop the run</option>
                  <option value="CONTINUE">On failure: record and continue</option>
                </select>
                <Button type="button" size="sm" variant="outline" className={`${OUTLINE} ml-auto`} onClick={() => setDraft((d) => ({ ...d, actions: d.actions.filter((_, j) => j !== i) }))} aria-label={`Remove action ${i + 1}`}><Trash2 className="size-3.5" /></Button>
              </div>
              {spec && Object.keys(spec.params).length > 0 && (
                <div className="grid gap-2 md:grid-cols-2">
                  {Object.entries(spec.params).map(([name, p]) => (
                    <label key={name} className="space-y-1 text-xs text-slate-400">
                      {name}{p.required ? ' *' : ''}
                      {p.kind === 'enum' ? (
                        <select className={`${SELECT} w-full`} value={String(a.params[name] ?? '')} onChange={(e) => setAction(i, { params: { ...a.params, [name]: e.target.value || undefined } })}>
                          <option value="">—</option>
                          {(p.values ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      ) : p.kind === 'number' ? (
                        <input type="number" className={INPUT} value={a.params[name] === undefined ? '' : String(a.params[name])} onChange={(e) => setAction(i, { params: { ...a.params, [name]: e.target.value === '' ? undefined : Number(e.target.value) } })} />
                      ) : (p.max ?? 0) > 300 ? (
                        <textarea rows={3} maxLength={p.max} className={`${INPUT} h-auto py-2`} value={String(a.params[name] ?? '')} onChange={(e) => setAction(i, { params: { ...a.params, [name]: e.target.value } })} />
                      ) : (
                        <input maxLength={p.max} className={INPUT} value={String(a.params[name] ?? '')} onChange={(e) => setAction(i, { params: { ...a.params, [name]: e.target.value } })} />
                      )}
                    </label>
                  ))}
                </div>
              )}
              <details>
                <summary className="cursor-pointer text-xs text-slate-500">Branch: only run this action when… ({a.when?.length ?? 0})</summary>
                <div className="mt-1.5"><ConditionRows value={a.when ?? []} onChange={(w) => setAction(i, { when: w.length ? w : undefined })} ops={catalog.conditionOps} label="branch condition" /></div>
              </details>
            </div>
          )
        })}
        <Button type="button" size="sm" variant="outline" className={OUTLINE} onClick={() => setDraft((d) => ({ ...d, actions: [...d.actions, { type: catalog.actions[0]?.type ?? 'NOTIFY_TEAM', params: {} }] }))}>
          <Plus className="size-4" /> Add action
        </Button>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={draft.requiresApproval || highImpact} disabled={highImpact} onChange={(e) => setDraft({ ...draft, requiresApproval: e.target.checked })} />
        Require Super Admin approval before each run executes
        {highImpact && <span className="text-xs text-amber-300">(always on: this rule contains a high-impact action)</span>}
      </label>
      <p className="text-xs text-slate-500">Saving a change to the trigger, conditions, actions or approval policy creates a new immutable version. Approvals are bound to the exact parameters; changed parameters need a new approval.</p>
      <div className="flex gap-2">
        <Button onClick={() => void save()} disabled={saving} className="font-semibold text-white" style={{ background: '#009FE3' }}>
          {saving && <Loader2 className="size-4 animate-spin" />} {draft.id ? 'Save new version' : 'Create draft rule'}
        </Button>
      </div>
    </section>
  )
}

function RunDetailPanel({ runId, onClose, onReplayed }: { runId: string; onClose: () => void; onReplayed: (id: string) => void }) {
  const { data, loading, error, refresh } = useApi<RunDetail>(`/api/admin/automation/runs/${encodeURIComponent(runId)}`)
  const [replaying, setReplaying] = useState(false)
  const replay = async () => {
    setReplaying(true)
    try {
      const res = await fetchJson<{ runId: string; status: string }>(`/api/admin/automation/runs/${encodeURIComponent(runId)}/replay`, { method: 'POST', body: {} })
      toast.success(`Replay started as a new run — ${res.status}.`)
      onReplayed(res.runId)
    } catch (err) {
      toast.error(errMsg(err, 'Replay refused.'))
    } finally {
      setReplaying(false)
    }
  }
  const run = data?.run
  const finished = run && !['PENDING', 'RUNNING', 'RETRY_SCHEDULED', 'WAITING_EXTERNAL', 'AWAITING_APPROVAL'].includes(run.status)
  return (
    <aside className={`${CARD} max-h-[calc(100vh-14rem)] space-y-3 overflow-y-auto p-4 text-xs ${SCROLL_THIN}`} aria-label="Run detail">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">Run detail</h2>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className={OUTLINE} onClick={refresh} aria-label="Refresh run"><RefreshCw className="size-3.5" /></Button>
          <Button size="sm" variant="outline" className={OUTLINE} onClick={onClose} aria-label="Close run detail"><X className="size-3.5" /></Button>
        </div>
      </div>
      {loading && !data ? <Loader2 className="size-4 animate-spin text-slate-500" /> : error ? <p className="text-red-400">{error}</p> : run ? (
        <>
          <div className="space-y-0.5 text-slate-300">
            <p className="flex items-center gap-2"><StatusBadge status={run.status} /> <span className="text-slate-500">attempt {run.attempts}/{run.maxAttempts}</span></p>
            <p>{data?.rule?.name ?? run.ruleName ?? 'Deleted rule'} <span className="text-slate-500">v{run.ruleVersion} · {run.triggerType}</span></p>
            <p className="font-mono text-[11px] text-slate-500">correlation {run.correlationId}</p>
            <p className="text-slate-500">created {when(run.createdAt)} · finished {when(run.finishedAt)}{run.triggeredBy ? ` · by ${run.triggeredBy}` : ''}</p>
            {run.nextAttemptAt && <p className="text-amber-300">Next retry {when(run.nextAttemptAt)}</p>}
            {run.replayOfId && <p className="text-slate-500">Replay of {run.replayOfId}</p>}
            {run.error && <p className="rounded border border-red-500/30 bg-red-500/10 p-2 text-red-300">{run.error}</p>}
          </div>
          <section>
            <h3 className="mb-1 font-semibold uppercase tracking-wide text-slate-500">Steps</h3>
            {run.steps.length === 0 ? <p className="text-slate-500">No steps recorded yet.</p> : (
              <ol className="space-y-1.5">
                {run.steps.map((s, i) => (
                  <li key={i} className="rounded border border-slate-800 bg-slate-950/40 p-2">
                    <p className="flex items-center gap-2"><StatusBadge status={s.status} /> <span className="text-slate-200">{s.type}</span> <span className="text-slate-500">#{s.index + 1} · try {s.attempt} · {when(s.at)}</span></p>
                    <p className="mt-0.5 text-slate-400">{s.detail}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
          {data?.approval && (
            <section>
              <h3 className="mb-1 font-semibold uppercase tracking-wide text-slate-500">Approval</h3>
              <p className="text-slate-300"><StatusBadge status={data.approval.status} /> {data.approval.title}</p>
              {data.approval.decidedBy && <p className="text-slate-500">by {data.approval.decidedBy}{data.approval.decisionNote ? ` — ${data.approval.decisionNote}` : ''}</p>}
              {data.approval.status === 'PENDING' && <p className="text-slate-500">Decide it in Approvals; the run resumes only after a Super Admin approves the exact parameters.</p>}
            </section>
          )}
          {data && data.n8nExecutions.length > 0 && (
            <section>
              <h3 className="mb-1 font-semibold uppercase tracking-wide text-slate-500">n8n executions</h3>
              {data.n8nExecutions.map((x) => <p key={x.id} className="text-slate-300">{x.workflowCode} · <StatusBadge status={x.status} /> {x.error && <span className="text-red-300">{x.error}</span>}</p>)}
            </section>
          )}
          {data?.event && (
            <section>
              <h3 className="mb-1 font-semibold uppercase tracking-wide text-slate-500">Triggering event</h3>
              <p className="text-slate-300">{data.event.type} from {data.event.source} · {data.event.subjectType} {data.event.subjectId}</p>
              <pre className={`mt-1 max-h-40 overflow-auto rounded bg-slate-950/70 p-2 text-[11px] text-slate-400 ${SCROLL_THIN}`}>{JSON.stringify(data.event.payload, null, 2)}</pre>
            </section>
          )}
          {data && data.replays.length > 0 && (
            <section>
              <h3 className="mb-1 font-semibold uppercase tracking-wide text-slate-500">Replays</h3>
              {data.replays.map((r) => <button key={r.id} type="button" className="block text-left text-sky-300 underline" onClick={() => onReplayed(r.id)}>{when(r.createdAt)} · {r.status}{r.triggeredBy ? ` · ${r.triggeredBy}` : ''}</button>)}
            </section>
          )}
          <Button size="sm" variant="outline" className={OUTLINE} disabled={!finished || replaying} onClick={() => void replay()} title={finished ? 'Start a new run of the current rule version with this event' : 'Only finished runs can be replayed'}>
            {replaying ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Replay as a new run
          </Button>
        </>
      ) : null}
    </aside>
  )
}

export default function AutomationView({ role }: { role?: string | null }) {
  const [tab, setTab] = useState<'rules' | 'runs' | 'events'>('rules')
  const { data: catalog } = useApi<Catalog>('/api/admin/automation/catalog')
  const rulesApi = useApi<{ rules: Rule[] }>('/api/admin/automation/rules')
  const [editing, setEditing] = useState<Draft | null>(null)
  const [statusBusy, setStatusBusy] = useState<string | null>(null)
  const [runFilter, setRunFilter] = useState<string>('')
  const [runQuery, setRunQuery] = useState('')
  const [runRule, setRunRule] = useState<{ id: string; name: string } | null>(null)
  const runParams = new URLSearchParams()
  if (runFilter === 'DEAD_LETTER') runParams.set('deadLetter', '1')
  else if (runFilter) runParams.set('status', runFilter)
  if (runQuery.trim()) runParams.set('q', runQuery.trim())
  if (runRule) runParams.set('ruleId', runRule.id)
  const runsUrl = `/api/admin/automation/runs?${runParams.toString()}`
  const runsApi = useApi<{ runs: Run[]; counts: Record<string, number> }>(tab === 'runs' ? runsUrl : null)
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [eventStatus, setEventStatus] = useState('')
  const eventsApi = useApi<{ events: EventRow[] }>(tab === 'events' ? `/api/admin/automation/events${eventStatus ? `?status=${eventStatus}` : ''}` : null)
  const isSuperAdmin = role === 'SUPER_ADMIN'

  const setStatus = useCallback(async (rule: Rule, status: Rule['status']) => {
    setStatusBusy(rule.id)
    try {
      await fetchJson(`/api/admin/automation/rules/${encodeURIComponent(rule.id)}`, { method: 'PATCH', body: { status } })
      toast.success(`${rule.name} is now ${status}.`)
      rulesApi.refresh()
    } catch (err) {
      toast.error(errMsg(err, 'Status change failed.'))
    } finally {
      setStatusBusy(null)
    }
  }, [rulesApi])

  const counts = runsApi.data?.counts ?? {}
  const rules = rulesApi.data?.rules ?? []

  return (
    <div>
      <PageHeader
        title="Automation"
        description="Event-driven rules with versioning, approvals, retries, a dead-letter queue and replay. A run is marked succeeded only after every action has actually succeeded."
        actions={
          <Button variant="outline" size="sm" className={OUTLINE} onClick={() => { rulesApi.refresh(); runsApi.refresh(); eventsApi.refresh() }}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        }
      />
      <div role="tablist" aria-label="Automation sections" className="mb-4 flex w-fit gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
        {([['rules', 'Rules', ListChecks], ['runs', 'Runs', Activity], ['events', 'Events', Workflow]] as const).map(([id, label, Icon]) => (
          <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${tab === id ? 'bg-[#009FE3] text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === 'rules' && (
        <div className="space-y-4">
          {editing && catalog ? (
            <RuleEditor key={editing.id ?? 'new'} catalog={catalog} initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); rulesApi.refresh() }} />
          ) : (
            <Button size="sm" onClick={() => catalog && setEditing(emptyDraft(catalog.triggers[0]?.type ?? 'LEAD_CREATED'))} disabled={!catalog} className="font-semibold text-white" style={{ background: '#009FE3' }}>
              <Plus className="size-4" /> New rule
            </Button>
          )}
          {!isSuperAdmin && <p className="text-xs text-slate-500">You can draft and disable rules. Activation is a Super Admin decision.</p>}
          {rulesApi.error && <p role="alert" className="text-sm text-red-400">{rulesApi.error}</p>}
          {rulesApi.loading && rules.length === 0 ? <Loader2 className="size-5 animate-spin text-slate-500" /> : rules.length === 0 ? (
            <div className={CARD}><EmptyState icon={ListChecks} title="No automation rules yet" description="Create a rule: choose a trigger, add conditions and actions. New rules start as DRAFT." /></div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {rules.map((r) => (
                <article key={r.id} className={`${CARD} p-4`} aria-label={`Rule ${r.name}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">{r.name}</p>
                      <p className="font-mono text-[11px] text-slate-500">{r.key} · v{r.version} · {r.triggerType}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  {r.description && <p className="mt-1 text-xs text-slate-400">{r.description}</p>}
                  <p className="mt-2 text-xs text-slate-400">{r.conditions.length} condition{r.conditions.length === 1 ? '' : 's'} → {r.actions.map((a) => a.type).join(', ') || 'no actions'}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    {r.needsApproval && <span className="flex items-center gap-1 text-amber-300"><ShieldCheck className="size-3" /> approval per run</span>}
                    <span>last run: {r.lastRun ? `${r.lastRun.status} ${when(r.lastRun.createdAt)}` : 'never'}</span>
                    {(r.failedRuns ?? 0) > 0 && <span className="flex items-center gap-1 text-red-300"><AlertTriangle className="size-3" />{r.failedRuns} failed</span>}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className={OUTLINE} disabled={!catalog} onClick={() => setEditing({ id: r.id, key: r.key, name: r.name, description: r.description ?? '', triggerType: r.triggerType, conditions: r.conditions, actions: r.actions, requiresApproval: r.requiresApproval, maxAttempts: r.maxAttempts })}>Edit</Button>
                    {r.status !== 'ACTIVE' && isSuperAdmin && <Button size="sm" variant="outline" className={OUTLINE} disabled={statusBusy === r.id} onClick={() => void setStatus(r, 'ACTIVE')}>Activate</Button>}
                    {r.status === 'ACTIVE' && <Button size="sm" variant="outline" className={OUTLINE} disabled={statusBusy === r.id} onClick={() => void setStatus(r, 'DISABLED')}>Disable</Button>}
                    <Button size="sm" variant="outline" className={OUTLINE} onClick={() => { setTab('runs'); setRunRule({ id: r.id, name: r.name }); setSelectedRun(null) }}>View runs</Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'runs' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Filter runs by status" className={SELECT} value={runFilter} onChange={(e) => { setRunFilter(e.target.value); setSelectedRun(null) }}>
              {RUN_FILTERS.map((s) => <option key={s} value={s}>{s ? `${s.replace(/_/g, ' ')} (${counts[s] ?? 0})` : 'All statuses'}</option>)}
            </select>
            <input aria-label="Search runs" className={`${INPUT} w-72`} placeholder="Run id, event id or correlation id…" value={runQuery} onChange={(e) => setRunQuery(e.target.value)} />
            {runRule && (
              <span className="flex items-center gap-1 rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                Rule: {runRule.name}
                <button type="button" aria-label="Clear rule filter" onClick={() => setRunRule(null)}><X className="size-3" /></button>
              </span>
            )}
            {(counts.DEAD_LETTER ?? 0) > 0 && (
              <button type="button" onClick={() => setRunFilter('DEAD_LETTER')} className="flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs text-red-300">
                <AlertTriangle className="size-3" /> {counts.DEAD_LETTER} in dead-letter queue
              </button>
            )}
          </div>
          {runsApi.error && <p role="alert" className="text-sm text-red-400">{runsApi.error}</p>}
          <div className={`grid gap-3 ${selectedRun ? 'xl:grid-cols-[1fr,420px]' : ''}`}>
            <div className={`${CARD} overflow-x-auto`}>
              {runsApi.loading && !runsApi.data ? <div className="p-4"><Loader2 className="size-5 animate-spin text-slate-500" /></div> : (runsApi.data?.runs ?? []).length === 0 ? (
                <EmptyState icon={Activity} title="No runs" description="Runs appear when an event matches an active rule." />
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-500"><tr><th className="p-2">Status</th><th className="p-2">Rule</th><th className="p-2">Trigger</th><th className="p-2">Attempts</th><th className="p-2">Created</th><th className="p-2">Error</th></tr></thead>
                  <tbody>
                    {(runsApi.data?.runs ?? []).map((r) => (
                      <tr key={r.id} onClick={() => setSelectedRun(r.id)} className={`cursor-pointer border-t border-slate-800 hover:bg-slate-800/40 ${selectedRun === r.id ? 'bg-[#009FE3]/10' : ''}`}>
                        <td className="p-2"><StatusBadge status={r.status} /></td>
                        <td className="p-2 text-slate-200">{r.ruleName ?? r.ruleId} <span className="text-slate-500">v{r.ruleVersion}</span></td>
                        <td className="p-2 text-slate-400">{r.triggerType}</td>
                        <td className="p-2 text-slate-400">{r.attempts}/{r.maxAttempts}</td>
                        <td className="p-2 text-slate-400">{when(r.createdAt)}</td>
                        <td className="max-w-xs truncate p-2 text-red-300">{r.error ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {selectedRun && <RunDetailPanel key={selectedRun} runId={selectedRun} onClose={() => setSelectedRun(null)} onReplayed={(id) => { setSelectedRun(id); runsApi.refresh() }} />}
          </div>
        </div>
      )}

      {tab === 'events' && (
        <div className="space-y-3">
          <select aria-label="Filter events by status" className={SELECT} value={eventStatus} onChange={(e) => setEventStatus(e.target.value)}>
            <option value="">All events</option><option value="PENDING">Pending</option><option value="PROCESSED">Processed</option><option value="FAILED">Failed</option>
          </select>
          {eventsApi.error && <p role="alert" className="text-sm text-red-400">{eventsApi.error}</p>}
          <div className={`${CARD} overflow-x-auto`}>
            {(eventsApi.data?.events ?? []).length === 0 ? <EmptyState icon={Workflow} title="No events" description="Domain events (new leads, chat messages, payments, project changes…) are recorded here." /> : (
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500"><tr><th className="p-2">Status</th><th className="p-2">Type</th><th className="p-2">Source</th><th className="p-2">Subject</th><th className="p-2">Created</th><th className="p-2">Error</th></tr></thead>
                <tbody>
                  {(eventsApi.data?.events ?? []).map((e) => (
                    <tr key={e.id} className="border-t border-slate-800">
                      <td className="p-2"><StatusBadge status={e.status} /></td>
                      <td className="p-2 text-slate-200">{e.type}</td>
                      <td className="p-2 text-slate-400">{e.source}</td>
                      <td className="p-2 font-mono text-[11px] text-slate-400">{e.subjectType} {e.subjectId}</td>
                      <td className="p-2 text-slate-400">{when(e.createdAt)}</td>
                      <td className="max-w-xs truncate p-2 text-red-300">{e.error ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
