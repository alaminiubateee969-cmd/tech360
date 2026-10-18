// ============================================================
// TECH360 — skill task queue + bounded worker pool
// ============================================================
// Skill work is queued on the SAME durable queue the agent runtime
// already uses (AgentJob), so there is exactly ONE task store with one
// lease, retry and crash-recovery implementation.
//
// A skill task is an AgentJob row with:
//   taskType  = 'SKILL'
//   agentCode = NULL  (a skill is not an LLM agent)
//   input     = {"skillId": "...", "payload": {...}, "correlationId": "..."}
//
// The worker pool is BOUNDED: it never runs more than `concurrency`
// skills at once, and it never spawns a model process per skill.
// ============================================================

import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { claimNextAgentJob, enqueueAgentJob, finishClaimedJob } from '@/lib/agents/jobs'
import { audit } from '@/lib/security'
import { getSkillDefinition } from './registry'
import { executeSkill } from './executor'
import type { SkillDefinition } from './types'

export const SKILL_TASK_TYPE = 'SKILL' as const

export type SkillTaskPayload = {
  skillId: string
  payload: Record<string, unknown>
  correlationId: string
  grantedPermissions: string[]
  requestedBy?: string
}

export type EnqueueSkillTaskInput = {
  skillId: string
  payload: Record<string, unknown>
  idempotencyKey: string
  grantedPermissions: string[]
  requestedBy?: string
  correlationId?: string
}

/**
 * Queue a skill for execution. The job is idempotent: the same
 * Idempotency-Key with the same payload returns the existing job; with a
 * DIFFERENT payload it is rejected as a conflict.
 */
export async function enqueueSkillTask(input: EnqueueSkillTaskInput) {
  const definition = getSkillDefinition(input.skillId)
  if (!definition) {
    throw new Error(`Skill "${input.skillId}" is not in the registry`)
  }
  const correlationId = input.correlationId ?? randomUUID()
  const body: SkillTaskPayload = {
    skillId: input.skillId,
    payload: input.payload,
    correlationId,
    grantedPermissions: input.grantedPermissions,
    ...(input.requestedBy ? { requestedBy: input.requestedBy } : {}),
  }
  return enqueueAgentJob({
    agentCode: null,
    taskType: SKILL_TASK_TYPE,
    idempotencyKey: input.idempotencyKey,
    input: JSON.stringify(body),
    contextNote: `skill:${input.skillId}`,
    workflow: 'SKILL_EXECUTION',
    requestedBy: input.requestedBy ?? null,
  })
}

function parsePayload(raw: string): SkillTaskPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SkillTaskPayload>
    if (!parsed || typeof parsed.skillId !== 'string' || typeof parsed.payload !== 'object' || !parsed.payload) {
      return null
    }
    return {
      skillId: parsed.skillId,
      payload: parsed.payload as Record<string, unknown>,
      correlationId: typeof parsed.correlationId === 'string' ? parsed.correlationId : randomUUID(),
      grantedPermissions: Array.isArray(parsed.grantedPermissions) ? parsed.grantedPermissions : [],
      ...(parsed.requestedBy ? { requestedBy: parsed.requestedBy } : {}),
    }
  } catch {
    return null
  }
}

/**
 * Process up to `limit` queued skill tasks. Used by the in-process ops
 * loop and by the standalone worker command.
 */
export async function processSkillTaskBatch(
  limit = 5,
  options: { definitions?: SkillDefinition[] } = {},
): Promise<{
  processed: Array<{ id: string; skillId: string; status: string; error?: string }>
  failed: number
}> {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)))
  const processed: Array<{ id: string; skillId: string; status: string; error?: string }> = []
  let failed = 0

  for (let i = 0; i < safeLimit; i += 1) {
    const workerId = `skill-worker-${randomUUID().slice(0, 8)}`
    const job = await claimNextAgentJob(workerId, new Date(), SKILL_TASK_TYPE)
    if (!job) break

    const payload = parsePayload(job.input)
    if (!payload) {
      const status = await finishClaimedJob(
        job,
        workerId,
        {
          ok: false,
          executionId: '',
          correlationId: job.correlationId,
          output: '',
          error: 'Skill task payload could not be parsed',
          status: 'FAILED',
        },
        new Date(),
      )
      failed += 1
      processed.push({ id: job.id, skillId: 'unknown', status, error: 'unparseable payload' })
      continue
    }

    const definition = getSkillDefinition(payload.skillId, options.definitions)
    if (!definition) {
      const status = await finishClaimedJob(
        job,
        workerId,
        {
          ok: false,
          executionId: '',
          correlationId: job.correlationId,
          output: '',
          error: `Skill "${payload.skillId}" is not in the registry`,
          status: 'FAILED',
        },
        new Date(),
      )
      failed += 1
      processed.push({ id: job.id, skillId: payload.skillId, status, error: 'unknown skill' })
      continue
    }

    const result = await executeSkill(definition, payload.payload, {
      grantedPermissions: payload.grantedPermissions,
      correlationId: payload.correlationId,
      requestedBy: payload.requestedBy,
    })

    const status = await finishClaimedJob(
      job,
      workerId,
      {
        ok: result.ok,
        executionId: '',
        correlationId: job.correlationId,
        output: result.output ? JSON.stringify(result.output) : '',
        ...(result.error ? { error: result.error } : {}),
        status: result.ok ? 'SUCCESS' : 'FAILED',
      },
      new Date(),
    )
    if (!result.ok) failed += 1
    processed.push({
      id: job.id,
      skillId: payload.skillId,
      status,
      ...(result.error ? { error: result.error } : {}),
    })
  }

  return { processed, failed }
}

/**
 * Bounded worker pool. Runs at most `concurrency` workers, each
 * processing one task at a time, and stops after `maxTasks` tasks so a
 * scheduled run cannot monopolise the host.
 */
export async function runSkillWorkerPool(options: {
  concurrency?: number
  maxTasks?: number
  definitions?: SkillDefinition[]
}): Promise<{ completed: number; failed: number }> {
  const concurrency = Math.max(1, Math.min(8, options.concurrency ?? 2))
  const maxTasks = Math.max(1, Math.min(500, options.maxTasks ?? 20))
  let completed = 0
  let failed = 0

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (completed + failed < maxTasks) {
        const batch = await processSkillTaskBatch(1, { definitions: options.definitions })
        if (batch.processed.length === 0) return
        completed += batch.processed.filter((p) => p.status === 'COMPLETED').length
        failed += batch.failed
      }
    }),
  )

  await audit({
    actor: 'system:skill-worker-pool',
    action: 'SKILL_WORKER_POOL_FINISHED',
    entityType: 'SkillPool',
    details: { completed, failed, concurrency, maxTasks },
  })

  return { completed, failed }
}

/** Count of queued skill tasks — used by the dashboard and health route. */
export async function skillQueueDepth(): Promise<number> {
  return db.agentJob.count({ where: { taskType: SKILL_TASK_TYPE, status: { in: ['QUEUED', 'RETRYING'] } } })
}
