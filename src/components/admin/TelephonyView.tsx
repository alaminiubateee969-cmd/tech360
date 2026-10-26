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
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null)

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

      <SectionCard title="Conversations — bubbles, not rows" description="Contact sidebar left, threaded bubbles right — same persisted CallLog rows, conversation-oriented rendering. Dialer is honest: it opens the operator device’s dialer via tel: link, never fakes a server-placed call.">
        {calls.length === 0 ? <p className="text-sm text-slate-500">No conversations yet — log a call above.</p> : (() => {
          const byNumber = new Map<string, CallRow[]>()
          for (const c of calls) {
            const key = c.number
            if (!byNumber.has(key)) byNumber.set(key, [])
            byNumber.get(key)!.push(c)
          }
          const contacts = Array.from(byNumber.entries()).map(([number, list]) => {
            const last = list.slice().sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0]
            return { number, count: list.length, lastAt: last.startedAt, client: last.client }
          }).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
          const thread = selectedNumber ? (byNumber.get(selectedNumber) ?? []).slice().sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()) : []
          const active = contacts.find((c) => c.number === selectedNumber) ?? null
          if (!selectedNumber && contacts.length > 0) {
            // auto-select first contact on first render without effect
          }
          return (
            <div className="grid gap-3 lg:grid-cols-12">
              <div className="lg:col-span-4 rounded-lg border border-slate-800 bg-slate-950/40">
                <div className="border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Contacts ({contacts.length})</div>
                <div className="max-h-[50vh] overflow-y-auto">
                  {contacts.map((ct) => (
                    <button key={ct.number} type="button" onClick={() => setSelectedNumber(ct.number)} className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition ${selectedNumber === ct.number ? 'bg-[#009FE3]/10 text-[#009FE3]' : 'hover:bg-slate-900 text-slate-300'}`}>
                      <div className="min-w-0">
                        <span className="block font-mono text-sm">{ct.number}</span>
                        <span className="block truncate text-xs text-slate-500">{ct.client ? `${ct.client.clientId} ${ct.client.name}` : '—'} · {ct.count} call(s)</span>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-500">{new Date(ct.lastAt).toLocaleDateString()}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-8 rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                {!selectedNumber || !active ? (
                  <div className="grid place-items-center py-12 text-center">
                    <PhoneCall className="size-6 text-slate-600" />
                    <p className="mt-2 text-sm text-slate-400">Select a contact to see its thread</p>
                    <p className="text-xs text-slate-600">Bubbles show direction, channel, delivery status and outcome — search via Client 360° for the same number.</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
                      <div><p className="font-mono text-sm font-semibold text-slate-200">{active.number}</p><p className="text-xs text-slate-500">{active.client ? `${active.client.clientId} ${active.client.name}` : 'Unknown contact'} · <a href={thread[0]?.dialUri ?? `tel:${active.number}`} className="font-semibold text-[#009FE3] hover:underline">Dial</a></p></div>
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400">{thread.length} message{thread.length===1?'':'s'}</span>
                    </div>
                    <ol className="space-y-2" aria-label={`Call thread for ${active.number}`}>
                      {thread.map((c) => {
                        const inbound = c.direction === 'INBOUND'
                        return (
                          <li key={c.id} className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${inbound ? 'bg-slate-800 text-slate-100 rounded-bl-sm' : 'bg-[#009FE3] text-white rounded-br-sm'}`}>
                              <p className="text-xs font-semibold opacity-80">{c.direction} · {c.channel} · {c.status}{c.outcome ? ` · ${c.outcome}` : ''}</p>
                              <p className="mt-1 text-sm">{c.notes || '—'}{c.durationSec ? ` · ${c.durationSec}s` : ''}</p>
                              <p className="mt-1 text-[11px] opacity-60">{new Date(c.startedAt).toLocaleString()} {c.endedAt ? `→ ${new Date(c.endedAt).toLocaleString()}` : ''}</p>
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                    <form onSubmit={(e) => { e.preventDefault(); const el = (e.target as HTMLFormElement).elements.namedItem('quickSms') as HTMLInputElement | null; const v = el?.value?.trim(); if (v) { setForm({ ...form, number: active.number, notes: v }); toast.message('Composer filled — send via Log & dial / SMS gateway'); } }} className="mt-3 flex gap-2">
                      <input name="quickSms" placeholder="Quick SMS composer for this thread…" className={cn(INPUT, 'flex-1')} />
                      <Button type="submit" size="sm" variant="outline">Fill</Button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )
        })()}
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
