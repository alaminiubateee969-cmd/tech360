// ============================================================
// TECH360 — communication pipeline RULES
//
// Three rules from the pipeline specification are enforced in CODE
// here, so they cannot be forgotten in a message template:
//
// 1. AUTO-SEND vs ADMIN-APPROVAL
//    The AI agent may auto-send some messages and must never send
//    another without an admin approval.
//
// 2. NO PHONE NUMBER IN AI CONTENT
//    "AI AGENT NOT MENTION ANY NUMBER AT WEBSITED." Every piece of
//    AI-generated, website-facing or client-facing content is
//    screened for a phone number before it is used.
//
// 3. ALWAYS SAVE
//    The CRM must hold the inbound message, the outbound message
//    (per channel), the client ID, the status change, the
//    timestamp, the admin approval, the payment proof and the
//    delivery proof.
//
// This module is PURE (no database), so it is directly testable.
// ============================================================

import { PIPELINE_MESSAGE_STAGES, type PipelineMessageStage } from './templates'

// ------------------------------------------------------------
// RULE 1 — AUTO-SEND vs ADMIN APPROVAL
// ------------------------------------------------------------

/**
 * The messages the AI agent may send on its own.
 *
 * Straight from the specification:
 *   "AI CAN AUTO SEND: first reply, business-type request,
 *    recommended plan, scope questions, meeting link,
 *    HTML-preview notification, revision acknowledgement,
 *    payment-received acknowledgement, review request."
 */
export const AUTO_SEND_STAGES: readonly PipelineMessageStage[] = [
  'FIRST_MESSAGE',
  'BUSINESS_TYPE_RECEIVED',
  'SCOPE_DETAILS_RECEIVED',
  'MEETING_REQUESTED',
  'SCOPE_APPROVED',
  'HTML_PREVIEW_SENT',
  'REVISION_REQUESTED',
  'PAYMENT_RECEIVED',
  'FINAL_DELIVERY_READY',
  'FINAL_DELIVERY_COMPLETED',
  'PROJECT_CLOSED',
]

/**
 * The messages that must NOT leave the system until an admin has
 * approved them.
 *
 * Straight from the specification:
 *   "AI MUST WAIT FOR ADMIN APPROVAL BEFORE SENDING: final Scope of
 *    Work, payment instruction with amount, invoice,
 *    legal/refund response, source-code handover, final delivery
 *    file links, dispute response."
 */
export const ADMIN_APPROVAL_STAGES: readonly PipelineMessageStage[] = [
  // The final Scope of Work.
  'FINAL_SCOPE_APPROVED',
  // Stage 7B: the client approved the HTML preview, so the next
  // message is the payment step. It is payment-specific, so it
  // waits for an admin even though it carries no amount.
  'HTML_PREVIEW_APPROVED',
]

/**
 * The non-template categories that also require an admin approval.
 * These are the message kinds that are not tied to one pipeline
 * stage but are named explicitly in the specification.
 */
export const ADMIN_APPROVAL_CATEGORIES = [
  'FINAL_SCOPE',
  'PAYMENT_INSTRUCTION',
  'INVOICE',
  'LEGAL_RESPONSE',
  'REFUND_RESPONSE',
  'SOURCE_CODE_HANDOVER',
  'DELIVERY_FILE_LINKS',
  'DISPUTE_RESPONSE',
] as const

export type AdminApprovalCategory = (typeof ADMIN_APPROVAL_CATEGORIES)[number]

export type MessageGate = 'AUTO_SEND' | 'ADMIN_APPROVAL_REQUIRED'

// ------------------------------------------------------------
// The content classifier
// ------------------------------------------------------------

/**
 * The approval categories that can be detected from the message body.
 *
 * The markers are deliberately HIGH PRECISION. The pipeline copy uses
 * "source code", "admin access", "handover", "payment policy" and
 * "non-refundable" as POLICY STATEMENTS inside messages that are
 * allowed to auto-send, so a loose keyword scan would wrongly gate
 * five of the auto-send stages. Only markers that appear in NONE of
 * the auto-send copy are used here.
 */
