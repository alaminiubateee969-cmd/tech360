'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CheckCheck, FileText, Loader2, MessageCircle, Paperclip, RotateCcw, Send, UserRound, X } from 'lucide-react'
import { mergeMessages } from '@/lib/webchat/client-thread'

// ============================================================
// TECH360 — public live chat widget (self-hosted, real backend)
// - Floating launcher bottom-right, brand gradient
// - Hidden on #/admin and #/portal hash routes
// - Anonymous visitor identity in localStorage (t360_chat_anid) + signed session cookie
// - Real time: Server-Sent Events (/api/chat/stream) while open, with polling
//   fallback (5s) when the stream is unavailable; 30s badge polling while closed
// - Typing indicators, delivery/read receipts, attachments, human handoff,
//   close/reopen and an offline enquiry form that posts to /api/contact
// - Honest states: connection issues are shown, never faked replies
// ============================================================

const ANON_KEY = 't360_chat_anid'
const SEEN_KEY = 't360_chat_seen'
const MAX_BODY = 2000
const MAX_FILE_BYTES = 5 * 1024 * 1024
const ACCEPTED_FILES = 'image/png,image/jpeg,image/webp,application/pdf,text/plain'
const ACCEPTED_MIME = new Set(ACCEPTED_FILES.split(','))
const TYPING_SEND_INTERVAL_MS = 3_000

type Author = 'VISITOR' | 'AI' | 'HUMAN' | 'SYSTEM'
type Delivery = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'

type ChatMsg = {
  id: string
  sender: 'VISITOR' | 'ADMIN' | 'SYSTEM'
  author?: Author
  body: string
  aiGenerated?: boolean
  deliveryStatus?: Delivery
  attachment?: { id: string; name: string; mime: string; size: number } | null
  agentEmail?: string | null
  createdAt: string
}

type PendingMsg = { requestId: string; body: string; status: 'SENDING' | 'FAILED'; error?: string | null; createdAt: string }

type ConversationState = {
  id: string
  status: 'OPEN' | 'CLOSED'
  visitorName?: string | null
  humanRequested?: boolean
  closedBy?: 'VISITOR' | 'TEAM' | null
} | null

type ConversationPayload = {
  id: string
  status: string
  visitorName?: string | null
  clientId?: string | null
  humanRequested?: boolean
  closedBy?: 'VISITOR' | 'TEAM' | null
}

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
  return hash.startsWith('/admin') || hash.startsWith('/portal')
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

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// unseen = team/AI/system messages after the last seen message id
function countUnseen(messages: ChatMsg[], seenId: string | null): number {
  if (!seenId) return messages.filter((m) => m.sender !== 'VISITOR').length
  const idx = messages.findIndex((m) => m.id === seenId)
  const tail = idx >= 0 ? messages.slice(idx + 1) : messages
  return tail.filter((m) => m.sender !== 'VISITOR').length
}

function authorOf(m: ChatMsg): Author {
  if (m.author) return m.author
  if (m.sender === 'VISITOR') return 'VISITOR'
  if (m.sender === 'SYSTEM') return 'SYSTEM'
  return m.aiGenerated ? 'AI' : 'HUMAN'
}

