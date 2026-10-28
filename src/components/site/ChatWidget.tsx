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
function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

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
  const [aiStatus, setAiStatus] = useState<'checking' | 'ready' | 'unavailable' | 'unknown'>('checking')
  const [aiError, setAiError] = useState<string | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)

  // first-contact form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [preferredContact, setPreferredContact] = useState<'SMS' | 'Email'>('SMS')
  const [contactConsent, setContactConsent] = useState(false)
  const [subject, setSubject] = useState('')
  const [initialMsg, setInitialMsg] = useState('')

  // composer
  const [draft, setDraft] = useState('')

  const anonIdRef = useRef<string>('')
  const messagesRef = useRef<ChatMsg[]>([])
  const seenIdRef = useRef<string | null>(null)
  const conversationRef = useRef<ConversationState>(null)
  const startRequestIdRef = useRef<string | null>(null)
  const messageRequestIdRef = useRef<string | null>(null)
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
    // External "Live Support" CTAs (AIAssistantLink and header chips) open the
    // chat through this event — live chat is the site's contact channel.
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
    const trimmedEmail = email.trim()
    const trimmedMsg = initialMsg.trim()
    if (trimmedMsg.length < 1 || (preferredContact === 'Email' && !trimmedEmail) || !contactConsent || (preferredContact === 'SMS' && !phone.trim())) return
    startRequestIdRef.current ??= newRequestId()
    setBusy(true)
    setConnIssue(false)
    setSessionError(null)
    setDeliveryNotice(null)
    setAiError(null)
    try {
      const res = await fetch('/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anonId: anonIdRef.current,
          requestId: startRequestIdRef.current,
          name: trimmedName,
          email: trimmedEmail,
          phone: phone.trim() || undefined,
          preferredContact,
          subject: subject.trim() || undefined,
          message: trimmedMsg,
          contactConsent: true,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? 'Could not start the chat.')
      }
      const data = (await res.json()) as {
        conversation: { id: string; status: string; clientId?: string | null }
        ai?: { available: boolean; detail: string }
        identityReviewRequired?: boolean
        emailDeliveryStatus?: 'ACCEPTED_BY_PROVIDER' | 'NOT_CONFIRMED' | null
        contactDeliveryStatus?: { channel: string; status: string; ok: boolean } | null
        notice?: string
      }
      startRequestIdRef.current = null
      setConversation({ id: data.conversation.id, status: 'OPEN', visitorName: trimmedName })
      if (data.conversation.clientId) setClientId(data.conversation.clientId)
      if (data.contactDeliveryStatus) {
        setDeliveryNotice(data.contactDeliveryStatus.ok
          ? `Your first ${data.contactDeliveryStatus.channel} reply was accepted by the configured provider; final delivery is not confirmed.`
          : `Your enquiry is saved, but the first ${data.contactDeliveryStatus.channel} message was not accepted by the provider. Continue here in webchat; our team will review it.`)
      } else if (data.emailDeliveryStatus === 'ACCEPTED_BY_PROVIDER') {
        setDeliveryNotice('The initial email was accepted by the configured mail service; delivery to the inbox is not confirmed.')
      } else if (data.emailDeliveryStatus === 'NOT_CONFIRMED') {
        setDeliveryNotice('Your enquiry is saved, but initial email delivery was not confirmed. Continue here in webchat; our team will review it.')
      }
      if (data.ai) {
        setAiStatus(data.ai.available ? 'ready' : 'unavailable')
        if (!data.ai.available) setAiError(data.ai.detail)
      }
      if (data.identityReviewRequired && data.notice) {
        setAiError(data.notice)
      }
      // Session now handles initial message atomically — fetch thread to get AI reply
      const thread = await fetchThread(null)
      if (thread) {
        setConversation(thread.conversation)
        setMessages(thread.messages)
        if (thread.latestId) {
          setSeenId(thread.latestId)
          writeSeenId(thread.latestId)
        }
      }
      setInitialMsg('')
      setSubject('')
      requestAnimationFrame(() => composerRef.current?.focus())
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : 'Could not start the chat. Please try again.')
      setConnIssue(true)
    } finally {
      setBusy(false)
    }
  }

  const sendMessage = async () => {
    if (busy) return
    const trimmed = draft.trim()
    if (trimmed.length < 1 || trimmed.length > MAX_BODY) return
    messageRequestIdRef.current ??= newRequestId()
    setBusy(true)
    setConnIssue(false)
    setAiError(null)
    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonId: anonIdRef.current, requestId: messageRequestIdRef.current, body: trimmed, name: name.trim() || undefined }),
      })
      if (!res.ok) {
        const failure = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(failure?.error ?? 'Your message could not be sent. Please try again.')
      }
      const data = (await res.json()) as { message: ChatMsg | null; messages?: ChatMsg[]; reply?: { body: string; wasAiGenerated: boolean; escalated: boolean; error?: string | null }; error?: string; code?: string; notice?: string; identityReviewRequired?: boolean }
      messageRequestIdRef.current = null
      // Server now returns full thread after AI reply — use it when available
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages)
        const last = data.messages[data.messages.length - 1]
        if (last?.id) {
          setSeenId(last.id)
          writeSeenId(last.id)
        }
        if (data.reply?.error) setAiError(data.reply.error)
        if (data.notice) setAiError(data.notice)
        if (data.reply?.escalated || data.identityReviewRequired) setAiStatus('unavailable')
      } else if (data.message) {
        const next = [...messagesRef.current, data.message]
        setMessages(next)
        if (data.message.id) {
          setSeenId(data.message.id)
          writeSeenId(data.message.id)
        }
        if (data.error) setAiError(data.error)
      }
      setDraft('')
      if (composerRef.current) composerRef.current.style.height = 'auto'
    } catch (error) {
      setConnIssue(true)
      if (error instanceof Error && error.message) setAiError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const restartConversation = () => {
    if (busy) return
    // A fresh conversation must capture contact consent again. The first-contact
    // form will resume the same browser's stable CRM Client ID when safe.
    setConversation(null)
    setMessages([])
    setBadgeCount(0)
    setContactConsent(false)
    setSessionError(null)
    setDeliveryNotice(null)
    setConnIssue(false)
    startRequestIdRef.current = null
    messageRequestIdRef.current = null
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
                <p role="status" className="mt-0.5 text-[11px] leading-tight text-white/85">
                  {aiStatus === 'checking' ? 'Checking assistant status…' : aiStatus === 'ready' ? 'AI assistant ready · a specialist joins when needed' : aiStatus === 'unavailable' ? 'AI assistant unavailable · our team will review your enquiry' : 'AI assistant status unknown · our team will review your enquiry'}
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
                <p className="text-sm leading-relaxed text-slate-600">
                  Welcome to TECH360. Tell us about your business and what you need; our webchat agent will ask focused questions, prepare an initial proposal, and then refine the scope after your feedback. Choose SMS for the first service-related reply or email. A Client ID is issued or linked only after identity can be handled safely.
                </p>
                <div className="space-y-1">
                  <label htmlFor="chat-name" className="text-xs font-medium text-slate-700">
                    Name <span className="font-normal text-slate-400">(optional; you can share it later)</span>
                  </label>
                  <input
                    id="chat-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                    autoComplete="name"
                    placeholder="Your name"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#009FE3] focus:outline-none focus:ring-2 focus:ring-[#009FE3]/30"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="chat-email" className="text-xs font-medium text-slate-700">
                    Email {preferredContact === 'Email'
                      ? <><span className="text-[#EF4444]" aria-hidden="true">*</span><span className="sr-only">(required)</span></>
                      : <span className="font-normal text-slate-400">(optional for SMS-first)</span>}
                  </label>
                  <input
                    id="chat-email"
                    type="email"
                    required={preferredContact === 'Email'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={320}
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#009FE3] focus:outline-none focus:ring-2 focus:ring-[#009FE3]/30"
                  />
                  <p className="text-[11px] leading-relaxed text-slate-500">{preferredContact === 'Email' ? 'Service follow-up will use email. A typed address alone does not verify ownership.' : 'Email is optional when SMS is selected; service follow-up uses SMS/webchat, not an email marketing list.'}</p>
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-xs font-medium text-slate-700">First service reply</legend>
                  <div className="flex gap-2">
                    {(['SMS', 'Email'] as const).map((method) => (
                      <button key={method} type="button" onClick={() => setPreferredContact(method)} aria-pressed={preferredContact === method}
                        className={`min-h-9 rounded-lg border px-3 text-xs font-semibold ${preferredContact === method ? 'border-[#009FE3] bg-sky-50 text-sky-800' : 'border-slate-300 text-slate-600'}`}>
                        {method === 'SMS' ? 'SMS first' : 'Email first'}
                      </button>
                    ))}
                  </div>
                  {preferredContact === 'SMS' && (
                    <div className="space-y-1">
                      <label htmlFor="chat-phone" className="text-xs font-medium text-slate-700">Mobile number <span className="text-[#EF4444]" aria-hidden="true">*</span></label>
                      <input id="chat-phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32} autoComplete="tel" placeholder="+8801XXXXXXXXX"
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#009FE3] focus:outline-none focus:ring-2 focus:ring-[#009FE3]/30" />
                      <p className="text-[11px] leading-relaxed text-slate-500">We will attempt one service-related SMS first only if an SMS gateway is configured. If not, your enquiry remains in webchat; we will not silently switch channels. No marketing texts without separate opt-in.</p>
                    </div>
                  )}
                </fieldset>
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
                <label htmlFor="chat-contact-consent" className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                  <input
                    id="chat-contact-consent"
                    type="checkbox"
                    required
                    checked={contactConsent}
                    onChange={(e) => setContactConsent(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-[#009FE3]"
                  />
                  <span>
                    I consent to TECH360 LLC storing this enquiry and using my selected first-reply channel ({preferredContact}) for service-related updates about this request. If I selected SMS, I agree to receive service-related texts at the number provided; message/data rates may apply. No marketing messages without separate opt-in. See the{" "}
                    <a href="#/legal/privacy" className="font-semibold underline underline-offset-2">Privacy Policy</a>.
                  </span>
                </label>
                {sessionError && (
                  <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                    {sessionError}
                  </p>
                )}
                {connIssue && (
                  <p role="status" className="text-xs text-amber-700">
                    We could not confirm whether it was saved. Retrying uses the same request id to avoid a duplicate.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy || !contactConsent || (preferredContact === 'Email' && !email.trim()) || (preferredContact === 'SMS' && !phone.trim())}
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
                  {clientId && (
                    <p className="text-center text-[11px] text-slate-400">Client ID: <span className="font-mono font-medium text-slate-600">{clientId}</span></p>
                  )}
                  {deliveryNotice && (
                    <p role="status" className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-800">
                      {deliveryNotice}
                    </p>
                  )}
                  {aiError && (
                    <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {aiError}
                    </p>
                  )}
                  {messages.length === 0 && (
                    <p className="py-8 text-center text-xs text-slate-400">
                      Connecting you to TECH360 — please wait a moment…
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
                {clientId && (
                  <p className="border-t border-slate-100 bg-slate-50 px-4 py-1 text-center text-[10px] text-slate-400">
                    Reference <span className="font-mono text-slate-500">{clientId}</span> · Replies may be assisted by AI — <a href="#/legal/privacy" className="underline">learn more</a>
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
