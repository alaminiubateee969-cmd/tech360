// ============================================================
// TECH360 — Hostinger Agentic Mail: provider profile, MCP wiring and
// per-agent least-privilege mail authority (PURE)
//
// This module contains NO I/O: no database, no network, no SDK. It is the
// single place that answers:
//
//   1. What is the mail provider profile (`hostinger_agentic_mail`) and which
//      capabilities does it expose to the AI Workforce tool gateway?
//   2. Which agent (by functional role) may use which capability, and what
//      approval level does each capability require?
//   3. Is the Hostinger Agentic Mail MCP server configured (names only, never
//      the token), and what is its honest state?
//   4. May an outbound message go to this recipient under the allow/block
//      lists, and may a failed send be retried?
//
// Governing rules encoded here:
//   - No agent ever receives an unrestricted mailbox grant.
//   - An agent can never AUTO-SEND a draft it wrote: a draft is a proposal,
//     a human decision sends it.
//   - An LLM can never authorize its own external action; every send is
//     mapped to an approval level the BACKEND enforces.
//   - Blocked recipients are never bypassed and never retried.
// ============================================================

export const HOSTINGER_AGENTIC_MAIL_PROVIDER = 'hostinger_agentic_mail'
export const HOSTINGER_AGENTIC_MAIL_MCP_PROFILE = 'hostinger_agentic_mail'

/** Environment variable NAMES for the MCP connection (values never leave the server). */
export const HOSTINGER_MCP_ENV = {
  url: 'HOSTINGER_MAIL_MCP_URL',
  token: 'HOSTINGER_MAIL_MCP_TOKEN',
  enabled: 'HOSTINGER_MAIL_MCP_ENABLED',
} as const

// ------------------------------------------------------------
// Capabilities
// ------------------------------------------------------------

export const MAIL_CAPABILITIES = [
  'mail.read',            // read a message in an authorized folder
  'mail.search',          // search an authorized folder
  'mail.thread.read',     // read the conversation thread around a message
  'mail.attachment.read', // download an attachment for analysis
  'mail.draft',           // compose a draft that a human reviews
  'mail.reply',           // reply inside the existing thread
  'mail.forward',         // forward a message when authorized
  'mail.send',            // start a new outbound conversation
  'mail.organize',        // flags / move / folder placement
  'mail.folder.create',   // create a folder
] as const

export type MailCapability = (typeof MAIL_CAPABILITIES)[number]

/**
 * Approval levels.
 *   L0  read-only internal action — no approval, no external effect
 *   L1  internal artifact (draft, folder, flag) — human review before use
 *   L2  customer-facing reply in an existing thread — one human approval
 *   L3  commercial / legal / money / handover message — SUPER_ADMIN approval
 *   L4  irreversible or credential-bearing action — SUPER_ADMIN approval with
 *       explicit confirmation; never automatable
 */
export type ApprovalLevel = 0 | 1 | 2 | 3 | 4

export const CAPABILITY_APPROVAL: Record<MailCapability, ApprovalLevel> = {
  'mail.read': 0,
  'mail.search': 0,
  'mail.thread.read': 0,
  'mail.attachment.read': 1,
  'mail.draft': 1,
  'mail.reply': 2,
  'mail.forward': 2,
  'mail.send': 3,
  'mail.organize': 1,
  'mail.folder.create': 1,
}

// ------------------------------------------------------------
// Per-agent least privilege
// ------------------------------------------------------------

export const MAIL_ROLE_KEYS = [
  'RECEPTIONIST',
  'SALES',
  'SOW',
  'SUPPORT',
  'PROJECT_MANAGER',
  'DELIVERY',
  'ADMIN_ASSISTANT',
] as const

export type MailRoleKey = (typeof MAIL_ROLE_KEYS)[number]

export type MailRoleGrant = {
  role: MailRoleKey
  label: string
  /** Agent codes that carry this role in the workforce registry. */
  agentCodes: readonly string[]
  capabilities: readonly MailCapability[]
  /** Highest approval level this role may participate in (draft/prepare only). */
  maxApprovalLevel: ApprovalLevel
  /** Never true: no role is ever granted the whole mailbox. */
  unrestrictedMailbox: false
}

