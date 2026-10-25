'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Activity, BookOpenText, CheckCircle2, Globe2, MessageCircle, RefreshCw, Send, Sparkles, Users } from 'lucide-react'

type Overview = {
  generatedAt: string
  dataSource: string
  metrics: {
    leads: number
    clients: number
    whatsappMessages: number
    inboundWhatsapp: number
    outboundWhatsapp: number
    failedCommunications: number
    content: { drafts: number; approved: number; published: number }
    pendingApprovals: number
    failedAutomations: number
  }
  recentAutomations: Array<{ id: string; workflow: string; status: string; startedAt: string; error: string | null }>
}
type ContentItem = { id: string; type: string; language: string; title: string; content: string; status: string; createdAt: string; updatedAt: string }
type Thread = { id: string; clientId: string | null; contactName: string; phone: string; lastMessagePreview: string; lastMessageAt: string | null; lastMessageStatus: string | null; canSendFreeform: boolean }
type InboxResponse = { threads: Thread[]; note?: string }

function csrfHeaders(): HeadersInit {
  const token = document.cookie.split('; ').find((part) => part.startsWith('t360_csrf='))?.split('=').slice(1).join('=')
  return token ? { 'x-csrf-token': decodeURIComponent(token) } : {}
}
function dateLabel(value?: string | null) {
  if (!value) return 'No activity yet'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString()
}
function parseContent(content: string) {
  try { return JSON.stringify(JSON.parse(content), null, 2) } catch { return content }
}

