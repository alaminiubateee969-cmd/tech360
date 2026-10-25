'use client'

import { useApi } from '@/lib/admin-client'
import { Button } from '@/components/ui/button'

type Status = {
  checkedAt: string
  worker: { state: string; heartbeatAt: string | null; ageSeconds: number | null }
  stages: Array<{ stage: string; label: string; count: number }>
  approvals: Array<{ type: string; count: number }>
  jobs: Array<{ status: string; count: number }>
  outbound: Array<{ status: string; count: number }>
  agents: Array<{ status: string; count: number }>
  channels: Record<string, boolean>
}
export function PipelineStatusPanel() {
  const { data, loading, error, refresh } = useApi<Status>('/api/admin/pipeline-status')
  return (
    <details className="mb-3 shrink-0 rounded-xl border border-slate-800 bg-slate-900/60 text-sm text-slate-300">
      <summary className="cursor-pointer p-4 font-semibold">First message → final delivery · live pipeline</summary>
      <div className="max-h-[60vh] space-y-4 overflow-auto p-4 pt-0">
        <p className="text-sky-300">HTML Preview Before Payment. Source Code After Full Payment.</p>
        <p>Agents handle permitted work through the existing journey engine and durable queue. Final scope, payment instructions, invoices, legal/dispute responses and file release require approval. A client message or uploaded payment proof is not verified payment.</p>
        <Button onClick={refresh} variant="outline" disabled={loading}>Refresh evidence</Button>
        {loading && <p role="status">Loading live CRM evidence…</p>}
        {error && <p role="alert" className="text-red-400">{error}</p>}
        {data && <>
          <p>Worker heartbeat: <strong>{data.worker.state}</strong> · {data.worker.heartbeatAt ?? 'No heartbeat recorded'}</p>
          <p className="text-xs text-slate-400">Checked {data.checkedAt}. Heartbeat activity is not proof that every stage or integration is working. Counts are current CRM totals, not completed tests.</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{data.stages.map((s) => <div key={s.stage} className="rounded border border-slate-800 p-2"><strong>{s.count}</strong><p className="text-xs">{s.label}</p></div>)}</div>
          <h3 className="font-semibold">Awaiting human approval</h3>
          {data.approvals.length ? <ul>{data.approvals.map((a) => <li key={a.type}>{a.type}: {a.count}</li>)}</ul> : <p>No pending approvals recorded.</p>}
          <div className="grid gap-4 md:grid-cols-3">{[['Agents', data.agents], ['Durable jobs', data.jobs], ['Outbound messages', data.outbound]].map(([title, rows]) => <section key={String(title)}><h3 className="font-semibold">{String(title)}</h3>{(rows as Status['jobs']).map((r) => <p key={r.status}>{r.status}: {r.count}</p>)}</section>)}</div>
          <h3 className="font-semibold">Channel configuration (not connectivity verification)</h3>
          <ul>{Object.entries(data.channels).map(([channel, configured]) => <li key={channel}>{channel}: {configured ? 'Configuration present' : 'Not configured'}</li>)}</ul>
          <p className="text-xs text-slate-400">Social intake uses authenticated relays. Native social outbound delivery is not implied by a token being present. Open Core Agents to inspect or queue an agent job; use Approvals for gated actions and client profiles for message, scope, payment and delivery history.</p>
        </>}
      </div>
    </details>
  )
}
