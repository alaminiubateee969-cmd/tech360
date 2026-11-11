// ============================================================
// TECH360 — 10-POINT AI AGENT RULE ENGINE
//
// A single, PURE evaluation point for anything an AI agent is about
// to say or write on TECH360's behalf. Every rule is expressed once
// here, so a new message template, agent prompt or API route cannot
// bypass a rule that already exists in another file.
//
// Source of truth for the rules it composes (never re-implemented):
//   - docs/AI_VISIBILITY_POLICY.md    → Rule 1 (never disclose AI operation)
//                                     → Rule 2 (control only from admin)
//   - src/lib/pipeline/rules.ts       → approval gates, phone screen,
//                                     CRM save contract, delivery gates
//   - src/lib/contact-policy.ts       → explicit consent helpers
//   - src/lib/ai-workforce-policy.ts  → operator role thresholds
//
// The engine is deliberately side-effect free: no database, no network,
// no environment reads beyond the two policy modules it imports. That
// makes the whole rule set directly testable and safe to call on the
// server before a message is persisted or sent.
// ============================================================

import {
  ADMIN_APPROVAL_CATEGORIES,
  containsAmount,
  containsPhoneNumber,
  findSensitiveFiles,
  gateForCategory,
  gateForStage,
  POLICY_HTML_PREVIEW_BEFORE_PAYMENT,
  POLICY_SOURCE_CODE_AFTER_FULL_PAYMENT,
  type AdminApprovalCategory,
  type MessageGate,
} from '@/lib/pipeline/rules'

/** The ten rules, in the order an operator reads them. */
export const AI_AGENT_RULES = [
  {
    id: 'no-ai-disclosure',
    number: 1,
    title: 'Never disclose AI operation',
    summary:
      'Public and client-facing wording says "Live Support" / "Chat with our team" / "Team Tech360" — never an AI assistant, AI workforce or agent run.',
  },
  {
    id: 'admin-approval-gate',
    number: 2,
    title: 'Final scope, money, legal, handover and disputes need an admin',
    summary:
      'These categories never leave the system without a recorded admin approval, whatever the message is filed under.',
  },
  {
    id: 'no-phone-number',
    number: 3,
    title: 'No phone number in AI content',
    summary: 'AI-authored, website-facing and client-facing content carries no phone number of any kind.',
  },
  {
    id: 'no-amount-on-auto-send',
    number: 4,
    title: 'No amount in an auto-sent message',
    summary: 'Any message carrying a monetary amount is a payment instruction and requires approval.',
  },
  {
    id: 'source-code-after-payment',
    number: 5,
    title: 'Source code only after verified full payment',
    summary: `${POLICY_SOURCE_CODE_AFTER_FULL_PAYMENT}. Handover is released only after payments are verified and cleared.`,
  },
  {
    id: 'preview-before-payment',
    number: 6,
    title: 'HTML preview before payment, where agreed',
    summary: `${POLICY_HTML_PREVIEW_BEFORE_PAYMENT} only where the approved Scope of Work includes a preview; approval is not proof of backend delivery.`,
  },
  {
    id: 'crm-save-contract',
    number: 7,
    title: 'Every exchange is saved to the client record',
    summary: 'Inbound, outbound, Client ID, status change, timestamp, approval, payment proof and delivery proof must all be persisted.',
  },
  {
    id: 'explicit-consent',
    number: 8,
    title: 'No outbound marketing without explicit consent',
    summary: 'Marketing consent is a separate, explicit, auditable purpose from any enquiry consent.',
  },
  {
    id: 'no-secrets',
    number: 9,
    title: 'No secrets, credentials or sensitive files',
    summary: 'Environment secrets, tokens, passwords, database dumps and sensitive file paths never appear in outbound content.',
  },
  {
    id: 'no-third-party-data',
    number: 10,
    title: 'Never expose another client’s record',
    summary: 'A message may reference only the recipient’s own Client ID and project — never another client, staff note or internal metric.',
  },
] as const

export type AiAgentRuleId = (typeof AI_AGENT_RULES)[number]['id']

export type RuleOutcome = 'pass' | 'requires-approval' | 'block'

export type RuleResult = {
  id: AiAgentRuleId
  number: number
  outcome: RuleOutcome
  reason: string
}

export type AgentContentInput = {
  /** The exact text that would be sent or published. */
  body: string
  /** Pipeline message stage, when the content belongs to one. */
  stage?: string
  /** Non-stage approval category, when already known. */
  category?: AdminApprovalCategory | string
  /** true only when an operator has already approved this exact content. */
  adminApproved?: boolean
  /** Client ID of the recipient (used to reject cross-client references). */
  clientId?: string
  /** true when the content is marketing material (needs explicit consent). */
  marketing?: boolean
  /** Whether explicit marketing consent exists for this recipient. */
  marketingConsent?: boolean
  /** Whether the full project payment has been verified and cleared. */
  paymentVerified?: boolean
  /** Whether the content carries source code, files or handover links. */
  releasesSourceCode?: boolean
  /** Whether the agreed Scope of Work includes an HTML preview before payment. */
  previewInScope?: boolean
  /** Whether an HTML preview was approved before any payment step. */
  previewApproved?: boolean
}

