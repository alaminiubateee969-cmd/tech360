// ============================================================
// TECH360 — WebChat policy (pure, no I/O)
// ============================================================
// Rules shared by the visitor routes, the operator inbox and the tests:
// inbox views, operator state transitions, attachment validation, what a
// visitor may see, and how a stored message is serialised for each side.
// ============================================================

import { scanDocumentBytes, type ScanVerdict } from '@/lib/files'

export const INBOX_STATES = ['OPEN', 'PENDING', 'ESCALATED', 'RESOLVED'] as const
export type InboxState = (typeof INBOX_STATES)[number]

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const
export type Priority = (typeof PRIORITIES)[number]

export const TEAMS = ['SUPPORT', 'SALES', 'BILLING', 'TECHNICAL'] as const
export type Team = (typeof TEAMS)[number]

export const INBOX_VIEWS = ['ALL', 'UNASSIGNED', 'MINE', 'ASSIGNED', 'OPEN', 'PENDING', 'ESCALATED', 'RESOLVED'] as const
export type InboxView = (typeof INBOX_VIEWS)[number]

export function isInboxState(v: unknown): v is InboxState {
  return typeof v === 'string' && (INBOX_STATES as readonly string[]).includes(v)
}
export function isPriority(v: unknown): v is Priority {
  return typeof v === 'string' && (PRIORITIES as readonly string[]).includes(v)
}
export function isTeam(v: unknown): v is Team {
  return typeof v === 'string' && (TEAMS as readonly string[]).includes(v)
}
export function parseInboxView(v: unknown): InboxView {
  const upper = typeof v === 'string' ? v.trim().toUpperCase() : ''
  return (INBOX_VIEWS as readonly string[]).includes(upper) ? (upper as InboxView) : 'ALL'
}

/**
 * Prisma `where` fragment for an inbox view. RESOLVED is excluded from every
 * working view except ALL and RESOLVED so resolved work does not clutter queues.
 */
export function inboxViewWhere(view: InboxView, userId: string): Record<string, unknown> {
  const active = { inboxState: { in: ['OPEN', 'PENDING', 'ESCALATED'] } }
  switch (view) {
    case 'UNASSIGNED': return { ...active, assignedToId: null }
    case 'MINE': return { ...active, assignedToId: userId }
    case 'ASSIGNED': return { ...active, assignedToId: { not: null } }
    case 'OPEN': return { inboxState: 'OPEN' }
    case 'PENDING': return { inboxState: 'PENDING' }
    case 'ESCALATED': return { inboxState: 'ESCALATED' }
    case 'RESOLVED': return { inboxState: 'RESOLVED' }
    default: return {}
  }
}

/** Allowed operator state transitions. Same-state writes are rejected so the timeline stays truthful. */
const TRANSITIONS: Record<InboxState, readonly InboxState[]> = {
  OPEN: ['PENDING', 'ESCALATED', 'RESOLVED'],
  PENDING: ['OPEN', 'ESCALATED', 'RESOLVED'],
  ESCALATED: ['OPEN', 'PENDING', 'RESOLVED'],
  RESOLVED: ['OPEN'],
}
export function canTransition(from: string, to: InboxState): boolean {
  const current = isInboxState(from) ? from : 'OPEN'
  return TRANSITIONS[current].includes(to)
}

// ------------------------------------------------------------
// Attachments
// ------------------------------------------------------------
export const CHAT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024
/** Visitor/agent attachments: images, PDF and plain text only. No HTML, SVG, scripts or archives. */
export const CHAT_ATTACHMENT_MIMES: Readonly<Record<string, string>> = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
})

export type AttachmentVerdict =
  | { ok: true; scan: ScanVerdict; mime: string; ext: string }
  | { ok: false; code: 'EMPTY' | 'TOO_LARGE' | 'TYPE_NOT_ALLOWED' | 'MALICIOUS'; reason: string; scan?: ScanVerdict }

export function validateChatAttachment(bytes: Buffer, declaredMime: string, filename: string): AttachmentVerdict {
  const mime = (declaredMime || '').split(';')[0].trim().toLowerCase()
  if (!bytes || bytes.length === 0) return { ok: false, code: 'EMPTY', reason: 'The file is empty.' }
  if (bytes.length > CHAT_ATTACHMENT_MAX_BYTES) return { ok: false, code: 'TOO_LARGE', reason: 'Files must be 5 MB or smaller.' }
  const ext = CHAT_ATTACHMENT_MIMES[mime]
  if (!ext) return { ok: false, code: 'TYPE_NOT_ALLOWED', reason: 'Only PNG, JPEG, WebP, PDF and plain-text files can be shared in chat.' }
  const scan = scanDocumentBytes(bytes, mime, filename)
  if (scan.verdict !== 'CLEAN') {
    return { ok: false, code: 'MALICIOUS', reason: 'The file failed the safety check and was not shared.', scan }
  }
  return { ok: true, scan, mime, ext }
}

