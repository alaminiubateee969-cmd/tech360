'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, Dna, GitBranch, Loader2, Lock, Play, RefreshCw,
  RotateCcw, ShieldAlert, ShieldCheck, XCircle,
} from 'lucide-react'

import { ApiError, fetchJson, useApi } from '@/lib/admin-client'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { CARD, INPUT, MONO } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

// ============================================================
// EVOLUTION LOOP — the agent changes its own CONFIGURED BEHAVIOUR,
// under human approval, versioned and reversible.
//
// This console is deliberately explicit about what is NOT happening.
// The agent does not edit source code, does not run commands, and
// cannot touch a registered control. The immutable list is rendered
// on screen every time, because a self-modification surface that
// hides its own boundaries is the thing an operator most needs to
// be able to check.
// ============================================================

type Proposal = {
  id: string
  code: string
  generation: number
  surface: string
  targetKey: string
  title: string
  risk: string
  riskScore: number
  status: string
  approvalId: string | null
  proposedBy: string | null
  decidedBy: string | null
  appliedAt: string | null
  rolledBackAt: string | null
  validationCode: string | null
  failureReason: string | null
  createdAt: string
  effect: string
}

type Generation = {
  generation: number
  parentGeneration: number | null
  observations: number
  proposed: number
  applied: number
  rejected: number
  rolledBack: number
  surfaces: string[]
  summary: string
  startedAt: string
  closedAt: string | null
}

type State = {
  generation: { current: number; hasEvolved: boolean; lineage: Generation[] }
  heuristics: { value: Record<string, unknown>; tuned: boolean; storageKey: string }
  pendingObservations: Array<{ kind: string; detail: string; subject: string | null; ref: string; count: number; lastAt: string }>
  proposals: Proposal[]
  contract: string[]
  loop: Array<{ step: string; what: string; autonomous: boolean }>
  surfaces: Array<{ surface: string; label: string; what: string; storage: string; maxRisk: string; requiresSuperAdmin: boolean; editableFields: Record<string, { type: string; note: string }>; protectedFields: string[] }>
  immutableControls: Array<{ id: string; label: string; why: string; path: string }>
  unsupportedMutations: Array<{ id: string; request: string; refusal: string }>
}

const RISK_STYLE: Record<string, string> = {
  LOW: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  MEDIUM: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  HIGH: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  CRITICAL: 'border-red-500/40 bg-red-500/10 text-red-300',
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'text-sky-300',
  APPROVED: 'text-emerald-300',
  APPLIED: 'text-emerald-200',
  REJECTED: 'text-slate-400',
  FAILED: 'text-red-300',
  ROLLED_BACK: 'text-amber-300',
}