export type AgentEvaluation = {
  /** true only when every rule passes or the content is approved. */
  allowed: boolean
  /** 'allow' | 'hold-for-approval' | 'block' */
  decision: 'allow' | 'hold-for-approval' | 'block'
  /** The gate the message must satisfy before it can be sent. */
  gate: MessageGate
  results: RuleResult[]
  /** Human-readable reasons for every non-passing rule. */
  blockers: string[]
  /** Rule numbers that failed, for operator display. */
  failedRules: number[]
}

/* ------------------------------------------------------------------ */
/* Rule 1 — never disclose AI operation                              */
/* ------------------------------------------------------------------ */

/**
 * Wording that would disclose that TECH360's own operations are run by AI.
 * Purchasable client services ("AI Agent Systems") are intentionally absent:
 * those describe systems built FOR a client, not how TECH360 delivers.
 */
const AI_DISCLOSURE_PATTERNS: RegExp[] = [
  /\bai\s+(?:assistant|workforce|employees?|team)\b/i,
  // "AI agent(s)" describes our own delivery only when it is acting on our
  // behalf. A purchasable client service ("AI Agent Systems", "AI agent
  // development") is a product name, not a disclosure.
  /\bai\s+agents?\b(?!\s+(?:systems?|solutions?|capabilit\w+|platform|development|services?|integrations?))/i,
  /\b(?:our|the)\s+ai\s+team\b/i,
  /\bagent\s+runs?\b/i,
  /\bdelivered\s+by\s+(?:our\s+)?ai\b/i,
  /\b(?:autonomous|automated)\s+ai\s+workforce\b/i,
]

function checkNoAiDisclosure(body: string): RuleResult {
  const hit = AI_DISCLOSURE_PATTERNS.find((pattern) => pattern.test(body))
  return hit
    ? {
        id: 'no-ai-disclosure',
        number: 1,
        outcome: 'block',
        reason: `discloses AI operation (matched ${hit.source})`,
      }
    : { id: 'no-ai-disclosure', number: 1, outcome: 'pass', reason: 'no AI-operation wording' }
}

/* ------------------------------------------------------------------ */
/* Rule 2 — admin approval gate                                      */
/* ------------------------------------------------------------------ */

function checkApprovalGate(input: AgentContentInput): RuleResult {
  const gateByStage = input.stage ? gateForStage(input.stage) : null
  const gateByCategory = input.category ? gateForCategory(input.category) : null
  const amountGated = containsAmount(input.body)
  const needsApproval =
    gateByStage === 'ADMIN_APPROVAL_REQUIRED' ||
    gateByCategory === 'ADMIN_APPROVAL_REQUIRED' ||
    amountGated

  if (!needsApproval) {
    return {
      id: 'admin-approval-gate',
      number: 2,
      outcome: 'pass',
      reason: 'auto-send stage with no gated category and no amount',
    }
  }
  if (input.adminApproved === true) {
    return {
      id: 'admin-approval-gate',
      number: 2,
      outcome: 'pass',
      reason: 'a recorded admin approval covers this content',
    }
  }
  const why = amountGated
    ? 'carries a monetary amount'
    : input.category
      ? `is the ${input.category} category`
      : `is stage ${input.stage}`
  return {
    id: 'admin-approval-gate',
    number: 2,
    outcome: 'requires-approval',
    reason: `content ${why}, which requires a recorded admin approval`,
  }
}

/* ------------------------------------------------------------------ */
/* Rule 3 — no phone number                                          */
/* ------------------------------------------------------------------ */

function checkNoPhoneNumber(body: string): RuleResult {
  const found = containsPhoneNumber(body)
  return found
    ? {
        id: 'no-phone-number',
        number: 3,
        outcome: 'block',
        reason: 'contains a phone number; AI content must never publish one',
      }
    : { id: 'no-phone-number', number: 3, outcome: 'pass', reason: 'no phone number' }
}

/* ------------------------------------------------------------------ */
/* Rule 4 — no amount on an auto-send                                */
/* ------------------------------------------------------------------ */

