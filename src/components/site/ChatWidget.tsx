'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, MessageCircle, Send, X } from 'lucide-react'

// ============================================================
// TECH360 — public live chat widget (Chatwoot parity, self-hosted)
// - Floating bubble bottom-right, brand gradient
// - Hidden on #/admin and #/portal hash routes
// - Anonymous visitor identity in localStorage (t360_chat_anid)
// - Polls: 5s thread polling while open, 30s badge polling while closed
// - Honest states: connection issues are shown, never faked replies
// ============================================================

const ANON_KEY = 't360_chat_anid'
const SEEN_KEY = 't360_chat_seen'
const MAX_BODY = 2000

type ChatMsg = {
  id: string
  sender: 'VISITOR' | 'ADMIN' | 'SYSTEM'
  body: string
  agentEmail?: string | null
  createdAt: string
}

type ConversationState = {
  id: string
  status: 'OPEN' | 'CLOSED'
  visitorName?: string | null
} | null

// ------------------------------------------------------------
// Anonymous visitor identity
// ------------------------------------------------------------
function getAnonId(): string {
  try {
    const existing = localStorage.getItem(ANON_KEY)
    if (existing) return existing
    const fresh =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(ANON_KEY, fresh)
    return fresh
  } catch {
    return `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

function readSeenId(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

function writeSeenId(id: string | null) {
  try {
    if (id) localStorage.setItem(SEEN_KEY, id)
  } catch { /* private mode — ignore */ }
}

// ------------------------------------------------------------
// Hide the widget on the admin console / client portal hash routes
// ------------------------------------------------------------
function isHashRouteHidden(): boolean {
  if (typeof window === 'undefined') return true
  const hash = window.location.hash || ''
  return hash.startsWith('#/admin') || hash.startsWith('#/portal')
}

// Analytics — fire and forget; must never break the chat.
function trackChatOpen(anonId: string) {
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'chat_open',
        path: window.location.hash || '#/',
        anonId: localStorage.getItem('t360_anid') || anonId,
        consent: localStorage.getItem('t360_consent') === 'granted',
        meta: { source: 'chat_widget' },
      }),
      keepalive: true,
    }).catch(() => null)
  } catch { /* analytics must never break the chat */ }
}

// ------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------
function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

// unseen = admin/system messages after the last seen message id
function countUnseen(messages: ChatMsg[], seenId: string | null): number {
  if (!seenId) return messages.filter((m) => m.sender !== 'VISITOR').length
  const idx = messages.findIndex((m) => m.id === seenId)
  const tail = idx >= 0 ? messages.slice(idx + 1) : messages
  return tail.filter((m) => m.sender !== 'VISITOR').length
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// ============================================================
// Widget
// ============================================================
export default function ChatWidget() {
  const [mounted, setMounted] = useState(false)
  const [hidden, setHidden] = useState(true)
  const [open, setOpen] = useState(false)

  const [conversation, setConversation] = useState<ConversationState>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [seenId, setSeenId] = useState<string | null>(null)
  const [badgeCount, setBadgeCount] = useState(0)
  const [connIssue, setConnIssue] = useState(false)
  const [busy, setBusy] = useState(false) // sending a message / starting a chat

  // first-contact form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [initialMsg, setInitialMsg] = useState('')

  // composer
  const [draft, setDraft] = useState('')

  const anonIdRef = useRef<string>('')
  const messagesRef = useRef<ChatMsg[]>([])
  const seenIdRef = useRef<string | null>(null)
  const conversationRef = useRef<ConversationState>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const bubbleRef = useRef<HTMLButtonElement>(null)

  messagesRef.current = messages
  seenIdRef.current = seenId
  conversationRef.current = conversation

  // ---------------- mount + hash-route visibility ----------------
  useEffect(() => {
    setMounted(true)
    anonIdRef.current = getAnonId()
    setSeenId(readSeenId())
    setHidden(isHashRouteHidden())
    const onHash = () => {
      const nowHidden = isHashRouteHidden()
      setHidden(nowHidden)
      if (nowHidden) setOpen(false)
    }
    window.addEventListener('hashchange', onHash)
    // External "AI assistant" CTAs (AIAssistantLink and header chips) open the
    // chat through this event — the AI agent is the site's contact channel.
    const onOpenChat = () => {
      if (!isHashRouteHidden()) setOpen(true)
    }
    window.addEventListener('tech360:open-chat', onOpenChat)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('tech360:open-chat', onOpenChat)
    }
  }, [])

  // ---------------- thread fetch ----------------
  const fetchThread = useCallback(async (after: string | null): Promise<{
    conversation: ConversationState
    messages: ChatMsg[]
    latestId: string | null
  } | null> => {
    const params = new URLSearchParams({ anonId: anonIdRef.current })
    if (after) params.set('after', after)
    const res = await fetch(`/api/chat/messages?${params.toString()}`)
    if (!res.ok) throw new Error('poll failed')
    const data = (await res.json()) as {
      conversation: { id: string; status: string; visitorName?: string | null } | null
      messages: ChatMsg[]
      latestId: string | null
    }
    return {
      conversation: data.conversation
        ? { id: data.conversation.id, status: data.conversation.status as 'OPEN' | 'CLOSED', visitorName: data.conversation.visitorName }
        : null,
      messages: data.messages ?? [],
      latestId: data.latestId ?? null,
    }
  }, [])

  // ---------------- badge poll (panel closed) ----------------
  const badgePoll = useCallback(async () => {
    try {
      const data = await fetchThread(null)
      if (!data) return
      setConversation(data.conversation)
      setMessages(data.messages)
      const unseen = countUnseen(data.messages, seenIdRef.current)
      setBadgeCount(unseen)
      setConnIssue(false)
    } catch {
      // honest: keep the last known state, flag nothing while closed
      // (the badge simply stops updating until the next poll succeeds)
    }
  }, [fetchThread])

  // ---------------- thread poll (panel open) ----------------
  const threadPoll = useCallback(async () => {
    const list = messagesRef.current
    const after = list.length > 0 ? list[list.length - 1].id : null
    try {
      const data = await fetchThread(after)
      if (!data) return
      setConversation(data.conversation)
      if (data.messages.length > 0 || !after) {
        // full sync on first load (no `after`), append on incremental polls
        const next = after ? [...list, ...data.messages] : data.messages
        setMessages(next)
      }
      // visitor is looking at the thread — mark everything seen
      const latest = data.latestId ?? seenIdRef.current
      if (latest && latest !== seenIdRef.current) {
        setSeenId(latest)
        writeSeenId(latest)
      }
      setBadgeCount(0)
      setConnIssue(false)
    } catch {
      setConnIssue(true)
    }
  }, [fetchThread])

  // initial fetch once visible (mounted + not on admin/portal)
  useEffect(() => {
    if (!mounted || hidden) return
    void badgePoll()
  }, [mounted, hidden, badgePoll])

  // polling: 5s while open, 30s while closed
  useEffect(() => {
    if (!mounted || hidden) return
    const interval = open ? 5_000 : 30_000
    const t = window.setInterval(() => {
      if (open) void threadPoll()
      else void badgePoll()
    }, interval)
    return () => window.clearInterval(t)
  }, [mounted, hidden, open, threadPoll, badgePoll])

  // keep the thread pinned to the bottom when new messages arrive
  useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  // ---------------- panel open / close ----------------
  const openPanel = useCallback(() => {
    setOpen(true)
    setBadgeCount(0)
    trackChatOpen(anonIdRef.current)
    // sync immediately, then mark seen + focus once data lands
    void (async () => {
      try {
        const data = await fetchThread(null)
        if (!data) return
        setConversation(data.conversation)
        setMessages(data.messages)
        if (data.latestId) {
          setSeenId(data.latestId)
          writeSeenId(data.latestId)
        }
        setConnIssue(false)
      } catch {
        setConnIssue(true)
      }
    })()
  }, [fetchThread])

  const closePanel = useCallback(() => {
    setOpen(false)
    // return focus to the launcher for keyboard users
    requestAnimationFrame(() => bubbleRef.current?.focus())
  }, [])

  // Escape closes the panel; focus trap keeps Tab inside it
  const onPanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closePanel()
      return
    }
    if (e.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null,
    )
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  // focus the composer when the thread is open (after data settles)
  useEffect(() => {
    if (open && conversation?.status === 'OPEN') composerRef.current?.focus()
  }, [open, conversation?.status, conversation?.id])

  // ---------------- composer auto-grow (max 4 rows) ----------------
  const autoGrow = () => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 88)}px`
  }

  // ---------------- actions ----------------
  const startConversation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const trimmedName = name.trim()
    const trimmedMsg = initialMsg.trim()
    if (trimmedName.length < 1) return
    if (trimmedMsg.length < 1) return
    setBusy(true)
    setConnIssue(false)
    try {
      const res = await fetch('/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anonId: anonIdRef.current,
          name: trimmedName,
          email: email.trim() || undefined,
          subject: subject.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? 'Could not start the chat.')
      }
      const data = (await res.json()) as { conversation: { id: string; status: string } }
      setConversation({ id: data.conversation.id, status: 'OPEN', visitorName: trimmedName })
      setMessages([])
      if (trimmedMsg) {
        const mres = await fetch('/api/chat/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anonId: anonIdRef.current, body: trimmedMsg }),
        })
        if (!mres.ok) throw new Error('Could not send the first message.')
        const mdata = (await mres.json()) as { message: ChatMsg }
        setMessages([mdata.message])
        if (mdata.message.id) {
          setSeenId(mdata.message.id)
          writeSeenId(mdata.message.id)
        }
      }
      setInitialMsg('')
      setSubject('')
      requestAnimationFrame(() => composerRef.current?.focus())
    } catch {
      setConnIssue(true)
    } finally {
      setBusy(false)
    }
  }

  const sendMessage = async () => {
    if (busy) return
    const trimmed = draft.trim()
    if (trimmed.length < 1 || trimmed.length > MAX_BODY) return
    setBusy(true)
    setConnIssue(false)
    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonId: anonIdRef.current, body: trimmed }),
      })
      if (!res.ok) throw new Error('send failed')
      const data = (await res.json()) as { message: ChatMsg }
      const next = [...messagesRef.current, data.message]
      setMessages(next)
      setDraft('')
      if (composerRef.current) composerRef.current.style.height = 'auto'
      if (data.message.id) {
        setSeenId(data.message.id)
        writeSeenId(data.message.id)
      }
    } catch {
      setConnIssue(true)
    } finally {
      setBusy(false)
    }
  }

  const restartConversation = async () => {
    if (busy) return
    setBusy(true)
    setConnIssue(false)
    try {
      const res = await fetch('/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anonId: anonIdRef.current,
          name: conversationRef.current?.visitorName || name || 'Visitor',
          email: email.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error('could not restart')
      const data = (await res.json()) as { conversation: { id: string; status: string } }
      setConversation({ id: data.conversation.id, status: 'OPEN', visitorName: conversationRef.current?.visitorName ?? name })
      setMessages([])
      requestAnimationFrame(() => composerRef.current?.focus())
    } catch {
      setConnIssue(true)
    } finally {
      setBusy(false)
    }
  }

  // ---------------- render ----------------
  if (!mounted || hidden) return null

  const isOpen = conversation?.status === 'OPEN'
  const showThread = conversation !== null && isOpen
  const showClosed = conversation !== null && conversation.status === 'CLOSED'
  const charCount = draft.length

  return (
    <>
      {/* ---------------- launcher bubble ---------------- */}
      <button
        ref={bubbleRef}
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        aria-label="Chat with TECH360"
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full text-white shadow-xl shadow-[#063B8F]/30 transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#009FE3]/40 print:hidden"
        style={{ background: 'linear-gradient(135deg, #009FE3 0%, #063B8F 100%)' }}
      >
        {open ? <X className="size-6" aria-hidden="true" /> : <MessageCircle className="size-6" aria-hidden="true" />}
        {!open && badgeCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EF4444] px-1 text-[11px] font-bold text-white shadow"
          >
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {/* ---------------- chat panel ---------------- */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label="TECH360 support chat"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onKeyDown={onPanelKeyDown}
            className="fixed bottom-[5.75rem] right-5 z-50 flex h-[520px] max-h-[75vh] w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl print:hidden"
          >
            {/* header */}
            <div
              className="flex items-center gap-3 px-4 py-3 text-white"
              style={{ background: 'linear-gradient(135deg, #009FE3 0%, #063B8F 100%)' }}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15" aria-hidden="true">
                <span className="size-2.5 rounded-full bg-white" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">TECH360 Support</p>
                <p className="mt-0.5 text-[11px] leading-tight text-white/85">
                  AI agents answer instantly — engineers step in when needed
                </p>
              </div>
              <button
                type="button"
                onClick={closePanel}
                aria-label="Close chat"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/85 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {/* ---------------- first-contact form ---------------- */}
            {!showThread && !showClosed && (
              <form onSubmit={startConversation} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
                <p className="text-sm text-slate-600">
                  Hi there 👋 Tell us a little about you and what you need — we&apos;ll get back to you during business
                  hours.
                </p>
                <div className="space-y-1">
                  <label htmlFor="chat-name" className="text-xs font-medium text-slate-700">
                    Name <span className="text-[#EF4444]" aria-hidden="true">*</span>
                    <span className="sr-only">(required)</span>
                  </label>
                  <input
                    id="chat-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={80}
                    autoComplete="name"
                    placeholder="Your name"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#009FE3] focus:outline-none focus:ring-2 focus:ring-[#009FE3]/30"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="chat-email" className="text-xs font-medium text-slate-700">
                    Email <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="chat-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={320}
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#009FE3] focus:outline-none focus:ring-2 focus:ring-[#009FE3]/30"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="chat-subject" className="text-xs font-medium text-slate-700">
                    Subject <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="chat-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={120}
                    placeholder="e.g. Website redesign question"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#009FE3] focus:outline-none focus:ring-2 focus:ring-[#009FE3]/30"
                  />
                </div>
                <div className="flex flex-1 flex-col space-y-1">
                  <label htmlFor="chat-initial" className="text-xs font-medium text-slate-700">
                    Message <span className="text-[#EF4444]" aria-hidden="true">*</span>
                    <span className="sr-only">(required)</span>
                  </label>
                  <textarea
                    id="chat-initial"
                    value={initialMsg}
                    onChange={(e) => setInitialMsg(e.target.value)}
                    required
                    rows={4}
                    maxLength={MAX_BODY}
                    placeholder="How can we help?"
                    className="min-h-24 flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#009FE3] focus:outline-none focus:ring-2 focus:ring-[#009FE3]/30"
                  />
                </div>
                {connIssue && (
                  <p role="status" className="text-xs text-amber-700">
                    Connection issue — retrying. Your message has not been sent yet.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white shadow transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]/50 focus-visible:ring-offset-2 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #009FE3 0%, #063B8F 100%)' }}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                  Start chat
                </button>
              </form>
            )}

            {/* ---------------- closed conversation ---------------- */}
            {showClosed && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
                  This conversation was closed by our team.
                </p>
                {connIssue && (
                  <p role="status" className="text-xs text-amber-700">
                    Connection issue — retrying.
                  </p>
                )}
                <button
                  type="button"
                  onClick={restartConversation}
                  disabled={busy}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-white shadow transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]/50 focus-visible:ring-offset-2 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #009FE3 0%, #063B8F 100%)' }}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  Start a new conversation
                </button>
              </div>
            )}

            {/* ---------------- open thread ---------------- */}
            {showThread && (
              <>
                <div
                  ref={listRef}
                  role="log"
                  aria-live="polite"
                  aria-label="Chat messages"
                  className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4"
                >
                  {messages.length === 0 && (
                    <p className="py-8 text-center text-xs text-slate-400">
                      Sending your message to the TECH360 team…
                    </p>
                  )}
                  {messages.map((m) => {
                    if (m.sender === 'SYSTEM') {
                      return (
                        <p key={m.id} className="text-center text-xs italic text-slate-500">
                          {m.body}
                        </p>
                      )
                    }
                    const mine = m.sender === 'VISITOR'
                    return (
                      <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                        <div
                          title={new Date(m.createdAt).toLocaleString()}
                          className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                            mine
                              ? 'rounded-br-md border border-[#009FE3]/30 bg-[#009FE3]/10 text-slate-900'
                              : 'rounded-bl-md border border-slate-200 bg-white text-slate-900'
                          }`}
                        >
                          {m.body}
                        </div>
                        <span className="mt-0.5 px-1 text-[10px] text-slate-400">
                          {mine ? 'You' : 'TECH360'} · {fmtTime(m.createdAt)}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {connIssue && (
                  <p role="status" className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-700">
                    Connection issue — retrying. Your last message may not have been sent.
                  </p>
                )}

                {/* composer */}
                <div className="border-t border-slate-200 bg-white p-3">
                  <div className="flex items-end gap-2">
                    <label htmlFor="chat-composer" className="sr-only">
                      Type your message
                    </label>
                    <textarea
                      id="chat-composer"
                      ref={composerRef}
                      value={draft}
                      onChange={(e) => {
                        setDraft(e.target.value.slice(0, MAX_BODY))
                        autoGrow()
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          void sendMessage()
                        }
                      }}
                      rows={1}
                      maxLength={MAX_BODY}
                      placeholder="Type your message…"
                      className="max-h-22 min-h-10 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#009FE3] focus:outline-none focus:ring-2 focus:ring-[#009FE3]/30"
                    />
                    <button
                      type="button"
                      onClick={() => void sendMessage()}
                      disabled={busy || draft.trim().length === 0}
                      aria-label="Send message"
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]/50 focus-visible:ring-offset-2 disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg, #009FE3 0%, #063B8F 100%)' }}
                    >
                      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                    </button>
                  </div>
                  <div className="mt-1 flex items-center justify-between px-1">
                    <p className="text-[10px] text-slate-400">Enter to send · Shift+Enter for a new line</p>
                    {charCount > MAX_BODY - 200 && (
                      <p className="text-[10px] tabular-nums text-slate-400" aria-live="polite">
                        {charCount}/{MAX_BODY}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