const CONTENT_MARKERS: Array<{ category: AdminApprovalCategory; pattern: RegExp }> = [
  // An invoice is never auto-sent. ("invoice" appears in no auto-send body.)
  { category: 'INVOICE', pattern: /\binvoices?\b|\bINV-\d{4}-\d{4}\b/i },
  // A legal response. ("legal" appears in no auto-send body.)
  { category: 'LEGAL_RESPONSE', pattern: /\b(legal|liabilit\w*|indemnit\w*|attorney|lawyer|arbitration|breach of contract|force majeure)\b/i },
  // A refund response — but NOT the policy statement "non-refundable".
  { category: 'REFUND_RESPONSE', pattern: /(?<!non-)\brefund\w*/i },
  // A dispute response.
  { category: 'DISPUTE_RESPONSE', pattern: /\bdisput\w*/i },
]

/**
 * A URL that points at a delivered file package.
 *
 * The meeting link ("/#contact") and the HTML preview link
 * ("/api/preview/<token>") are auto-send; a handover or download link
 * is not. "preview" is therefore deliberately absent from the list.
 */
const DELIVERY_LINK = /\/(?:download|handover|archive|package|source-?code|files?)\b/i

/** A payment word — used only together with a real amount. */
const PAYMENT_WORD = /\b(payment|paid|pay|invoice|due|balance|milestone|advance|transaction reference|installment)\b/i

/**
 * The approval categories detected in a message body.
 *
 * This is the content-level half of the policy: it makes the seven
 * gated categories detectable from the message itself, so a message
 * cannot slip past the gate by being filed under an auto-send stage.
 */
