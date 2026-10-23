// ============================================================
// TECH360 — Hostinger inbound mail and webhook policy (pure)
//
// Everything here is deterministic and has no database, SDK or
// network dependency, so the security-relevant rules are unit-tested.
//
// Webhook authentication (verified in the SDK reference):
//   Hostinger sends each delivery as POST with
//   "Authorization: Bearer <webhook secret>". The secret is returned once
//   when the webhook is created. No HMAC signature, timestamp or delivery
//   id is documented, so replay protection is limited to deduplicating
//   identical request bodies. This limitation is stated, not hidden.
//
// Event types (verified in the SDK enum): "message.received" only.
//   The delivery JSON schema is NOT documented in the SDK. Therefore a
//   delivery is treated as a notification: it triggers a bounded,
//   checkpointed inbox sync that reads the mailbox through the documented
//   API. Payload fields are never trusted to create customer records.
// ============================================================

import { createHash } from 'node:crypto'
import { constantTimeEquals } from '@/lib/constant-time'

export const HOSTINGER_SUPPORTED_EVENTS = ['message.received'] as const

export type WebhookAuthResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_CONFIGURED' | 'MISSING_AUTH' | 'INVALID_AUTH' }

/** Verify "Authorization: Bearer <secret>" in constant time. Fails closed. */
export function verifyHostingerWebhookAuth(input: { authorization: string | null | undefined; secret: string | null | undefined }): WebhookAuthResult {
  const secret = input.secret?.trim() ?? ''
  if (secret.length < 32) return { ok: false, reason: 'NOT_CONFIGURED' }
  const header = input.authorization?.trim() ?? ''
  if (!header) return { ok: false, reason: 'MISSING_AUTH' }
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  if (!match) return { ok: false, reason: 'INVALID_AUTH' }
  return constantTimeEquals(match[1], secret) ? { ok: true } : { ok: false, reason: 'INVALID_AUTH' }
}

export type WebhookEventDecision =
  | { kind: 'SYNC'; eventType: string | null }
  | { kind: 'IGNORE'; eventType: string }
  | { kind: 'INVALID'; reason: string }

/**
 * Decide what a parsed delivery means. `message.received` (or a delivery
 * without an identifiable type, which is treated as a notification) triggers
 * a sync. Any other explicit type is acknowledged and ignored.
 */
export function classifyWebhookDelivery(payload: unknown): WebhookEventDecision {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { kind: 'INVALID', reason: 'Payload must be a JSON object.' }
  }
  const record = payload as Record<string, unknown>
  const candidate = [record.event, record.type, record.eventType].find((v) => typeof v === 'string') as string | undefined
  if (!candidate) return { kind: 'SYNC', eventType: null }
  const eventType = candidate.trim().slice(0, 64)
  if ((HOSTINGER_SUPPORTED_EVENTS as readonly string[]).includes(eventType)) return { kind: 'SYNC', eventType }
  return { kind: 'IGNORE', eventType }
}

/** SHA-256 of the exact raw body. Identical redeliveries map to one receipt. */
export function webhookBodyDedupKey(rawBody: string): string {
  return `body:${createHash('sha256').update(rawBody, 'utf8').digest('hex')}`
}

/**
 * Durable dedupe key for one inbound message. The RFC Message-ID is hashed so
 * arbitrary header length can never break the receipt's length limit.
 */
export function inboundMessageDedupKey(messageId: string | null, uid: number): string {
  if (messageId && messageId.trim()) {
    return `msgid:${createHash('sha256').update(messageId.trim(), 'utf8').digest('hex')}`
  }
  return `uid:${uid}`
}

export type InboxCheckpoint = {
  lastUid: number
  lastRunAt: string | null
  lastSuccessAt: string | null
  lastError: string | null
  lastImported: number
}

export const EMPTY_CHECKPOINT: InboxCheckpoint = {
  lastUid: 0,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastImported: 0,
}

/** Parse the stored checkpoint defensively; corrupt JSON resets to zero rather than skipping mail. */
export function parseCheckpoint(raw: string | null | undefined): InboxCheckpoint {
  if (!raw) return { ...EMPTY_CHECKPOINT }
  try {
    const value = JSON.parse(raw) as Partial<InboxCheckpoint>
    const lastUid = Number.isSafeInteger(value.lastUid) && (value.lastUid as number) >= 0 ? (value.lastUid as number) : 0
    return {
      lastUid,
      lastRunAt: typeof value.lastRunAt === 'string' ? value.lastRunAt : null,
      lastSuccessAt: typeof value.lastSuccessAt === 'string' ? value.lastSuccessAt : null,
      lastError: typeof value.lastError === 'string' ? value.lastError.slice(0, 300) : null,
      lastImported: Number.isSafeInteger(value.lastImported) ? (value.lastImported as number) : 0,
    }
  } catch {
    return { ...EMPTY_CHECKPOINT }
  }
}

/** Keep only messages newer than the checkpoint, oldest first (IMAP "N:*" can return the last old UID). */
export function selectNewUids<T extends { uid: number }>(items: readonly T[], lastUid: number): T[] {
  return items.filter((item) => Number.isSafeInteger(item.uid) && item.uid > lastUid).sort((a, b) => a.uid - b.uid)
}

/** Lower-case, trimmed sender address, or null when it is not a plausible address. */
export function normalizeSenderAddress(address: string | null | undefined): string | null {
  const value = (address ?? '').trim().toLowerCase()
  if (value.length === 0 || value.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null
  return value
}

const HTML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/**
 * Convert an HTML body to readable plain text for the CRM. Scripts and styles
 * are removed before tags are stripped; the result is never rendered as HTML.
 */
export function htmlToPlainText(html: string, maxLength = 8000): string {
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
      if (entity.startsWith('#')) {
        const codePoint = entity.startsWith('#x') || entity.startsWith('#X')
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10)
        // Out-of-range or surrogate code points would throw; keep the literal text instead.
        if (!Number.isInteger(codePoint) || codePoint < 1 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return match
        return String.fromCodePoint(codePoint)
      }
      return HTML_ENTITIES[entity.toLowerCase()] ?? match
    })
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()
  return text.slice(0, maxLength)
}

/** Plain-text body for an outbound email, derived from its HTML so both parts match. */
export function outboundPlainText(html: string): string {
  return htmlToPlainText(html, 20000)
}