// ------------------------------------------------------------
// Message serialisation
// ------------------------------------------------------------
export type StoredChatMessage = {
  id: string
  sender: string
  body: string
  agentEmail?: string | null
  kind?: string | null
  internal?: boolean | null
  aiGenerated?: boolean | null
  deliveryStatus?: string | null
  deliveredAt?: Date | string | null
  readAt?: Date | string | null
  attachmentId?: string | null
  attachmentName?: string | null
  attachmentMime?: string | null
  attachmentSize?: number | null
  createdAt: Date | string
}

/** Internal notes are operator-only. They must never reach a visitor API response. */
export function isVisitorVisible(m: Pick<StoredChatMessage, 'internal' | 'kind'>): boolean {
  return m.internal !== true && m.kind !== 'NOTE'
}

/** Prisma where-fragment that enforces the visitor visibility rule at query level. */
export const VISITOR_VISIBLE_WHERE = { internal: false, NOT: { kind: 'NOTE' } } as const

export type AuthorLabel = 'You' | 'TECH360 AI assistant' | 'TECH360 team' | 'TECH360'

export function authorType(m: Pick<StoredChatMessage, 'sender' | 'aiGenerated'>): 'VISITOR' | 'AI' | 'HUMAN' | 'SYSTEM' {
  if (m.sender === 'VISITOR') return 'VISITOR'
  if (m.sender === 'SYSTEM') return 'SYSTEM'
  return m.aiGenerated ? 'AI' : 'HUMAN'
}

function iso(v: Date | string | null | undefined): string | null {
  if (!v) return null
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString()
}

/** Shape returned to the public widget. Operator emails are not disclosed to visitors. */
export function toVisitorMessage(m: StoredChatMessage) {
  return {
    id: m.id,
    sender: m.sender as 'VISITOR' | 'ADMIN' | 'SYSTEM',
    author: authorType(m),
    body: m.body,
    aiGenerated: m.aiGenerated === true,
    deliveryStatus: (m.deliveryStatus ?? 'SENT') as 'SENT' | 'DELIVERED' | 'READ' | 'FAILED',
    attachment: m.attachmentId
      ? { id: m.attachmentId, name: m.attachmentName ?? 'attachment', mime: m.attachmentMime ?? 'application/octet-stream', size: m.attachmentSize ?? 0 }
      : null,
    createdAt: iso(m.createdAt) as string,
  }
}

/** Shape returned to operators (includes notes and the human author). */
export function toOperatorMessage(m: StoredChatMessage) {
  return {
    ...toVisitorMessage(m),
    agentEmail: m.agentEmail ?? null,
    kind: (m.kind ?? 'MESSAGE') as 'MESSAGE' | 'NOTE' | 'EVENT',
    internal: m.internal === true,
    deliveredAt: iso(m.deliveredAt),
    readAt: iso(m.readAt),
  }
}

/** Typing indicators expire quickly so a crashed tab never shows "typing…" forever. */
export const TYPING_TTL_MS = 6_000
export function isTypingFresh(at: Date | string | null | undefined, now: number = Date.now()): boolean {
  if (!at) return false
  const t = at instanceof Date ? at.getTime() : new Date(at).getTime()
  return Number.isFinite(t) && now - t >= 0 && now - t < TYPING_TTL_MS
}

// ------------------------------------------------------------
// Abuse protection
// ------------------------------------------------------------
/** Max visitor messages per conversation inside the burst window (DB-counted, so it holds across instances). */
export const VISITOR_BURST_LIMIT = 12
export const VISITOR_BURST_WINDOW_MS = 60_000

export type AbuseVerdict = { ok: true } | { ok: false; code: 'LINK_SPAM' | 'REPEATED_CHARACTERS'; reason: string }

/** Cheap deterministic content screen for obvious spam. Genuine messages with one or two links pass. */
export function screenVisitorMessage(body: string): AbuseVerdict {
  const links = body.match(/https?:\/\/|www\./gi)?.length ?? 0
  if (links > 5) return { ok: false, code: 'LINK_SPAM', reason: 'Messages with many links are blocked. Please describe your request in words.' }
  if (/(.)\1{49,}/u.test(body)) return { ok: false, code: 'REPEATED_CHARACTERS', reason: 'This message looks like repeated characters. Please rephrase it.' }
  return { ok: true }
}