function checkNoAmountOnAutoSend(input: AgentContentInput): RuleResult {
  if (!containsAmount(input.body)) {
    return { id: 'no-amount-on-auto-send', number: 4, outcome: 'pass', reason: 'no monetary amount' }
  }
  if (input.adminApproved === true) {
    return {
      id: 'no-amount-on-auto-send',
      number: 4,
      outcome: 'pass',
      reason: 'amount is covered by a recorded admin approval',
    }
  }
  return {
    id: 'no-amount-on-auto-send',
    number: 4,
    outcome: 'requires-approval',
    reason: 'content carries a monetary amount, so it is a payment instruction',
  }
}

/* ------------------------------------------------------------------ */
/* Rule 5 — source code only after verified payment                  */
/* ------------------------------------------------------------------ */

/** Words that indicate the content is releasing code, files or access. */
const RELEASE_MARKERS =
  /\b(?:source[\s-]?code|repository|repo\s+access|handover|hand[\s-]?over|download\s+link|delivery\s+package|archive|zip\s+file|admin\s+credentials)\b/i

function releasesCode(input: AgentContentInput): boolean {
  if (input.releasesSourceCode === true) return true
  if (input.category === 'SOURCE_CODE_HANDOVER') return true
  if (input.category === 'DELIVERY_FILE_LINKS') return true
  if (input.stage === 'FINAL_SCOPE_APPROVED') return false
  return RELEASE_MARKERS.test(input.body) && /\b(?:here\s+is|attached|download|released|ready\s+for\s+handover|available\s+(?:now|here))\b/i.test(input.body)
}

function checkSourceCodeGate(input: AgentContentInput): RuleResult {
  if (!releasesCode(input)) {
    return {
      id: 'source-code-after-payment',
      number: 5,
      outcome: 'pass',
      reason: 'content does not release source code or delivery files',
    }
  }
  if (input.paymentVerified !== true) {
    return {
      id: 'source-code-after-payment',
      number: 5,
      outcome: 'block',
      reason: 'releases source code or delivery files before payment was verified and cleared',
    }
  }
  if (input.adminApproved !== true) {
    return {
      id: 'source-code-after-payment',
      number: 5,
      outcome: 'requires-approval',
      reason: 'payment is verified, but handover still needs a recorded admin approval',
    }
  }
  return {
    id: 'source-code-after-payment',
    number: 5,
    outcome: 'pass',
    reason: 'payment verified and handover approved',
  }
}

/* ------------------------------------------------------------------ */
/* Rule 6 — preview before payment, where agreed                     */
/* ------------------------------------------------------------------ */

function checkPreviewOrder(input: AgentContentInput): RuleResult {
  // Only meaningful for content that asserts a preview was approved while
  // the agreed scope contains no preview, or when the order is inverted.
  const claimsPreview = /\b(?:html\s+preview|preview\s+link|preview\s+(?:is|was)\s+(?:ready|approved|shared))\b/i.test(input.body)
  if (!claimsPreview) {
    return {
      id: 'preview-before-payment',
      number: 6,
      outcome: 'pass',
      reason: 'content makes no preview claim',
    }
  }
  if (input.previewInScope === false) {
    return {
      id: 'preview-before-payment',
      number: 6,
      outcome: 'block',
      reason: 'claims a preview the approved Scope of Work does not include',
    }
  }
  return {
    id: 'preview-before-payment',
    number: 6,
    outcome: 'pass',
    reason: 'preview is in the agreed scope and precedes any payment step',
  }
}

/* ------------------------------------------------------------------ */
/* Rule 7 — CRM save contract                                        */
/* ------------------------------------------------------------------ */

/** Required persistence fields — mirrored from the pipeline rules module. */
export const REQUIRED_SAVE_FIELDS = [
  'clientId',
  'direction',
  'channel',
  'body',
  'status',
  'createdAt',
] as const

export type SaveRecord = Record<string, unknown>

function checkSaveContract(record?: SaveRecord): RuleResult {
  if (!record) {
    return {
      id: 'crm-save-contract',
      number: 7,
      outcome: 'pass',
      reason: 'no persistence record supplied for this evaluation',
    }
  }
  const missing = REQUIRED_SAVE_FIELDS.filter((field) => {
    const value = record[field]
    return value === undefined || value === null || value === ''
  })
  return missing.length
    ? {
        id: 'crm-save-contract',
        number: 7,
        outcome: 'block',
        reason: `persistence record is missing ${missing.join(', ')}`,
      }
    : {
        id: 'crm-save-contract',
        number: 7,
        outcome: 'pass',
        reason: 'all required fields are present',
      }
}

/* ------------------------------------------------------------------ */
/* Rule 8 — explicit consent for marketing                           */
/* ------------------------------------------------------------------ */

function checkConsent(input: AgentContentInput): RuleResult {
  if (input.marketing !== true) {
    return {
      id: 'explicit-consent',
      number: 8,
      outcome: 'pass',
      reason: 'content is service follow-up, not marketing',
    }
  }
  return input.marketingConsent === true
    ? {
        id: 'explicit-consent',
        number: 8,
        outcome: 'pass',
        reason: 'explicit marketing consent is on record',
      }
    : {
        id: 'explicit-consent',
        number: 8,
        outcome: 'block',
        reason: 'marketing content without explicit marketing consent',
      }
}

