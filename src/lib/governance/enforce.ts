// ============================================================
// TECH360 — runtime governance enforcement boundary
// ============================================================
// Every consequential action that moves money, changes a financial
// document or settles a refund calls this module IMMEDIATELY before its
// side effect. The boundary:
//
//   1. evaluates the governance rules for the exact action (fail closed
//      on an evaluation error, a thrown exception or an invalid result);
//   2. requires a human-granted ApprovalRequest for the action, bound to
//      the same action type, resource key and amount, that is APPROVED,
//      not expired, not already consumed, and decided by an active
//      SUPER_ADMIN who is not the requester;
//   3. consumes the approval atomically in the SAME database transaction
//      as the side effect, so a replay or concurrent use cannot execute
//      the action twice, and a failed side effect rolls the approval back;
//   4. writes a GOVERNANCE_DECISION audit row (action, decision, approval
//      status, actor type and id). It never stores payloads or secrets.
//
// The rule engine can only ADD restrictions. The approval requirement
// below is applied even when the rules allow the action, so a missing
// or mis-written rule can never remove the human approval gate.
//
// The only exception is provider evidence: a Stripe webhook whose HMAC
// signature the route has already verified may confirm a payment. It
// is recorded with path PROVIDER_EVIDENCE. Automation, agents and AI
// may never use that path.
// ============================================================

import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  defaultGovernanceRules,
  evaluateGovernance,
  type GovernanceContext,
  type GovernanceDecision,
} from '@/lib/governance/rules'

/** An approval older than this (since its decision) is no longer usable. */
export const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000

export type GovernedAction = 'payment.verify' | 'refund.settle' | 'invoice.generate' | 'communication.send'

type ActionSpec = {
  /** The governance tool the rule engine evaluates. */
  tool: string
  /** The ApprovalRequest.type that must approve this action. */
  approvalType: string
  risk: 'HIGH' | 'CRITICAL'
  /** Provider ids allowed to confirm this action with verified evidence. */
  providerIds: readonly string[]
}

export const GOVERNED_ACTION_SPECS: Record<GovernedAction, ActionSpec> = {
  'payment.verify': { tool: 'payment.verify', approvalType: 'PAYMENT_VERIFY', risk: 'CRITICAL', providerIds: ['stripe'] },
  'refund.settle': { tool: 'refund.settle', approvalType: 'REFUND_SETTLE', risk: 'CRITICAL', providerIds: [] },
  'invoice.generate': { tool: 'invoice.generate', approvalType: 'INVOICE_GENERATE', risk: 'HIGH', providerIds: [] },
  'communication.send': { tool: 'email.send', approvalType: 'MANUAL_COMMUNICATION', risk: 'HIGH', providerIds: [] },
}

export type GovernanceActor =
  | { type: 'HUMAN'; id: string; role: string }
  | { type: 'PROVIDER'; id: string; evidence: 'VERIFIED_SIGNATURE' }
  | { type: 'AGENT'; id: string }
  | { type: 'AUTOMATION'; id: string }

export type DenyCode =
  | 'UNKNOWN_ACTION'
  | 'INVALID_REQUEST'
  | 'GOVERNANCE_EVALUATION_FAILED'
  | 'GOVERNANCE_INVALID_DECISION'
  | 'GOVERNANCE_FORBIDDEN'
  | 'APPROVAL_REQUIRED'
  | 'APPROVAL_NOT_FOUND'
  | 'APPROVAL_TYPE_MISMATCH'
  | 'APPROVAL_PENDING'
  | 'APPROVAL_REJECTED'
  | 'APPROVAL_ALREADY_CONSUMED'
  | 'APPROVAL_NOT_GRANTED'
  | 'APPROVAL_EXPIRED'
  | 'APPROVAL_RESOURCE_MISMATCH'
  | 'APPROVAL_AMOUNT_MISMATCH'
  | 'UNAUTHORIZED_APPROVER'
  | 'SELF_APPROVAL_FORBIDDEN'
  | 'ACTOR_NOT_PERMITTED'
  | 'PROVIDER_NOT_PERMITTED'
  | 'REQUEST_STATE_INVALID'

