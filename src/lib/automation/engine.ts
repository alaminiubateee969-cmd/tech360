// ============================================================
// TECH360 — automation engine (event-driven, persisted, idempotent)
// ============================================================
// emitAutomationEvent()  persist an AutomationEvent (unique dedupeKey) and,
//                        when it is due, match ACTIVE rules of the same tenant.
// processAutomationEvent() creates one AutomationRun per matching rule with a
//                        deterministic idempotency key and executes it.
// executeAutomationRun() claims the run atomically, enforces the approval
//                        policy, executes actions in order, records every step,
//                        and only marks SUCCEEDED after every action succeeded.
//                        Failures retry with backoff, then DEAD_LETTER.
// processDueAutomation() the scheduler tick: due retries, due scheduled events
//                        and unanswered-conversation detection.
// replayAutomationRun()  manual replay of a finished/failed run (new run row,
//                        linked with replayOfId; the original is never mutated).
// ============================================================

import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { DEFAULT_TENANT_ID } from '@/lib/tenancy'
import { logError } from '@/lib/security'
import { redactSensitiveCrmData } from '@/lib/sensitive-redaction'
import {
  approvalFingerprint,
  evaluateConditions,
  retryDelayMs,
  ruleNeedsApproval,
  type Condition,
  type RuleAction,
  type TriggerType,
} from '@/lib/automation/catalog'

export type EventInput = {
  tenantId?: string
  type: TriggerType
  source: string
  subjectType?: string | null
  subjectId?: string | null
  payload: Record<string, unknown>
  dedupeKey?: string
  correlationId?: string
  availableAt?: Date
  /** Causation depth: events emitted by a run carry depth+1. Processing stops past MAX_DEPTH. */
  depth?: number
}

export const MAX_EVENT_DEPTH = 3
/** Prefix on action idempotency keys (also stored as Communication.workflowId) so automation-originated sends are recognisable. */
export const AUTOMATION_WORKFLOW_PREFIX = 'automation:'
export const UNANSWERED_AFTER_MS = 10 * 60 * 1000

export type StepRecord = {
  index: number
  type: string
  status: 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'WAITING' | 'INFO'
  detail: string
  attempt: number
  at: string
  output?: Record<string, unknown>
}

export type ActionOutcome = {
  status: 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'WAITING'
  detail: string
  retryable?: boolean
  output?: Record<string, unknown>
}

export type RuleSnapshot = {
  triggerType: string
  conditions: Condition[]
  actions: RuleAction[]
  requiresApproval: boolean
  maxAttempts: number
}

function isUniqueConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'P2002')
}

function safeJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback
  try { return JSON.parse(text) as T } catch { return fallback }
}

/** Redact free-text fields before they are persisted in an event payload. */
function redactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload)) {
    out[k] = typeof v === 'string' ? redactSensitiveCrmData(v.slice(0, 2000)).text : v
  }
  return out
}

// ------------------------------------------------------------
// Events
// ------------------------------------------------------------
export async function emitAutomationEvent(input: EventInput, opts: { process?: boolean } = {}) {
  const tenantId = input.tenantId || DEFAULT_TENANT_ID
  // dedupeKey is globally unique: namespace non-default tenants so two tenants
  // can never collide on (or read back) each other's event.
  const baseKey = input.dedupeKey || `${input.type}:${input.subjectId ?? 'none'}:${randomUUID()}`
  const dedupeKey = (tenantId === DEFAULT_TENANT_ID ? baseKey : `t:${tenantId}:${baseKey}`).slice(0, 191)
  const payload = { ...redactPayload(input.payload), _depth: input.depth ?? 0 }
  let event
  let duplicate = false
  try {
    event = await db.automationEvent.create({
      data: {
        tenantId,
        type: input.type,
        source: input.source,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
        payload: JSON.stringify(payload),
        dedupeKey,
        correlationId: input.correlationId ?? `evt_${randomUUID()}`,
        availableAt: input.availableAt ?? new Date(),
      },
    })
  } catch (error) {
    if (!isUniqueConflict(error)) throw error
    event = await db.automationEvent.findUniqueOrThrow({ where: { dedupeKey } })
    if (event.tenantId !== tenantId) throw error
    duplicate = true
  }
  let runs: string[] = []
  if (!duplicate && opts.process !== false && event.availableAt.getTime() <= Date.now()) {
    runs = await processAutomationEvent(event.id)
  }
  return { event, duplicate, runs }
}

