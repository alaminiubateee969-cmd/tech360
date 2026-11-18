'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Lock,
  MessageSquare,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  StickyNote,
  UserPlus,
  XCircle,
} from 'lucide-react'

import { ApiError, fetchJson, getCsrf, useApi } from '@/lib/admin-client'
import { mergeMessages } from '@/lib/webchat/client-thread'
import { EmptyState, PageHeader } from './shared/cards'
import { ACCENT, SCROLL_THIN } from './shared/styles'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

// ============================================================
// TECH360 — Unified inbox for website chat conversations.
// Views (All / Unassigned / Mine / Assigned / Open / Pending /
// Escalated / Resolved) with live counts and server-side search;
// live thread over SSE (polling fallback) with visitor typing and
// read receipts; assignment, team transfer, priority, internal
// notes, AI-suggested drafts (never auto-sent), escalation,
// resolve/reopen, attachments, and the linked CRM profile with its
// activity timeline. Every action is persisted server-side.
// ============================================================

type InboxState = 'OPEN' | 'PENDING' | 'ESCALATED' | 'RESOLVED'
type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
type View = 'ALL' | 'UNASSIGNED' | 'MINE' | 'ASSIGNED' | 'OPEN' | 'PENDING' | 'ESCALATED' | 'RESOLVED'

type ConversationRow = {
  id: string
  anonId: string
  clientId: string | null
  status: 'OPEN' | 'CLOSED'
  inboxState: InboxState
  priority: Priority
  team: string | null
  assignedToId: string | null
  assignedToEmail: string | null
  humanRequested: boolean
  aiIntent: string | null
  aiLanguage: string | null
  visitorName: string | null
  visitorEmail: string | null
  visitorPhone: string | null
  subject: string | null
  lastMessagePreview: string | null
  lastMessageAt: string
  lastSender: 'VISITOR' | 'ADMIN' | 'SYSTEM' | null
  unreadCount: number
  createdAt: string
  updatedAt: string
  messageCount: number
  lastAgentEmail?: string | null
}

type ConversationsResponse = {
  conversations: ConversationRow[]
  counts: { OPEN: number; CLOSED: number }
  viewCounts?: Partial<Record<View, number>>
}

type ThreadMessage = {
  id: string
  sender: 'VISITOR' | 'ADMIN' | 'SYSTEM'
  author: 'VISITOR' | 'AI' | 'HUMAN' | 'SYSTEM'
  body: string
  aiGenerated: boolean
  deliveryStatus: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
  attachment: { id: string; name: string; mime: string; size: number } | null
  agentEmail: string | null
  kind: 'MESSAGE' | 'NOTE' | 'EVENT'
  internal: boolean
  createdAt: string
}

type ThreadConversation = ConversationRow & {
  escalatedAt: string | null
  escalationReason: string | null
  resolvedAt: string | null
  firstResponseAt: string | null
  aiBusinessType: string | null
  aiSummary: string | null
}

type CrmProfile = {
  rowId: string
  clientId: string
  name: string | null
  businessName: string | null
  businessType: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  status: string
  pipelineStage: string
  source: string | null
  createdAt: string
  lead: { requirements: string | null; interest: string | null; budgetRange: string | null; sourceDetails: string | null } | null
  conversations: Array<{ id: string; status: string; inboxState: string; lastMessageAt: string; subject: string | null }>
  projects: Array<{ id: string; name: string; status: string }>
  timeline: Array<{ at: string; kind: string; title: string; detail: string | null }>
}

type ThreadResponse = { conversation: ThreadConversation; messages: ThreadMessage[]; crm: CrmProfile | null }

type DuplicateCandidate = { rowId: string; clientId: string; name: string | null; businessName: string | null; status: string; matchedOn: string[] }

type Assignee = { id: string; email: string; name: string | null; role: string }

type AssistResult =
  | { method: 'AI'; status: 'OK'; suggestions: string[]; summary: string | null; knowledge: Array<{ id: string; title: string }>; withheld: number; agentCode: string }
  | { method: 'AI'; status: 'ESCALATE' | 'NOT_CONFIGURED' | 'FAILED'; reason: string; knowledge: Array<{ id: string; title: string }> }

const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'UNASSIGNED', label: 'Unassigned' },
  { id: 'MINE', label: 'Mine' },
  { id: 'ASSIGNED', label: 'Assigned' },
  { id: 'OPEN', label: 'Open' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'ESCALATED', label: 'Escalated' },
  { id: 'RESOLVED', label: 'Resolved' },
]

const PRIORITIES: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT']

const STATE_STYLE: Record<InboxState, string> = {
  OPEN: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  PENDING: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  ESCALATED: 'border-red-500/40 bg-red-500/10 text-red-300',
  RESOLVED: 'border-slate-700 bg-slate-800 text-slate-400',
}

const PRIORITY_STYLE: Record<Priority, string> = {
  LOW: 'text-slate-500',
  NORMAL: 'text-slate-400',
  HIGH: 'text-amber-400',
  URGENT: 'text-red-400',
}

const SELECT = 'h-8 rounded-md border border-slate-800 bg-slate-950/60 px-2 text-xs text-slate-200 focus-visible:border-[#009FE3]/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#009FE3]/40'
const OUTLINE_BTN = 'border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'

