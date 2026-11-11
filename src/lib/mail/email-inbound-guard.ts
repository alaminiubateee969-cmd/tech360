// ============================================================
// TECH360 — Inbound Email Safety, Bounce & RFC 3834 Loop Guard
//
// Protects info@bdtech360.com (both webhook and Hostinger Mail API)
// against:
//   1. Self-sent mail loops (info@bdtech360.com, @bdtech360.com,
//      info@tech360.com, configured SMTP_FROM / HOSTINGER_MAIL_ADDRESS)
//   2. Delivery Status Notifications / Mailer-Daemon bounces
//   3. Automated / no-reply / bulk / auto-responder senders (RFC 3834)
// ============================================================

import { COMPANY, OFFICIAL_INFO } from '@/lib/constants'
import { HOSTINGER_MAIL_ENV } from './hostinger-config'

export type InboundEmailSafetyVerdict =
  | {
      allowProcess: true
      allowAutoReply: true
      classification: 'HUMAN_CUSTOMER'
    }
  | {
      allowProcess: false
      allowAutoReply: false
      classification: 'SELF_SENDER' | 'BOUNCE_NOTIFICATION' | 'AUTO_SUBMITTED' | 'NO_REPLY_SENDER' | 'INVALID_SENDER'
      reason: string
    }

function extractBareEmail(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  const bracket = trimmed.match(/<([^>]+)>/)
  const candidate = (bracket ? bracket[1] : trimmed).trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : ''
}

const SYSTEM_LOCAL_PARTS = /^(?:mailer-daemon|postmaster|noreply|no-reply|no_reply|donotreply|do-not-reply|auto-confirm|autoconfirm|bounce|bounces|daemon|automated|notifications?)$/i

const BOUNCE_SUBJECT_RE =
  /\b(?:undelivered mail returned to sender|delivery status notification\s*\((?:failure|delay)\)|mail delivery failed|returned mail:\s*see transcript|undeliverable:|delivery failure|message not delivered)\b/i

const BOUNCE_BODY_RE =
  /\b(?:diagnostic-code:\s*smtp|action:\s*failed|status:\s*5\.\d+\.\d+|550\s+5\.\d+\.\d+|this is the mail system at host)\b/i

export interface InboundEmailInspectionInput {
  fromEmail: string
  subject?: string | null
  body?: string | null
  headers?: Record<string, string | null | undefined>
}

export function classifyInboundEmailSafety(input: InboundEmailInspectionInput): InboundEmailSafetyVerdict {
  const sender = extractBareEmail(input.fromEmail)
  if (!sender) {
    return {
      allowProcess: false,
      allowAutoReply: false,
      classification: 'INVALID_SENDER',
      reason: 'Missing or invalid sender email address.',
    }
  }

  const [localPart = '', domain = ''] = sender.split('@')

  // 1. Self-sender / internal mailbox guard (prevents infinite self-reply loops)
  const ownAddresses = new Set<string>(
    [
      COMPANY.email,
      COMPANY.publicEmail,
      OFFICIAL_INFO.email,
      OFFICIAL_INFO.padEmail,
      extractBareEmail(process.env.SMTP_FROM),
      extractBareEmail(process.env.SMTP_USER),
      extractBareEmail(process.env[HOSTINGER_MAIL_ENV.fromAddress]),
    ]
      .map((v) => (v ?? '').trim().toLowerCase())
      .filter(Boolean),
  )

  if (ownAddresses.has(sender) || domain === 'bdtech360.com') {
    return {
      allowProcess: false,
      allowAutoReply: false,
      classification: 'SELF_SENDER',
      reason: `Ignored inbound email from internal/own address (${sender}) to prevent mail loop.`,
    }
  }

  const subject = (input.subject ?? '').trim()
  const body = (input.body ?? '').slice(0, 4000)

  // 2. Bounce / DSN detection
  if (
    /^(?:mailer-daemon|postmaster|bounce|bounces)$/i.test(localPart) ||
    BOUNCE_SUBJECT_RE.test(subject) ||
    (BOUNCE_BODY_RE.test(body) && /\b(?:delivery|undelivered|failed|bounce)\b/i.test(subject))
  ) {
    return {
      allowProcess: false,
      allowAutoReply: false,
      classification: 'BOUNCE_NOTIFICATION',
      reason: `Detected bounce / delivery status notification from ${sender}.`,
    }
  }

  // 3. RFC 3834 Auto-Submitted / Precedence / X-Auto-Response-Suppress headers
  const normHeaders: Record<string, string> = {}
  if (input.headers) {
    for (const [k, v] of Object.entries(input.headers)) {
      if (typeof v === 'string' && v.trim()) {
        normHeaders[k.trim().toLowerCase()] = v.trim().toLowerCase()
      }
    }
  }
  const autoSubmitted = normHeaders['auto-submitted']
  if (autoSubmitted && autoSubmitted !== 'no') {
    return {
      allowProcess: false,
      allowAutoReply: false,
      classification: 'AUTO_SUBMITTED',
      reason: `RFC 3834 Auto-Submitted header (${autoSubmitted}) present.`,
    }
  }
  const precedence = normHeaders['precedence']
  if (precedence && /\b(?:bulk|junk|list|auto_reply)\b/i.test(precedence)) {
    return {
      allowProcess: false,
      allowAutoReply: false,
      classification: 'AUTO_SUBMITTED',
      reason: `Automated Precedence header (${precedence}) present.`,
    }
  }
  if (normHeaders['x-autoreply'] || normHeaders['x-autorespond'] || normHeaders['x-auto-response-suppress']) {
    return {
      allowProcess: false,
      allowAutoReply: false,
      classification: 'AUTO_SUBMITTED',
      reason: 'Auto-responder suppression header present.',
    }
  }

  // 4. Automated / no-reply local parts
  if (SYSTEM_LOCAL_PARTS.test(localPart) || localPart.startsWith('noreply+') || localPart.startsWith('bounce+')) {
    return {
      allowProcess: false,
      allowAutoReply: false,
      classification: 'NO_REPLY_SENDER',
      reason: `Automated system sender (${sender}) suppressed from CRM intake and auto-reply.`,
    }
  }

  return {
    allowProcess: true,
    allowAutoReply: true,
    classification: 'HUMAN_CUSTOMER',
  }
}

/** Extract clean display name from `"Alice Rahman <alice@example.com>"` or empty string. */
export function extractSenderDisplayName(rawFrom: string | null | undefined): string {
  if (!rawFrom) return ''
  const trimmed = rawFrom.trim()
  const bracketIdx = trimmed.indexOf('<')
  if (bracketIdx <= 0) return ''
  const name = trimmed
    .slice(0, bracketIdx)
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .trim()
  if (!name || name.includes('@')) return ''
  return name.slice(0, 120)
}
