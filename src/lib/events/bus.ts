// ============================================================
// TECH360 — event bus
// ============================================================
// One event bus for the whole workforce.
//
// The specification asks for an event-driven organisation: agents
// subscribe to the events that matter to them and are never woken
// for the rest. That is the difference between a workforce and a
// crowd of chatbots.
//
// DESIGN
//   publish()   — records the event (AgentEvent) and dispatches it
//                 to the subscribers that matched.
//   subscribe() — registers a handler for a set of event types and
//                 an optional filter.
//   persist     — every event is stored, so the event history is a
//                 real record and not just a log line.
//
// HONESTY
//   A handler that throws does NOT fail the publisher. The error is
//   recorded on the event and the publish is reported as delivered
//   with errors. A subscriber cannot be allowed to break the system
//   that raised the event.
// ============================================================

import { newCorrelationId } from '@/lib/correlation'

export const EVENT_TYPES = [
  // Task lifecycle
  'TASK_CREATED',
  'TASK_ASSIGNED',
  'TASK_STARTED',
  'TASK_COMPLETED',
  'TASK_FAILED',
  'TASK_ESCALATED',
  'TASK_CANCELLED',
  // Delegation and collaboration
  'DELEGATION_REQUESTED',
  'DELEGATION_ACCEPTED',
  'DELEGATION_COMPLETED',
  'DELEGATION_FAILED',
  'COLLABORATION_REQUESTED',
  'COLLABORATION_COMPLETED',
  // Procedures
  'SOP_STARTED',
  'SOP_STEP_COMPLETED',
  'SOP_COMPLETED',
  'SOP_FAILED',
  'SOP_ESCALATED',
  'SOP_AWAITING_APPROVAL',
  // Skills and tools
  'SKILL_EXECUTED',
  'SKILL_FAILED',
  'TOOL_CALLED',
  'TOOL_BLOCKED',
  'TOOL_FAILED',
  // Model
  'MODEL_CALLED',
  'MODEL_FAILED',
  'MODEL_FALLBACK',
  // Knowledge and memory
  'KNOWLEDGE_INGESTED',
  'KNOWLEDGE_UPDATED',
  'KNOWLEDGE_QUERIED',
  'MEMORY_WRITTEN',
  'MEMORY_RETRIEVED',
  // Governance
  'APPROVAL_REQUESTED',
  'APPROVAL_GRANTED',
  'APPROVAL_REJECTED',
  'SECURITY_ANOMALY',
  'POLICY_VIOLATION',
  // Learning and reflection
  'LEARNING_PROPOSED',
  'LEARNING_VALIDATED',
  'LEARNING_REJECTED',
  'REFLECTION_RECORDED',
  // Quality
  'QUALITY_REVIEW_PASSED',
  'QUALITY_REVIEW_FAILED',
  // Self healing
  'ANOMALY_DETECTED',
  'SELF_HEALING_STARTED',
  'SELF_HEALING_RESOLVED',
  'SELF_HEALING_ESCALATED',
  // Workforce
  'AGENT_AVAILABILITY_CHANGED',
  'WORKFLOW_STARTED',
  'WORKFLOW_COMPLETED',
  'USER_COMMAND',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

export type EventSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export type AgentEventPayload = {
  type: EventType
  source: string
  payload: Record<string, unknown>
  correlationId?: string
  severity?: EventSeverity
  /** The agents that should be notified. Empty means "every subscriber". */
  notify?: string[]
  createdAt?: Date
}

export type PublishedEvent = {
  id: string
  type: EventType
  source: string
  payload: Record<string, unknown>
  correlationId: string | null
  severity: EventSeverity
  subscribers: string[]
  createdAt: Date
}

export type EventHandler = (event: PublishedEvent) => Promise<void> | void

export type Subscription = {
  id: string
  types: EventType[]
  /** Optional filter — the handler runs only when this returns true. */
  filter?: (event: PublishedEvent) => boolean
  handler: EventHandler
  /** The agent this subscription belongs to, if any. */
  owner?: string
  createdAt: Date
}

export type PublishResult = {
  published: boolean
  event: PublishedEvent | null
  matched: number
  delivered: number
  errors: Array<{ subscriptionId: string; error: string }>
  /** True when the event could not be persisted. */
  persistError: string | null
}

const subscriptions: Subscription[] = []
let subscriptionCounter = 0

/** Register a handler for a set of event types. */
export function subscribe(input: {
  types: EventType[]
  handler: EventHandler
  filter?: (event: PublishedEvent) => boolean
  owner?: string
}): Subscription {
  subscriptionCounter += 1
  const subscription: Subscription = {
    id: `sub-${subscriptionCounter}`,
    types: input.types,
    filter: input.filter,
    handler: input.handler,
    owner: input.owner,
    createdAt: new Date(),
  }
  subscriptions.push(subscription)
  return subscription
}

export function unsubscribe(subscriptionId: string): boolean {
  const index = subscriptions.findIndex((s) => s.id === subscriptionId)
  if (index === -1) return false
  subscriptions.splice(index, 1)
  return true
}

export function listSubscriptions(): Array<{ id: string; types: EventType[]; owner: string | null; createdAt: Date }> {
  return subscriptions.map((s) => ({ id: s.id, types: s.types, owner: s.owner ?? null, createdAt: s.createdAt }))
}

/**
 * Publish an event.
 *
 * The event is persisted first (when a database is reachable), then
 * dispatched. A persistence failure is reported, not swallowed.
 */
export async function publish(input: AgentEventPayload): Promise<PublishResult> {
  const event: PublishedEvent = {
    id: '',
    type: input.type,
    source: input.source,
    payload: input.payload,
    correlationId: input.correlationId ?? null,
    severity: input.severity ?? 'INFO',
    subscribers: input.notify ?? [],
    createdAt: input.createdAt ?? new Date(),
  }

  let persistError: string | null = null
  try {
    const { db } = await import('@/lib/db')
    const row = await db.agentEvent.create({
      data: {
        type: event.type,
        source: event.source,
        payload: JSON.stringify(event.payload).slice(0, 40_000),
        correlationId: event.correlationId,
        severity: event.severity,
        subscribers: JSON.stringify(event.subscribers),
      },
      select: { id: true, createdAt: true },
    })
    event.id = row.id
    event.createdAt = row.createdAt
  } catch (error) {
    persistError = error instanceof Error ? error.message : 'the event could not be persisted'
  }

  // Dispatch to the subscribers that match.
  const matched = subscriptions.filter((subscription) => {
    if (!subscription.types.includes(event.type)) return false
    if (event.subscribers.length > 0 && subscription.owner && !event.subscribers.includes(subscription.owner)) {
      return false
    }
    if (subscription.filter) {
      try {
        return subscription.filter(event)
      } catch {
        return false
      }
    }
    return true
  })

  const errors: Array<{ subscriptionId: string; error: string }> = []
  let delivered = 0
  for (const subscription of matched) {
    try {
      await subscription.handler(event)
      delivered += 1
    } catch (error) {
      errors.push({
        subscriptionId: subscription.id,
        error: error instanceof Error ? error.message : 'the subscriber threw',
      })
    }
  }

  return { published: true, event, matched: matched.length, delivered, errors, persistError }
}

/** Read the recorded event history, newest first. */
export async function eventHistory(options: {
  type?: EventType
  limit?: number
  source?: string
}): Promise<Array<{ id: string; type: string; source: string; payload: string; createdAt: Date; severity: string }>> {
  const { db } = await import('@/lib/db')
  return db.agentEvent.findMany({
    where: {
      ...(options.type ? { type: options.type } : {}),
      ...(options.source ? { source: options.source } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(200, options.limit ?? 50),
    select: { id: true, type: true, source: true, payload: true, createdAt: true, severity: true },
  })
}

/** A correlation id for a publish that did not supply one. */
export function eventCorrelationId(): string {
  return newCorrelationId()
}