export default function CommandCenterPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [items, setItems] = useState<ContentItem[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState<'overview' | 'content' | 'whatsapp'>('overview')
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [brand, setBrand] = useState('ALO Education')
  const [language, setLanguage] = useState('EN')
  const [audience, setAudience] = useState('Bangladesh students planning to study abroad')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      const [o, c, w] = await Promise.all([
        fetch('/api/admin/command-center/overview', { cache: 'no-store' }),
        fetch('/api/admin/command-center/content?perPage=30', { cache: 'no-store' }),
        fetch('/api/admin/whatsapp/inbox?perPage=20', { cache: 'no-store' }),
      ])
      if (o.status === 401 || c.status === 401 || w.status === 401) {
        setNotice('Please sign in to the Tech360 admin dashboard, then reload this page.')
        return
      }
      if (o.ok) setOverview(await o.json())
      if (c.ok) setItems((await c.json()).items ?? [])
      if (w.ok) setThreads((await w.json() as InboxResponse).threads ?? [])
      if (!o.ok || !c.ok) setNotice('Some dashboard data could not load. Check API permissions and server logs.')
      else setNotice('')
    } catch {
      setNotice('Unable to reach the command center APIs. Check the server and try again.')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    try {
      const response = await fetch('/api/admin/command-center/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({
          title, topic, brand, language, audience, type: 'BLOG_DRAFT',
          content: { topic, brand, audience, language, outline: [], sections: [], seo: { title, description: '', keywords: [] }, state: 'DRAFT' },
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not create draft')
      setTitle('')
      setTopic('')
      setNotice('Draft saved. AI writing and live publishing are not connected yet; this is a reviewable content record.')
      setTab('content')
      await refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Draft creation failed')
    } finally {
      setBusy(false)
    }
  }

  async function reviewContent(id: string, action: 'APPROVE' | 'RETURN_TO_DRAFT') {
    setBusy(true)
    setNotice('')
    try {
      const response = await fetch(`/api/admin/command-center/content/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ action }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Review action failed')
      setNotice(action === 'APPROVE' ? 'Content approved. It has not been published to a live website.' : 'Content returned to draft.')
      await refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Review action failed')
    } finally {
      setBusy(false)
    }
  }

  async function sendReply(thread: Thread) {
    const body = (replyDrafts[thread.id] ?? '').trim()
    if (!body || !thread.clientId) return
    setBusy(true)
    setNotice('')
    try {
      const response = await fetch('/api/admin/whatsapp/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ clientId: thread.clientId, body }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'WhatsApp reply failed')
      setReplyDrafts((current) => ({ ...current, [thread.id]: '' }))
      setNotice(data.status === 'SENT' ? 'WhatsApp reply accepted by Meta. Delivery status will update from webhook events.' : 'Message status: ' + data.status)
      await refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'WhatsApp reply failed')
    } finally {
      setBusy(false)
    }
  }

  const metrics = overview?.metrics
  const cards = [
    { label: 'Open leads', value: metrics?.leads ?? '—', icon: Users },
    { label: 'CRM contacts', value: metrics?.clients ?? '—', icon: Globe2 },
    { label: 'WhatsApp messages', value: metrics?.whatsappMessages ?? '—', icon: MessageCircle },
    { label: 'Content drafts', value: metrics?.content.drafts ?? '—', icon: BookOpenText },
    { label: 'Approved content', value: metrics?.content.approved ?? '—', icon: CheckCircle2 },
    { label: 'Failed automations', value: metrics?.failedAutomations ?? '—', icon: Activity },
  ]

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Tech360 · Central Operations</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">AI Command Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">Manage brand content, review publishing drafts, and monitor WhatsApp CRM from one workspace.</p>
          </div>
          <button onClick={() => void refresh()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 disabled:opacity-50">
            <RefreshCw className={busy ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh live data
          </button>
        </header>

        {notice && <div role="status" className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">{notice}</div>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: 'ALO Education', domain: 'aloeducation.com', detail: 'Study abroad · Bangladesh · বাংলা + English' },
            { name: 'Tech360', domain: 'bdtech360.com', detail: 'Technology · software · automation' },
            { name: 'Al-Amin personal brand', domain: 'alaminn.info', detail: 'Portfolio · insights · personal publishing' },
          ].map((b) => <article key={b.domain} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Globe2 className="h-4 w-4 text-cyan-300" />{b.name}</div>
            <p className="mt-1 text-xs text-slate-400">{b.domain}</p>
            <p className="mt-3 text-sm text-slate-300">{b.detail}</p>
            <p className="mt-3 text-[11px] uppercase tracking-wider text-amber-300">Registry / publishing adapter pending</p>
          </article>)}
        </section>

        <nav className="flex flex-wrap gap-2" aria-label="Command center sections">
          {([{ id: 'overview', label: 'Overview' }, { id: 'content', label: 'SEO & Content' }, { id: 'whatsapp', label: 'WhatsApp CRM' }] as const).map((item) =>
            <button key={item.id} onClick={() => setTab(item.id)} className={tab === item.id ? 'rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950' : 'rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5'}>
              {item.label}
            </button>)}
        </nav>

        {tab === 'overview' && <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ label, value, icon: Icon }) => <article key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between text-sm text-slate-400"><span>{label}</span><Icon className="h-4 w-4 text-cyan-300" /></div>
              <p className="mt-3 text-3xl font-bold">{value}</p>
            </article>)}
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="font-semibold">WhatsApp activity</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-black/20 p-3"><p className="text-xs text-slate-400">Inbound</p><p className="mt-1 text-2xl font-semibold">{metrics?.inboundWhatsapp ?? '—'}</p></div>
                <div className="rounded-xl bg-black/20 p-3"><p className="text-xs text-slate-400">Outbound</p><p className="mt-1 text-2xl font-semibold">{metrics?.outboundWhatsapp ?? '—'}</p></div>
                <div className="rounded-xl bg-black/20 p-3"><p className="text-xs text-slate-400">Failed messages</p><p className="mt-1 text-2xl font-semibold">{metrics?.failedCommunications ?? '—'}</p></div>
                <div className="rounded-xl bg-black/20 p-3"><p className="text-xs text-slate-400">Pending approvals</p><p className="mt-1 text-2xl font-semibold">{metrics?.pendingApprovals ?? '—'}</p></div>
              </div>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="font-semibold">Recent automation runs</h2>
              <div className="mt-3 space-y-3">
                {(overview?.recentAutomations ?? []).map((run) => <div key={run.id} className="flex items-start justify-between gap-3 border-b border-white/5 pb-3 last:border-0">
                  <div><p className="text-sm font-medium">{run.workflow}</p><p className="mt-1 text-xs text-slate-500">{dateLabel(run.startedAt)}</p></div>
                  <span className={run.status === 'FAILED' ? 'rounded-full bg-rose-400/10 px-2 py-1 text-xs text-rose-300' : 'rounded-full bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300'}>{run.status}</span>
                </div>)}
                {!overview?.recentAutomations.length && <p className="text-sm text-slate-500">No automation runs recorded yet.</p>}
              </div>
            </article>
          </section>
        </>}

        {tab === 'content' && <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <form onSubmit={createDraft} className="h-fit space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-cyan-300" /><h2 className="font-semibold">Create a content draft</h2></div>
            <p className="text-xs text-slate-400">Creates a saved draft for review. It does not call an AI provider or publish live.</p>
            <label className="block text-sm">Brand<select value={brand} onChange={(e) => { setBrand(e.target.value); setAudience(e.target.value === 'ALO Education' ? 'Bangladesh students planning to study abroad' : e.target.value === 'Tech360' ? 'Business owners and technology decision-makers' : 'Readers interested in technology and personal insights') }} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2"><option>ALO Education</option><option>Tech360</option><option>Al-Amin personal brand</option></select></label>
            <label className="block text-sm">Language<select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2"><option value="EN">English</option><option value="BN">বাংলা</option><option value="BILINGUAL">Bangla + English</option></select></label>
            <label className="block text-sm">Audience<input value={audience} onChange={(e) => setAudience(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2" maxLength={240} /></label>
            <label className="block text-sm">Draft title<input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2" maxLength={240} /></label>
            <label className="block text-sm">Topic / keyword<input required value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2" maxLength={500} /></label>
            <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"><BookOpenText className="h-4 w-4" />Save draft</button>
          </form>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Content review queue</h2><span className="text-xs text-slate-400">{items.length} loaded</span></div>
            {items.map((item) => <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-slate-400">{item.type} · {item.language} · updated {dateLabel(item.updatedAt)}</p></div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-xs">{item.status}</span>
              </div>
              <details className="mt-3"><summary className="cursor-pointer text-xs text-cyan-300">View draft data</summary><pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 text-xs text-slate-300">{parseContent(item.content)}</pre></details>
              {item.status !== 'PUBLISHED' && <div className="mt-3 flex flex-wrap gap-2">
                {item.status !== 'APPROVED' && <button disabled={busy} onClick={() => void reviewContent(item.id, 'APPROVE')} className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">Approve draft</button>}
                {item.status !== 'DRAFT' && <button disabled={busy} onClick={() => void reviewContent(item.id, 'RETURN_TO_DRAFT')} className="rounded-lg border border-white/15 px-3 py-2 text-xs disabled:opacity-50">Return to draft</button>}
              </div>}
            </article>)}
            {!items.length && <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">No content records yet. Create your first draft to start the review workflow.</div>}
          </div>
        </section>}

        {tab === 'whatsapp' && <section className="space-y-4">
          <div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-emerald-300" /><h2 className="font-semibold">WhatsApp inbox preview</h2></div>
          <p className="text-sm text-slate-400">Read-only preview of existing CRM communication threads. Reply sending, agent assignment, unread tracking, templates and campaigns are not yet enabled in this screen.</p>
          {threads.map((thread) => <article key={thread.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{thread.contactName}</p><p className="mt-1 text-xs text-slate-400">{thread.phone} {thread.clientId ? `· ${thread.clientId}` : ''}</p></div><span className="text-xs text-slate-500">{dateLabel(thread.lastMessageAt)}</span></div>
            <p className="mt-3 text-sm text-slate-300">{thread.lastMessagePreview || 'Media message'}</p>
            <p className="mt-2 text-xs text-slate-500">{thread.canSendFreeform ? 'Customer service window appears open' : 'Template may be required outside the service window'} · {thread.lastMessageStatus ?? 'status unavailable'}</p>
            {thread.canSendFreeform && thread.clientId && <form onSubmit={(event) => { event.preventDefault(); void sendReply(thread) }} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input aria-label={'Reply to ' + thread.contactName} value={replyDrafts[thread.id] ?? ''} onChange={(event) => setReplyDrafts((current) => ({ ...current, [thread.id]: event.target.value }))} maxLength={4000} placeholder="Write a WhatsApp reply…" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm" />
              <button disabled={busy || !(replyDrafts[thread.id] ?? '').trim()} className="rounded-lg bg-emerald-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">Send reply</button>
            </form>}
          </article>)}
          {!threads.length && <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">No WhatsApp threads found in the current communications ledger.</div>}
        </section>}

        <footer className="flex flex-col gap-2 border-t border-white/10 pt-4 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <span>Data source: {overview?.dataSource ?? 'waiting for API'} · refreshed {dateLabel(overview?.generatedAt)}</span>
          <span className="inline-flex items-center gap-1"><Send className="h-3 w-3" /> Publishing and outbound campaigns require separate approved integrations.</span>
        </footer>
      </div>
    </main>
  )
}
