'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, PhoneCall, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { fetchJson, ApiError } from '@/lib/admin-client'
import { PageHeader, SectionCard } from './shared/cards'
import { ACCENT, INPUT, MONO } from './shared/styles'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Call centre — log every call, dial from the operator device, record the real
// outcome. Server-side calling is reported honestly from configuration.

interface CallRow {
  id: string; number: string; direction: string; channel: string; provider: string | null
  status: string; outcome: string | null; notes: string | null; durationSec: number
  startedAt: string; endedAt: string | null; dialUri: string
  client: { id: string; clientId: string; name: string } | null
}
interface State { provider: string; serverCalling: string; smsGateway: string; detail: string }

const CHANNELS = ['CLICK_TO_CALL', 'SIP', 'DEVICE_GATEWAY', 'MANUAL'] as const
const STATUSES = ['LOGGED', 'CONNECTED', 'COMPLETED', 'MISSED', 'FAILED'] as const
const OUTCOMES = ['INTERESTED', 'CALLBACK', 'NOT_INTERESTED', 'NO_ANSWER', 'WRONG_NUMBER', 'CLOSED_WON'] as const

export function TelephonyView() {
  const [calls, setCalls] = useState<CallRow[]>([])
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ number: '', channel: 'CLICK_TO_CALL' as (typeof CHANNELS)[number], notes: '' })
  const [draft, setDraft] = useState<Record<string, { status: string; outcome: string; durationSec: string }>>({})

  const load = useCallback(async () => {
    try {
      const data = await fetchJson<{ calls: CallRow[]; state: State }>('/api/admin/telephony/calls')
      setCalls(data.calls); setState(data.state)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load calls')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const log = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null)
    try {
      const res = await fetchJson<{ notice: string }>('/api/admin/telephony/calls', { method: 'POST', body: form })
      toast.message(res.notice)
      setForm({ ...form, number: '', notes: '' })
      await load()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not log the call'
      setError(msg); toast.error(msg)
    } finally { setBusy(false) }
  }

  const update = async (id: string) => {
    const d = draft[id] ?? { status: 'COMPLETED', outcome: 'INTERESTED', durationSec: '' }
    setBusyId(id)
    try {
      await fetchJson(`/api/admin/telephony/calls/${id}`, {
        method: 'PATCH',
        body: { status: d.status, outcome: d.outcome, ...(d.durationSec ? { durationSec: Number(d.durationSec) } : {}) },
      })
      toast.success('Call outcome recorded.')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed')
    } finally { setBusyId(null) }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Call & SMS centre"
        description="Click-to-call with a real call record, device SMS gateway (httpSMS-style) and call outcomes wired into the CRM. A call the server cannot place is logged and dialled from the operator device — it is never reported as a server-placed call."
      />

      {state ? (
        <SectionCard title="Provider state" description={state.detail}>
          <div className="grid gap-2 sm:grid-cols-3 text-xs">
            <div className="rounded-md border border-slate-800 p-2">Provider: <span className="font-semibold text-slate-200">{state.provider}</span></div>
            <div className={cn('rounded-md border p-2', state.serverCalling === 'AVAILABLE' ? 'border-emerald-600/40 text-emerald-400' : 'border-amber-600/40 text-amber-400')}>Server calling: {state.serverCalling}</div>
            <div className={cn('rounded-md border p-2', state.smsGateway === 'AVAILABLE' ? 'border-emerald-600/40 text-emerald-400' : 'border-amber-600/40 text-amber-400')}>SMS gateway: {state.smsGateway}</div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Log a call" description="The number is normalised to E.164 and a dial link is produced for the operator device.">
        <form onSubmit={log} className="grid gap-3 md:grid-cols-4">
          <label className="text-xs text-slate-400 md:col-span-1">Number
            <input required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} className={cn(INPUT, 'mt-1 w-full')} placeholder="+44 20 7946 0000" />
          </label>
          <label className="text-xs text-slate-400">Channel
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as (typeof CHANNELS)[number] })} className={cn(INPUT, 'mt-1 w-full')}>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">Notes
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={cn(INPUT, 'mt-1 w-full')} placeholder="Reason for the call" />
          </label>
          <div className="flex items-end">
            <Button type="submit" disabled={busy} style={{ backgroundColor: ACCENT }}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <PhoneCall className="mr-2 size-4" />}Log & dial
            </Button>
          </div>
        </form>
        {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
      </SectionCard>

      <SectionCard title="Call log" description={`${calls.length} call(s)`}
        actions={<Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-1 size-3.5" />Refresh</Button>}>
        {calls.length === 0 ? <p className="text-sm text-slate-500">No calls logged yet.</p> : (
          <ul className="divide-y divide-slate-800">
            {calls.map((c) => {
              const d = draft[c.id] ?? { status: 'COMPLETED', outcome: 'INTERESTED', durationSec: '' }
              const terminal = ['COMPLETED', 'MISSED', 'FAILED'].includes(c.status)
              return (
                <li key={c.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200">
                        <span className={cn(MONO)}>{c.number}</span> · {c.direction} · {c.channel}
                        {c.client ? <span className="text-slate-500"> · {c.client.clientId} {c.client.name}</span> : null}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(c.startedAt).toLocaleString()} · status <span className="text-slate-300">{c.status}</span>
                        {c.outcome ? ` · ${c.outcome}` : ''}{c.durationSec ? ` · ${c.durationSec}s` : ''}
                        {c.notes ? ` · ${c.notes}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <a href={c.dialUri} className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300">Dial</a>
                      {!terminal ? (
                        <>
                          <select
                            aria-label="Call status"
                            value={d.status}
                            onChange={(e) => setDraft({ ...draft, [c.id]: { ...d, status: e.target.value } })}
                            className={cn(INPUT, 'text-xs')}
                          >
                            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <select
                            aria-label="Call outcome"
                            value={d.outcome}
                            onChange={(e) => setDraft({ ...draft, [c.id]: { ...d, outcome: e.target.value } })}
                            className={cn(INPUT, 'text-xs')}
                          >
                            {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <input
                            aria-label="Duration in seconds"
                            value={d.durationSec}
                            onChange={(e) => setDraft({ ...draft, [c.id]: { ...d, durationSec: e.target.value.replace(/[^\d]/g, '') } })}
                            placeholder="secs"
                            className={cn(INPUT, 'w-16 text-xs')}
                          />
                          <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => void update(c.id)}>
                            {busyId === c.id ? <Loader2 className="size-3.5 animate-spin" /> : 'Save'}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
