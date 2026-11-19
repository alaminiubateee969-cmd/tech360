'use client'

import { useState } from 'react'
import { Download, Loader2, PlayCircle, PlugZap, RefreshCw, Workflow as WorkflowIcon, Zap } from 'lucide-react'
import { toast } from 'sonner'

import { ApiError, fetchJson, fmtDate, prettify, useApi, type N8nResponse } from '@/lib/admin-client'
import { EmptyState, PageHeader, SectionCard } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { CARD, INPUT, SCROLL_THIN } from './shared/styles'
import { Button } from '@/components/ui/button'

// ============================================================
// TECH360 — n8n control plane. TECH360 owns the workflow registry,
// correlation ids, execution log and callbacks; n8n executes.
// "Connected" is shown only after a stored, successful live test.
// Secrets never reach the browser: only variable NAMES and n8n
// credential NAMES are displayed or stored.
// ============================================================

type N8nStatus = {
  state: 'NOT_CONFIGURED' | 'CONFIGURED_UNTESTED' | 'CONNECTED' | 'CONNECTION_FAILED'
  configured: boolean
  host: string | null
  expectedVersion: string
  missing: string[]
  callbackUrl: string
  lastTest: { ok: boolean; testedAt: string; detail: string; httpStatus?: number | null } | null
  featureEnabled: boolean
}
type RegistryRow = {
  id: string; code: string; name: string; category: string | null; trigger: string | null; status: string
  enabled: boolean; webhookPath: string | null; credentialRefs: string[]; timeoutMs: number; lastRunAt: string | null; lastRunStatus: string | null
}
type ExecutionRow = {
  id: string; workflowCode: string; correlationId: string; status: string; attempts: number; httpStatus: number | null
  error: string | null; automationRunId: string | null; requestedBy: string | null; callbackReceivedAt: string | null; finishedAt: string | null; createdAt: string
}
type StatusResponse = { status: N8nStatus; workflows: RegistryRow[]; executions: ExecutionRow[]; executionCounts: Record<string, number> }

const OUTLINE = 'border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'

function errText(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    const issues = (err.data as { issues?: string[] } | null)?.issues
    return issues?.length ? `${err.message} ${issues.join(' ')}` : err.message
  }
  return err instanceof Error ? err.message : fallback
}

