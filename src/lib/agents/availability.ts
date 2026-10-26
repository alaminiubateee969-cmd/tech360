// ============================================================
// TECH360 — agent availability
// ============================================================
// The six states the specification names:
//   AVAILABLE · BUSY · QUEUED · OFFLINE · ERROR · ESCALATED
//
// THE STATE IS DERIVED, NEVER DECLARED.
//
// There is no "set the agent to AVAILABLE" button. The state is read
// from the durable queue and the execution record:
//
//   RUNNING job                → BUSY
//   QUEUED / RETRYING job       → QUEUED
//   the agent is not ACTIVE     → OFFLINE
//   the last run failed         → ERROR
//   an approval is pending      → ESCALATED
//   otherwise                   → AVAILABLE
//
// A workforce of 2,201 that is all "AVAILABLE" is a lie, and this
// module is how that lie is prevented.
// ============================================================

import { db } from '@/lib/db'

export const AVAILABILITY_STATES = ['AVAILABLE', 'BUSY', 'QUEUED', 'OFFLINE', 'ERROR', 'ESCALATED'] as const
export type AgentAvailability = (typeof AVAILABILITY_STATES)[number]

export type AvailabilitySnapshot = {
  agentCode: string
  state: AgentAvailability
  /** Why the state is what it is. */
  reason: string
  running: number
  queued: number
  awaitingApproval: number
  recentFailures: number
  /** The measured success rate, or null when the agent has never run. */
  successRate: number | null
  /** The measured mean duration, or null. */
  meanDurationMs: number | null
  lastActivityAt: Date | null
}

const ACTIVE_JOB_STATES = ['RUNNING']
const QUEUED_JOB_STATES = ['QUEUED', 'RETRYING']

/**
 * Derive the availability of a single agent from its real record.
 */
export async function deriveAvailability(agentCode: string): Promise<AvailabilitySnapshot> {
  const agent = await db.aiAgent.findUnique({
    where: { code: agentCode },
    select: { status: true, executionCount: true, successCount: true, failureCount: true },
  })

  if (!agent || agent.status !== 'ACTIVE') {
    return {
      agentCode,
      state: 'OFFLINE',
      reason: agent ? `the agent is ${agent.status}` : 'the agent is not registered',
      running: 0,
      queued: 0,
      awaitingApproval: 0,
      recentFailures: 0,
      successRate: null,
      meanDurationMs: null,
      lastActivityAt: null,
    }
  }

  const [running, queued, awaitingApproval, recentFailures, lastRun] = await Promise.all([
    db.agentJob.count({ where: { agentCode, status: { in: ACTIVE_JOB_STATES } } }),
    db.agentJob.count({ where: { agentCode, status: { in: QUEUED_JOB_STATES } } }),
    db.agentJob.count({ where: { agentCode, status: 'AWAITING_APPROVAL' } }),
    db.aiAgentExecution.count({
      where: { agentCode, status: { in: ['FAILED', 'TIMEOUT'] }, startedAt: { gte: recentWindow() } },
    }),
    db.aiAgentExecution.findFirst({
      where: { agentCode },
      orderBy: { startedAt: 'desc' },
      select: { status: true, startedAt: true, durationMs: true },
    }),
  ])

  const successRate =
    agent.executionCount > 0 ? round(agent.successCount / agent.executionCount) : null

  const durations = await db.aiAgentExecution.findMany({
    where: { agentCode, status: 'SUCCESS', durationMs: { not: null } },
    orderBy: { startedAt: 'desc' },
    take: 20,
    select: { durationMs: true },
  })
  const measured = durations.map((row) => row.durationMs).filter((value): value is number => typeof value === 'number')
  const meanDurationMs = measured.length > 0 ? Math.round(measured.reduce((a, b) => a + b, 0) / measured.length) : null

  const { state, reason } = resolveState({
    running,
    queued,
    awaitingApproval,
    recentFailures,
    lastStatus: lastRun?.status ?? null,
  })

  return {
    agentCode,
    state,
    reason,
    running,
    queued,
    awaitingApproval,
    recentFailures,
    successRate,
    meanDurationMs,
    lastActivityAt: lastRun?.startedAt ?? null,
  }
}

/**
 * The state resolution rules, in order.
 *
 * They are pure so they can be tested without a database.
 */
export function resolveState(input: {
  running: number
  queued: number
  awaitingApproval: number
  recentFailures: number
  lastStatus: string | null
}): { state: AgentAvailability; reason: string } {
  if (input.running > 0) {
    return { state: 'BUSY', reason: `${input.running} job(s) are running` }
  }
  if (input.awaitingApproval > 0) {
    return { state: 'ESCALATED', reason: `${input.awaitingApproval} job(s) are waiting for a human approval` }
  }
  if (input.queued > 0) {
    return { state: 'QUEUED', reason: `${input.queued} job(s) are waiting for a worker` }
  }
  if (input.recentFailures > 0) {
    return { state: 'ERROR', reason: `${input.recentFailures} recent run(s) failed` }
  }
  if (input.lastStatus === 'FAILED' || input.lastStatus === 'TIMEOUT') {
    return { state: 'ERROR', reason: `the last run ${input.lastStatus.toLowerCase()}` }
  }
  return { state: 'AVAILABLE', reason: 'no active work and no recent failure' }
}

/** The availability of every registered agent, counted for the dashboard. */
export async function workforceAvailability(): Promise<{
  states: Record<AgentAvailability, number>
  total: number
  agents: AvailabilitySnapshot[]
}> {
  const codes = await db.aiAgent.findMany({ where: { status: 'ACTIVE' }, select: { code: true } })
  const snapshots: AvailabilitySnapshot[] = []
  for (const row of codes) {
    snapshots.push(await deriveAvailability(row.code))
  }
  const states: Record<AgentAvailability, number> = {
    AVAILABLE: 0,
    BUSY: 0,
    QUEUED: 0,
    OFFLINE: 0,
    ERROR: 0,
    ESCALATED: 0,
  }
  for (const snapshot of snapshots) states[snapshot.state] += 1
  return { states, total: snapshots.length, agents: snapshots }
}

function recentWindow(): Date {
  return new Date(Date.now() - 24 * 60 * 60 * 1000)
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000
}
