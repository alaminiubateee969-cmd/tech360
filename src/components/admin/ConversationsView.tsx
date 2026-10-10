'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  UserPlus,
  XCircle,
} from 'lucide-react'

import { fetchJson, useApi } from '@/lib/admin-client'
import { EmptyState, PageHeader } from './shared/cards'
import { ACCENT, SCROLL_THIN } from './shared/styles'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

// ============================================================
// TECH360 — Live Chat console (public ChatWidget conversations)
// Open/Closed tabs with live counts, searchable list, full
// thread pane with reply, close/reopen and convert-to-lead.
// ============================================================

type ConversationRow = {
  id: string
  anonId: string
  status: 'OPEN' | 'CLOSED'
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
  lastAgentEmail: string | null
}

type ConversationsResponse = {
  conversations: ConversationRow[]
  counts: { OPEN: number; CLOSED: number }
}

type ThreadMessage = {
  id: string
  sender: 'VISITOR' | 'ADMIN' | 'SYSTEM'
  body: string
  agentEmail: string | null
  createdAt: string
}

type ThreadResponse = {
  conversation: ConversationRow
  messages: ThreadMessage[]
}

function fmtAgo(iso: string): string {
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

function visitorLabel(c: ConversationRow): string {
  return c.visitorName || 'Anonymous visitor'
}

export function ConversationsView() {
  // ---------------- list state ----------------
  const [statusTab, setStatusTab] = useState<'OPEN' | 'CLOSED'>('OPEN')
  const [search, setSearch] = useState('')
  const listUrl = `/api/admin/conversations?status=${statusTab}`
  const { data, loading, error, refresh } = useApi<ConversationsResponse>(listUrl)
  const conversations = data?.conversations ?? []
  const counts = data?.counts ?? { OPEN: 0, CLOSED: 0 }

  // 15s list polling — live updates while the console is open
  useEffect(() => {
    const t = window.setInterval(() => refresh(), 15_000)
    return () => window.clearInterval(t)
  }, [refresh])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) =>
      [c.visitorName, c.visitorEmail, c.lastMessagePreview, c.subject].some(
        (f) => f && f.toLowerCase().includes(q),
      ),
    )
  }, [conversations, search])

  // ---------------- thread state ----------------
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [thread, setThread] = useState<ThreadResponse | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)
  const [converting, setConverting] = useState(false)
  const threadScrollRef = useRef<HTMLDivElement>(null)
  const replyRef = useRef<HTMLTextAreaElement>(null)

  const loadThread = useCallback(async (id: string) => {
    setSelectedId(id)
    setThreadLoading(true)
    setThreadError(null)
    setThread(null)
    try {
      const res = await fetchJson<ThreadResponse>(`/api/admin/conversations/${encodeURIComponent(id)}`)
      setThread(res)
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : 'Could not load the conversation.')
    } finally {
      setThreadLoading(false)
    }
  }, [])

  // opening a thread clears its unread flag server-side — refresh the list
  const openConversation = useCallback(
    (id: string) => {
      if (id === selectedId) return
      setReply('')
      void loadThread(id).then(() => refresh())
    },
    [selectedId, loadThread, refresh],
  )

  // keep the thread pinned to the bottom as messages arrive
  useEffect(() => {
    const el = threadScrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight })
  }, [thread?.messages.length, thread?.conversation.id])

  // ---------------- actions ----------------
  const sendReply = useCallback(async () => {
    if (!selectedId || sending) return
    const body = reply.trim()
    if (!body) return
    setSending(true)
    try {
      const res = await fetchJson<{ ok?: boolean; message?: ThreadMessage; error?: string }>(
        `/api/admin/conversations/${encodeURIComponent(selectedId)}`,
        { method: 'POST', body: { action: 'reply', body } },
      )
      setReply('')
      if (res.message) {
        setThread((prev) =>
          prev ? { ...prev, messages: [...prev.messages, res.message as ThreadMessage] } : prev,
        )
      }
      refresh()
      replyRef.current?.focus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reply failed — try again.')
    } finally {
      setSending(false)
    }
  }, [selectedId, sending, reply, refresh])

  const toggleStatus = useCallback(async () => {
    if (!selectedId || closing) return
    const action = thread?.conversation.status === 'OPEN' ? 'close' : 'reopen'
    setClosing(true)
    try {
      await fetchJson(`/api/admin/conversations/${encodeURIComponent(selectedId)}`, {
        method: 'POST',
        body: { action },
      })
      toast.success(action === 'close' ? 'Conversation closed.' : 'Conversation reopened.')
      await loadThread(selectedId)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed — try again.')
    } finally {
      setClosing(false)
    }
  }, [selectedId, closing, thread?.conversation.status, loadThread, refresh])

  const convertToLead = useCallback(async () => {
    if (!selectedId || converting) return
    setConverting(true)
    try {
      const res = await fetchJson<{ ok?: boolean; clientId?: string }>(
        `/api/admin/conversations/${encodeURIComponent(selectedId)}`,
        { method: 'POST', body: { action: 'convert-to-lead' } },
      )
      if (res.clientId) {
        toast.success(`Lead ${res.clientId} created from this conversation.`)
      } else {
        toast.success('Lead created from this conversation.')
      }
      await loadThread(selectedId)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Conversion failed — try again.')
    } finally {
      setConverting(false)
    }
  }, [selectedId, converting, loadThread, refresh])

  // ---------------- render ----------------
  const selected = thread?.conversation ?? null

  return (
    <div>
      <PageHeader
        title="Live Chat"
        description="Website chat conversations — a real person replies during business hours."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
            aria-label="Refresh conversations"
          >
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
          </Button>
        }
      />

      {/* status tabs + search */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Conversation status" className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
          {(['OPEN', 'CLOSED'] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              type="button"
              aria-selected={statusTab === tab}
              onClick={() => {
                setStatusTab(tab)
                setSelectedId(null)
                setThread(null)
              }}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                statusTab === tab ? 'bg-[#009FE3] text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              {tab === 'OPEN' ? 'Open' : 'Closed'}
              <span
                className={`rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
                  statusTab === tab ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {counts[tab]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <label htmlFor="chat-search" className="sr-only">Search conversations</label>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            id="chat-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search visitor, email or message…"
            className="h-9 w-full rounded-md border border-slate-800 bg-slate-950/60 pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:border-[#009FE3]/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#009FE3]/40"
          />
        </div>
      </div>

      {error ? (
        <div role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Could not load conversations: {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px,1fr]">
        {/* ---------------- left: conversation list ---------------- */}
        <section aria-label="Conversation list" className="flex max-h-[calc(100vh-16rem)] flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60">
          <div className="flex-1 overflow-y-auto p-2">
            {loading && conversations.length === 0 ? (
              <div className="space-y-2 p-1" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-800/60" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title={search ? 'No matches' : statusTab === 'OPEN' ? 'No open conversations' : 'No closed conversations'}
                description={
                  search
                    ? 'Nothing matches this search — try a different name, email or keyword.'
                    : 'New website chat conversations appear here the moment a visitor starts one.'
                }
              />
            ) : (
              <ul className="space-y-1.5" role="list" aria-label={`${statusTab === 'OPEN' ? 'Open' : 'Closed'} conversations`}>
                {filtered.map((c) => {
                  const active = c.id === selectedId
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => openConversation(c.id)}
                        aria-current={active ? 'true' : undefined}
                        aria-label={`Conversation with ${visitorLabel(c)}${c.subject ? ` about ${c.subject}` : ''}, ${c.messageCount} messages, last activity ${fmtAgo(c.lastMessageAt)}${c.status === 'OPEN' && c.lastSender === 'VISITOR' ? ', waiting on a reply' : ''}`}
                        className={`w-full rounded-lg border p-2.5 text-left transition ${
                          active
                            ? 'border-[#009FE3]/50 bg-[#009FE3]/10'
                            : 'border-transparent bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            title={c.status === 'OPEN' ? 'Open' : 'Closed'}
                            className={`size-2 shrink-0 rounded-full ${c.status === 'OPEN' ? 'bg-emerald-400' : 'bg-slate-600'}`}
                          />
                          <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">{visitorLabel(c)}</p>
                          {c.status === 'OPEN' && c.lastSender === 'VISITOR' && (
                            <span
                              title="The visitor has the last word — this thread is waiting on a reply"
                              className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400"
                            >
                              needs reply
                            </span>
                          )}
                          {c.unreadCount > 0 && (
                            <span
                              className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400"
                              title={`${c.unreadCount} unread visitor message${c.unreadCount === 1 ? '' : 's'}`}
                            >
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                        {c.visitorEmail ? (
                          <p className="mt-0.5 truncate text-xs text-slate-500">{c.visitorEmail}</p>
                        ) : null}
                        {c.subject ? (
                          <p className="mt-1 truncate text-xs font-medium text-slate-400">{c.subject}</p>
                        ) : null}
                        <p className="mt-0.5 truncate text-xs text-slate-500">{c.lastMessagePreview || 'No messages yet'}</p>
                        <p className="mt-1 text-[10px] text-slate-600">
                          {fmtAgo(c.lastMessageAt)} · {c.messageCount} message{c.messageCount === 1 ? '' : 's'}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ---------------- right: thread pane ---------------- */}
        <section aria-label="Conversation thread" className="flex max-h-[calc(100vh-16rem)] min-h-125 flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60">
          {!selectedId ? (
            <EmptyState
              icon={MessageSquare}
              title="Select a conversation"
              description="Pick a conversation on the left to read the thread, reply, or convert the visitor into a lead."
              className="flex-1"
            />
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
            <div role="alert" className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              {threadError}
            </div>
          ) : thread ? (
            <>
              {/* thread header */}
              <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-slate-100">{visitorLabel(thread.conversation)}</h2>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        thread.conversation.status === 'OPEN'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : 'border-slate-700 bg-slate-800 text-slate-400'
                      }`}
                    >
                      {thread.conversation.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {[thread.conversation.visitorEmail, thread.conversation.visitorPhone]
                      .filter(Boolean)
                      .join(' · ') || 'No contact details shared'}
                    {thread.conversation.subject ? ` — ${thread.conversation.subject}` : ''}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-600">
                    Started {fmtAgo(thread.conversation.createdAt)} · {thread.conversation.messageCount} messages
                    {thread.conversation.lastAgentEmail ? ` · last reply by ${thread.conversation.lastAgentEmail}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void toggleStatus()}
                    disabled={closing}
                    className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
                    aria-label={thread.conversation.status === 'OPEN' ? 'Close this conversation' : 'Reopen this conversation'}
                  >
                    {closing ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : thread.conversation.status === 'OPEN' ? (
                      <XCircle className="size-4" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                    )}
                    {thread.conversation.status === 'OPEN' ? 'Close' : 'Reopen'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void convertToLead()}
                    disabled={converting}
                    className="font-semibold text-white hover:opacity-95"
                    style={{ background: ACCENT }}
                    aria-label="Convert this conversation to a lead"
                  >
                    {converting ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <UserPlus className="size-4" aria-hidden="true" />
                    )}
                    Convert to lead
                  </Button>
                </div>
              </header>

              {/* messages */}
              <div
                ref={threadScrollRef}
                role="log"
                aria-live="polite"
                aria-label="Conversation messages"
                className={`flex-1 space-y-3 overflow-y-auto p-4 ${SCROLL_THIN}`}
              >
                {thread.messages.length === 0 ? (
                  <EmptyState icon={MessageSquare} title="No messages yet" description="The visitor started this conversation but hasn't said anything yet." />
                ) : (
                  thread.messages.map((m) => {
                    if (m.sender === 'SYSTEM') {
                      return (
                        <p key={m.id} className="text-center text-[11px] italic text-slate-600">
                          {m.body} · {fmtAgo(m.createdAt)}
                        </p>
                      )
                    }
                    const fromVisitor = m.sender === 'VISITOR'
                    return (
                      <div key={m.id} className={`flex flex-col ${fromVisitor ? 'items-start' : 'items-end'}`}>
                        <div
                          title={new Date(m.createdAt).toLocaleString()}
                          className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                            fromVisitor
                              ? 'rounded-bl-md border border-slate-700 bg-slate-800/70 text-slate-200'
                              : 'rounded-br-md border border-[#009FE3]/30 bg-[#009FE3]/10 text-slate-100'
                          }`}
                        >
                          {m.body}
                        </div>
                        <span className="mt-0.5 px-1 text-[10px] text-slate-600">
                          {fromVisitor
                            ? `${visitorLabel(thread.conversation)} · ${fmtAgo(m.createdAt)}`
                            : `TECH360${m.agentEmail ? ` — ${m.agentEmail}` : ''} · ${fmtAgo(m.createdAt)}`}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>

              {/* reply composer */}
              <footer className="border-t border-slate-800 p-3">
                {thread.conversation.status === 'OPEN' ? (
                  <div className="flex items-end gap-2">
                    <label htmlFor="chat-admin-reply" className="sr-only">Reply to the visitor</label>
                    <textarea
                      id="chat-admin-reply"
                      ref={replyRef}
                      value={reply}
                      onChange={(e) => setReply(e.target.value.slice(0, 4000))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          void sendReply()
                        }
                      }}
                      rows={2}
                      maxLength={4000}
                      placeholder="Write a reply — Enter to send, Shift+Enter for a new line"
                      className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:border-[#009FE3]/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#009FE3]/40"
                    />
                    <Button
                      type="button"
                      onClick={() => void sendReply()}
                      disabled={sending || reply.trim().length === 0}
                      className="font-semibold text-white hover:opacity-95"
                      style={{ background: ACCENT }}
                      aria-label="Send reply"
                    >
                      {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                      Send
                    </Button>
                  </div>
                ) : (
                  <p className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-500">
                    This conversation is closed — reopen it to send another message, or convert it to a lead.
                  </p>
                )}
              </footer>
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}