export function classifyContentCategory(body: string): AdminApprovalCategory[] {
  if (!body) return []
  const found = new Set<AdminApprovalCategory>()
  const masked = maskIdentifiers(body)

  for (const marker of CONTENT_MARKERS) {
    marker.pattern.lastIndex = 0
    if (marker.pattern.test(masked)) found.add(marker.category)
  }

  // A money amount together with a payment word is a payment instruction.
  if (containsAmount(body) && PAYMENT_WORD.test(masked)) found.add('PAYMENT_INSTRUCTION')

  // A link to a delivered package is a source-code handover or a
  // delivery-file-links message. The link scan runs on the ORIGINAL
  // text, because masking replaces the URL characters.
  for (const match of body.matchAll(/https?:\/\/[^\s<>"']+/g)) {
    if (DELIVERY_LINK.test(match[0])) {
      found.add('DELIVERY_FILE_LINKS')
      found.add('SOURCE_CODE_HANDOVER')
    }
  }

  return [...found]
}

/**
 * The effective gate of a concrete message.
 *
 * A stage that is normally auto-sent still requires an approval when
 * its body carries an amount — that is the "payment instruction with
 * amount" rule, enforced on the CONTENT, not only on the stage label.
 * The same is true of the other six gated categories: if the body
 * reads as an invoice, a legal or refund response, a dispute response,
 * a source-code handover or a delivery-file-links message, it is gated
 * whatever the stage is called.
 */
export function effectiveGate(stage: string, body: string, category?: string): MessageGate {
  if (category && gateForCategory(category) === 'ADMIN_APPROVAL_REQUIRED') return 'ADMIN_APPROVAL_REQUIRED'
  if (gateForStage(stage) === 'ADMIN_APPROVAL_REQUIRED') return 'ADMIN_APPROVAL_REQUIRED'
  if (containsAmount(body)) return 'ADMIN_APPROVAL_REQUIRED'
  if (classifyContentCategory(body).length > 0) return 'ADMIN_APPROVAL_REQUIRED'
  return 'AUTO_SEND'
}

/** Why a message was gated — shown to the operator in the console. */
export function gateReason(stage: string, body: string, category?: string): string {
  if (category && gateForCategory(category) === 'ADMIN_APPROVAL_REQUIRED') {
    return `the ${category} category requires an admin approval`
  }
  if (gateForStage(stage) === 'ADMIN_APPROVAL_REQUIRED') {
    return `the ${stage} stage requires an admin approval`
  }
  if (containsAmount(body)) {
    return 'the message carries a monetary amount'
  }
  const detected = classifyContentCategory(body)
  if (detected.length > 0) {
    return `the message reads as ${detected.join(' / ')}`
  }
  return 'the message is on the auto-send list'
}

/** The gate for a pipeline stage. Unknown stages fail closed. */
export function gateForStage(stage: string): MessageGate {
  if ((ADMIN_APPROVAL_STAGES as readonly string[]).includes(stage)) return 'ADMIN_APPROVAL_REQUIRED'
  if ((AUTO_SEND_STAGES as readonly string[]).includes(stage)) return 'AUTO_SEND'
  // FAIL CLOSED: an unknown stage is never auto-sent.
  return 'ADMIN_APPROVAL_REQUIRED'
}

/** The gate for a non-stage category. Unknown categories fail closed. */
export function gateForCategory(category: string): MessageGate {
  if ((ADMIN_APPROVAL_CATEGORIES as readonly string[]).includes(category)) return 'ADMIN_APPROVAL_REQUIRED'
  return 'ADMIN_APPROVAL_REQUIRED'
}

// ------------------------------------------------------------
// Amount detection — a message that carries money is gated
// ------------------------------------------------------------

/**
 * A monetary amount, precisely.
 *
 * The pipeline copy contains percentages ("Advance 40%") and currency
 * names in *policy statements* ("payment is non-refundable unless
 * …"), so a loose test would gate messages that the policy allows.
 * These three patterns are the only shapes that really carry money:
 *
 *   $1,500        1,500 USD        USD 1,500
 *
 * A percentage is never an amount, and a bare four-digit number is
 * only an amount when it is not a year.
 */
const AMOUNT_PATTERNS: RegExp[] = [
  /[$€£¥৳]\s?\d[\d,]*(?:\.\d+)?/g,
  /\b\d[\d,]*(?:\.\d+)?\s?(?:USD|EUR|GBP|BDT|INR|PKR|AED)\b/gi,
  /\b(?:USD|EUR|GBP|BDT|INR|PKR|AED)\s?\d[\d,]*(?:\.\d+)?/gi,
]

/** A bare number that is money rather than a year or a list index. */
const BARE_AMOUNT = /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g

/**
 * True when the text carries a monetary amount.
 *
 * The specification gates a "payment instruction WITH AMOUNT".
 * The check is deliberately precise: any currency symbol or currency
 * code next to a number counts, and a bare four-digit number counts
 * when it is not a year and not a percentage.
 */
export function containsAmount(text: string): boolean {
  if (!text) return false
  // Only the IDENTIFIERS are masked here: a currency amount is exactly
  // what this function is looking for.
  const masked = maskIdentifiers(text)
  for (const pattern of AMOUNT_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(masked)) return true
  }
  for (const match of masked.matchAll(BARE_AMOUNT)) {
    // 1,500 / 1,500.00 — a thousands separator is always money.
    if (match[0].includes(',')) return true
  }
  for (const match of masked.matchAll(/\b(\d{4,})\b/g)) {
    const value = Number(match[1])
    if (!Number.isFinite(value)) continue
    // A year is not money.
    if (value >= 1900 && value <= 2100) continue
    // A percentage is not money.
    const after = masked.slice((match.index ?? 0) + match[1].length, (match.index ?? 0) + match[1].length + 1)
    if (after === '%') continue
    return true
  }
  return false
}

// ------------------------------------------------------------
// RULE 2 — NO PHONE NUMBER IN AI CONTENT
// ------------------------------------------------------------

/**
 * Patterns that are NOT phone numbers but contain digits.
 *
 * Each entry blanks the match out (preserving its length) before
 * the phone scan runs, so a Client ID such as TECH-2026-000001 is
 * never mistaken for a number.
 */
const IDENTIFIER_PATTERNS: RegExp[] = [
  // Client ID — TECH-2026-000001
  /\bTECH-\d{4}-\d{6}\b/gi,
  // URLs
  /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi,
  // Email addresses
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
  // ISO dates
  /\b\d{4}-\d{2}-\d{2}\b/g,
  // Invoice / project / order numbers, including a second segment
  // (INV-2026-0001, SOW-2026-0002)
  /\b(?:INV|PRJ|REF|ORD|SOW)[-\s]?\d{2,6}(?:[-\s]\d{2,6})?\b/gi,
]

/**
 * A currency amount, symbol first. It is NOT an identifier, so the
 * amount detector must be able to see it — but the phone scanner must
 * not, because "$1234567" is seven digits and would look like a
 * number.
 */
const CURRENCY_AMOUNT = /[$€£¥৳]\s?\d[\d,.]*(?:\s?(?:USD|EUR|GBP|BDT|INR|PKR|AED|tk))?/gi

/**
 * A phone-number candidate: an optional leading +, then a run of
 * digits and common separators, ending in a digit.
 */
const PHONE_CANDIDATE = /(?:\+?\d[\d\s().-]{4,}\d)/g

/** A masked placeholder such as +880 1XXX-XXXXXX. */
const MASKED_PHONE = /(?:\+?\d[\s().-]{0,4})?X{3,}[\dX\s().-]{2,}/gi

/**
 * Blank out the identifier patterns, keeping the string length
 * identical so that the offsets of a phone candidate still point at
 * the same characters in the original text.
 */
function maskIdentifiers(text: string): string {
  let masked = text
  for (const pattern of IDENTIFIER_PATTERNS) {
    masked = masked.replace(pattern, (match) => match.replace(/[^\s]/g, 'x'))
  }
  return masked
}

/**
 * Blank out the identifiers AND the currency amounts.
 *
 * Used by the phone scanner, where "$1234567" must not be read as a
 * phone number.
 */
function maskSafePatterns(text: string): string {
  return maskIdentifiers(text).replace(CURRENCY_AMOUNT, (match) => match.replace(/[^\s]/g, 'x'))
}

type PhoneRange = { start: number; end: number; text: string }

/** Every phone-number range in the text, in order. */
function phoneRanges(text: string): PhoneRange[] {
  if (!text) return []
  const masked = maskSafePatterns(text)
  const ranges: PhoneRange[] = []
  for (const match of masked.matchAll(PHONE_CANDIDATE)) {
    const candidate = match[0]
    const digits = candidate.replace(/\D/g, '')
    if (digits.length < 7) continue
    const start = match.index ?? 0
    ranges.push({ start, end: start + candidate.length, text: text.slice(start, start + candidate.length) })
  }
  for (const match of text.matchAll(MASKED_PHONE)) {
    const start = match.index ?? 0
    ranges.push({ start, end: start + match[0].length, text: match[0] })
  }
  return ranges.sort((a, b) => a.start - b.start)
}

/**
 * Find phone numbers in a piece of text.
 *
 * Safe patterns (client IDs, URLs, emails, dates, amounts, document
 * numbers) are blanked out first, so a Client ID such as
 * TECH-2026-000001 is never mistaken for a number.
 */
export function findPhoneNumbers(text: string): string[] {
  return phoneRanges(text).map((range) => range.text.trim()).filter((value) => value.length > 0)
}

/** True when the text contains a phone number. */
export function containsPhoneNumber(text: string): boolean {
  return phoneRanges(text).length > 0
}

/**
 * Remove every phone number from the text.
 *
 * Used as a last-resort guard on AI output that must not carry a
 * number: the number is replaced, not the whole message. The rest
 * of the text — including client IDs, links and amounts — is left
 * untouched.
 */
export function redactPhoneNumbers(text: string): string {
  if (!text) return text
  const chars = [...text]
  for (const range of phoneRanges(text)) {
    for (let i = range.start; i < range.end; i += 1) {
      if (chars[i] !== undefined) chars[i] = ' '
    }
  }
  return chars.join('')
}

export class PhoneNumberInAiContentError extends Error {
  readonly code = 'PHONE_NUMBER_IN_AI_CONTENT'
  readonly matches: string[]
  readonly context: string
  constructor(matches: string[], context = 'AI content') {
    super(`${context} must not contain a phone number.`)
    this.name = 'PhoneNumberInAiContentError'
    this.matches = matches
    this.context = context
  }
}

/**
 * Throw when the text carries a phone number.
 *
 * Used by the journey engine on every AI-generated, client-facing
 * message and by the website content path.
 */
export function assertNoPhoneNumber(text: string, context = 'AI content'): void {
  const matches = findPhoneNumbers(text)
  if (matches.length > 0) {
    throw new PhoneNumberInAiContentError(matches, context)
  }
}

/**
 * Screen AI content: returns the text with any phone number
 * removed, and reports what was found.
 */
export function screenAiContent(text: string): { text: string; redacted: string[] } {
  const redacted = findPhoneNumbers(text)
  if (redacted.length === 0) return { text, redacted }
  return { text: redactPhoneNumbers(text), redacted }
}

// ------------------------------------------------------------
// RULE 3 — ALWAYS SAVE
// ------------------------------------------------------------

/**
 * The records the CRM must hold for every client, whatever the
 * channel. The journey engine writes one of each per message.
 */
export const CRM_SAVE_FIELDS = [
  'clientId',
  'messageHistory',
  'scopeHistory',
  'approvalHistory',
  'paymentHistory',
  'deliveryHistory',
  'reviewHistory',
] as const

export type CrmSaveField = (typeof CRM_SAVE_FIELDS)[number]

/** The communication rows that must exist for one outbound message. */
export const REQUIRED_SAVED_CHANNELS = ['WHATSAPP', 'SMS', 'EMAIL'] as const

/**
 * Which of the always-save fields a given journey action produces.
 * Used by the journey engine to prove that nothing was skipped.
 */
export const ACTION_SAVE_FIELDS: Record<string, CrmSaveField[]> = {
  INTAKE: ['clientId', 'messageHistory'],
  DETECT_BUSINESS: ['clientId', 'messageHistory'],
  RECOMMEND_PLAN: ['clientId', 'messageHistory'],
  ASK_SCOPE_QUESTIONS: ['clientId', 'messageHistory'],
  SUBMIT_SCOPE: ['clientId', 'messageHistory', 'scopeHistory'],
  AI_SCOPE_REVIEW: ['clientId', 'scopeHistory', 'approvalHistory'],
  ADMIN_SCOPE_APPROVAL: ['clientId', 'approvalHistory'],
  SEND_FINAL_SCOPE: ['clientId', 'messageHistory', 'approvalHistory', 'scopeHistory'],
  CLIENT_SCOPE_DECISION: ['clientId', 'messageHistory', 'scopeHistory', 'approvalHistory'],
  REQUEST_MEETING: ['clientId', 'messageHistory'],
  GENERATE_PREVIEW: ['clientId', 'messageHistory'],
  PREVIEW_DECISION: ['clientId', 'messageHistory', 'approvalHistory'],
  REQUEST_PAYMENT: ['clientId', 'messageHistory', 'approvalHistory'],
  RECORD_PAYMENT: ['clientId', 'paymentHistory'],
  VERIFY_PAYMENT: ['clientId', 'paymentHistory', 'approvalHistory'],
  PREPARE_HANDOVER: ['clientId', 'deliveryHistory'],
  RELEASE_HANDOVER: ['clientId', 'messageHistory', 'deliveryHistory', 'approvalHistory'],
  DELIVERY_CONFIRM: ['clientId', 'messageHistory', 'deliveryHistory'],
  REQUEST_REVIEW: ['clientId', 'messageHistory', 'reviewHistory'],
  REQUEST_REFERRAL: ['clientId', 'messageHistory', 'reviewHistory'],
  CLOSE_PROJECT: ['clientId', 'deliveryHistory', 'reviewHistory'],
}

// ------------------------------------------------------------
// The policy contract — the two policies the specification names
// ------------------------------------------------------------

export const POLICY_HTML_PREVIEW_BEFORE_PAYMENT = 'HTML Preview Before Payment'
export const POLICY_SOURCE_CODE_AFTER_FULL_PAYMENT = 'Source Code After Full Payment'

/**
 * The non-negotiable delivery rules.
 *
 * `assertDeliveryRules` is called by the handover release path so
 * the source code can never be released before full payment, and
 * `assertNoSensitiveFilesInPublicContent` so a public AI message
 * can never carry a file link.
 */
export function assertDeliveryRules(input: { paymentConfirmed: boolean; sourceCodeRelease: boolean; adminApproved: boolean }): void {
  if (input.sourceCodeRelease && !input.paymentConfirmed) {
    throw new Error('Source code cannot be released before payment is confirmed.')
  }
  if (input.sourceCodeRelease && !input.adminApproved) {
    throw new Error('Source code handover requires an admin approval.')
  }
}

/**
 * A public AI message must not carry a file link (source code, a
 * zip, a private document). The delivery links are only ever sent
 * through the gated handover path.
 */
const SENSITIVE_FILE_PATTERN = /\b(?:https?:\/\/\S+\.(?:zip|rar|7z|tar|gz|sql|dump|env|key|pem|p12|pfx)|[^\s]+\.(?:zip|rar|7z|tar|gz|sql|dump|env|key|pem|p12|pfx))\b/i

export function findSensitiveFiles(text: string): string[] {
  return text.match(SENSITIVE_FILE_PATTERN) ?? []
}

export function assertNoSensitiveFilesInPublicContent(text: string): void {
  const found = findSensitiveFiles(text)
  if (found.length > 0) {
    throw new Error('Sensitive file reference found in public AI content.')
  }
}

// ------------------------------------------------------------
// Stage <-> number mapping (the 11 stages of the specification)
// ------------------------------------------------------------

/**
 * The 11 stages of the client journey, in order, with the pipeline
 * message stage each one produces. Used by the journey engine and
 * by the console, so there is one definition of the pipeline.
 */
export const CLIENT_JOURNEY_STAGES = [
  { number: 1, key: 'FIRST_MESSAGE', label: 'First message received', messageStage: 'FIRST_MESSAGE' },
  { number: 2, key: 'BUSINESS_TYPE', label: 'Business type received', messageStage: 'BUSINESS_TYPE_RECEIVED' },
  { number: 3, key: 'SCOPE_DETAILS', label: 'Scope details received', messageStage: 'SCOPE_DETAILS_RECEIVED' },
  { number: 4, key: 'FINAL_SCOPE', label: 'Final scope approved', messageStage: 'FINAL_SCOPE_APPROVED' },
  { number: 5, key: 'MEETING', label: 'Meeting needed (5A) / scope approved (5B)', messageStage: 'MEETING_REQUESTED' },
  { number: 6, key: 'HTML_PREVIEW', label: 'HTML preview sent', messageStage: 'HTML_PREVIEW_SENT' },
  { number: 7, key: 'REVISION_OR_APPROVAL', label: 'Revision (7A) / preview approved (7B)', messageStage: 'REVISION_REQUESTED' },
  { number: 8, key: 'PAYMENT', label: 'Payment received', messageStage: 'PAYMENT_RECEIVED' },
  { number: 9, key: 'DELIVERY_READY', label: 'Final delivery ready', messageStage: 'FINAL_DELIVERY_READY' },
  { number: 10, key: 'DELIVERY_CONFIRM', label: 'Final delivery completed', messageStage: 'FINAL_DELIVERY_COMPLETED' },
  { number: 11, key: 'CLOSED', label: 'Client confirms — project closed', messageStage: 'PROJECT_CLOSED' },
] as const satisfies ReadonlyArray<{ number: number; key: string; label: string; messageStage: PipelineMessageStage }>

/** Every message stage must be reachable from the journey table. */
export const JOURNEY_MESSAGE_STAGES: PipelineMessageStage[] = CLIENT_JOURNEY_STAGES.map((s) => s.messageStage)

/** Sanity: the auto-send list and the approval list must partition the message stages. */
export function gatePartitionIsComplete(): boolean {
  const all = new Set<string>(PIPELINE_MESSAGE_STAGES)
  const covered = new Set<string>([...AUTO_SEND_STAGES, ...ADMIN_APPROVAL_STAGES])
  if (covered.size !== all.size) return false
  for (const stage of all) if (!covered.has(stage)) return false
  for (const stage of covered) if (!all.has(stage)) return false
  return true
}