/** Match rules for one event and execute the resulting runs. Returns run ids. */
export async function processAutomationEvent(eventId: string): Promise<string[]> {
  const event = await db.automationEvent.findUnique({ where: { id: eventId } })
  if (!event || event.status === 'PROCESSED') return []
  const payload = safeJson<Record<string, unknown>>(event.payload, {})
  const depth = Number(payload._depth ?? 0)
  if (depth > MAX_EVENT_DEPTH) {
    await db.automationEvent.update({ where: { id: event.id }, data: { status: 'FAILED', error: `Causation depth ${depth} exceeds ${MAX_EVENT_DEPTH}; possible rule loop`, processedAt: new Date() } })
    return []
  }
  const ctx = { type: event.type, source: event.source, subjectType: event.subjectType, subjectId: event.subjectId, payload }
  const runIds: string[] = []
  try {
    const rules = await db.automationRule.findMany({ where: { tenantId: event.tenantId, triggerType: event.type, status: 'ACTIVE' } })
    for (const rule of rules) {
      if (!evaluateConditions(ctx, safeJson<Condition[]>(rule.conditions, []))) continue
      const idempotencyKey = `${event.id}:${rule.id}:v${rule.version}`
      let run
      try {
        run = await db.automationRun.create({
          data: {
            tenantId: event.tenantId,
            ruleId: rule.id,
            ruleVersion: rule.version,
            eventId: event.id,
            triggerType: event.type,
            idempotencyKey,
            correlationId: event.correlationId,
            status: 'PENDING',
            maxAttempts: rule.maxAttempts,
            steps: '[]',
            triggeredBy: 'EVENT',
          },
        })
      } catch (error) {
        if (!isUniqueConflict(error)) throw error
        run = await db.automationRun.findUniqueOrThrow({ where: { idempotencyKey } })
      }
      runIds.push(run.id)
      await executeAutomationRun(run.id)
    }
    await db.automationEvent.update({ where: { id: event.id }, data: { status: 'PROCESSED', processedAt: new Date() } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await db.automationEvent.update({ where: { id: event.id }, data: { status: 'FAILED', error: message.slice(0, 2000), processedAt: new Date() } }).catch(() => null)
    await logError({ source: 'AUTOMATION', code: 'EVENT_PROCESSING_FAILED', message: `${event.type} ${event.id}: ${message}` }).catch(() => null)
  }
  return runIds
}

// ------------------------------------------------------------
// Runs
// ------------------------------------------------------------
async function loadSnapshot(ruleId: string, version: number): Promise<RuleSnapshot | null> {
  const v = await db.automationRuleVersion.findUnique({ where: { ruleId_version: { ruleId, version } } })
  return v ? safeJson<RuleSnapshot | null>(v.snapshot, null) : null
}

const CLAIMABLE = ['PENDING', 'RETRY_SCHEDULED', 'AWAITING_APPROVAL']

export async function executeAutomationRun(runId: string): Promise<string> {
  // Atomic claim: only one worker can move a run into RUNNING.
  const claimed = await db.automationRun.updateMany({
    where: { id: runId, status: { in: CLAIMABLE } },
    data: { status: 'RUNNING', startedAt: new Date() },
  })
  if (claimed.count === 0) {
    const current = await db.automationRun.findUnique({ where: { id: runId }, select: { status: true } })
    return current?.status ?? 'NOT_FOUND'
  }
  const run = await db.automationRun.findUniqueOrThrow({ where: { id: runId } })
  const steps = safeJson<StepRecord[]>(run.steps, [])
  const finish = async (status: string, data: Record<string, unknown> = {}) => {
    await db.automationRun.update({ where: { id: run.id }, data: { status, steps: JSON.stringify(steps), ...data } })
    return status
  }

  const [rule, event, snapshot] = await Promise.all([
    db.automationRule.findUnique({ where: { id: run.ruleId } }),
    db.automationEvent.findUnique({ where: { id: run.eventId } }),
    loadSnapshot(run.ruleId, run.ruleVersion),
  ])
  if (!rule || !event || !snapshot) {
    steps.push({ index: -1, type: 'ENGINE', status: 'FAILED', detail: 'Rule, rule version or event no longer exists', attempt: run.attempts, at: new Date().toISOString() })
    return finish('FAILED', { error: 'Rule, rule version or event missing', finishedAt: new Date() })
  }
  if (rule.status === 'DISABLED') {
    steps.push({ index: -1, type: 'ENGINE', status: 'SKIPPED', detail: 'Rule was disabled before execution; no action ran', attempt: run.attempts, at: new Date().toISOString() })
    return finish('SKIPPED', { finishedAt: new Date() })
  }

  // ---------------- approval policy ----------------
  const needsApproval = ruleNeedsApproval({ requiresApproval: snapshot.requiresApproval, actions: snapshot.actions })
  let approvalToConsume: string | null = null
  if (needsApproval) {
    const fingerprint = approvalFingerprint({ ruleId: run.ruleId, ruleVersion: run.ruleVersion, actions: snapshot.actions, subjectType: event.subjectType, subjectId: event.subjectId })
    const approval = run.approvalId ? await db.approvalRequest.findUnique({ where: { id: run.approvalId } }) : null
    if (approval && approval.status === 'REJECTED') {
      steps.push({ index: -1, type: 'APPROVAL', status: 'FAILED', detail: `Approval ${approval.id} was rejected; no action ran`, attempt: run.attempts, at: new Date().toISOString() })
      return finish('FAILED', { error: 'Approval rejected', finishedAt: new Date() })
    }
    const approvalValid = approval && approval.status === 'APPROVED' && run.approvalHash === fingerprint
      && safeJson<{ fingerprint?: string }>(approval.payload, {}).fingerprint === fingerprint
    if (!approvalValid) {
      if (approval && approval.status === 'PENDING' && run.approvalHash === fingerprint) {
        return finish('AWAITING_APPROVAL')
      }
      if (approval && approval.status === 'APPROVED') {
        // Parameters changed after the decision: the old approval covers different work.
        await db.approvalRequest.update({ where: { id: approval.id }, data: { status: 'FAILED', decisionNote: 'Invalidated: the automation parameters changed after approval.', updatedAt: new Date() } }).catch(() => null)
        steps.push({ index: -1, type: 'APPROVAL', status: 'INFO', detail: `Approval ${approval.id} invalidated because the parameters changed`, attempt: run.attempts, at: new Date().toISOString() })
      }
      const created = await db.approvalRequest.create({
        data: {
          type: 'AUTOMATION_RUN',
          title: `Automation "${rule.name}" v${run.ruleVersion} needs approval`,
          description: `Trigger ${run.triggerType}. Actions: ${snapshot.actions.map((a) => a.type).join(', ')}.`,
          payload: JSON.stringify({ runId: run.id, ruleId: run.ruleId, ruleVersion: run.ruleVersion, fingerprint, actions: snapshot.actions, subjectType: event.subjectType, subjectId: event.subjectId }),
          risk: 'HIGH',
          status: 'PENDING',
          requestedBy: `automation:${rule.key}`,
          agentCode: 'AUTOMATION_ENGINE',
        },
      })
      steps.push({ index: -1, type: 'APPROVAL', status: 'WAITING', detail: `Waiting for approval ${created.id}`, attempt: run.attempts, at: new Date().toISOString() })
      return finish('AWAITING_APPROVAL', { approvalId: created.id, approvalHash: fingerprint })
    }
    approvalToConsume = approval.id
  }

  // ---------------- actions ----------------
  const attempt = run.attempts + 1
  await db.automationRun.update({ where: { id: run.id }, data: { attempts: attempt } })
  const ctx = { type: event.type, source: event.source, subjectType: event.subjectType, subjectId: event.subjectId, payload: safeJson<Record<string, unknown>>(event.payload, {}) }
  const { executeAction } = await import('@/lib/automation/actions')
  const succeeded = new Set(steps.filter((s) => s.status === 'SUCCEEDED' || s.status === 'SKIPPED').map((s) => s.index))

  for (let index = 0; index < snapshot.actions.length; index += 1) {
    if (succeeded.has(index)) continue // never repeat a side effect that already succeeded
    const action = snapshot.actions[index]
    if (!evaluateConditions(ctx, action.when)) {
      steps.push({ index, type: action.type, status: 'SKIPPED', detail: 'Branch condition did not match', attempt, at: new Date().toISOString() })
      continue
    }
    let outcome: ActionOutcome
    try {
      outcome = await executeAction(action, {
        tenantId: run.tenantId,
        runId: run.id,
        ruleKey: rule.key,
        actionIndex: index,
        idempotencyKey: `${AUTOMATION_WORKFLOW_PREFIX}${run.id}:${index}`,
        event: ctx,
        approvalId: approvalToConsume,
      })
    } catch (error) {
      outcome = { status: 'FAILED', detail: error instanceof Error ? error.message : String(error), retryable: true }
    }
    steps.push({ index, type: action.type, status: outcome.status, detail: outcome.detail.slice(0, 1000), attempt, at: new Date().toISOString(), ...(outcome.output ? { output: outcome.output } : {}) })

    if (outcome.status === 'WAITING') {
      return finish('WAITING_EXTERNAL')
    }
    if (outcome.status === 'FAILED') {
      if (action.onFailure === 'CONTINUE') continue
      const exhausted = attempt >= run.maxAttempts
      if (outcome.retryable && !exhausted) {
        return finish('RETRY_SCHEDULED', { error: outcome.detail.slice(0, 2000), nextAttemptAt: new Date(Date.now() + retryDelayMs(attempt)) })
      }
      const status = outcome.retryable ? 'DEAD_LETTER' : 'FAILED'
      const result = await finish(status, { error: outcome.detail.slice(0, 2000), finishedAt: new Date(), nextAttemptAt: null })
      const { createNotification } = await import('@/lib/notify')
      await createNotification({
        type: 'ERROR',
        title: `Automation ${status === 'DEAD_LETTER' ? 'dead-lettered' : 'failed'}: ${rule.name}`,
        body: `${action.type}: ${outcome.detail}`.slice(0, 480),
        severity: 'WARNING',
        link: 'automation',
      })
      return result
    }
  }

  if (approvalToConsume) {
    await db.approvalRequest.updateMany({ where: { id: approvalToConsume, status: 'APPROVED' }, data: { status: 'EXECUTED', executedAt: new Date(), result: JSON.stringify({ runId: run.id }), updatedAt: new Date() } })
  }
  const anyFailed = steps.some((s) => s.attempt === attempt && s.status === 'FAILED')
  return finish(anyFailed ? 'SUCCEEDED_WITH_ERRORS' : 'SUCCEEDED', { error: null, finishedAt: new Date(), nextAttemptAt: null })
}

/** Resume a run that was waiting on an external system (n8n callback). */
export async function resumeRunAfterExternal(runId: string, input: { correlationId: string; ok: boolean; detail: string }): Promise<string> {
  const run = await db.automationRun.findUnique({ where: { id: runId } })
  if (!run || run.status !== 'WAITING_EXTERNAL') return run?.status ?? 'NOT_FOUND'
  const steps = safeJson<StepRecord[]>(run.steps, [])
  const waiting = [...steps].reverse().find((s) => s.status === 'WAITING' && s.output?.correlationId === input.correlationId)
  if (!waiting) return run.status
  steps.push({ index: waiting.index, type: waiting.type, status: input.ok ? 'SUCCEEDED' : 'FAILED', detail: input.detail.slice(0, 1000), attempt: waiting.attempt, at: new Date().toISOString(), output: { correlationId: input.correlationId } })
  if (input.ok) {
    const moved = await db.automationRun.updateMany({ where: { id: run.id, status: 'WAITING_EXTERNAL' }, data: { status: 'PENDING', steps: JSON.stringify(steps) } })
    if (moved.count === 0) return 'CONFLICT'
    // attempts were already counted for this attempt; executeAutomationRun increments again,
    // so compensate to keep the retry budget honest.
    await db.automationRun.update({ where: { id: run.id }, data: { attempts: Math.max(0, run.attempts - 1) } })
    return executeAutomationRun(run.id)
  }
  const exhausted = run.attempts >= run.maxAttempts
  const status = exhausted ? 'DEAD_LETTER' : 'RETRY_SCHEDULED'
  await db.automationRun.updateMany({
    where: { id: run.id, status: 'WAITING_EXTERNAL' },
    data: { status, steps: JSON.stringify(steps), error: input.detail.slice(0, 2000), nextAttemptAt: exhausted ? null : new Date(Date.now() + retryDelayMs(run.attempts)), finishedAt: exhausted ? new Date() : null },
  })
  return status
}

/** Called when an AUTOMATION_RUN approval is granted. Re-validates the fingerprint before anything runs. */
export async function resumeApprovedAutomationRun(approvalId: string): Promise<{ runId: string | null; status: string }> {
  const run = await db.automationRun.findFirst({ where: { approvalId } })
  if (!run) return { runId: null, status: 'NOT_FOUND' }
  if (run.status !== 'AWAITING_APPROVAL') return { runId: run.id, status: run.status }
  const status = await executeAutomationRun(run.id)
  return { runId: run.id, status }
}

/** Manual replay: a new run row against the rule's CURRENT version (new approval if required). */
export async function replayAutomationRun(runId: string, actor: { email: string; tenantId: string }) {
  const original = await db.automationRun.findFirst({ where: { id: runId, tenantId: actor.tenantId } })
  if (!original) return { ok: false as const, code: 'NOT_FOUND' }
  if (['PENDING', 'RUNNING', 'WAITING_EXTERNAL', 'AWAITING_APPROVAL', 'RETRY_SCHEDULED'].includes(original.status)) {
    return { ok: false as const, code: 'RUN_STILL_ACTIVE' }
  }
  const rule = await db.automationRule.findFirst({ where: { id: original.ruleId, tenantId: actor.tenantId } })
  if (!rule) return { ok: false as const, code: 'RULE_NOT_FOUND' }
  if (rule.status === 'DISABLED') return { ok: false as const, code: 'RULE_DISABLED' }
  const replay = await db.automationRun.create({
    data: {
      tenantId: original.tenantId,
      ruleId: rule.id,
      ruleVersion: rule.version,
      eventId: original.eventId,
      triggerType: original.triggerType,
      idempotencyKey: `${original.eventId}:${rule.id}:replay:${randomUUID()}`,
      correlationId: original.correlationId,
      status: 'PENDING',
      maxAttempts: rule.maxAttempts,
      steps: '[]',
      replayOfId: original.id,
      triggeredBy: actor.email,
    },
  })
  const status = await executeAutomationRun(replay.id)
  return { ok: true as const, runId: replay.id, status }
}

/** Scheduler tick. Safe to call concurrently: every run/event is claimed atomically. */
export async function processDueAutomation(now: Date = new Date(), limit = 25) {
  const dueRuns = await db.automationRun.findMany({
    where: { status: 'RETRY_SCHEDULED', nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: 'asc' },
    take: limit,
    select: { id: true },
  })
  for (const r of dueRuns) await executeAutomationRun(r.id)

  const dueEvents = await db.automationEvent.findMany({
    where: { status: 'PENDING', availableAt: { lte: now } },
    orderBy: { availableAt: 'asc' },
    take: limit,
    select: { id: true },
  })
  for (const e of dueEvents) await processAutomationEvent(e.id)

  // Unanswered conversations: one event per unanswered visitor message.
  const threshold = new Date(now.getTime() - UNANSWERED_AFTER_MS)
  const unanswered = await db.chatConversation.findMany({
    where: { status: 'OPEN', lastSender: 'VISITOR', lastMessageAt: { lte: threshold }, inboxState: { in: ['OPEN', 'PENDING', 'ESCALATED'] } },
    take: limit,
    select: { id: true, tenantId: true, lastMessageAt: true, clientId: true, assignedToId: true, priority: true },
  })
  let unansweredEmitted = 0
  for (const c of unanswered) {
    const r = await emitAutomationEvent({
      tenantId: c.tenantId,
      type: 'CONVERSATION_UNANSWERED',
      source: 'SCHEDULER',
      subjectType: 'ChatConversation',
      subjectId: c.id,
      payload: { conversationId: c.id, clientRowId: c.clientId, assigned: Boolean(c.assignedToId), priority: c.priority, waitingMinutes: Math.round((now.getTime() - c.lastMessageAt.getTime()) / 60000) },
      dedupeKey: `unanswered:${c.id}:${c.lastMessageAt.getTime()}`,
    })
    if (!r.duplicate) unansweredEmitted += 1
  }
  return { retried: dueRuns.length, scheduledEvents: dueEvents.length, unansweredEmitted }
}