function RegistryEditor({ row, onSaved }: { row: RegistryRow; onSaved: () => void }) {
  const [webhookPath, setWebhookPath] = useState(row.webhookPath ?? '')
  const [timeoutMs, setTimeoutMs] = useState(row.timeoutMs)
  const [refs, setRefs] = useState(row.credentialRefs.join(', '))
  const [saving, setSaving] = useState(false)
  const save = async (patch: Record<string, unknown>) => {
    setSaving(true)
    try {
      await fetchJson(`/api/admin/n8n/workflows/${encodeURIComponent(row.code)}`, { method: 'PATCH', body: patch })
      toast.success(`${row.name} updated.`)
      onSaved()
    } catch (err) {
      toast.error(errText(err, 'Update failed.'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="space-y-2 text-xs">
      <label className="block space-y-1 text-slate-400">Webhook path (relative to N8N_BASE_URL/webhook/)
        <input className={INPUT} value={webhookPath} onChange={(e) => setWebhookPath(e.target.value)} placeholder="tech360/lead-intake" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1 text-slate-400">Timeout (ms)
          <input type="number" min={1000} max={60000} step={500} className={INPUT} value={timeoutMs} onChange={(e) => setTimeoutMs(Number(e.target.value))} />
        </label>
        <label className="block space-y-1 text-slate-400">n8n credential names
          <input className={INPUT} value={refs} onChange={(e) => setRefs(e.target.value)} placeholder="TECH360 SMTP, CRM API" />
        </label>
      </div>
      <p className="text-[11px] text-slate-600">Credential NAMES as defined inside n8n — never paste secret values.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className={OUTLINE} disabled={saving} onClick={() => void save({ webhookPath, timeoutMs, credentialRefs: refs.split(',').map((r) => r.trim()).filter(Boolean) })}>
          {saving && <Loader2 className="size-3.5 animate-spin" />} Save
        </Button>
        <Button size="sm" variant="outline" className={OUTLINE} disabled={saving} onClick={() => void save({ enabled: !row.enabled })}>
          {row.enabled ? 'Disable' : 'Enable'}
        </Button>
      </div>
    </div>
  )
}

export function N8nView() {
  const statusApi = useApi<StatusResponse>('/api/admin/n8n/status')
  const blueprints = useApi<N8nResponse>('/api/admin/n8n')
  const [testing, setTesting] = useState(false)
  const [executeFor, setExecuteFor] = useState<string | null>(null)
  const [payloadText, setPayloadText] = useState('{\n  "note": "manual test"\n}')
  const [executing, setExecuting] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const status = statusApi.data?.status
  const registry = statusApi.data?.workflows ?? []
  const executions = statusApi.data?.executions ?? []
  const blueprintRows = blueprints.data?.workflows ?? []

  const runTest = async () => {
    setTesting(true)
    try {
      const res = await fetchJson<{ ok: boolean; result: { detail: string } }>('/api/admin/n8n/test', { method: 'POST', body: {} })
      if (res.ok) toast.success(`n8n reachable — ${res.result.detail}`)
      else toast.error(`Connection test failed — ${res.result.detail}`)
      statusApi.refresh()
    } catch (err) {
      toast.error(errText(err, 'Connection test failed.'))
    } finally {
      setTesting(false)
    }
  }

  const execute = async (code: string) => {
    let payload: unknown
    try {
      payload = JSON.parse(payloadText || '{}')
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('not an object')
    } catch {
      toast.error('Payload must be a JSON object.')
      return
    }
    setExecuting(true)
    try {
      const res = await fetchJson<{ message: string }>('/api/admin/n8n/execute', { method: 'POST', body: { workflowCode: code, payload } })
      toast.success(res.message)
      setExecuteFor(null)
    } catch (err) {
      toast.error(errText(err, 'Execution request failed.'))
    } finally {
      setExecuting(false)
      statusApi.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="n8n Workflows"
        description="TECH360 is the control plane: registry, correlation ids, execution log and signed callbacks. n8n executes. Secrets stay on the server."
        actions={
          <Button variant="outline" size="sm" onClick={() => { statusApi.refresh(); blueprints.refresh() }} disabled={statusApi.loading} className={OUTLINE} aria-label="Refresh n8n status">
            <RefreshCw className={statusApi.loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
          </Button>
        }
      />
      {statusApi.error && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">Could not load n8n status: {statusApi.error}</div>}

      <SectionCard
        title="Connection"
        description={status ? `${status.host ?? 'No host configured'} · expected n8n ${status.expectedVersion}` : 'Loading…'}
        actions={
          <Button size="sm" variant="outline" className={OUTLINE} disabled={testing || !status?.configured} onClick={() => void runTest()} title={status?.configured ? 'Run a live request against the n8n health endpoint' : 'Configure n8n on the server first'}>
            {testing ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />} Test connection
          </Button>
        }
      >
        {status ? (
          <div className="space-y-2 text-xs text-slate-400">
            <p className="flex flex-wrap items-center gap-2">
              <StatusBadge status={status.state} />
              {!status.featureEnabled && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">Executions switched off in Settings → features (n8n)</span>}
            </p>
            {status.state === 'NOT_CONFIGURED' && (
              <p>NOT CONFIGURED — set these server environment variables: <span className="font-mono text-slate-300">{status.missing.join(', ')}</span>. Executions are refused until then.</p>
            )}
            {status.state === 'CONFIGURED_UNTESTED' && <p>Credentials are present but no live test has been run, so the connection is not reported as working.</p>}
            {status.lastTest && <p>Last test {fmtDate(status.lastTest.testedAt)}: {status.lastTest.ok ? 'reachable' : 'failed'} — {status.lastTest.detail}</p>}
            <p>Callback URL for n8n (signed with N8N_CALLBACK_SECRET, HMAC-SHA256 over <span className="font-mono">timestamp.body</span>): <span className="font-mono text-slate-300">{status.callbackUrl}</span></p>
          </div>
        ) : <Loader2 className="size-4 animate-spin text-slate-500" />}
      </SectionCard>

      <SectionCard title="Workflow registry" description="Only registered and enabled workflows can be executed. Each execution gets a correlation id and waits for a signed callback.">
        {registry.length === 0 ? (
          <EmptyState icon={WorkflowIcon} title="Registry is empty" description="Workflow blueprints are registered when seeded; none exist for this workspace yet." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {registry.map((w) => (
              <article key={w.id} className={`${CARD} space-y-2 p-3`} aria-label={`Workflow ${w.name}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{w.name}</p>
                    <p className="font-mono text-[11px] text-slate-500">{w.code}{w.webhookPath ? ` → /webhook/${w.webhookPath}` : ' · no webhook path'}</p>
                  </div>
                  <StatusBadge status={w.enabled ? 'ENABLED' : 'DISABLED'} />
                </div>
                <p className="text-[11px] text-slate-500">
                  {w.credentialRefs.length ? `Credentials: ${w.credentialRefs.join(', ')}` : 'No credential references'} · timeout {Math.round(w.timeoutMs / 1000)}s ·{' '}
                  {w.lastRunAt ? `last run ${fmtDate(w.lastRunAt)}${w.lastRunStatus ? ` (${prettify(w.lastRunStatus)})` : ''}` : 'never run'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className={OUTLINE} onClick={() => setEditing(editing === w.code ? null : w.code)}>{editing === w.code ? 'Close settings' : 'Settings'}</Button>
                  <Button size="sm" variant="outline" className={OUTLINE} disabled={!w.enabled || !status?.featureEnabled} onClick={() => setExecuteFor(executeFor === w.code ? null : w.code)} title={!w.enabled ? 'Enable the workflow first' : !status?.featureEnabled ? 'n8n executions are switched off' : 'Request an execution'}>
                    <PlayCircle className="size-3.5" /> Execute
                  </Button>
                </div>
                {editing === w.code && <RegistryEditor row={w} onSaved={() => { setEditing(null); statusApi.refresh() }} />}
                {executeFor === w.code && (
                  <div className="space-y-2">
                    <label className="block space-y-1 text-xs text-slate-400">Payload (JSON object, 20 KB max; sensitive data is redacted)
                      <textarea rows={5} className={`${INPUT} h-auto py-2 font-mono text-xs`} value={payloadText} onChange={(e) => setPayloadText(e.target.value)} />
                    </label>
                    <Button size="sm" disabled={executing} onClick={() => void execute(w.code)} className="font-semibold text-white" style={{ background: '#009FE3' }}>
                      {executing && <Loader2 className="size-3.5 animate-spin" />} Request execution
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Execution log" description={Object.entries(statusApi.data?.executionCounts ?? {}).map(([k, v]) => `${prettify(k)} ${v}`).join(' · ') || 'No executions yet'}>
        {executions.length === 0 ? <p className="text-xs text-slate-500">No executions recorded.</p> : (
          <div className={`overflow-x-auto ${SCROLL_THIN}`}>
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500"><tr><th className="p-2">Status</th><th className="p-2">Workflow</th><th className="p-2">Correlation</th><th className="p-2">Attempts</th><th className="p-2">Requested</th><th className="p-2">Callback</th><th className="p-2">Error</th></tr></thead>
              <tbody>
                {executions.map((x) => (
                  <tr key={x.id} className="border-t border-slate-800">
                    <td className="p-2"><StatusBadge status={x.status} /></td>
                    <td className="p-2 text-slate-200">{x.workflowCode}{x.automationRunId ? <span className="text-slate-500"> · automation</span> : null}</td>
                    <td className="p-2 font-mono text-[11px] text-slate-500">{x.correlationId}</td>
                    <td className="p-2 text-slate-400">{x.attempts}{x.httpStatus ? ` · HTTP ${x.httpStatus}` : ''}</td>
                    <td className="p-2 text-slate-400">{fmtDate(x.createdAt)}{x.requestedBy ? ` · ${x.requestedBy}` : ''}</td>
                    <td className="p-2 text-slate-400">{x.callbackReceivedAt ? fmtDate(x.callbackReceivedAt) : '—'}</td>
                    <td className="max-w-xs truncate p-2 text-red-300">{x.error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Importable blueprints" description="Download a JSON definition and import it into n8n. Definitions contain no secrets.">
        {blueprints.error ? <p className="text-xs text-red-400">{blueprints.error}</p> : blueprintRows.length === 0 ? (
          <p className="text-xs text-slate-500">No blueprints registered.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {blueprintRows.map((w) => (
              <div key={w.code} className={`${CARD} flex items-start justify-between gap-2 p-3`}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-200">{w.name}</p>
                  <p className="font-mono text-[11px] text-slate-600">{w.code}</p>
                  {w.trigger && <p className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase text-[#009FE3]"><Zap className="size-3" />{prettify(w.trigger)}</p>}
                </div>
                <a href={`/api/admin/n8n/${encodeURIComponent(w.code)}/download`} download={`${w.code}.json`} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-700 px-2.5 text-xs text-slate-300 hover:border-[#009FE3]/50 hover:text-[#009FE3]" aria-label={`Download ${w.name} workflow JSON`}>
                  <Download className="size-3.5" /> JSON
                </a>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