const READ_ONLY: readonly MailCapability[] = ['mail.read', 'mail.search', 'mail.thread.read', 'mail.draft']

export const MAIL_ROLE_GRANTS: Record<MailRoleKey, MailRoleGrant> = {
  RECEPTIONIST: {
    role: 'RECEPTIONIST',
    label: 'First response / triage',
    agentCodes: ['EML-012', 'CST-020'],
    capabilities: [...READ_ONLY, 'mail.reply'],
    maxApprovalLevel: 2,
    unrestrictedMailbox: false,
  },
  SALES: {
    role: 'SALES',
    label: 'Inbound sales and qualification',
    agentCodes: ['CRM-003', 'PLN-005', 'PRP-009'],
    capabilities: [...READ_ONLY, 'mail.reply', 'mail.attachment.read'],
    maxApprovalLevel: 2,
    unrestrictedMailbox: false,
  },
  SOW: {
    role: 'SOW',
    label: 'Scope of Work and quotation',
    agentCodes: ['SCP-006', 'SCP-007', 'SCP-008', 'INV-017'],
    capabilities: [...READ_ONLY, 'mail.attachment.read', 'mail.reply'],
    maxApprovalLevel: 3,
    unrestrictedMailbox: false,
  },
  SUPPORT: {
    role: 'SUPPORT',
    label: 'Customer support',
    agentCodes: ['CST-020', 'ERR-034'],
    capabilities: [...READ_ONLY, 'mail.reply', 'mail.attachment.read'],
    maxApprovalLevel: 2,
    unrestrictedMailbox: false,
  },
  PROJECT_MANAGER: {
    role: 'PROJECT_MANAGER',
    label: 'Project management',
    agentCodes: ['PRJ-018', 'TSK-019'],
    capabilities: [...READ_ONLY, 'mail.reply'],
    maxApprovalLevel: 2,
    unrestrictedMailbox: false,
  },
  DELIVERY: {
    role: 'DELIVERY',
    label: 'Delivery, QA and handover',
    agentCodes: ['DLV-029', 'HND-030'],
    capabilities: [...READ_ONLY, 'mail.attachment.read', 'mail.reply'],
    maxApprovalLevel: 3,
    unrestrictedMailbox: false,
  },
  ADMIN_ASSISTANT: {
    role: 'ADMIN_ASSISTANT',
    label: 'Office administration',
    agentCodes: ['ADM-033', 'OPS-044'],
    capabilities: [...READ_ONLY, 'mail.organize', 'mail.folder.create'],
    maxApprovalLevel: 2,
    unrestrictedMailbox: false,
  },
}

/** `mail.send` and `mail.forward` are deliberately absent from every role: they
 *  are executed by the backend only after the mapped approval is granted. */
export const AGENT_SEND_CAPABILITIES_NOT_GRANTED: readonly MailCapability[] = ['mail.send', 'mail.forward']

export type MailAuthorizationInput = {
  role: MailRoleKey | null | undefined
  capability: MailCapability | string
  /** Approval level the caller claims. The backend supplies this, never the model. */
  approvalLevel?: number | null
  /** True when the caller wants the provider to transmit immediately. */
  autoSend?: boolean
}

export type MailAuthorizationDecision =
  | { allowed: true; capability: MailCapability; requiredApproval: ApprovalLevel; autoSendAllowed: false }
  | { allowed: false; code: MailDenyCode; reason: string; requiredApproval?: ApprovalLevel }

export type MailDenyCode =
  | 'UNKNOWN_CAPABILITY'
  | 'UNKNOWN_ROLE'
  | 'CAPABILITY_NOT_GRANTED'
  | 'APPROVAL_REQUIRED'
  | 'SELF_AUTHORIZED_SEND'
  | 'UNRESTRICTED_MAILBOX_FORBIDDEN'