export type GovernedActionInput = {
  action: GovernedAction
  actor: GovernanceActor
  /** Server-derived identifier of the resource, e.g. `payment:<id>`. Never client-supplied. */
  resourceKey: string
  /** Server-derived amount in minor units, when the action moves money. */
  amountMinor?: number
  /** The approval the caller presents, if any. */
  approvalId?: string | null
  clientId?: string | null
  projectId?: string | null
}

export type ApprovalSnapshot = {
  id: string
  type: string
  status: string
  payload: string | null
  requestedBy: string | null
  decidedBy: string | null
  /** The decision time. ApprovalRequest.updatedAt is set when the decision is recorded. */
  decidedAt: Date | null
}

export type AuthorizationOutcome =
  | { allowed: true; path: 'PROVIDER_EVIDENCE' | 'APPROVAL'; approvalId: string | null; governanceRule: string | null; appliedRules: string[] }
  | { allowed: false; code: DenyCode; reason: string; appliedRules: string[] }

export class GovernanceDeniedError extends Error {
  readonly code: DenyCode
  readonly action: string
  constructor(code: DenyCode, action: string, reason: string) {
    super(`Governance denied ${action}: ${code}`)
    this.name = 'GovernanceDeniedError'
    this.code = code
    this.action = action
  }
}

const ACTOR_TYPES = ['HUMAN', 'PROVIDER', 'AGENT', 'AUTOMATION'] as const

function deny(code: DenyCode, reason: string, appliedRules: string[] = []): AuthorizationOutcome {
  return { allowed: false, code, reason, appliedRules }
}

function isValidDecision(value: unknown): value is GovernanceDecision {
  if (!value || typeof value !== 'object') return false
  const d = value as Record<string, unknown>
  return (
    typeof d.allowed === 'boolean' &&
    typeof d.requiresApproval === 'boolean' &&
    Array.isArray(d.appliedRules) &&
    d.appliedRules.every((rule) => typeof rule === 'string') &&
    typeof d.reason === 'string'
  )
}

