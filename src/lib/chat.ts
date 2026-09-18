import { db } from '@/lib/db'
import type { ChatConversation, ChatMessage } from '@prisma/client'

// ============================================================
// TECH360 — Live chat shared engine (Task 11-a)
// Chatwoot-inspired: public-site widget ↔ admin inbox.
// Every value is DB-backed; no bots, no fake auto-replies —
// the widget honestly tells visitors a human will reply.
// ============================================================

export const CHAT_MAX_BODY = 2000
export const CHAT_PREVIEW_LEN = 120

// Serialized wire shapes (JSON-safe, never leak other visitors' data)
export interface ChatMessageDTO {
  id: string
  sender: string
  body: string
  agentEmail?: string | null
  createdAt: string
}

export interface ChatConversationDTO {
  id: string
  status: string
  visitorName?: string | null
  visitorEmail?: string | null
  visitorPhone?: string | null
  subject?: string | null
  lastMessageAt: string
  lastMessagePreview?: string | null
  unreadCount: number
  createdAt: string
}

export function serializeMessage(m: ChatMessage): ChatMessageDTO {
  return {
    id: m.id,
    sender: m.sender,
    body: m.body,
    agentEmail: m.agentEmail,
    createdAt: m.createdAt.toISOString(),
  }
}

export function serializeConversation(c: ChatConversation): ChatConversationDTO {
  return {
    id: c.id,
    status: c.status,
    visitorName: c.visitorName,
    visitorEmail: c.visitorEmail,
    visitorPhone: c.visitorPhone,
    subject: c.subject,
    lastMessageAt: c.lastMessageAt.toISOString(),
    lastMessagePreview: c.lastMessagePreview,
    unreadCount: c.unreadCount,
    createdAt: c.createdAt.toISOString(),
  }
}

export function chatPreview(body: string): string {
  return body.replace(/\s+/g, ' ').trim().slice(0, CHAT_PREVIEW_LEN)
}

/**
 * Find the visitor's LATEST conversation (any status) for an anonId.
 * Used by the public read path so the widget can show the closed
 * state honestly instead of silently hiding history.
 */
export async function latestConversationFor(anonId: string): Promise<ChatConversation | null> {
  return db.chatConversation.findFirst({
    where: { anonId },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Ensure an OPEN conversation exists for the visitor, carrying over
 * known contact details from their previous conversations.
 * Never reopens a CLOSED thread — a fresh conversation is created.
 */
export async function ensureOpenConversation(anonId: string): Promise<{ conversation: ChatConversation; created: boolean }> {
  const open = await db.chatConversation.findFirst({
    where: { anonId, status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
  })
  if (open) return { conversation: open, created: false }

  const previous = await latestConversationFor(anonId)
  const conversation = await db.chatConversation.create({
    data: {
      anonId,
      visitorName: previous?.visitorName ?? null,
      visitorEmail: previous?.visitorEmail ?? null,
      visitorPhone: previous?.visitorPhone ?? null,
    },
  })
  return { conversation, created: true }
}

/**
 * Resolve a cursor (message id OR ISO timestamp) to the date after
 * which messages should be returned. Returns null when the cursor is
 * absent/unparseable — callers then return the recent window and the
 * client merges/dedupes by message id.
 */
export function resolveCursor(after: string | null, known: ChatMessage[]): Date | null {
  if (!after) return null
  const byId = known.find((m) => m.id === after)
  if (byId) return byId.createdAt
  const d = new Date(after)
  return Number.isNaN(d.getTime()) ? null : d
}
