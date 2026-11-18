// ============================================================
// TECH360 — automation catalog (pure, no I/O)
// ============================================================
// Triggers, actions, condition evaluation, rule validation and the approval
// fingerprint. The engine (engine.ts) and the console both read this file so
// the UI can never offer an action the engine cannot execute.
// ============================================================

import { createHash } from 'node:crypto'

export const TRIGGER_TYPES = {
  WEBCHAT_MESSAGE_RECEIVED: 'A visitor sent a WebChat message',
  CONVERSATION_CREATED: 'A WebChat conversation started',
  CONVERSATION_UNANSWERED: 'A visitor message is still unanswered',
  CONVERSATION_ESCALATED: 'A conversation was escalated',
  HUMAN_REQUESTED: 'A visitor asked for a human',
  CONVERSATION_STATUS_CHANGED: 'A conversation changed inbox state',
  LEAD_CREATED: 'A lead was created',
  CUSTOMER_CREATED: 'A customer record was created',
  EMAIL_RECEIVED: 'An inbound email was recorded',
  WHATSAPP_RECEIVED: 'An inbound WhatsApp message was recorded',
  PAYMENT_VERIFIED: 'A payment was verified by finance',
  PROPOSAL_APPROVED: 'A client approved a proposal/scope',
  PROJECT_STATUS_CHANGED: 'A project changed status',
  DELIVERY_COMPLETED: 'A delivery was completed',
  FOLLOW_UP_DUE: 'A scheduled follow-up became due',
  INTEGRATION_FAILED: 'An integration call failed',
} as const
export type TriggerType = keyof typeof TRIGGER_TYPES

export type ActionSpec = {
  label: string
  /** High-impact actions always require a human approval before they run. */
  highImpact: boolean
  /** Parameters the action accepts (validated on save). */
  params: Record<string, { required: boolean; kind: 'string' | 'number' | 'enum'; values?: readonly string[]; max?: number }>
}

export const ACTION_TYPES = {
  CRM_UPDATE_LEAD: {
    label: 'Update the linked lead / pipeline stage',
    highImpact: false,
    params: {
      pipelineStage: { required: false, kind: 'enum', values: ['CONTACTED', 'BUSINESS_IDENTIFIED'] },
      interest: { required: false, kind: 'string', max: 200 },
    },
  },
  ASSIGN_CONVERSATION: {
    label: 'Assign the conversation to a team or operator',
    highImpact: false,
    params: {
      team: { required: false, kind: 'enum', values: ['SUPPORT', 'SALES', 'BILLING', 'TECHNICAL'] },
      assigneeEmail: { required: false, kind: 'string', max: 200 },
    },
  },
  SET_PRIORITY: {
    label: 'Set conversation priority',
    highImpact: false,
    params: { priority: { required: true, kind: 'enum', values: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] } },
  },
  ESCALATE_CONVERSATION: {
    label: 'Escalate the conversation to a human',
    highImpact: false,
    params: { reason: { required: true, kind: 'string', max: 300 } },
  },
  CREATE_TASK: {
    label: 'Create a human task for the team',
    highImpact: false,
    params: {
      title: { required: true, kind: 'string', max: 200 },
      priority: { required: false, kind: 'enum', values: ['LOW', 'MEDIUM', 'HIGH'] },
    },
  },
  CREATE_SUPPORT_TICKET: {
    label: 'Open a support ticket (escalate + task)',
    highImpact: false,
    params: {
      category: { required: true, kind: 'enum', values: ['GENERAL', 'BILLING', 'TECHNICAL', 'COMPLAINT', 'SALES'] },
    },
  },
  NOTIFY_TEAM: {
    label: 'Notify the operations team',
    highImpact: false,
    params: {
      title: { required: true, kind: 'string', max: 200 },
      severity: { required: false, kind: 'enum', values: ['INFO', 'WARNING', 'CRITICAL'] },
    },
  },
  SEND_APPROVED_REPLY: {
    label: 'Post an operator-approved reply template into WebChat',
    highImpact: false,
    params: { text: { required: true, kind: 'string', max: 1000 } },
  },
  SEND_EMAIL: {
    label: 'Send an email to the customer (consent + provider checked)',
    highImpact: true,
    params: {
      subject: { required: true, kind: 'string', max: 200 },
      text: { required: true, kind: 'string', max: 4000 },
    },
  },
  SEND_WHATSAPP: {
    label: 'Send a WhatsApp message to the customer (consent + provider checked)',
    highImpact: true,
    params: { text: { required: true, kind: 'string', max: 1000 } },
  },
  SCHEDULE_FOLLOW_UP: {
    label: 'Schedule a FOLLOW_UP_DUE event',
    highImpact: false,
    params: {
      delayMinutes: { required: true, kind: 'number' },
      note: { required: false, kind: 'string', max: 300 },
    },
  },
  REQUEST_APPROVAL: {
    label: 'Pause until a Super Admin approves',
    highImpact: true,
    params: { reason: { required: true, kind: 'string', max: 300 } },
  },
  UPDATE_PROJECT_STATUS: {
    label: 'Change a project status',
    highImpact: true,
    params: { status: { required: true, kind: 'enum', values: ['ACTIVE', 'ON_HOLD', 'CLIENT_REVIEW'] } },
  },
  N8N_EXECUTE: {
    label: 'Request an n8n workflow execution (waits for its callback)',
    highImpact: false,
    params: { workflowCode: { required: true, kind: 'string', max: 80 } },
  },
} as const satisfies Record<string, ActionSpec>
export type ActionType = keyof typeof ACTION_TYPES