function parsePayload(payload: string | null): Record<string, unknown> | null {
  if (!payload) return null
  try {
    const parsed: unknown = JSON.parse(payload)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * The pure authorization decision. It has no database access, so every
 * branch can be tested directly. The database wrapper below only loads
 * the approval and the approver, then calls this function.
 */
export function decideAuthorization(args: {
  input: GovernedActionInput
  approval: ApprovalSnapshot | null
  /** Role of the approver (decidedBy) when the account is active; null when missing or inactive. */
  approverRole: string | null
  now: Date
  /** Injectable for tests. Production uses the real rule engine. */
  evaluate?: (context: GovernanceContext) => unknown
}): AuthorizationOutcome {
  const { input, approval, approverRole, now } = args
  const spec = GOVERNED_ACTION_SPECS[input.action]
  if (!spec) return deny('UNKNOWN_ACTION', 'The action is not governed.')

  const { actor } = input
  if (!actor || !(ACTOR_TYPES as readonly string[]).includes(actor.type) || typeof actor.id !== 'string' || !actor.id.trim()) {
    return deny('INVALID_REQUEST', 'The acting principal is missing or malformed.')
  }
  if (actor.type === 'HUMAN' && (typeof actor.role !== 'string' || !actor.role.trim())) {
    return deny('INVALID_REQUEST', 'The human actor has no role.')
  }
  // Agents and automations never execute these actions, even when a human
  // approval exists. The approval authorizes a human decision, not an AI run.
  if (actor.type === 'AGENT' || actor.type === 'AUTOMATION') {
    return deny('ACTOR_NOT_PERMITTED', 'Agents and automations may not execute this action, even with an approval.')
  }
  if (typeof input.resourceKey !== 'string' || !input.resourceKey.trim()) {
    return deny('INVALID_REQUEST', 'The governed resource is not identified.')
  }
  if (input.amountMinor !== undefined && (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0)) {
    return deny('INVALID_REQUEST', 'The governed amount is invalid.')
  }

  // 1. Policy evaluation. Any throw or malformed result fails closed.
  const context: GovernanceContext = {
    departmentCode: 'COMPANY',
    role: actor.type === 'HUMAN' ? actor.role : actor.type,
    agentId: 'none',
    taskType: input.action,
    tool: spec.tool,
    riskLevel: spec.risk,
    amount: input.amountMinor !== undefined ? input.amountMinor / 100 : undefined,
    rules: defaultGovernanceRules(),
  }
  let decision: unknown
  try {
    decision = args.evaluate ? args.evaluate(context) : evaluateGovernance(context)
  } catch {
    return deny('GOVERNANCE_EVALUATION_FAILED', 'The governance evaluation failed, so the action is refused.')
  }
  if (!isValidDecision(decision)) {
    return deny('GOVERNANCE_INVALID_DECISION', 'The governance decision was malformed, so the action is refused.')
  }
  const applied = decision.appliedRules
  if (!decision.allowed && !decision.requiresApproval) {
    return deny('GOVERNANCE_FORBIDDEN', decision.reason, applied)
  }

  // 2. Provider evidence: a verified provider event may confirm this
  //    action. Only the listed provider and only for the listed action.
  if (actor.type === 'PROVIDER') {
    if (actor.evidence === 'VERIFIED_SIGNATURE' && spec.providerIds.includes(actor.id)) {
      return { allowed: true, path: 'PROVIDER_EVIDENCE', approvalId: null, governanceRule: decision.decidedBy, appliedRules: applied }
    }
    return deny('PROVIDER_NOT_PERMITTED', 'This provider may not confirm this action.', applied)
  }

  // 3. Human approval. Every governed action in this boundary requires one,
  //    even when the rule engine allows it. The rules can only add restrictions.
  if (!input.approvalId) return deny('APPROVAL_REQUIRED', 'A Super Admin approval is required before this action.', applied)
  if (!approval) return deny('APPROVAL_NOT_FOUND', 'The approval was not found.', applied)
  if (approval.id !== input.approvalId) return deny('APPROVAL_NOT_FOUND', 'The approval was not found.', applied)
  if (approval.type !== spec.approvalType) return deny('APPROVAL_TYPE_MISMATCH', 'The approval is for a different action.', applied)
  switch (approval.status) {
    case 'APPROVED':
      break
    case 'PENDING':
      return deny('APPROVAL_PENDING', 'The approval is still pending a decision.', applied)
    case 'REJECTED':
      return deny('APPROVAL_REJECTED', 'The approval was rejected.', applied)
    case 'EXECUTED':
      return deny('APPROVAL_ALREADY_CONSUMED', 'The approval was already used.', applied)
    default:
      return deny('APPROVAL_NOT_GRANTED', 'The approval does not grant this action.', applied)
  }
  if (!approval.decidedAt || now.getTime() - approval.decidedAt.getTime() > APPROVAL_TTL_MS) {
    return deny('APPROVAL_EXPIRED', 'The approval has expired.', applied)
  }

  const payload = parsePayload(approval.payload)
  if (!payload || payload.resourceKey !== input.resourceKey) {
    return deny('APPROVAL_RESOURCE_MISMATCH', 'The approval is for a different resource.', applied)
  }
  if (input.amountMinor !== undefined && payload.amountMinor !== input.amountMinor) {
    return deny('APPROVAL_AMOUNT_MISMATCH', 'The approval is for a different amount.', applied)
  }

  if (!approval.decidedBy || approverRole !== 'SUPER_ADMIN') {
    return deny('UNAUTHORIZED_APPROVER', 'The approval was not granted by an active Super Admin.', applied)
  }
  if (approval.requestedBy && approval.requestedBy === approval.decidedBy) {
    return deny('SELF_APPROVAL_FORBIDDEN', 'The requester cannot approve their own request.', applied)
  }

  return { allowed: true, path: 'APPROVAL', approvalId: approval.id, governanceRule: decision.decidedBy, appliedRules: applied }
}

// ------------------------------------------------------------
// Database-backed wrapper
// ------------------------------------------------------------

type GovernanceReader = Pick<Prisma.TransactionClient, 'approvalRequest' | 'user'>

async function loadAuthorization(client: GovernanceReader, input: GovernedActionInput, now: Date): Promise<AuthorizationOutcome> {
  let approval: ApprovalSnapshot | null = null
  let approverRole: string | null = null
  if (input.approvalId) {
    const row = await client.approvalRequest.findUnique({
      where: { id: input.approvalId },
      select: { id: true, type: true, status: true, payload: true, requestedBy: true, decidedBy: true, updatedAt: true },
    })
    if (row) {
      approval = {
        id: row.id,
        type: row.type,
        status: row.status,
        payload: row.payload,
        requestedBy: row.requestedBy,
        decidedBy: row.decidedBy,
        decidedAt: row.updatedAt,
      }
    }
    if (approval?.decidedBy) {
      const approver = await client.user.findUnique({ where: { id: approval.decidedBy }, select: { role: true, isActive: true } })
      approverRole = approver?.isActive ? approver.role : null
    }
  }
  return decideAuthorization({ input, approval, approverRole, now })
}

async function writeDecisionAudit(
  client: Pick<Prisma.TransactionClient, 'auditLog'>,
  input: GovernedActionInput,
  outcome: AuthorizationOutcome,
  now: Date,
) {
  // Written with the same client as the decision, so a failed audit write
  // fails the whole action. Only identifiers and codes are recorded.
  await client.auditLog.create({
    data: {
      actor: input.actor.type === 'HUMAN' ? `user:${input.actor.id}` : `${input.actor.type.toLowerCase()}:${input.actor.id}`,
      userId: input.actor.type === 'HUMAN' ? input.actor.id : null,
      action: 'GOVERNANCE_DECISION',
      entityType: 'GovernedAction',
      entityId: input.approvalId ?? input.resourceKey,
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      details: JSON.stringify({
        action: input.action,
        decision: outcome.allowed ? 'ALLOW' : 'DENY',
        path: outcome.allowed ? outcome.path : null,
        code: outcome.allowed ? null : outcome.code,
        reason: outcome.allowed ? null : outcome.reason.slice(0, 300),
        approvalId: input.approvalId ?? null,
        resourceKey: input.resourceKey,
        amountMinor: input.amountMinor ?? null,
        governanceRule: outcome.allowed ? outcome.governanceRule : null,
        appliedRules: outcome.appliedRules,
        decidedAt: now.toISOString(),
      }),
    },
  })
}

/**
 * Check the boundary without executing anything, for callers that only
 * need a yes/no (for example, an AI tool that must skip a step). A denial
 * is audited. An audit write failure throws, so the caller fails closed.
 */
export async function checkGovernedAction(input: GovernedActionInput, now: Date = new Date()): Promise<AuthorizationOutcome> {
  const outcome = await loadAuthorization(db, input, now)
  await writeDecisionAudit(db, input, outcome, now)
  return outcome
}

/**
 * Run a governed side effect. The authorization, the approval
 * consumption, the decision audit and the side effect (`work`) all run in
 * ONE database transaction.
 *
 *   - Denied: the denial is audited outside the transaction, then
 *     GovernanceDeniedError is thrown. Nothing was executed.
 *   - Allowed: the approval is consumed with a conditional update
 *     (APPROVED to EXECUTED). If another request consumed it first, the
 *     update matches zero rows and the transaction rolls back.
 *   - `work` throws: the transaction rolls back, including the
 *     consumption, so the approval stays usable for a retry.
 */
export async function executeGoverned<T>(
  input: GovernedActionInput,
  work: (tx: Prisma.TransactionClient, outcome: Extract<AuthorizationOutcome, { allowed: true }>) => Promise<T>,
  now: Date = new Date(),
): Promise<T> {
  const spec = GOVERNED_ACTION_SPECS[input.action]
  const result = await db.$transaction(async (tx) => {
    const outcome = await loadAuthorization(tx, input, now)
    if (!outcome.allowed) return { outcome, value: undefined as T | undefined }
    if (outcome.approvalId) {
      const consumed = await tx.approvalRequest.updateMany({
        where: { id: outcome.approvalId, type: spec.approvalType, status: 'APPROVED' },
        data: {
          status: 'EXECUTED',
          executedAt: now,
          result: JSON.stringify({ governedAction: input.action, resourceKey: input.resourceKey }).slice(0, 4000),
          updatedAt: now,
        },
      })
      if (consumed.count !== 1) {
        return {
          outcome: deny('APPROVAL_ALREADY_CONSUMED', 'The approval was already used by another request.', outcome.appliedRules),
          value: undefined as T | undefined,
        }
      }
    }
    await writeDecisionAudit(tx, input, outcome, now)
    const value = await work(tx, outcome)
    return { outcome, value: value as T | undefined }
  })

  if (!result.outcome.allowed) {
    await writeDecisionAudit(db, input, result.outcome, now)
    throw new GovernanceDeniedError(result.outcome.code, input.action, result.outcome.reason)
  }
  return result.value as T
}

/**
 * The most recent APPROVED approval for this exact resource, or null.
 * It lets a human's repeated request (the admin button sends no approval
 * id) use the decision they already received. It grants nothing: the
 * boundary still validates the approval in full.
 */
export async function findApprovedGovernedApproval(
  action: GovernedAction,
  resourceKey: string,
  client: Pick<Prisma.TransactionClient, 'approvalRequest'> = db,
): Promise<string | null> {
  const spec = GOVERNED_ACTION_SPECS[action]
  const rows = await client.approvalRequest.findMany({
    where: { type: spec.approvalType, status: 'APPROVED' },
    select: { id: true, payload: true },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })
  for (const row of rows) {
    if (parsePayload(row.payload)?.resourceKey === resourceKey) return row.id
  }
  return null
}

/**
 * Create (or reuse) the PENDING approval a governed action needs. Reuse
 * prevents a retry loop from piling up duplicate approval requests for
 * the same resource.
 */
export async function ensureGovernedApproval(input: {
  action: GovernedAction
  requestedBy: string
  resourceKey: string
  amountMinor?: number
  clientId?: string | null
  projectId?: string | null
  title: string
  description: string
  extraPayload?: Record<string, unknown>
}): Promise<string> {
  const spec = GOVERNED_ACTION_SPECS[input.action]
  const pending = await db.approvalRequest.findMany({
    where: { type: spec.approvalType, status: 'PENDING' },
    select: { id: true, payload: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  for (const row of pending) {
    if (parsePayload(row.payload)?.resourceKey === input.resourceKey) return row.id
  }
  const created = await db.approvalRequest.create({
    data: {
      type: spec.approvalType,
      title: input.title.slice(0, 200),
      description: input.description,
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      risk: spec.risk === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      requestedBy: input.requestedBy,
      payload: JSON.stringify({
        ...(input.extraPayload ?? {}),
        action: input.action,
        resourceKey: input.resourceKey,
        ...(input.amountMinor !== undefined ? { amountMinor: input.amountMinor } : {}),
      }),
    },
  })
  return created.id
}
