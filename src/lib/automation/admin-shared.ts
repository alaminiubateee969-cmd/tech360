// Shared helpers for the automation admin API (tenant scoping + safe JSON parsing).
import { tenantOf } from '@/lib/tenancy'

export type GuardedUser = { id: string; email: string; role: string; tenantId?: string | null }

export function tenantFor(user: GuardedUser): string {
  return tenantOf(user)
}

export function safeParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try { return JSON.parse(value) as T } catch { return fallback }
}

export function serializeRun(run: {
  id: string; tenantId: string; ruleId: string; ruleVersion: number; eventId: string; triggerType: string
  correlationId: string; status: string; attempts: number; maxAttempts: number; nextAttemptAt: Date | null
  steps: string; output: string | null; error: string | null; approvalId: string | null; replayOfId: string | null
  triggeredBy: string | null; startedAt: Date | null; finishedAt: Date | null; createdAt: Date; updatedAt: Date
}, ruleName?: string | null) {
  return {
    id: run.id,
    ruleId: run.ruleId,
    ruleName: ruleName ?? null,
    ruleVersion: run.ruleVersion,
    eventId: run.eventId,
    triggerType: run.triggerType,
    correlationId: run.correlationId,
    status: run.status,
    attempts: run.attempts,
    maxAttempts: run.maxAttempts,
    nextAttemptAt: run.nextAttemptAt,
    steps: safeParse<unknown[]>(run.steps, []),
    output: safeParse<unknown>(run.output, null),
    error: run.error,
    approvalId: run.approvalId,
    replayOfId: run.replayOfId,
    triggeredBy: run.triggeredBy,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  }
}