function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function visitorLabel(c: { visitorName: string | null }): string {
  return c.visitorName || 'Anonymous visitor'
}

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

function convoUrl(id: string, suffix = '') {
  return `/api/admin/conversations/${encodeURIComponent(id)}${suffix}`
}

export function ConversationsView({ onOpenClient }: { onOpenClient?: (clientRowId: string) => void } = {}) {
  // ---------------- list state ----------------
  const [view, setView] = useState<View>('OPEN')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])
  const listUrl = `/api/admin/conversations?view=${view}${query ? `&q=${encodeURIComponent(query)}` : ''}`
  const { data, loading, error, refresh } = useApi<ConversationsResponse>(listUrl)
  const conversations = useMemo(() => data?.conversations ?? [], [data])
  const viewCounts = data?.viewCounts ?? {}
  const { data: team } = useApi<{ me: string; teams: string[]; assignees: Assignee[] }>('/api/admin/conversations/assignees')

  // 15s list polling — live queue counts while the console is open
  useEffect(() => {
    const t = window.setInterval(() => refresh(), 15_000)
    return () => window.clearInterval(t)
  }, [refresh])

  // ---------------- thread state ----------------
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [thread, setThread] = useState<ThreadResponse | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState<string | null>(null)
  const [composerMode, setComposerMode] = useState<'reply' | 'note'>('reply')
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [visitorTyping, setVisitorTyping] = useState(false)
  const [streamLive, setStreamLive] = useState(false)
  const [streamNonce, setStreamNonce] = useState(0)
  const [assist, setAssist] = useState<AssistResult | null>(null)
  const [assistLoading, setAssistLoading] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<{ id: string; name: string; mime: string; size: number } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null)
  const replyRequestIdRef = useRef<string | null>(null)
  const typingSentAtRef = useRef(0)
  const threadScrollRef = useRef<HTMLDivElement>(null)
  const replyRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const threadRef = useRef<ThreadResponse | null>(null)
  threadRef.current = thread

  const loadThread = useCallback(async (id: string, opts: { quiet?: boolean } = {}) => {
    if (!opts.quiet) {
      setThreadLoading(true)
      setThreadError(null)
      setThread(null)
    }
    try {
      const res = await fetchJson<ThreadResponse>(convoUrl(id))
      setThread(res)
    } catch (err) {
      if (!opts.quiet) setThreadError(err instanceof Error ? err.message : 'Could not load the conversation.')
    } finally {
      if (!opts.quiet) setThreadLoading(false)
    }
  }, [])

  // opening a thread clears its unread flag and marks visitor messages read — refresh the list
  const openConversation = useCallback(
    (id: string) => {
      if (id === selectedId) return
      setSelectedId(id)
      setReply('')
      setAssist(null)
      setPendingAttachment(null)
      setDuplicates(null)
      setComposerMode('reply')
      replyRequestIdRef.current = null
      void loadThread(id).then(() => refresh())
    },
    [selectedId, loadThread, refresh],
  )

  // ---------------- live thread: SSE with polling fallback ----------------
  useEffect(() => {
    if (!selectedId || typeof window === 'undefined' || typeof window.EventSource === 'undefined') return
    const msgs = threadRef.current?.conversation.id === selectedId ? threadRef.current.messages : []
    const after = msgs.length ? `?after=${encodeURIComponent(msgs[msgs.length - 1].id)}` : ''
    const es = new EventSource(convoUrl(selectedId, `/stream${after}`))
    let ended = false
    const parse = <T,>(e: Event): T | null => { try { return JSON.parse((e as MessageEvent).data) as T } catch { return null } }
    es.onopen = () => setStreamLive(true)
    es.addEventListener('messages', (e) => {
      const d = parse<{ messages: ThreadMessage[] }>(e)
      if (!d) return
      setThread((prev) => (prev && prev.conversation.id === selectedId ? { ...prev, messages: mergeMessages(prev.messages, d.messages) } : prev))
    })
    es.addEventListener('status', (e) => {
      const d = parse<Partial<ThreadConversation> & { id: string }>(e)
      if (!d) return
      setThread((prev) => (prev && prev.conversation.id === d.id ? { ...prev, conversation: { ...prev.conversation, ...d } as ThreadConversation } : prev))
    })
    es.addEventListener('typing', (e) => setVisitorTyping(Boolean(parse<{ active: boolean }>(e)?.active)))
    es.addEventListener('receipts', (e) => {
      const d = parse<{ receipts: Array<{ id: string; deliveryStatus: ThreadMessage['deliveryStatus'] }> }>(e)
      if (!d) return
      const byId = new Map(d.receipts.map((r) => [r.id, r.deliveryStatus]))
      setThread((prev) => (prev ? { ...prev, messages: prev.messages.map((m) => (byId.has(m.id) ? { ...m, deliveryStatus: byId.get(m.id)! } : m)) } : prev))
    })
    es.addEventListener('reconnect', () => {
      if (ended) return
      ended = true
      es.close()
      setStreamNonce((n) => n + 1)
    })
    es.addEventListener('gone', () => {
      ended = true
      es.close()
      setStreamLive(false)
    })
    es.onerror = () => setStreamLive(false)
    return () => {
      ended = true
      es.close()
      setStreamLive(false)
      setVisitorTyping(false)
    }
  }, [selectedId, streamNonce])

  useEffect(() => {
    if (!selectedId || streamLive) return
    const t = window.setInterval(() => void loadThread(selectedId, { quiet: true }), 10_000)
    return () => window.clearInterval(t)
  }, [selectedId, streamLive, loadThread])

  // keep the thread pinned to the bottom as messages arrive
  useEffect(() => {
    const el = threadScrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight })
  }, [thread?.messages.length, thread?.conversation.id, visitorTyping])

  // ---------------- actions ----------------
  const post = useCallback(async <T,>(body: Record<string, unknown>): Promise<T> => {
    if (!selectedId) throw new Error('No conversation selected')
    return fetchJson<T>(convoUrl(selectedId), { method: 'POST', body })
  }, [selectedId])

  const runAction = useCallback(async (label: string, body: Record<string, unknown>, success?: string) => {
    if (!selectedId || busyAction) return
    setBusyAction(label)
    try {
      await post(body)
      if (success) toast.success(success)
      await loadThread(selectedId, { quiet: true })
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed — try again.')
    } finally {
      setBusyAction(null)
    }
  }, [selectedId, busyAction, post, loadThread, refresh])

  const sendTyping = useCallback((typing: boolean) => {
    if (!selectedId || composerMode !== 'reply') return
    const now = Date.now()
    if (typing && now - typingSentAtRef.current < 3_000) return
    if (!typing && typingSentAtRef.current === 0) return
    typingSentAtRef.current = typing ? now : 0
    void post({ action: 'typing', typing }).catch(() => null)
  }, [selectedId, composerMode, post])

  const submitComposer = useCallback(async () => {
    if (!selectedId || sending) return
    const body = reply.trim()
    if (!body && !(composerMode === 'reply' && pendingAttachment)) return
    setSending(true)
    try {
      if (composerMode === 'note') {
        const res = await post<{ message?: ThreadMessage }>({ action: 'note', body })
        if (res.message) setThread((prev) => (prev ? { ...prev, messages: mergeMessages(prev.messages, [res.message!]) } : prev))
      } else {
        // The request id survives failures so a retry can never post the reply twice.
        replyRequestIdRef.current ??= newRequestId()
        const res = await post<{ message?: ThreadMessage; duplicate?: boolean }>({
          action: 'reply',
          body,
          requestId: replyRequestIdRef.current,
          ...(pendingAttachment ? { attachment: { id: pendingAttachment.id } } : {}),
        })
        replyRequestIdRef.current = null
        setPendingAttachment(null)
        typingSentAtRef.current = 0
        if (res.message) setThread((prev) => (prev ? { ...prev, messages: mergeMessages(prev.messages, [res.message!]) } : prev))
      }
      setReply('')
      refresh()
      replyRef.current?.focus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sending failed — try again (it will not be duplicated).')
    } finally {
      setSending(false)
    }
  }, [selectedId, sending, reply, composerMode, pendingAttachment, post, refresh])

  const uploadAttachment = useCallback(async (file: File) => {
    if (!selectedId) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Files must be 5 MB or smaller.'); return }
    setUploading(true)
    try {
      const form = new FormData()
      form.set('file', file)
      const res = await fetch(convoUrl(selectedId, '/attachments'), { method: 'POST', body: form, headers: { 'x-csrf-token': getCsrf() } })
      const data = (await res.json().catch(() => null)) as { attachment?: { id: string; name: string; mime: string; size: number }; error?: string } | null
      if (!res.ok || !data?.attachment) throw new Error(data?.error ?? 'Upload failed.')
      setPendingAttachment(data.attachment)
      setComposerMode('reply')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [selectedId])

  const requestSuggestions = useCallback(async () => {
    if (!selectedId || assistLoading) return
    setAssistLoading(true)
    setAssist(null)
    try {
      const res = await post<{ result: AssistResult }>({ action: 'suggest' })
      setAssist(res.result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not get suggestions.')
    } finally {
      setAssistLoading(false)
    }
  }, [selectedId, assistLoading, post])

  // Convert to a lead. A typed email/phone that matches a live CRM record is
  // never auto-linked: the server answers POSSIBLE_DUPLICATE and the operator
  // either links to the existing record or explicitly creates a separate lead.
  const convertToLead = useCallback(async (createNew = false) => {
    if (!selectedId || busyAction) return
    setBusyAction('convert')
    try {
      const res = await post<{ ok?: boolean; clientId?: string }>({ action: 'convert-to-lead', ...(createNew ? { createNew: true } : {}) })
      setDuplicates(null)
      toast.success(res.clientId ? `Lead ${res.clientId} linked to this conversation.` : 'Lead created from this conversation.')
      await loadThread(selectedId, { quiet: true })
      refresh()
    } catch (err) {
      const data = err instanceof ApiError ? (err.data as { code?: string; candidates?: DuplicateCandidate[] } | null) : null
      if (data?.code === 'POSSIBLE_DUPLICATE' && data.candidates?.length) {
        setDuplicates(data.candidates)
      } else {
        toast.error(err instanceof Error ? err.message : 'Conversion failed — try again.')
      }
    } finally {
      setBusyAction(null)
    }
  }, [selectedId, busyAction, post, loadThread, refresh])

  const linkToClient = useCallback(async (candidate: DuplicateCandidate) => {
    if (!selectedId || busyAction) return
    setBusyAction('link')
    try {
      await post({ action: 'link-client', clientRowId: candidate.rowId })
      setDuplicates(null)
      toast.success(`Conversation linked to ${candidate.clientId}.`)
      await loadThread(selectedId, { quiet: true })
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Linking failed — try again.')
    } finally {
      setBusyAction(null)
    }
  }, [selectedId, busyAction, post, loadThread, refresh])

  // ---------------- render ----------------
  const selected = thread?.conversation ?? null
  const canReply = selected?.status === 'OPEN' && selected.inboxState !== 'RESOLVED'

  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Website chat conversations — assign, triage and reply. AI drafts are suggestions only; a person sends every reply."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className={OUTLINE_BTN} aria-label="Refresh conversations">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
          </Button>
        }
      />

      {/* view tabs + search */}
      <div className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div role="tablist" aria-label="Inbox views" className={`flex gap-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60 p-1 ${SCROLL_THIN}`}>
          {VIEWS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={view === tab.id}
              onClick={() => {
                setView(tab.id)
                setSelectedId(null)
                setThread(null)
              }}
              className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                view === tab.id ? 'bg-[#009FE3] text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              {tab.label}
              <span className={`rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${view === tab.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {viewCounts[tab.id] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div className="relative xl:w-80">
          <label htmlFor="chat-search" className="sr-only">Search conversations</label>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            id="chat-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, Client ID or message…"
            className="h-9 w-full rounded-md border border-slate-800 bg-slate-950/60 pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:border-[#009FE3]/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#009FE3]/40"
          />
        </div>
      </div>

      {error ? (
        <div role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Could not load conversations: {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px,1fr] 2xl:grid-cols-[320px,1fr,300px]">
        {/* ---------------- left: conversation list ---------------- */}
        <section aria-label="Conversation list" className="flex max-h-[calc(100vh-16rem)] flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60">
          <div className={`flex-1 overflow-y-auto p-2 ${SCROLL_THIN}`}>
            {loading && conversations.length === 0 ? (
              <div className="space-y-2 p-1" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-800/60" />)}
              </div>
            ) : conversations.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title={query ? 'No matches' : 'Nothing in this view'}
                description={query ? 'Nothing matches this search — try a different name, email, Client ID or keyword.' : 'New website chat conversations appear here the moment a visitor starts one.'}
              />
            ) : (
              <ul className="space-y-1.5" role="list" aria-label="Conversations">
                {conversations.map((c) => {
                  const active = c.id === selectedId
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => openConversation(c.id)}
                        aria-current={active ? 'true' : undefined}
                        aria-label={`Conversation with ${visitorLabel(c)}${c.subject ? ` about ${c.subject}` : ''}, ${c.inboxState.toLowerCase()}, ${c.priority.toLowerCase()} priority, last activity ${fmtAgo(c.lastMessageAt)}${c.status === 'OPEN' && c.lastSender === 'VISITOR' ? ', waiting on a reply' : ''}`}
                        className={`w-full rounded-lg border p-2.5 text-left transition ${
                          active ? 'border-[#009FE3]/50 bg-[#009FE3]/10' : 'border-transparent bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span aria-hidden="true" title={c.status === 'OPEN' ? 'Visitor session open' : 'Visitor session closed'} className={`size-2 shrink-0 rounded-full ${c.status === 'OPEN' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">{visitorLabel(c)}</p>
                          {c.status === 'OPEN' && c.lastSender === 'VISITOR' && (
                            <span title="The visitor has the last word — this thread is waiting on a reply" className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                              needs reply
                            </span>
                          )}
                          {c.unreadCount > 0 && (
                            <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400" title={`${c.unreadCount} unread visitor message${c.unreadCount === 1 ? '' : 's'}`}>
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className={`rounded-full border px-1.5 py-0.5 font-semibold ${STATE_STYLE[c.inboxState] ?? STATE_STYLE.OPEN}`}>{c.inboxState}</span>
                          <span className={`font-semibold ${PRIORITY_STYLE[c.priority] ?? ''}`}>{c.priority}</span>
                          {c.humanRequested && <span className="text-red-300">· asked for a person</span>}
                          {c.team && <span className="text-slate-500">· {c.team}</span>}
                          {c.aiIntent && c.aiIntent !== 'GENERAL' && <span className="text-violet-300">· {c.aiIntent.toLowerCase().replace(/_/g, ' ')}</span>}
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">{c.lastMessagePreview || 'No messages yet'}</p>
                        <p className="mt-1 truncate text-[10px] text-slate-600">
                          {fmtAgo(c.lastMessageAt)} · {c.assignedToEmail ? `assigned to ${c.assignedToEmail}` : 'unassigned'}{c.clientId ? ` · ${c.clientId}` : ''}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ---------------- centre: thread pane ---------------- */}
        <section aria-label="Conversation thread" className="flex max-h-[calc(100vh-16rem)] min-h-125 flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60">
          {!selectedId ? (
            <EmptyState icon={MessageSquare} title="Select a conversation" description="Pick a conversation to read the thread, reply, assign it or add internal notes." className="flex-1" />
          ) : threadLoading && !thread ? (
            <div className="flex-1 space-y-3 p-4" aria-label="Loading conversation">
              <div className="h-5 w-48 animate-pulse rounded bg-slate-800/70" />
              {[0, 1, 2].map((i) => (
                <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
                  <div className={`h-12 animate-pulse rounded-2xl bg-slate-800/60 ${i % 2 ? 'w-2/3' : 'w-1/2'}`} />
                </div>
              ))}
            </div>
          ) : threadError ? (
            <div role="alert" className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{threadError}</div>
          ) : thread && selected ? (
            <>
              {/* thread header */}
              <header className="space-y-2 border-b border-slate-800 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-slate-100">{visitorLabel(selected)}</h2>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATE_STYLE[selected.inboxState] ?? STATE_STYLE.OPEN}`}>{selected.inboxState}</span>
                      {selected.status === 'CLOSED' && <span className="shrink-0 rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">SESSION CLOSED</span>}
                      <span className={`text-[10px] ${streamLive ? 'text-emerald-400' : 'text-slate-500'}`} title={streamLive ? 'Live updates connected' : 'Polling every 10 seconds'}>
                        {streamLive ? '● live' : '○ polling'}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {[selected.visitorEmail, selected.visitorPhone].filter(Boolean).join(' · ') || 'No contact details shared'}
                      {selected.subject ? ` — ${selected.subject}` : ''}
                    </p>
                    {selected.escalationReason && selected.inboxState === 'ESCALATED' && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-red-300"><AlertTriangle className="size-3" aria-hidden="true" />{selected.escalationReason}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {selected.inboxState !== 'ESCALATED' && selected.inboxState !== 'RESOLVED' && (
                      <Button variant="outline" size="sm" className={OUTLINE_BTN} disabled={Boolean(busyAction)} onClick={() => void runAction('escalate', { action: 'escalate', body: 'Escalated by an operator' }, 'Escalated.')}>
                        <AlertTriangle className="size-4" aria-hidden="true" /> Escalate
                      </Button>
                    )}
                    {selected.inboxState !== 'PENDING' && selected.inboxState !== 'RESOLVED' && (
                      <Button variant="outline" size="sm" className={OUTLINE_BTN} disabled={Boolean(busyAction)} onClick={() => void runAction('pending', { action: 'pending' }, 'Marked pending (waiting on the customer).')}>
                        <Clock className="size-4" aria-hidden="true" /> Pending
                      </Button>
                    )}
                    {selected.inboxState !== 'RESOLVED' ? (
                      <Button variant="outline" size="sm" className={OUTLINE_BTN} disabled={Boolean(busyAction)} onClick={() => void runAction('resolve', { action: 'resolve' }, 'Resolved.')}>
                        <CheckCircle2 className="size-4" aria-hidden="true" /> Resolve
                      </Button>
                    ) : selected.status === 'OPEN' ? (
                      <Button variant="outline" size="sm" className={OUTLINE_BTN} disabled={Boolean(busyAction)} onClick={() => void runAction('reopen', { action: 'reopen' }, 'Reopened.')}>
                        <RotateCcw className="size-4" aria-hidden="true" /> Reopen
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      className={OUTLINE_BTN}
                      disabled={Boolean(busyAction)}
                      onClick={() => void runAction('session', { action: selected.status === 'OPEN' ? 'close' : 'reopen' }, selected.status === 'OPEN' ? 'Conversation closed for the visitor.' : 'Conversation reopened.')}
                      aria-label={selected.status === 'OPEN' ? 'Close this conversation for the visitor' : 'Reopen this conversation for the visitor'}
                    >
                      {busyAction === 'session' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : selected.status === 'OPEN' ? <XCircle className="size-4" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
                      {selected.status === 'OPEN' ? 'Close' : 'Reopen session'}
                    </Button>
                    {!thread.crm && (
                      <Button size="sm" onClick={() => void convertToLead()} disabled={Boolean(busyAction)} className="font-semibold text-white hover:opacity-95" style={{ background: ACCENT }} aria-label="Convert this conversation to a lead">
                        {busyAction === 'convert' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
                        Convert to lead
                      </Button>
                    )}
                  </div>
                </div>
                {/* assignment / team / priority */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <label className="flex items-center gap-1.5">
                    Assignee
                    <select
                      className={SELECT}
                      value={selected.assignedToId ?? ''}
                      disabled={Boolean(busyAction)}
                      onChange={(e) => void runAction('assign', { action: 'assign', assigneeId: e.target.value }, e.target.value ? 'Assigned.' : 'Unassigned.')}
                    >
                      <option value="">Unassigned</option>
                      {(team?.assignees ?? []).map((a) => (
                        <option key={a.id} value={a.id}>{a.id === team?.me ? `Me (${a.email})` : a.name ? `${a.name} — ${a.email}` : a.email}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5">
                    Team
                    <select
                      className={SELECT}
                      value={selected.team ?? ''}
                      disabled={Boolean(busyAction)}
                      onChange={(e) => void runAction('team', { action: 'transfer', assigneeId: selected.assignedToId ?? '', team: e.target.value }, e.target.value ? `Transferred to ${e.target.value}.` : 'Team cleared.')}
                    >
                      <option value="">No team</option>
                      {(team?.teams ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5">
                    Priority
                    <select className={SELECT} value={selected.priority} disabled={Boolean(busyAction)} onChange={(e) => void runAction('priority', { action: 'priority', priority: e.target.value }, 'Priority updated.')}>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  {busyAction && <Loader2 className="size-3.5 animate-spin text-slate-500" aria-label="Saving" />}
                </div>
              </header>

              {/* messages */}
              <div ref={threadScrollRef} role="log" aria-live="polite" aria-label="Conversation messages" className={`flex-1 space-y-3 overflow-y-auto p-4 ${SCROLL_THIN}`}>
                {thread.messages.length === 0 ? (
                  <EmptyState icon={MessageSquare} title="No messages yet" description="The visitor started this conversation but hasn't said anything yet." />
                ) : (
                  thread.messages.map((m) => {
                    if (m.kind === 'NOTE') {
                      return (
                        <div key={m.id} className="mx-auto max-w-[90%] rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                          <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                            <Lock className="size-3" aria-hidden="true" /> Internal note · {m.agentEmail ?? 'team'} · {fmtAgo(m.createdAt)}
                          </p>
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        </div>
                      )
                    }
                    if (m.kind === 'EVENT' || (m.sender === 'SYSTEM' && !m.attachment)) {
                      return (
                        <p key={m.id} className="text-center text-[11px] italic text-slate-500">
                          {m.internal && <Lock className="mr-1 inline size-3" aria-label="Team only" />}
                          {m.body} · {fmtAgo(m.createdAt)}
                        </p>
                      )
                    }
                    const fromVisitor = m.author === 'VISITOR'
                    const isAi = m.author === 'AI'
                    return (
                      <div key={m.id} className={`flex flex-col ${fromVisitor ? 'items-start' : 'items-end'}`}>
                        <div
                          title={new Date(m.createdAt).toLocaleString()}
                          className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                            fromVisitor
                              ? 'rounded-bl-md border border-slate-700 bg-slate-800/70 text-slate-200'
                              : isAi
                                ? 'rounded-br-md border border-violet-500/30 bg-violet-500/10 text-slate-100'
                                : 'rounded-br-md border border-[#009FE3]/30 bg-[#009FE3]/10 text-slate-100'
                          }`}
                        >
                          {m.attachment && (
                            <a href={convoUrl(selected.id, `/attachments/${encodeURIComponent(m.attachment.id)}`)} target="_blank" rel="noopener noreferrer" className="mb-1 flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950/50 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-900">
                              <FileText className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                              <span className="min-w-0 flex-1 truncate">{m.attachment.name}</span>
                              <span className="shrink-0 text-slate-500">{fmtBytes(m.attachment.size)}</span>
                            </a>
                          )}
                          {m.body}
                        </div>
                        <span className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-slate-500">
                          {isAi && <span className="flex items-center gap-0.5 rounded bg-violet-500/20 px-1 font-semibold text-violet-300"><Bot className="size-3" aria-hidden="true" />AI</span>}
                          {fromVisitor ? visitorLabel(selected) : isAi ? 'AI assistant (automated)' : `TECH360${m.agentEmail ? ` — ${m.agentEmail}` : ''}`} · {fmtAgo(m.createdAt)}
                          {!fromVisitor && <span className="text-slate-600">· {m.deliveryStatus === 'READ' ? 'read by visitor' : m.deliveryStatus === 'DELIVERED' ? 'delivered' : 'sent'}</span>}
                          {fromVisitor && m.deliveryStatus === 'READ' && <span className="text-slate-600">· read</span>}
                        </span>
                      </div>
                    )
                  })
                )}
                {visitorTyping && <p className="text-xs italic text-slate-500" aria-live="polite">{visitorLabel(selected)} is typing…</p>}
              </div>

              {/* AI suggestions */}
              {(assist || assistLoading) && (
                <div className="border-t border-slate-800 bg-slate-950/40 px-4 py-2 text-xs">
                  {assistLoading ? (
                    <p className="flex items-center gap-2 text-slate-400"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Asking the AI gateway for drafts…</p>
                  ) : assist?.status === 'OK' ? (
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1 font-semibold text-violet-300"><Sparkles className="size-3.5" aria-hidden="true" />AI drafts — review and edit before sending. Nothing is sent automatically.</p>
                      {assist.suggestions.map((s, i) => (
                        <button key={i} type="button" onClick={() => { setComposerMode('reply'); setReply(s); replyRef.current?.focus() }} className="block w-full rounded-md border border-violet-500/20 bg-violet-500/5 px-2 py-1.5 text-left text-slate-200 hover:border-violet-400/40">
                          {s}
                        </button>
                      ))}
                      {assist.knowledge.length > 0 && <p className="text-slate-500">Grounded in: {assist.knowledge.map((k) => k.title).join(' · ')}</p>}
                      {assist.withheld > 0 && <p className="text-amber-400">{assist.withheld} draft{assist.withheld === 1 ? ' was' : 's were'} withheld by the guardrail.</p>}
                    </div>
                  ) : assist ? (
                    <p className={assist.status === 'ESCALATE' ? 'text-amber-300' : 'text-slate-400'}>
                      <span className="font-semibold">{assist.status === 'ESCALATE' ? 'Needs a person: ' : assist.status === 'NOT_CONFIGURED' ? 'AI not configured: ' : 'AI unavailable: '}</span>
                      {assist.reason}
                    </p>
                  ) : null}
                  {!assistLoading && <button type="button" onClick={() => setAssist(null)} className="mt-1 text-slate-500 underline">Dismiss</button>}
                </div>
              )}

              {/* composer */}
              <footer className="border-t border-slate-800 p-3">
                <div className="mb-2 flex items-center gap-1">
                  <button type="button" onClick={() => setComposerMode('reply')} aria-pressed={composerMode === 'reply'} className={`rounded-md px-2.5 py-1 text-xs font-medium ${composerMode === 'reply' ? 'bg-[#009FE3]/20 text-sky-200' : 'text-slate-400 hover:text-slate-200'}`}>
                    Reply to visitor
                  </button>
                  <button type="button" onClick={() => setComposerMode('note')} aria-pressed={composerMode === 'note'} className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${composerMode === 'note' ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400 hover:text-slate-200'}`}>
                    <StickyNote className="size-3.5" aria-hidden="true" /> Internal note
                  </button>
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="outline" size="sm" className={OUTLINE_BTN} onClick={() => void requestSuggestions()} disabled={assistLoading || !canReply}>
                      <Sparkles className="size-3.5" aria-hidden="true" /> Suggest replies
                    </Button>
                  </div>
                </div>
                {composerMode === 'note' || canReply ? (
                  <>
                    {pendingAttachment && composerMode === 'reply' && (
                      <p className="mb-2 flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-slate-300">
                        <Paperclip className="size-3.5" aria-hidden="true" /> {pendingAttachment.name} ({fmtBytes(pendingAttachment.size)})
                        <button type="button" className="ml-auto text-slate-500 underline" onClick={() => setPendingAttachment(null)}>Remove</button>
                      </p>
                    )}
                    <div className="flex items-end gap-2">
                      {composerMode === 'reply' && (
                        <>
                          <input ref={fileRef} type="file" className="sr-only" tabIndex={-1} aria-hidden="true" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAttachment(f) }} />
                          <Button type="button" variant="outline" size="sm" className={`${OUTLINE_BTN} h-10`} onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Attach a file">
                            {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Paperclip className="size-4" aria-hidden="true" />}
                          </Button>
                        </>
                      )}
                      <label htmlFor="chat-admin-reply" className="sr-only">{composerMode === 'note' ? 'Internal note (team only)' : 'Reply to the visitor'}</label>
                      <textarea
                        id="chat-admin-reply"
                        ref={replyRef}
                        value={reply}
                        onChange={(e) => { setReply(e.target.value.slice(0, 4000)); sendTyping(e.target.value.trim().length > 0) }}
                        onBlur={() => sendTyping(false)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            void submitComposer()
                          }
                        }}
                        rows={2}
                        maxLength={4000}
                        placeholder={composerMode === 'note' ? 'Internal note — only your team can see this' : 'Write a reply — Enter to send, Shift+Enter for a new line'}
                        className={`max-h-32 min-h-10 flex-1 resize-none rounded-lg border px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-1 ${composerMode === 'note' ? 'border-amber-500/30 bg-amber-500/5 focus-visible:ring-amber-400/40' : 'border-slate-800 bg-slate-950/60 focus-visible:border-[#009FE3]/60 focus-visible:ring-[#009FE3]/40'}`}
                      />
                      <Button
                        type="button"
                        onClick={() => void submitComposer()}
                        disabled={sending || (reply.trim().length === 0 && !(composerMode === 'reply' && pendingAttachment))}
                        className="font-semibold text-white hover:opacity-95"
                        style={{ background: composerMode === 'note' ? '#B45309' : ACCENT }}
                        aria-label={composerMode === 'note' ? 'Save internal note' : 'Send reply'}
                      >
                        {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : composerMode === 'note' ? <StickyNote className="size-4" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                        {composerMode === 'note' ? 'Add note' : 'Send'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-500">
                    {selected.status !== 'OPEN' ? 'The visitor session is closed — reopen it to send another message.' : 'This conversation is resolved — reopen it to reply.'} Internal notes are still available.
                  </p>
                )}
              </footer>
            </>
          ) : null}
        </section>

        {/* ---------------- right: customer profile ---------------- */}
        {thread && selected && (
          <aside aria-label="Customer profile" className={`max-h-[calc(100vh-16rem)] space-y-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs lg:col-span-2 2xl:col-span-1 ${SCROLL_THIN}`}>
            <section>
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Triage</h3>
              <dl className="grid grid-cols-[90px,1fr] gap-x-2 gap-y-1 text-slate-300">
                <dt className="text-slate-500">Language</dt><dd>{selected.aiLanguage === 'bn' ? 'Bangla' : selected.aiLanguage === 'en' ? 'English' : selected.aiLanguage === 'mixed' ? 'Bangla + English' : '—'}</dd>
                <dt className="text-slate-500">Intent</dt><dd>{selected.aiIntent ? selected.aiIntent.toLowerCase().replace(/_/g, ' ') : '—'}</dd>
                <dt className="text-slate-500">Business</dt><dd>{selected.aiBusinessType ?? '—'}</dd>
                <dt className="text-slate-500">First reply</dt><dd>{selected.firstResponseAt ? fmtAgo(selected.firstResponseAt) : 'not yet'}</dd>
              </dl>
              <p className="mt-1 text-[10px] text-slate-600">Rules-based triage (keywords in Bangla and English) — not an AI judgement.</p>
              <button type="button" className="mt-1 text-sky-300 underline" disabled={Boolean(busyAction)} onClick={() => void runAction('triage', { action: 'triage' }, 'Triage refreshed.')}>Re-run triage</button>
            </section>
            {thread.crm ? (
              <>
                <section>
                  <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Customer</h3>
                  <p className="font-mono text-sm text-slate-100">{thread.crm.clientId}</p>
                  <p className="text-slate-300">{thread.crm.name ?? 'No name'}{thread.crm.businessName ? ` · ${thread.crm.businessName}` : ''}</p>
                  <p className="text-slate-500">{[thread.crm.email, thread.crm.phone, thread.crm.whatsapp].filter(Boolean).join(' · ') || 'No contact on file'}</p>
                  <p className="mt-1 text-slate-400">Stage <span className="text-slate-200">{thread.crm.pipelineStage.replace(/_/g, ' ')}</span> · {thread.crm.status} · source {thread.crm.source ?? '—'}</p>
                  {thread.crm.businessType && <p className="text-slate-400">Business type: {thread.crm.businessType}</p>}
                  {thread.crm.lead?.requirements && <p className="mt-1 line-clamp-4 text-slate-400">{thread.crm.lead.requirements}</p>}
                  {onOpenClient && <button type="button" onClick={() => onOpenClient(thread.crm!.rowId)} className="mt-1 inline-block text-sky-300 underline">Open CRM record</button>}
                </section>
                {thread.crm.projects.length > 0 && (
                  <section>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Projects</h3>
                    <ul className="space-y-0.5">{thread.crm.projects.map((p) => <li key={p.id} className="text-slate-300">{p.name} <span className="text-slate-500">· {p.status}</span></li>)}</ul>
                  </section>
                )}
                {thread.crm.conversations.length > 1 && (
                  <section>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Other conversations</h3>
                    <ul className="space-y-0.5">
                      {thread.crm.conversations.filter((c) => c.id !== selected.id).map((c) => (
                        <li key={c.id}><button type="button" className="text-left text-sky-300 underline" onClick={() => openConversation(c.id)}>{c.subject || 'Conversation'}</button> <span className="text-slate-500">· {c.inboxState} · {fmtAgo(c.lastMessageAt)}</span></li>
                      ))}
                    </ul>
                  </section>
                )}
                <section>
                  <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Activity timeline</h3>
                  {thread.crm.timeline.length === 0 ? <p className="text-slate-500">No recorded activity yet.</p> : (
                    <ol className="space-y-1.5 border-l border-slate-800 pl-3">
                      {thread.crm.timeline.map((t, i) => (
                        <li key={i}>
                          <p className="text-slate-300">{t.title}</p>
                          {t.detail && <p className="line-clamp-2 text-slate-500">{t.detail}</p>}
                          <p className="text-[10px] text-slate-600">{fmtAgo(t.at)}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </>
            ) : (
              <section>
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Customer</h3>
                <p className="text-slate-400">This visitor is not linked to a CRM record yet. Convert the conversation to create or safely match a lead.</p>
                {duplicates && (
                  <div className="mt-2 space-y-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-2" role="alert">
                    <p className="font-semibold text-amber-300">Possible existing customer</p>
                    <p className="text-slate-400">The visitor&apos;s typed contact details match these records. Typed details are not verified — confirm before linking.</p>
                    <ul className="space-y-1">
                      {duplicates.map((c) => (
                        <li key={c.rowId} className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950/50 px-2 py-1">
                          <span className="min-w-0">
                            <span className="block font-mono text-slate-200">{c.clientId}</span>
                            <span className="block truncate text-slate-500">{c.name ?? 'No name'}{c.businessName ? ` · ${c.businessName}` : ''} · {c.status} · matched on {c.matchedOn.join(' + ') || 'contact'}</span>
                          </span>
                          <Button size="sm" variant="outline" className={OUTLINE_BTN} disabled={Boolean(busyAction)} onClick={() => void linkToClient(c)}>Link</Button>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className={OUTLINE_BTN} disabled={Boolean(busyAction)} onClick={() => void convertToLead(true)}>Create separate lead</Button>
                      <button type="button" className="text-slate-500 underline" onClick={() => setDuplicates(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