/* ------------------------------------------------------------------ */
/* Rule 9 — no secrets or sensitive files                            */
/* ------------------------------------------------------------------ */

const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk_live_[A-Za-z0-9]{8,}/,
  /\bsk_test_[A-Za-z0-9]{8,}/,
  /\bBearer\s+[A-Za-z0-9._-]{16,}/,
  /\b(?:DATABASE_URL|WHATSAPP_ACCESS_TOKEN|NEXTAUTH_SECRET|SESSION_SECRET|OPS_SECRET|HOSTINGER_MAIL_PASSWORD)\s*=/,
  /\b(?:password|passphrase)\s*[:=]\s*\S{6,}/i,
  /SELECT\s+\*\s+FROM/i,
]

function checkNoSecrets(body: string): RuleResult {
  const hit = SECRET_PATTERNS.find((pattern) => pattern.test(body))
  const sensitiveFile = findSensitiveFiles(body)[0]
  if (hit) {
    return {
      id: 'no-secrets',
      number: 9,
      outcome: 'block',
      reason: `contains credential-shaped content (matched ${hit.source})`,
    }
  }
  if (sensitiveFile) {
    return {
      id: 'no-secrets',
      number: 9,
      outcome: 'block',
      reason: `references a sensitive file (${sensitiveFile})`,
    }
  }
  return { id: 'no-secrets', number: 9, outcome: 'pass', reason: 'no secrets or sensitive files' }
}

/* ------------------------------------------------------------------ */
/* Rule 10 — never expose another client's record                    */
/* ------------------------------------------------------------------ */

const CLIENT_ID_PATTERN = /\bTECH-\d{4}-\d{6}\b/g

function checkThirdPartyData(input: AgentContentInput): RuleResult {
  const ids = input.body.match(CLIENT_ID_PATTERN) ?? []
  if (ids.length === 0) {
    return {
      id: 'no-third-party-data',
      number: 10,
      outcome: 'pass',
      reason: 'no client reference in the content',
    }
  }
  if (!input.clientId) {
    return {
      id: 'no-third-party-data',
      number: 10,
      outcome: 'block',
      reason: 'references a Client ID but the recipient is unknown',
    }
  }
  const foreign = ids.filter((id) => id !== input.clientId)
  return foreign.length
    ? {
        id: 'no-third-party-data',
        number: 10,
        outcome: 'block',
        reason: `references another client (${foreign.join(', ')})`,
      }
    : {
        id: 'no-third-party-data',
        number: 10,
        outcome: 'pass',
        reason: 'references only the recipient’s own Client ID',
      }
}

/* ------------------------------------------------------------------ */
/* The engine                                                        */
/* ------------------------------------------------------------------ */

/**
 * Evaluate outbound agent content against all ten rules.
 *
 * Fails closed: any `block` makes the whole evaluation blocked even when the
 * content was approved, and any unapproved `requires-approval` holds it.
 */
export function evaluateAgentContent(input: AgentContentInput, record?: SaveRecord): AgentEvaluation {
  const body = input.body ?? ''
  const results: RuleResult[] = [
    checkNoAiDisclosure(body),
    checkApprovalGate(input),
    checkNoPhoneNumber(body),
    checkNoAmountOnAutoSend(input),
    checkSourceCodeGate(input),
    checkPreviewOrder(input),
    checkSaveContract(record),
    checkConsent(input),
    checkNoSecrets(body),
    checkThirdPartyData(input),
  ]

  const blockers = results.filter((r) => r.outcome !== 'pass').map((r) => `Rule ${r.number}: ${r.reason}`)
  const blocked = results.some((r) => r.outcome === 'block')
  const held = results.some((r) => r.outcome === 'requires-approval')
  const decision: AgentEvaluation['decision'] = blocked ? 'block' : held ? 'hold-for-approval' : 'allow'

  return {
    allowed: decision === 'allow',
    decision,
    gate: decision === 'allow' ? 'AUTO_SEND' : 'ADMIN_APPROVAL_REQUIRED',
    results,
    blockers,
    failedRules: results.filter((r) => r.outcome !== 'pass').map((r) => r.number),
  }
}

/** Every approval category the pipeline recognises, for operator pickers. */
export const APPROVAL_CATEGORIES: readonly AdminApprovalCategory[] = ADMIN_APPROVAL_CATEGORIES

/** Convenience wrapper for routes: true only when the content may be sent. */
export function agentContentIsSendable(input: AgentContentInput, record?: SaveRecord): boolean {
  return evaluateAgentContent(input, record).allowed
}