function RiskBadge({ risk }: { risk: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${RISK_STYLE[risk] ?? RISK_STYLE.LOW}`}>
      {risk}
    </span>
  )
}

export function EvolutionView() {
  const state = useApi<State>('/api/admin/evolution')
  const [running, setRunning] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [request, setRequest] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<{
    proposal: { rationale: string; rollbackNote: string; patch: { ops: Array<{ op: string; path: string; value?: unknown; delta?: number }> } ; evidence: Array<{ kind: string; detail: string; ref: string }>; riskReasons: string[] }
    preview: { ok: boolean; label?: string; before?: Record<string, unknown>; after?: Record<string, unknown>; reason?: string }
  } | null>(null)

  const data = state.data
  const proposals = data?.proposals ?? []
  const pending = proposals.filter((p) => p.status === 'PENDING')
  const applied = proposals.filter((p) => p.status === 'APPLIED')

  const runCycle = useCallback(async () => {
    setRunning(true)
    try {
      if (dryRun) {
        const result = await fetchJson<{ proposals: Array<{ title: string; surface: string; risk: string; rationale: string; ops: unknown[] }>; declined: Array<{ observation: string; reason: string }>; refused: Array<{ observation: string; reason: string }> }>('/api/admin/evolution', {
          method: 'POST',
          body: { dryRun: true, ...(request.trim() ? { request: request.trim() } : {}) },
        })
        toast.info(`Dry run: ${result.proposals.length} would be proposed, ${result.declined.length} declined, ${result.refused.length} refused. Nothing persisted.`)
      } else {
        const result = await fetchJson<{ proposals: Array<{ code: string; risk: string }>; refused?: boolean; error?: string; reason?: string; appliedChanges: number }>('/api/admin/evolution', {
          method: 'POST',
          body: { ...(request.trim() ? { request: request.trim() } : {}) },
        })
        if (result.refused) toast.error(result.error ?? 'Refused.')
        else if (result.reason) toast.info(result.reason)
        else toast.success(`${result.proposals.length} proposal(s) opened for approval. Nothing has changed.`)
      }
      state.refresh()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'The cycle failed.')
    } finally {
      setRunning(false)
    }
  }, [dryRun, request, state])

  const decide = useCallback(async (proposal: Proposal, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const result = await fetchJson<{ nextStep?: string; error?: string }>(`/api/admin/evolution/proposals/${proposal.id}`, {
        method: 'POST',
        body: { decision, note: `${decision} from the Evolution console.` },
      })
      toast.success(result.nextStep ?? decision)
      state.refresh()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : `Could not record ${decision}.`)
    }
  }, [state])

  const apply = useCallback(async (proposal: Proposal) => {
    try {
      const result = await fetchJson<{ applied: boolean; error?: string; note?: string; before?: unknown; after?: unknown }>(`/api/admin/evolution/proposals/${proposal.id}/apply`, { method: 'POST', body: {} })
      if (result.applied) toast.success(`Applied and verified. ${result.note ?? ''}`)
      else toast.error(result.error ?? 'Apply refused.')
      state.refresh()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Apply refused.')
      state.refresh()
    }
  }, [state])

  const rollback = useCallback(async (proposal: Proposal) => {
    if (!window.confirm(`Roll back ${proposal.code}? The stored before-snapshot will be written back and verified.`)) return
    try {
      const result = await fetchJson<{ rolledBack: boolean; error?: string; note?: string }>(`/api/admin/evolution/proposals/${proposal.id}/rollback`, { method: 'POST', body: { note: 'Rolled back from the Evolution console.' } })
      if (result.rolledBack) toast.success(`Rolled back and verified. ${result.note ?? ''}`)
      else toast.error(result.error ?? 'Rollback refused.')
      state.refresh()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Rollback refused.')
      state.refresh()
    }
  }, [state])

  const openDetail = useCallback(async (proposal: Proposal) => {
    setExpanded(proposal.id)
    try {
      const result = await fetchJson<NonNullable<typeof detail>>(`/api/admin/evolution/proposals/${proposal.id}`)
      setDetail(result)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not load the proposal.')
      setDetail(null)
    }
  }, [])

  const currentGeneration = data?.generation.current ?? 0
  const hasEvolved = data?.generation.hasEvolved ?? false

  const lineage = useMemo(() => data?.generation.lineage ?? [], [data])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Evolution Loop"
        description="The agent proposes changes to its own configured behaviour — prompts, skill configuration, REA heuristics, runtime parameters and playbooks. Nothing changes until a different human approves it and a Super Admin applies it."
        actions={<Button variant="outline" size="sm" onClick={() => state.refresh()} disabled={state.loading}><RefreshCw className={`mr-1.5 size-3.5 ${state.loading ? 'animate-spin' : ''}`} /> Refresh</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Generation" value={currentGeneration} icon={Dna} tone="accent" sub={hasEvolved ? 'Behaviour has actually changed at least once' : 'No applied change yet — the agent has not evolved'} />
        <KpiCard label="Pending proposals" value={pending.length} icon={AlertTriangle} tone="amber" sub="Awaiting a human decision" />
        <KpiCard label="Applied" value={applied.length} icon={CheckCircle2} tone="green" sub="Written, verified, and reversible" />
        <KpiCard label="Observations" value={data?.pendingObservations.length ?? 0} icon={GitBranch} tone="slate" sub="Unconsumed evidence for the next cycle" />
        <KpiCard label="Immutable controls" value={data?.immutableControls.length ?? 0} icon={Lock} tone="red" sub="Never evolvable, not even with approval" />
      </div>

      {/* ---------------- run a cycle ---------------- */}
      <SectionCard
        title="Run one cycle: observe → propose → gate"
        description="Opening a generation writes proposals and approval requests. It changes no behaviour. Applying is a separate, gated step."
      >
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor="evo-request" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Optional instruction (screened before anything else)</label>
            <Input id="evo-request" className={INPUT} value={request} onChange={(e) => setRequest(e.target.value)} placeholder="e.g. tighten fingerprint reporting after the last false positive" />
            <p className="mt-1 text-[11px] text-slate-500">Ask it to edit source code or relax a guard and the refusal is the response — recorded, not silently ignored.</p>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={() => { setDryRun(true) }} disabled={running} className={dryRun ? 'border-[#009FE3]/60 text-[#009FE3]' : undefined}>Dry run</Button>
            <Button onClick={runCycle} disabled={running}>
              {running ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Play className="mr-1.5 size-3.5" />}
              {dryRun ? 'Preview proposals' : 'Open a generation'}
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {(data?.pendingObservations ?? []).slice(0, 8).map((o, i) => (
            <div key={`${o.kind}-${i}`} className="rounded-md border border-slate-800 bg-slate-950/40 p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{o.kind}{o.count > 1 ? ` × ${o.count}` : ''}</p>
              <p className="mt-1 text-xs text-slate-300">{o.detail}</p>
              <p className={MONO}>{o.subject ?? '—'} · {o.ref}</p>
            </div>
          ))}
          {(data?.pendingObservations ?? []).length === 0 ? (
            <p className="text-xs text-slate-500 md:col-span-2">
              No pending observations. The loop does not invent changes when nothing has been observed — that would be drift, not
              evolution. Record a correction from the Reverse Engineer console to produce one.
            </p>
          ) : null}
        </div>
      </SectionCard>

      {/* ---------------- proposals ---------------- */}
      <SectionCard title={`Proposals (${proposals.length})`} description="Highest risk first. Deciding a proposal changes nothing by itself.">
        {proposals.length === 0 ? (
          <EmptyState icon={Dna} title="No proposals yet" description="Run a cycle once there is an observation to act on." />
        ) : (
          <ul className="space-y-2">
            {proposals.map((p) => (
              <li key={p.id} className={CARD}>
                <div className="flex flex-wrap items-start gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={MONO}>{p.code}</span>
                      <RiskBadge risk={p.risk} />
                      <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">{p.surface}</span>
                      <span className={`text-[11px] font-semibold ${STATUS_STYLE[p.status] ?? 'text-slate-400'}`}>{p.status}</span>
                      <span className="text-[10px] text-slate-600">gen {p.generation}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-200">{p.title}</p>
                    <p className={MONO}>{p.targetKey} · risk score {p.riskScore} · proposed by {p.proposedBy ?? '—'}</p>
                    {p.status === 'APPROVED' ? <p className="mt-1 text-[11px] text-emerald-300/80">Approved but NOT applied. The value is unchanged until a Super Admin applies it.</p> : null}
                    {p.failureReason ? <p className="mt-1 text-[11px] text-red-300">{p.validationCode}: {p.failureReason}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => (expanded === p.id ? setExpanded(null) : openDetail(p))}>
                      {expanded === p.id ? 'Hide' : 'Inspect'}
                    </Button>
                    {p.status === 'PENDING' ? (
                      <>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-emerald-300" onClick={() => decide(p, 'APPROVED')}><CheckCircle2 className="mr-1 size-3.5" /> Approve</Button>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-slate-400" onClick={() => decide(p, 'REJECTED')}><XCircle className="mr-1 size-3.5" /> Reject</Button>
                      </>
                    ) : null}
                    {p.status === 'APPROVED' ? (
                      <Button size="sm" className="h-7 px-2 text-xs" onClick={() => apply(p)}><Play className="mr-1 size-3.5" /> Apply</Button>
                    ) : null}
                    {p.status === 'APPLIED' ? (
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-amber-300" onClick={() => rollback(p)}><RotateCcw className="mr-1 size-3.5" /> Roll back</Button>
                    ) : null}
                  </div>
                </div>

                {expanded === p.id && detail ? (
                  <div className="space-y-3 border-t border-slate-800 p-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Rationale</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-300">{detail.proposal.rationale}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Why this risk level (computed, never self-declared)</p>
                      <ul className="mt-1 space-y-0.5">{detail.proposal.riskReasons.map((r, i) => <li key={i} className="text-xs text-slate-400">• {r}</li>)}</ul>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Operations</p>
                      <ul className="mt-1 space-y-0.5">
                        {detail.proposal.patch.ops.map((op, i) => (
                          <li key={i} className={MONO}>{op.op} {op.path}{op.value !== undefined ? ` = ${JSON.stringify(op.value).slice(0, 120)}` : ''}{op.delta !== undefined ? ` ${op.delta >= 0 ? '+' : ''}${op.delta}` : ''}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Evidence that motivated it</p>
                      <ul className="mt-1 space-y-1">
                        {detail.proposal.evidence.map((e, i) => (
                          <li key={i} className="text-xs text-slate-400"><span className={MONO}>{e.kind}</span> {e.detail} <span className="text-slate-600">({e.ref})</span></li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Live preview {detail.preview.label ? `— ${detail.preview.label}` : ''}</p>
                      {detail.preview.ok ? (
                        <div className="mt-1 grid gap-2 md:grid-cols-2">
                          <pre className="max-h-48 overflow-auto rounded border border-slate-800 bg-slate-950/70 p-2 text-[11px] text-slate-400">{JSON.stringify(detail.preview.before, null, 2)}</pre>
                          <pre className="max-h-48 overflow-auto rounded border border-emerald-500/25 bg-emerald-500/5 p-2 text-[11px] text-emerald-200/90">{JSON.stringify(detail.preview.after, null, 2)}</pre>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-amber-300">Preview unavailable: {detail.preview.reason}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">How to undo it</p>
                      <p className="mt-1 text-xs text-slate-400">{detail.proposal.rollbackNote}</p>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* ---------------- lineage ---------------- */}
      <SectionCard title="Lineage" description="A generation only counts as evolution once something was applied. Proposing alone changes nothing.">
        {lineage.length === 0 ? (
          <EmptyState icon={GitBranch} title="No generations yet" description="Open the first cycle once there is evidence to act on." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                <tr><th className="pb-2 pr-3">Gen</th><th className="pb-2 pr-3">Parent</th><th className="pb-2 pr-3">Obs</th><th className="pb-2 pr-3">Proposed</th><th className="pb-2 pr-3">Applied</th><th className="pb-2 pr-3">Rejected</th><th className="pb-2 pr-3">Rolled back</th><th className="pb-2">Summary</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {lineage.map((l) => (
                  <tr key={l.generation}>
                    <td className="py-2 pr-3 tabular-nums text-slate-200">{l.generation}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-500">{l.parentGeneration ?? '—'}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-400">{l.observations}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-400">{l.proposed}</td>
                    <td className="py-2 pr-3 tabular-nums text-emerald-300">{l.applied}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-400">{l.rejected}</td>
                    <td className="py-2 pr-3 tabular-nums text-amber-300">{l.rolledBack}</td>
                    <td className="py-2 text-slate-400">{l.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ---------------- the boundary ---------------- */}
      <SectionCard title="What the agent may edit" description="An explicit allowlist of surfaces and, within each, of fields.">
        <div className="grid gap-3 lg:grid-cols-2">
          {(data?.surfaces ?? []).map((s) => (
            <div key={s.surface} className={CARD}>
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
                <p className="text-sm font-semibold text-slate-200">{s.label}</p>
                <div className="flex items-center gap-1.5">
                  <RiskBadge risk={s.maxRisk} />
                  {s.requiresSuperAdmin ? <span className="rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">SUPER_ADMIN</span> : null}
                </div>
              </div>
              <div className="space-y-2 p-3">
                <p className="text-xs text-slate-400">{s.what}</p>
                <p className={MONO}>{s.storage}</p>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/80">Editable fields</p>
                  <ul className="mt-1 space-y-0.5">
                    {Object.entries(s.editableFields).map(([field, spec]) => (
                      <li key={field} className="text-xs text-slate-300"><span className={MONO}>{field}</span> <span className="text-slate-500">({spec.type})</span> — {spec.note}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-red-400/80">Never writable through this surface</p>
                  <p className={`mt-0.5 ${MONO}`}>{s.protectedFields.join(', ')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Immutable controls" description="The loop may never propose a change to any of these — not with approval, not with a Super Admin signature. Changing one means a human editing source and shipping it through review.">
        <ul className="grid gap-2 lg:grid-cols-2">
          {(data?.immutableControls ?? []).map((c) => (
            <li key={c.id} className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/5 p-2.5">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-red-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-200">{c.label}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{c.why}</p>
                <p className={MONO}>{c.path}</p>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Refused by design" description="Requests the loop does not honour at all, in the words it answers with.">
        <ul className="space-y-2">
          {(data?.unsupportedMutations ?? []).map((u) => (
            <li key={u.id} className="flex items-start gap-2 text-xs">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-400" aria-hidden="true" />
              <span className="min-w-0 text-slate-400"><span className="font-semibold text-slate-300">{u.request}</span> — {u.refusal}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="The contract" description="Rendered on every load so the boundary is checkable, not merely documented.">
        <ol className="space-y-1.5">
          {(data?.contract ?? []).map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-400" aria-hidden="true" /> {line}
            </li>
          ))}
        </ol>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {(data?.loop ?? []).map((step) => (
            <div key={step.step} className="rounded-md border border-slate-800 bg-slate-950/40 p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{step.step}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{step.what}</p>
              <p className={`mt-1 text-[10px] font-semibold ${step.autonomous ? 'text-sky-400' : 'text-emerald-400'}`}>
                {step.autonomous ? 'AUTONOMOUS' : 'HUMAN REQUIRED'}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

export default EvolutionView
