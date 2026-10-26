// ============================================================
// TECH360 — outbound communication policy
// ============================================================
// One definition of what makes an outbound message CONSEQUENTIAL (it needs
// a Super Admin approval bound to its exact content and recipient) versus
// ROUTINE (a transactional template that carries no amount, payment,
// contract, handover or legal content).
//
// The classifier is the same one the pipeline already uses. Adding a new
// marker belongs in src/lib/pipeline/rules.ts, not here.
// ============================================================

import { createHash } from 'node:crypto'
import { classifyContentCategory, containsAmount } from '@/lib/pipeline/rules'

export type OutboundPolicy = {
  consequential: boolean
  categories: string[]
  carriesAmount: boolean
}

export function classifyOutbound(body: string, subject?: string | null): OutboundPolicy {
  const text = `${subject ?? ''}\n${body ?? ''}`
  const categories = classifyContentCategory(text).map(String)
  const carriesAmount = containsAmount(text)
  return { consequential: categories.length > 0 || carriesAmount, categories, carriesAmount }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/** Normalised recipient hash. Stored in approval payloads instead of the raw address. */
export function recipientHash(to: string): string {
  return sha256(`recipient:${to.trim().toLowerCase()}`)
}

/**
 * Hash of the exact outbound message: channel, recipient, subject and body.
 * An approval for one message cannot be used for a different recipient,
 * channel or wording, because the hash changes.
 */
export function outboundContentHash(parts: { channel: string; to: string; subject?: string | null; body: string }): string {
  return sha256(
    JSON.stringify({
      channel: parts.channel.toUpperCase(),
      to: parts.to.trim().toLowerCase(),
      subject: parts.subject ?? '',
      body: parts.body,
    }),
  )
}