/**
 * Decide whether an agent may use a mail capability.
 *
 * Reading is allowed without approval. Anything that leaves the system — a
 * reply, a forward, a new outbound message — requires the approval level the
 * BACKEND recorded (`approvalLevel`). A model cannot pass its own level: the
 * value must come from a decided ApprovalRequest.
 */
export function authorizeMailCapability(input: MailAuthorizationInput): MailAuthorizationDecision {
  const capability = input.capability as MailCapability
  if (!(MAIL_CAPABILITIES as readonly string[]).includes(capability)) {
    return { allowed: false, code: 'UNKNOWN_CAPABILITY', reason: 'Unknown mail capability.' }
  }
  const grant = input.role ? MAIL_ROLE_GRANTS[input.role] : undefined
  if (!grant) {
    return { allowed: false, code: 'UNKNOWN_ROLE', reason: 'The agent has no mail role; no mailbox access is granted.' }
  }
  // No capability that transmits to a customer may ever be triggered by the
  // agent itself, whatever approval the caller claims.
  if (capability === 'mail.send' || capability === 'mail.forward' || (input.autoSend && capability === 'mail.reply')) {
    const required = CAPABILITY_APPROVAL[capability]
    return {
      allowed: false,
      code: input.autoSend || capability === 'mail.send' || capability === 'mail.forward'
        ? 'SELF_AUTHORIZED_SEND'
        : 'CAPABILITY_NOT_GRANTED',
      reason: input.autoSend
        ? 'An agent can never auto-send. A human decision must authorize transmission.'
        : 'This capability is executed by the backend after approval; agents may only prepare it.',
      requiredApproval: required,
    }
  }
  if (!grant.capabilities.includes(capability)) {
    return {
      allowed: false,
      code: 'CAPABILITY_NOT_GRANTED',
      reason: `Role ${grant.role} is not granted ${capability}.`,
      requiredApproval: CAPABILITY_APPROVAL[capability],
    }
  }
  const required = CAPABILITY_APPROVAL[capability]
  const supplied = typeof input.approvalLevel === 'number' ? input.approvalLevel : 0
  if (required > 0 && supplied < required) {
    return {
      allowed: false,
      code: 'APPROVAL_REQUIRED',
      reason: `${capability} requires approval level L${required}; the backend recorded L${supplied}.`,
      requiredApproval: required,
    }
  }
  return { allowed: true, capability, requiredApproval: required, autoSendAllowed: false }
}

// ------------------------------------------------------------
// MCP connection status (names only, never values)
// ------------------------------------------------------------

export type HostingerMcpState = 'DISABLED' | 'INVALID' | 'CONFIGURED'

export type HostingerMcpStatus = {
  state: HostingerMcpState
  profile: typeof HOSTINGER_AGENTIC_MAIL_MCP_PROFILE
  problems: string[]
  /** True when both URL and token are present and well-formed. Never the values. */
  configured: boolean
}

/**
 * Validate the MCP connection settings from the environment.
 * A Hostinger MCP endpoint must be HTTPS; a bearer token must be long enough to
 * be a real credential. Problems are reported by VARIABLE NAME only.
 */
export function readHostingerMcpStatus(env: Record<string, string | undefined> = process.env): HostingerMcpStatus {
  const enabled = (env[HOSTINGER_MCP_ENV.enabled] ?? '').trim() === 'true'
  const url = (env[HOSTINGER_MCP_ENV.url] ?? '').trim()
  const token = (env[HOSTINGER_MCP_ENV.token] ?? '').trim()
  const problems: string[] = []

  if (!enabled) {
    return { state: 'DISABLED', profile: HOSTINGER_AGENTIC_MAIL_MCP_PROFILE, problems: [], configured: false }
  }
  if (!url) problems.push(`${HOSTINGER_MCP_ENV.url} is not set`)
  else if (!/^https:\/\/[^\s]+$/i.test(url)) problems.push(`${HOSTINGER_MCP_ENV.url} must be an https:// URL`)
  if (!token) problems.push(`${HOSTINGER_MCP_ENV.token} is not set`)
  else if (token.length < 20 || /\s/.test(token)) problems.push(`${HOSTINGER_MCP_ENV.token} has an invalid format`)

  const configured = problems.length === 0
  return {
    state: configured ? 'CONFIGURED' : 'INVALID',
    profile: HOSTINGER_AGENTIC_MAIL_MCP_PROFILE,
    problems,
    configured,
  }
}