function toConversation(c: ConversationPayload | null | undefined): ConversationState {
  if (!c) return null
  return {
    id: c.id,
    status: c.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
    visitorName: c.visitorName,
    humanRequested: Boolean(c.humanRequested),
    closedBy: c.closedBy ?? null,
  }
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const BRAND_GRADIENT = { background: 'linear-gradient(135deg, #009FE3 0%, #063B8F 100%)' }
const INPUT_CLASS = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#009FE3] focus:outline-none focus:ring-2 focus:ring-[#009FE3]/30'

// ============================================================
// Widget
// ============================================================
export default function ChatWidget() {
  const [mounted, setMounted] = useState(false)
  const [hidden, setHidden] = useState(true)
  const [open, setOpen] = useState(false)

  const [conversation, setConversation] = useState<ConversationState>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [pending, setPending] = useState<PendingMsg[]>([])
  const [seenId, setSeenId] = useState<string | null>(null)
  const [badgeCount, setBadgeCount] = useState(0)
  const [connIssue, setConnIssue] = useState(false)
  const [busy, setBusy] = useState(false) // starting a chat / conversation action
  const [aiStatus, setAiStatus] = useState<'checking' | 'ready' | 'unavailable' | 'unknown'>('checking')
  const [aiError, setAiError] = useState<string | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [teamTyping, setTeamTyping] = useState<string | null>(null)
  const [streamLive, setStreamLive] = useState(false)
  const [streamNonce, setStreamNonce] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  // first-contact form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [preferredContact, setPreferredContact] = useState<'CHAT' | 'SMS' | 'Email'>('CHAT')
  const [contactConsent, setContactConsent] = useState(false)
  const [subject, setSubject] = useState('')
  const [initialMsg, setInitialMsg] = useState('')

  // offline enquiry form (posts to the consented /api/contact intake)
  const [showOffline, setShowOffline] = useState(false)
  const [offName, setOffName] = useState('')
  const [offEmail, setOffEmail] = useState('')
  const [offDetails, setOffDetails] = useState('')
  const [offConsent, setOffConsent] = useState(false)
  const [offBusy, setOffBusy] = useState(false)
  const [offResult, setOffResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [offFieldErrors, setOffFieldErrors] = useState<Record<string, string>>({})

  // composer
  const [draft, setDraft] = useState('')

  const anonIdRef = useRef<string>('')
  const messagesRef = useRef<ChatMsg[]>([])
  const seenIdRef = useRef<string | null>(null)
  const conversationRef = useRef<ConversationState>(null)
  const startRequestIdRef = useRef<string | null>(null)
  const offlineRequestIdRef = useRef<string | null>(null)
  const typingSentAtRef = useRef(0)
  const lastReadMarkRef = useRef<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const bubbleRef = useRef<HTMLButtonElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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
    // External "Live Support" CTAs (LiveSupportLink and header chips) open the
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

  // ---------------- thread fetch (polling path) ----------------
  const fetchThread = useCallback(async (after: string | null, markRead = false): Promise<{
    conversation: ConversationState
    messages: ChatMsg[]
    latestId: string | null
    typing: string | null
    receipts: Array<{ id: string; deliveryStatus: Delivery }>
  } | null> => {
    const params = new URLSearchParams({ anonId: anonIdRef.current })
    if (after) params.set('after', after)
    if (markRead) params.set('read', '1')
    const res = await fetch(`/api/chat/messages?${params.toString()}`)
    if (!res.ok) throw new Error('poll failed')
    const data = (await res.json()) as {
      conversation: ConversationPayload | null
      messages: ChatMsg[]
      latestId: string | null
      typing?: { active: boolean; name: string | null }
      receipts?: Array<{ id: string; deliveryStatus: Delivery }>
      ai?: { available: boolean; detail: string }
    }
    if (data.ai) {
      setAiStatus((prev) => (prev === 'checking' || prev === 'unknown' ? (data.ai!.available ? 'ready' : 'unavailable') : prev))
    }
    if (data.conversation?.clientId) {
      setClientId(data.conversation.clientId)
    }
    return {
      conversation: toConversation(data.conversation),
      messages: data.messages ?? [],
      latestId: data.latestId ?? null,
      typing: data.typing?.active ? (data.typing.name ?? 'TECH360 team') : null,
      receipts: data.receipts ?? [],
    }
  }, [])

  const applyReceipts = useCallback((receipts: Array<{ id: string; deliveryStatus: Delivery }>) => {
    if (receipts.length === 0) return
    const byId = new Map(receipts.map((r) => [r.id, r.deliveryStatus]))
    setMessages((list) => {
      let changed = false
      const next = list.map((m) => {
        const status = byId.get(m.id)
        if (status && status !== m.deliveryStatus) { changed = true; return { ...m, deliveryStatus: status } }
        return m
      })
      return changed ? next : list
    })
  }, [])

  const markSeen = useCallback((list: ChatMsg[]) => {
    const latest = list.length ? list[list.length - 1].id : null
    if (latest && latest !== seenIdRef.current) {
      setSeenId(latest)
      writeSeenId(latest)
    }
  }, [])

  // ---------------- badge poll (panel closed) ----------------
  const badgePoll = useCallback(async () => {
    try {
      const data = await fetchThread(null)
      if (!data) return
      setConversation(data.conversation)
      setMessages(data.messages)
      setBadgeCount(countUnseen(data.messages, seenIdRef.current))
      setConnIssue(false)
    } catch {
      // honest: keep the last known state, flag nothing while closed
      // (the badge simply stops updating until the next poll succeeds)
    }
  }, [fetchThread])

  // ---------------- thread poll (panel open, stream unavailable) ----------------
  const threadPoll = useCallback(async () => {
    const list = messagesRef.current
    const after = list.length > 0 ? list[list.length - 1].id : null
    try {
      const visible = typeof document === 'undefined' || document.visibilityState === 'visible'
      const data = await fetchThread(after, visible)
      if (!data) return
      setConversation(data.conversation)
      const next = after ? mergeMessages(list, data.messages) : data.messages
      if (next !== list) setMessages(next)
      applyReceipts(data.receipts)
      setTeamTyping(data.typing)
      markSeen(next)
      setBadgeCount(0)
      setConnIssue(false)
    } catch {
      setConnIssue(true)
    }
  }, [fetchThread, applyReceipts, markSeen])

  // initial fetch once visible (mounted + not on admin/portal)
  useEffect(() => {
    if (!mounted || hidden) return
    void badgePoll()
  }, [mounted, hidden, badgePoll])

  // polling: 5s while open without a live stream, 30s while closed
  useEffect(() => {
    if (!mounted || hidden) return
    if (open && streamLive) return
    const interval = open ? 5_000 : 30_000
    const t = window.setInterval(() => {
      if (open) void threadPoll()
      else void badgePoll()
    }, interval)
    return () => window.clearInterval(t)
  }, [mounted, hidden, open, streamLive, threadPoll, badgePoll])

  // ---------------- live stream (SSE) while the panel is open ----------------
  const conversationId = conversation?.id ?? null
  const conversationOpen = conversation?.status === 'OPEN'
  useEffect(() => {
    if (!mounted || hidden || !open || !conversationId || !conversationOpen) return
    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') return
    const list = messagesRef.current
    const params = new URLSearchParams({ anonId: anonIdRef.current })
    if (list.length) params.set('after', list[list.length - 1].id)
    const es = new EventSource(`/api/chat/stream?${params.toString()}`)
    let closed = false
    const parse = <T,>(e: MessageEvent): T | null => { try { return JSON.parse(e.data) as T } catch { return null } }
    es.onopen = () => { setStreamLive(true); setConnIssue(false) }
    es.addEventListener('messages', (e) => {
      const data = parse<{ messages: ChatMsg[] }>(e as MessageEvent)
      if (!data) return
      setMessages((cur) => {
        const next = mergeMessages(cur, data.messages)
        markSeen(next)
        return next
      })
    })
    es.addEventListener('status', (e) => {
      const data = parse<{ id: string; status: string; humanRequested: boolean; closedBy: 'VISITOR' | 'TEAM' | null }>(e as MessageEvent)
      if (!data) return
      setConversation((cur) => (cur && cur.id === data.id
        ? { ...cur, status: data.status === 'CLOSED' ? 'CLOSED' : 'OPEN', humanRequested: data.humanRequested, closedBy: data.closedBy }
        : cur))
    })
    es.addEventListener('typing', (e) => {
      const data = parse<{ active: boolean; name: string | null }>(e as MessageEvent)
      setTeamTyping(data?.active ? (data.name ?? 'TECH360 team') : null)
    })
    es.addEventListener('receipts', (e) => {
      const data = parse<{ receipts: Array<{ id: string; deliveryStatus: Delivery }> }>(e as MessageEvent)
      if (data) applyReceipts(data.receipts)
    })
    // The server ends each stream after ~55s; reconnect from the last message id.
    es.addEventListener('reconnect', () => {
      if (closed) return
      closed = true
      es.close()
      setStreamNonce((n) => n + 1)
    })
    // The conversation no longer exists for this session: stop streaming and let polling report it.
    es.addEventListener('gone', () => {
      closed = true
      es.close()
      setStreamLive(false)
    })
    es.onerror = () => {
      // EventSource retries by itself; polling covers the gap meanwhile.
      setStreamLive(false)
    }
    return () => {
      closed = true
      es.close()
      setStreamLive(false)
    }
  }, [mounted, hidden, open, conversationId, conversationOpen, streamNonce, applyReceipts, markSeen])

  // ---------------- read receipts: the visitor is looking at the thread ----------------
  useEffect(() => {
    if (!open || !conversationOpen || typeof document === 'undefined') return
    const lastTeam = [...messages].reverse().find((m) => m.sender !== 'VISITOR')
    if (!lastTeam || lastTeam.deliveryStatus === 'READ' || lastReadMarkRef.current === lastTeam.id) return
    if (document.visibilityState !== 'visible') return
    lastReadMarkRef.current = lastTeam.id
    void fetch('/api/chat/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonId: anonIdRef.current, action: 'read' }),
    }).catch(() => { lastReadMarkRef.current = null })
  }, [messages, open, conversationOpen])

  // keep the thread pinned to the bottom when new messages arrive
  useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, pending, teamTyping, open])

  // ---------------- panel open / close ----------------
  const openPanel = useCallback(() => {
    setOpen(true)
    setBadgeCount(0)
    trackChatOpen(anonIdRef.current)
    // sync immediately, then mark seen + focus once data lands
    void (async () => {
      try {
        const data = await fetchThread(null, true)
        if (!data) return
        setConversation(data.conversation)
        setMessages(data.messages)
        setTeamTyping(data.typing)
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

  // ---------------- typing indicator (outbound, throttled) ----------------
  const sendTyping = useCallback((typing: boolean) => {
    if (!conversationRef.current || conversationRef.current.status !== 'OPEN') return
    const now = Date.now()
    if (typing && now - typingSentAtRef.current < TYPING_SEND_INTERVAL_MS) return
    if (!typing && typingSentAtRef.current === 0) return
    typingSentAtRef.current = typing ? now : 0
    void fetch('/api/chat/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonId: anonIdRef.current, typing }),
      keepalive: !typing,
    }).catch(() => null)
  }, [])

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
        if (res.status >= 500) {
          // Live chat is down: offer the offline enquiry form, prefilled.
          setOffName((v) => v || trimmedName)
          setOffEmail((v) => v || trimmedEmail)
          setOffDetails((v) => v || trimmedMsg)
        }
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
      setConversation({ id: data.conversation.id, status: 'OPEN', visitorName: trimmedName, humanRequested: false, closedBy: null })
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
      } else {
        setAiStatus('unknown')
      }
      if (data.identityReviewRequired && data.notice) {
        setAiError(data.notice)
      }
      // The session endpoint only returns success after the first message has
      // been persisted. A subsequent read may still fail transiently (for
      // example, a database failover), so don't present it as a failed start
      // or strand the visitor on the now-hidden intake form.
      setInitialMsg('')
      setSubject('')
      try {
        const thread = await fetchThread(null)
        if (thread) {
          setConversation(thread.conversation)
          setMessages(thread.messages)
          if (thread.latestId) {
            setSeenId(thread.latestId)
            writeSeenId(thread.latestId)
          }
        }
      } catch {
        setConnIssue(true)
      }
      requestAnimationFrame(() => composerRef.current?.focus())
    } catch (error) {
      setAiStatus('unknown')
      setSessionError(error instanceof Error ? error.message : 'Could not start the chat. Please try again.')
      setConnIssue(true)
    } finally {
      setBusy(false)
    }
  }

  /** Send (or retry) one message. The request id is kept until the server confirms it. */
  const deliver = async (item: PendingMsg) => {
    setPending((list) => list.map((p) => (p.requestId === item.requestId ? { ...p, status: 'SENDING', error: null } : p)))
    setConnIssue(false)
    setAiError(null)
    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonId: anonIdRef.current, requestId: item.requestId, body: item.body, name: name.trim() || undefined }),
      })
      if (!res.ok) {
        const failure = (await res.json().catch(() => null)) as { error?: string } | null
        const err = new Error(failure?.error ?? 'Your message could not be sent. Please try again.') as Error & { status?: number }
        err.status = res.status
        throw err
      }
      const data = (await res.json()) as {
        message: ChatMsg | null
        messages?: ChatMsg[]
        reply?: { body: string; wasAiGenerated: boolean; escalated: boolean; error?: string | null }
        conversation?: { id: string; clientId?: string | null; status: string }
        error?: string
        code?: string
        notice?: string
        identityReviewRequired?: boolean
      }
      setPending((list) => list.filter((p) => p.requestId !== item.requestId))
      if (data.conversation?.clientId) {
        setClientId(data.conversation.clientId)
      }
      // Server returns the full visible thread after any AI reply — use it when available
      if (data.messages && data.messages.length > 0) {
        setMessages((cur) => {
          const next = mergeMessages(cur, data.messages!)
          markSeen(next)
          return next
        })
        if (data.reply?.error) setAiError(data.reply.error)
        if (data.notice) setAiError(data.notice)
        if (data.reply?.escalated || data.identityReviewRequired) setAiStatus('unavailable')
      } else if (data.message) {
        setMessages((cur) => {
          const next = mergeMessages(cur, [data.message!])
          markSeen(next)
          return next
        })
        if (data.error) setAiError(data.error)
      }
    } catch (error) {
      const status = (error as { status?: number }).status
      // 4xx (other than rate limits) will not succeed on retry with the same text.
      setPending((list) => list.map((p) => (p.requestId === item.requestId
        ? { ...p, status: 'FAILED', error: error instanceof Error ? error.message : 'Not sent' }
        : p)))
      if (!status || status >= 500 || status === 429) setConnIssue(true)
    }
  }

  const sendMessage = async () => {
    const trimmed = draft.trim()
    if (trimmed.length < 1 || trimmed.length > MAX_BODY) return
    if (pending.some((p) => p.status === 'SENDING')) return
    const item: PendingMsg = { requestId: newRequestId(), body: trimmed, status: 'SENDING', createdAt: new Date().toISOString() }
    setPending((list) => [...list, item])
    setDraft('')
    if (composerRef.current) composerRef.current.style.height = 'auto'
    sendTyping(false)
    await deliver(item)
  }

  const discardPending = (requestId: string) => {
    setPending((list) => list.filter((p) => p.requestId !== requestId))
  }

  const uploadFile = async (file: File) => {
    setUploadError(null)
    if (file.size > MAX_FILE_BYTES) { setUploadError('Files must be 5 MB or smaller.'); return }
    if (file.type && !ACCEPTED_MIME.has(file.type)) { setUploadError('Only PNG, JPEG, WebP images, PDF and plain-text files can be shared.'); return }
    setUploading(true)
    try {
      const form = new FormData()
      form.set('anonId', anonIdRef.current)
      form.set('requestId', newRequestId())
      form.set('file', file)
      const caption = draft.trim()
      if (caption) form.set('caption', caption.slice(0, 500))
      const res = await fetch('/api/chat/attachment', { method: 'POST', body: form })
      const data = (await res.json().catch(() => null)) as { message?: ChatMsg; error?: string } | null
      if (!res.ok || !data?.message) throw new Error(data?.error ?? 'The file could not be uploaded.')
      setMessages((cur) => {
        const next = mergeMessages(cur, [data.message!])
        markSeen(next)
        return next
      })
      if (caption) { setDraft(''); if (composerRef.current) composerRef.current.style.height = 'auto' }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'The file could not be uploaded.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const conversationAction = async (action: 'request-human' | 'close' | 'reopen') => {
    if (busy) return
    setBusy(true)
    setActionNotice(null)
    try {
      const res = await fetch('/api/chat/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonId: anonIdRef.current, action }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string; status?: string; inboxState?: string } | null
      if (!res.ok) throw new Error(data?.error ?? 'That did not work — please try again.')
      if (action === 'request-human') {
        setConversation((cur) => (cur ? { ...cur, humanRequested: true } : cur))
        setActionNotice('A team member has been asked to join this conversation. You can keep writing here.')
      } else if (action === 'close') {
        sendTyping(false)
        setConversation((cur) => (cur ? { ...cur, status: 'CLOSED', closedBy: 'VISITOR' } : cur))
      } else {
        setConversation((cur) => (cur ? { ...cur, status: 'OPEN', closedBy: null } : cur))
      }
      const thread = await fetchThread(null).catch(() => null)
      if (thread) {
        setConversation(thread.conversation)
        setMessages(thread.messages)
        markSeen(thread.messages)
      }
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : 'That did not work — please try again.')
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
    setPending([])
    setBadgeCount(0)
    setContactConsent(false)
    setSessionError(null)
    setDeliveryNotice(null)
    setActionNotice(null)
    setConnIssue(false)
    startRequestIdRef.current = null
  }

  const submitOffline = async (e: React.FormEvent) => {
    e.preventDefault()
    if (offBusy) return
    offlineRequestIdRef.current ??= newRequestId()
    setOffBusy(true)
    setOffResult(null)
    setOffFieldErrors({})
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: offlineRequestIdRef.current,
          name: offName.trim() || undefined,
          email: offEmail.trim(),
          preferredContact: 'Email',
          details: offDetails.trim(),
          consent: offConsent === true,
          tracking: { source: 'CHAT_OFFLINE_FORM' },
        }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string; fields?: Record<string, string>; clientId?: string } | null
      if (!res.ok) {
        setOffFieldErrors(data?.fields ?? {})
        throw new Error(data?.error ?? 'Your enquiry could not be submitted.')
      }
      offlineRequestIdRef.current = null
      setOffResult({ ok: true, text: data?.clientId ? `Thank you — your enquiry is saved under reference ${data.clientId}. Our team will reply by email.` : 'Thank you — your enquiry is saved. Our team will reply by email.' })
      setOffDetails('')
    } catch (error) {
      setOffResult({ ok: false, text: error instanceof Error ? error.message : 'Your enquiry could not be submitted.' })
    } finally {
      setOffBusy(false)
    }
  }

  // ---------------- render ----------------
  if (!mounted || hidden) return null

  const isOpen = conversation?.status === 'OPEN'
  const showThread = conversation !== null && isOpen && !showOffline
  const showClosed = conversation !== null && conversation.status === 'CLOSED' && !showOffline
  const charCount = draft.length
  const sending = pending.some((p) => p.status === 'SENDING')
  const headerStatus = teamTyping
    ? `${teamTyping} is typing…`
    : aiStatus === 'checking'
      ? 'Checking assistant status…'
      : conversation?.humanRequested
        ? 'A team member has been requested.'
        : aiStatus === 'ready'
          ? 'Automated help can reply here; our team reviews every conversation.'
          : 'Our team will review your enquiry and reply here.'

  const attachmentUrl = (id: string) => `/api/chat/attachment/${encodeURIComponent(id)}?anonId=${encodeURIComponent(anonIdRef.current)}`

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
        style={BRAND_GRADIENT}
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
            className="fixed inset-x-3 bottom-[5.75rem] z-50 flex h-[560px] max-h-[78vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:right-5 sm:w-[24rem] print:hidden"
          >
            {/* header */}
            <div className="flex items-center gap-3 px-4 py-3 text-white" style={BRAND_GRADIENT}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15" aria-hidden="true">
                <span className={`size-2.5 rounded-full ${streamLive ? 'bg-emerald-300' : 'bg-white'}`} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">TECH360 Support</p>
                <p role="status" className="mt-0.5 truncate text-[11px] leading-tight text-white/85">
                  {headerStatus}
                </p>
              </div>
              {showThread && (
                <button
                  type="button"
                  onClick={() => void conversationAction('close')}
                  disabled={busy}
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white/90 ring-1 ring-white/40 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-60"
                >
                  End chat
                </button>
              )}
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
            {!showThread && !showClosed && !showOffline && (
              <form onSubmit={startConversation} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
                <p className="text-sm leading-relaxed text-slate-600">
                  Welcome to TECH360. Tell us what you need and your message will be saved in this chat.
                  If an AI assistant is available, it may help here; otherwise our team can reply in this
                  thread. No account or email is required. Add contact details only if you want a first
                  reply on that channel. Prefer email? Write to info@bdtech360.com at any time.
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
                      : <span className="font-normal text-slate-400">(optional for SMS-first and chat replies — you can share it at any time)</span>}
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
                  <p className="text-[11px] leading-relaxed text-slate-500">{preferredContact === 'Email' ? 'Service follow-up uses email. A typed address is contact information only — portal sign-in always requires a one-time code.' : 'Optional. If you provide an email we will use it for formal documents and follow-up. A typed address is contact information only — portal sign-in always requires a one-time code.'}</p>
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-xs font-medium text-slate-700">Where should we answer first?</legend>
                  <div className="flex flex-wrap gap-2">
                    {(['CHAT', 'SMS', 'Email'] as const).map((method) => (
                      <button key={method} type="button" onClick={() => setPreferredContact(method)} aria-pressed={preferredContact === method}
                        className={`min-h-9 rounded-lg border px-3 text-xs font-semibold ${preferredContact === method ? 'border-[#009FE3] bg-sky-50 text-sky-800' : 'border-slate-300 text-slate-600'}`}>
                        {method === 'CHAT' ? 'Here in chat' : method === 'SMS' ? 'SMS first' : 'Email first'}
                      </button>
                    ))}
                  </div>
                  {preferredContact === 'CHAT' && (
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      Recommended. Your enquiry is saved with a Client ID immediately. An available assistant or our team can reply here. Share an email later whenever you want a written proposal copy.
                    </p>
                  )}
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
                    I consent to TECH360 LLC storing this enquiry under a Client ID and replying on my selected first-reply channel ({preferredContact === 'CHAT' ? 'this chat' : preferredContact}) for service-related updates about this request. If I selected SMS, I agree to receive service-related texts at the number provided; message/data rates may apply. No marketing messages without separate opt-in. See the{" "}
                    <a href="/legal/privacy" className="font-semibold underline underline-offset-2">Privacy Policy</a>.
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
                  disabled={busy || !contactConsent || (preferredContact === 'Email' && !email.trim()) || (preferredContact === 'SMS' && !phone.trim()) || initialMsg.trim().length < 1}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white shadow transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]/50 focus-visible:ring-offset-2 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #009FE3 0%, #063B8F 100%)' }}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                  Start chat
                </button>
              </form>
            )}

            {!showThread && !showClosed && !showOffline && (
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-center">
                <button type="button" onClick={() => { setShowOffline(true); setOffResult(null) }} className="text-xs font-semibold text-[#063B8F] underline underline-offset-2">
                  Prefer not to chat? Leave a message instead
                </button>
              </div>
            )}

            {/* ---------------- offline enquiry form ---------------- */}
            {showOffline && (
              <form onSubmit={submitOffline} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" aria-label="Leave a message">
                <p className="text-sm leading-relaxed text-slate-600">
                  Leave your enquiry and our team will reply by email. It is saved with a reference number — nothing is sent until you submit.
                </p>
                <div className="space-y-1">
                  <label htmlFor="off-name" className="text-xs font-medium text-slate-700">Name <span className="font-normal text-slate-400">(optional)</span></label>
                  <input id="off-name" value={offName} onChange={(e) => setOffName(e.target.value)} maxLength={200} autoComplete="name" className={INPUT_CLASS} />
                  {offFieldErrors.name && <p className="text-[11px] text-red-600">{offFieldErrors.name}</p>}
                </div>
                <div className="space-y-1">
                  <label htmlFor="off-email" className="text-xs font-medium text-slate-700">Email <span className="text-[#EF4444]" aria-hidden="true">*</span><span className="sr-only">(required)</span></label>
                  <input id="off-email" type="email" required value={offEmail} onChange={(e) => setOffEmail(e.target.value)} maxLength={320} autoComplete="email" placeholder="you@company.com" className={INPUT_CLASS} />
                  {offFieldErrors.email && <p className="text-[11px] text-red-600">{offFieldErrors.email}</p>}
                </div>
                <div className="flex flex-1 flex-col space-y-1">
                  <label htmlFor="off-details" className="text-xs font-medium text-slate-700">How can we help? <span className="text-[#EF4444]" aria-hidden="true">*</span><span className="sr-only">(required, at least 20 characters)</span></label>
                  <textarea id="off-details" required minLength={20} rows={5} maxLength={8000} value={offDetails} onChange={(e) => setOffDetails(e.target.value)} placeholder="Describe what you need (at least 20 characters)"
                    className="min-h-28 flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#009FE3] focus:outline-none focus:ring-2 focus:ring-[#009FE3]/30" />
                  {offFieldErrors.details && <p className="text-[11px] text-red-600">{offFieldErrors.details}</p>}
                </div>
                <label htmlFor="off-consent" className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                  <input id="off-consent" type="checkbox" required checked={offConsent} onChange={(e) => setOffConsent(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[#009FE3]" />
                  <span>
                    I consent to TECH360 LLC storing this enquiry and replying by email about this request. No marketing messages without separate opt-in. See the{' '}
                    <a href="/legal/privacy" className="font-semibold underline underline-offset-2">Privacy Policy</a>.
                  </span>
                </label>
                {offResult && (
                  <p role={offResult.ok ? 'status' : 'alert'} className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${offResult.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                    {offResult.text}
                  </p>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowOffline(false)} className="h-11 flex-1 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    Back to chat
                  </button>
                  <button type="submit" disabled={offBusy || !offConsent || !offEmail.trim() || offDetails.trim().length < 20}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white shadow disabled:opacity-60" style={BRAND_GRADIENT}>
                    {offBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                    Send enquiry
                  </button>
                </div>
              </form>
            )}

            {/* ---------------- closed conversation ---------------- */}
            {showClosed && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
                  {conversation?.closedBy === 'VISITOR' ? 'You ended this conversation. Your messages are saved.' : 'This conversation was closed by our team.'}
                </p>
                {actionNotice && <p role="status" className="text-xs text-amber-700">{actionNotice}</p>}
                {connIssue && (
                  <p role="status" className="text-xs text-amber-700">
                    Connection issue — retrying.
                  </p>
                )}
                {conversation?.closedBy === 'VISITOR' && (
                  <button
                    type="button"
                    onClick={() => void conversationAction('reopen')}
                    disabled={busy}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#009FE3]/50 px-5 text-sm font-semibold text-[#063B8F] transition hover:bg-sky-50 disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
                    Reopen this conversation
                  </button>
                )}
                <button
                  type="button"
                  onClick={restartConversation}
                  disabled={busy}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-white shadow transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]/50 focus-visible:ring-offset-2 disabled:opacity-60"
                  style={BRAND_GRADIENT}
                >
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
                      Our support team will review your enquiry. Please continue here or email info@bdtech360.com.
                    </p>
                  )}
                  {messages.length === 0 && pending.length === 0 && (
                    <p className="py-8 text-center text-xs text-slate-400">
                      Loading your conversation…
                    </p>
                  )}
                  {messages.map((m) => {
                    const author = authorOf(m)
                    if (author === 'SYSTEM' && !m.attachment) {
                      return (
                        <p key={m.id} className="text-center text-xs italic text-slate-500">
                          {m.body}
                        </p>
                      )
                    }
                    const mine = author === 'VISITOR'
                    const isImage = m.attachment && m.attachment.mime.startsWith('image/')
                    return (
                      <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                        <div
                          title={new Date(m.createdAt).toLocaleString()}
                          className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                            mine
                              ? 'rounded-br-md border border-[#009FE3]/30 bg-[#009FE3]/10 text-slate-900'
                              : author === 'AI'
                                ? 'rounded-bl-md border border-violet-200 bg-violet-50 text-slate-900'
                                : 'rounded-bl-md border border-slate-200 bg-white text-slate-900'
                          }`}
                        >
                          {m.attachment && (
                            isImage ? (
                              <a href={attachmentUrl(m.attachment.id)} target="_blank" rel="noopener noreferrer" className="mb-1 block">
                                <img src={attachmentUrl(m.attachment.id)} alt={m.attachment.name} className="max-h-48 rounded-lg border border-slate-200 object-contain" />
                              </a>
                            ) : (
                              <a href={attachmentUrl(m.attachment.id)} target="_blank" rel="noopener noreferrer" className="mb-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                                <FileText className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate">{m.attachment.name}</span>
                                <span className="shrink-0 text-slate-400">{fmtBytes(m.attachment.size)}</span>
                              </a>
                            )
                          )}
                          {m.body}
                        </div>
                        <span className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-slate-400">
                          {author === 'AI' && (
                            <span className="rounded bg-violet-100 px-1 font-semibold uppercase tracking-wide text-violet-700">AI</span>
                          )}
                          {mine ? 'You' : author === 'AI' ? 'TECH360 AI assistant' : 'TECH360 team'} · {fmtTime(m.createdAt)}
                          {mine && (
                            m.deliveryStatus === 'READ'
                              ? <span className="flex items-center gap-0.5 text-sky-600"><CheckCheck className="size-3" aria-hidden="true" />Seen</span>
                              : <span className="flex items-center gap-0.5"><Check className="size-3" aria-hidden="true" />Sent</span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                  {pending.map((p) => (
                    <div key={p.requestId} className="flex flex-col items-end">
                      <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md border px-3.5 py-2 text-sm leading-relaxed ${p.status === 'FAILED' ? 'border-red-200 bg-red-50 text-slate-700' : 'border-[#009FE3]/20 bg-[#009FE3]/5 text-slate-500'}`}>
                        {p.body}
                      </div>
                      {p.status === 'SENDING' ? (
                        <span className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-slate-400"><Loader2 className="size-3 animate-spin" aria-hidden="true" />Sending…</span>
                      ) : (
                        <span role="alert" className="mt-0.5 flex flex-wrap items-center justify-end gap-2 px-1 text-[10px] text-red-600">
                          Your message has not been sent yet{p.error ? ` — ${p.error}` : ''}.
                          <button type="button" onClick={() => void deliver(p)} className="font-semibold underline">Retry</button>
                          <button type="button" onClick={() => discardPending(p.requestId)} className="text-slate-500 underline">Discard</button>
                        </span>
                      )}
                    </div>
                  ))}
                  {teamTyping && (
                    <div className="flex items-center gap-2 text-xs text-slate-500" aria-live="polite">
                      <span className="flex gap-0.5" aria-hidden="true">
                        <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-slate-400" />
                      </span>
                      {teamTyping} is typing…
                    </div>
                  )}
                </div>

                {connIssue && (
                  <p role="status" className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-700">
                    Connection issue — retrying. Check whether your last message appears before sending it again.
                  </p>
                )}
                {(actionNotice || uploadError) && (
                  <p role="status" className="border-t border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-600">
                    {uploadError ?? actionNotice}
                  </p>
                )}
                {clientId && (
                  <p className="border-t border-slate-100 bg-slate-50 px-4 py-1 text-center text-[10px] text-slate-400">
                    Reference <span className="font-mono text-slate-500">{clientId}</span> · Your enquiry is handled by TECH360 Support — <a href="/legal/privacy" className="underline">Privacy Policy</a>
                  </p>
                )}

                {/* composer */}
                <div className="border-t border-slate-200 bg-white p-3">
                  {!conversation?.humanRequested && (
                    <div className="mb-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void conversationAction('request-human')}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-[#009FE3] hover:text-[#063B8F] disabled:opacity-60"
                      >
                        <UserRound className="size-3.5" aria-hidden="true" />
                        Talk to a person
                      </button>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept={ACCEPTED_FILES}
                      className="sr-only"
                      tabIndex={-1}
                      aria-hidden="true"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void uploadFile(f)
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      aria-label="Attach a file (PNG, JPEG, WebP, PDF or text, up to 5 MB)"
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-500 transition hover:border-[#009FE3] hover:text-[#063B8F] disabled:opacity-50"
                    >
                      {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Paperclip className="size-4" aria-hidden="true" />}
                    </button>
                    <label htmlFor="chat-composer" className="sr-only">
                      Type your message
                    </label>
                    <textarea
                      id="chat-composer"
                      ref={composerRef}
                      value={draft}
                      onChange={(e) => {
                        const value = e.target.value.slice(0, MAX_BODY)
                        setDraft(value)
                        autoGrow()
                        sendTyping(value.trim().length > 0)
                      }}
                      onBlur={() => sendTyping(false)}
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
                      disabled={sending || draft.trim().length === 0}
                      aria-label="Send message"
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]/50 focus-visible:ring-offset-2 disabled:opacity-40"
                      style={BRAND_GRADIENT}
                    >
                      {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
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