export const CONDITION_OPS = ['eq', 'neq', 'contains', 'in', 'exists', 'not_exists', 'gt', 'lt'] as const
export type ConditionOp = (typeof CONDITION_OPS)[number]
export type Condition = { field: string; op: ConditionOp; value?: unknown }

export type RuleAction = {
  type: ActionType
  params: Record<string, unknown>
  /** Branch: the action only runs when every condition matches the event. */
  when?: Condition[]
  /** STOP (default) fails the run; CONTINUE records the failure and moves on. */
  onFailure?: 'STOP' | 'CONTINUE'
}

export function isTriggerType(v: unknown): v is TriggerType {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(TRIGGER_TYPES, v)
}
export function isActionType(v: unknown): v is ActionType {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(ACTION_TYPES, v)
}

/** Read a dotted path from the event context, e.g. `payload.channel`. */
export function readPath(source: unknown, path: string): unknown {
  let cur: unknown = source
  for (const part of path.split('.')) {
    if (!part || part === '__proto__' || part === 'constructor' || part === 'prototype') return undefined
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

export function evaluateCondition(ctx: unknown, c: Condition): boolean {
  const actual = readPath(ctx, c.field)
  switch (c.op) {
    case 'exists': return actual !== undefined && actual !== null && actual !== ''
    case 'not_exists': return actual === undefined || actual === null || actual === ''
    case 'eq': return String(actual ?? '') === String(c.value ?? '')
    case 'neq': return String(actual ?? '') !== String(c.value ?? '')
    case 'contains': return String(actual ?? '').toLowerCase().includes(String(c.value ?? '').toLowerCase())
    case 'in': return Array.isArray(c.value) && c.value.map(String).includes(String(actual ?? ''))
    case 'gt': return Number(actual) > Number(c.value)
    case 'lt': return Number(actual) < Number(c.value)
    default: return false
  }
}

export function evaluateConditions(ctx: unknown, conditions: Condition[] | undefined): boolean {
  if (!conditions || conditions.length === 0) return true
  return conditions.every((c) => evaluateCondition(ctx, c))
}

/** Validate a rule body. Returns a list of human-readable issues (empty = valid). */
export function validateRule(input: { triggerType: unknown; conditions: unknown; actions: unknown; maxAttempts?: unknown }): string[] {
  const issues: string[] = []
  if (!isTriggerType(input.triggerType)) issues.push('triggerType is not a supported trigger')
  const conds = Array.isArray(input.conditions) ? input.conditions : null
  if (!conds) issues.push('conditions must be an array')
  conds?.forEach((c, i) => issues.push(...validateConditionShape(c, `conditions[${i}]`)))
  const actions = Array.isArray(input.actions) ? input.actions : null
  if (!actions || actions.length === 0) issues.push('at least one action is required')
  if (actions && actions.length > 20) issues.push('a rule may have at most 20 actions')
  actions?.forEach((a, i) => {
    const label = `actions[${i}]`
    if (!a || typeof a !== 'object') { issues.push(`${label} must be an object`); return }
    const action = a as Record<string, unknown>
    if (!isActionType(action.type)) { issues.push(`${label}.type is not a supported action`); return }
    const spec: ActionSpec = ACTION_TYPES[action.type]
    const params = (action.params && typeof action.params === 'object' ? action.params : {}) as Record<string, unknown>
    for (const [name, rule] of Object.entries(spec.params)) {
      const v = params[name]
      if (v === undefined || v === null || v === '') {
        if (rule.required) issues.push(`${label}.params.${name} is required`)
        continue
      }
      if (rule.kind === 'number' && !(typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 60 * 24 * 90)) issues.push(`${label}.params.${name} must be a number between 0 and 129600`)
      if (rule.kind === 'string' && (typeof v !== 'string' || (rule.max && v.length > rule.max))) issues.push(`${label}.params.${name} must be text up to ${rule.max} characters`)
      if (rule.kind === 'enum' && !(rule.values ?? []).includes(String(v))) issues.push(`${label}.params.${name} must be one of ${(rule.values ?? []).join(', ')}`)
    }
    for (const name of Object.keys(params)) {
      if (!Object.prototype.hasOwnProperty.call(spec.params, name)) issues.push(`${label}.params.${name} is not a parameter of ${action.type}`)
    }
    if (action.when !== undefined) {
      if (!Array.isArray(action.when)) issues.push(`${label}.when must be an array`)
      else action.when.forEach((c, j) => issues.push(...validateConditionShape(c, `${label}.when[${j}]`)))
    }
    if (action.onFailure !== undefined && action.onFailure !== 'STOP' && action.onFailure !== 'CONTINUE') issues.push(`${label}.onFailure must be STOP or CONTINUE`)
  })
  if (input.maxAttempts !== undefined) {
    const n = Number(input.maxAttempts)
    if (!Number.isInteger(n) || n < 1 || n > 10) issues.push('maxAttempts must be an integer from 1 to 10')
  }
  return issues
}

function validateConditionShape(c: unknown, label: string): string[] {
  if (!c || typeof c !== 'object') return [`${label} must be an object`]
  const cond = c as Record<string, unknown>
  const out: string[] = []
  if (typeof cond.field !== 'string' || !/^[A-Za-z0-9_.]{1,80}$/.test(cond.field)) out.push(`${label}.field must be a dotted path`)
  if (!(CONDITION_OPS as readonly string[]).includes(String(cond.op))) out.push(`${label}.op must be one of ${CONDITION_OPS.join(', ')}`)
  return out
}

/** True when the rule needs an approval before any action may run. */
export function ruleNeedsApproval(rule: { requiresApproval: boolean; actions: RuleAction[] }): boolean {
  return rule.requiresApproval || rule.actions.some((a) => ACTION_TYPES[a.type]?.highImpact === true)
}

/** Stable JSON (sorted keys) so the fingerprint does not depend on key order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

/**
 * Fingerprint of exactly what an approval covers: rule id + version, the full
 * action list with parameters, and the event subject. Editing the rule (new
 * version or parameters) or pointing it at another subject changes the hash,
 * which invalidates any earlier approval.
 */
export function approvalFingerprint(input: { ruleId: string; ruleVersion: number; actions: RuleAction[]; subjectType?: string | null; subjectId?: string | null }): string {
  return createHash('sha256').update(stableStringify({
    ruleId: input.ruleId,
    ruleVersion: input.ruleVersion,
    actions: input.actions,
    subjectType: input.subjectType ?? null,
    subjectId: input.subjectId ?? null,
  })).digest('hex')
}

/** Exponential retry backoff: 30s, 2m, 8m, 32m … capped at 6h. */
export function retryDelayMs(attempt: number): number {
  const n = Math.max(1, attempt)
  return Math.min(30_000 * 4 ** (n - 1), 6 * 60 * 60 * 1000)
}