/**
 * The tool-gateway manifest. Every tool is declared with its capability and the
 * approval level the backend enforces, so a caller cannot invent a wider grant.
 */
export function mailToolManifest(): Array<{ tool: string; capability: MailCapability; approvalLevel: ApprovalLevel; mutates: boolean }> {
  const map: Array<[string, MailCapability]> = [
    ['mail_search', 'mail.search'],
    ['mail_get_message', 'mail.read'],
    ['mail_get_thread', 'mail.thread.read'],
    ['mail_get_attachment', 'mail.attachment.read'],
    ['mail_compose_draft', 'mail.draft'],
    ['mail_reply_in_thread', 'mail.reply'],
    ['mail_forward', 'mail.forward'],
    ['mail_send_new', 'mail.send'],
    ['mail_move_message', 'mail.organize'],
    ['mail_set_flags', 'mail.organize'],
    ['mail_create_folder', 'mail.folder.create'],
  ]
  return map.map(([tool, capability]) => ({
    tool,
    capability,
    approvalLevel: CAPABILITY_APPROVAL[capability],
    mutates: ['mail.organize', 'mail.folder.create', 'mail.reply', 'mail.forward', 'mail.send'].includes(capability),
  }))
}

// ------------------------------------------------------------
// Allow / block governance
// ------------------------------------------------------------

export type RecipientDecision =
  | { allowed: true; reason: 'ALLOWLISTED' | 'NOT_BLOCKED' }
  | { allowed: false; code: 'BLOCKED_RECIPIENT' | 'NOT_ON_ALLOWLIST' | 'INVALID_RECIPIENT'; reason: string }

const SIMPLE_EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/

/** Normalize for list comparison: lower-case, trim. Returns null when unusable. */
export function normalizeRecipient(address: string | null | undefined): string | null {
  const value = (address ?? '').trim().toLowerCase()
  if (!value || value.length > 320 || !SIMPLE_EMAIL.test(value)) return null
  return value
}

/**
 * Allow/block decision. A block ALWAYS wins, even when the address is also
 * allowlisted — an operator's explicit block is never bypassed by an agent,
 * a workflow or a template.
 */
export function decideRecipient(
  address: string | null | undefined,
  lists: { allowlist?: readonly string[]; blocklist?: readonly string[] },
): RecipientDecision {
  const normalized = normalizeRecipient(address)
  if (!normalized) return { allowed: false, code: 'INVALID_RECIPIENT', reason: 'Recipient is not a valid email address.' }
  const blocklist = (lists.blocklist ?? []).map((a) => (a ?? '').trim().toLowerCase()).filter(Boolean)
  const allowlist = (lists.allowlist ?? []).map((a) => (a ?? '').trim().toLowerCase()).filter(Boolean)
  if (blocklist.includes(normalized)) {
    return { allowed: false, code: 'BLOCKED_RECIPIENT', reason: 'This recipient is on the block list. No mail is sent and no retry is attempted.' }
  }
  if (allowlist.length > 0 && !allowlist.includes(normalized)) {
    return { allowed: false, code: 'NOT_ON_ALLOWLIST', reason: 'The allow list is active and this recipient is not on it.' }
  }
  return { allowed: true, reason: allowlist.length > 0 ? 'ALLOWLISTED' : 'NOT_BLOCKED' }
}

/** A rejected send is never retried; a blocked recipient is never retried either. */
export function mayRetryMailFailure(classification: 'ACCEPTED' | 'NOT_PROCESSED' | 'REJECTED' | 'AMBIGUOUS' | 'BLOCKED'): boolean {
  return classification === 'NOT_PROCESSED'
}
