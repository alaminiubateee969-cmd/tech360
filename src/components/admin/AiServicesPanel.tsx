'use client'

import { useState } from 'react'
import { fetchJson, useApi } from '@/lib/admin-client'
import type { AI_SERVICES, FreeModel } from '@/lib/free-ai-services'
import { Button } from '@/components/ui/button'
import { Markdownish } from './shared/Markdownish'

type Catalog = { services: typeof AI_SERVICES; models: FreeModel[]; configured: boolean; checkedAt?: string; error?: string }

export function AiServicesPanel() {
  const { data, loading, error, refresh } = useApi<Catalog>('/api/admin/ai-services')
  const [model, setModel] = useState('')
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const selected = data?.models.some((m) => m.id === model) ? model : data?.models[0]?.id ?? ''
  async function ask() {
    setBusy(true); setFailure(''); setReply('')
    try {
      const result = await fetchJson<{ reply: string }>('/api/admin/ai-services', { method: 'POST', body: { model: selected, message } })
      setReply(result.reply)
    } catch (e) { setFailure(e instanceof Error ? e.message : 'Request failed') }
    finally { setBusy(false) }
  }
  return (
    <details className="mb-4 shrink-0 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-300">
      <summary className="cursor-pointer p-4 font-semibold">AI services & free-model assistant</summary>
      <div className="max-h-[65vh] space-y-4 overflow-auto p-4 pt-0 text-sm">
        <p>Free tiers have quotas and can change. Local models need hardware. Setup references are not active integrations. This assistant cannot execute commands; use Oracle below for live platform actions.</p>
        <Button variant="outline" onClick={refresh} disabled={loading}>Refresh live catalog</Button>
        <p role="status">{loading ? 'Checking live availability…' : error || data?.error || `${data?.models.length ?? 0} zero-price routes · ${data?.configured ? 'Server key configured (not a health check)' : 'OPENROUTER_API_KEY required on server'}`}</p>
        {data?.checkedAt && <p className="text-xs">Catalog checked: {data.checkedAt}</p>}
        <label className="block">Model
          <select value={selected} onChange={(e) => setModel(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" disabled={!data?.models.length}>
            {!data?.models.length && <option value="">No verified free routes available</option>}
            {data?.models.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.id}</option>)}
          </select>
        </label>
        <form onSubmit={(e) => { e.preventDefault(); void ask() }} className="space-y-2">
          <label className="block">Ask the assistant (sent to OpenRouter)
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} rows={3} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" placeholder="Draft a plan, explain code, or ask a question. Do not include secrets." />
          </label>
          <Button type="submit" disabled={busy || !selected || !message.trim() || !data?.configured}>{busy ? 'Generating…' : 'Ask — zero-price routes only'}</Button>
        </form>
        {failure && <p role="alert" className="text-red-400">{failure}</p>}
        {reply && <div aria-live="polite"><Markdownish text={reply} /></div>}
        <label className="block">Service directory
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" placeholder="Search chat, images, speech, local, memory…" />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          {data?.services.filter((s) => `${s.name} ${s.category} ${s.mode}`.toLowerCase().includes(query.toLowerCase())).map((s) => (
            <article key={s.name} className="rounded-lg border border-slate-800 p-3">
              <a className="font-semibold text-sky-400 underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a>
              <p>{s.category}</p><p className="mt-1 text-xs text-amber-300">{s.mode}</p><p className="mt-2 text-xs text-slate-400">{s.setup}</p>
            </article>
          ))}
        </div>
      </div>
    </details>
  )
}
