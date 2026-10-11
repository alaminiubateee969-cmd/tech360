import { createHash, randomUUID } from 'node:crypto'

import { db } from '@/lib/db'
import { newCorrelationId } from '@/lib/security'
import { getAgentDefinition } from '@/lib/agents/bootstrap'
import { runAgent } from '@/lib/agents/engine'
import { agentHasPermission, authorizeAgentTool, PRIVILEGED_AGENT_TOOLS, type AgentTool } from '@/lib/ai-workforce-policy'
import { AgentJobToolInputError, executeAgentJobTool, normalizeAgentJobToolCall } from '@/lib/agents/tool-executor'
import { resolveAgentTimeoutMs } from '@/lib/agents/resilience'
import {
  AGENT_JOB_DEFAULT_MAX_ATTEMPTS,
  agentJobRetryDelayMs,
  agentJobTerminalState,
  isRetryableAgentJobFailure,
} from '@/lib/agents/job-policy'

const MAX_JOB_INPUT = 12_000
const MAX_JOB_CONTEXT = 8_000
const MAX_JOB_OUTPUT = 20_000
const MAX_JOBS_PER_BATCH = 5

export class AgentJobInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentJobInputError'
  }
}

export class AgentJobIdempotencyConflict extends Error {
  constructor() {
    super('Idempotency-Key has already been used for a different agent-job payload')
    this.name = 'AgentJobIdempotencyConflict'
  }
}

export class AgentJobDecisionConflict extends Error {
  constructor() {
    super('Agent job is no longer awaiting approval')
    this.name = 'AgentJobDecisionConflict'
  }
}

export type EnqueueAgentJobInput = {
  agentCode: string
  idempotencyKey: string
  input: string
  contextNote?: string
  expectJson?: boolean
  clientId?: string | null
  projectId?: string | null
  workflow?: string | null
  requestedBy?: string | null
  toolName?: string | null
  toolArgs?: unknown
}

function payloadHash(input: Omit<EnqueueAgentJobInput, 'idempotencyKey' | 'requestedBy'>): string {
  const canonicalPayload: Record<string, unknown> = {
    agentCode: input.agentCode.toUpperCase(),
    input: input.input,
    contextNote: input.contextNote ?? '',
    expectJson: input.expectJson === true,
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
    workflow: input.workflow ?? null,
  }
  // Keep the original inference hash format stable for idempotent retries from
  // clients running before tool-call jobs were introduced.
  if (input.toolName) {
    canonicalPayload.taskType = 'TOOL_CALL'
    canonicalPayload.toolName = input.toolName
    canonicalPayload.toolArgs = input.toolArgs ?? null
  }
  return createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex')
}

function safeCheckpoint(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function prismaCode(error: unknown): string | null {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : null
}

/**
 * Persist one idempotent inference request. The unique database key is the
 * concurrency authority; a repeated key with different content is rejected.
 */
export async function enqueueAgentJob(input: EnqueueAgentJobInput): Promise<{ job: Awaited<ReturnType<typeof db.agentJob.findUniqueOrThrow>>; created: boolean }> {
  const agentCode = input.agentCode.trim().toUpperCase()
  const idempotencyKey = input.idempotencyKey.trim()
  const jobInput = input.input.trim()
  const contextNote = input.contextNote?.trim().slice(0, MAX_JOB_CONTEXT) || null

  if (!idempotencyKey || idempotencyKey.length > 191) throw new AgentJobInputError('A valid Idempotency-Key of at most 191 characters is required')
  if (!jobInput || jobInput.length > MAX_JOB_INPUT) throw new AgentJobInputError(`Input must contain 1–${MAX_JOB_INPUT} characters`)
  const definition = getAgentDefinition(agentCode)
  if (!definition) throw new AgentJobInputError(`Agent ${agentCode} is not in the executable registry`)

  const requestedToolName = input.toolName?.trim() || null
  let toolCall: ReturnType<typeof normalizeAgentJobToolCall> | null = null
  if (requestedToolName) {
    try {
      toolCall = normalizeAgentJobToolCall(requestedToolName, input.toolArgs)
    } catch (error) {
      throw new AgentJobInputError(error instanceof Error ? error.message : 'Invalid durable tool call')
    }
  } else if (input.toolArgs !== undefined) {
    throw new AgentJobInputError('Tool arguments require a tool name')
  }

  const agent = await db.aiAgent.findUnique({
    where: { code: agentCode },
    select: { code: true, status: true, requiresApproval: true, tools: true, permissions: true, department: { select: { code: true } } },
  })
  if (!agent) throw new AgentJobInputError(`Agent ${agentCode} is not registered in the database`)
  if (agent.status !== 'ACTIVE') throw new AgentJobInputError(`Agent ${agentCode} is ${agent.status}`)
  if (toolCall && agent.department?.code !== definition.dept) throw new AgentJobInputError(`Agent ${agentCode} department mapping is invalid`)
  if (toolCall) {
    if (!definition.tools.includes(toolCall.toolName)) throw new AgentJobInputError(`Agent ${agentCode} is not authorized for tool '${toolCall.toolName}' by the canonical registry`)
    const toolDecision = authorizeAgentTool(agent, toolCall.toolName as AgentTool)
    if (!toolDecision.allowed) throw new AgentJobInputError(`Tool '${toolCall.toolName}' is not granted (${toolDecision.code})`)
    if (!agentHasPermission(agent, 'write:tasks') || !definition.permissions.includes('write:tasks')) {
      throw new AgentJobInputError(`Agent ${agentCode} does not have the required write:tasks permission`)
    }
  }

  let clientId = input.clientId?.trim() || null
  let projectId = input.projectId?.trim() || null
  if (projectId) {
    const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, clientId: true, deletedAt: true, status: true } })
    if (!project || project.deletedAt) throw new AgentJobInputError('Project not found or deleted')
    if (toolCall && ['COMPLETED', 'CANCELLED', 'ON_HOLD'].includes(project.status)) throw new AgentJobInputError('Tool calls require an active, non-completed project')
    if (clientId && project.clientId !== clientId) throw new AgentJobInputError('Project does not belong to the specified client')
    clientId = project.clientId
  }
  if (toolCall && !projectId) throw new AgentJobInputError("Tool 'task.create' requires a project ID")
  if (clientId) {
    const client = await db.client.findFirst({ where: { id: clientId, deletedAt: null }, select: { id: true } })
    if (!client) throw new AgentJobInputError('Client not found or deleted')
  }

  const normalized: Omit<EnqueueAgentJobInput, 'idempotencyKey' | 'requestedBy'> = {
    agentCode,
    input: jobInput,
    contextNote: contextNote ?? undefined,
    expectJson: input.expectJson === true,
    clientId,
    projectId,
    workflow: input.workflow?.trim().slice(0, 191) || null,
    ...(toolCall ? { toolName: toolCall.toolName, toolArgs: toolCall.args } : {}),
  }
  const hash = payloadHash(normalized)
  const existing = await db.agentJob.findUnique({ where: { idempotencyKey } })
  if (existing) {
    if (existing.payloadHash !== hash) throw new AgentJobIdempotencyConflict()
    return { job: existing, created: false }
  }

  // Fail safe when registry metadata and persisted agent configuration drift.
  const requiresApproval = agent.requiresApproval
    || definition.requiresApproval === true
    || Boolean(toolCall && PRIVILEGED_AGENT_TOOLS.includes(toolCall.toolName as AgentTool))
  const correlationId = newCorrelationId()
  try {
    const job = await db.$transaction(async (tx) => {
      const created = await tx.agentJob.create({
        data: {
          idempotencyKey,
          payloadHash: hash,
          taskType: toolCall ? 'TOOL_CALL' : 'INFERENCE',
          toolName: toolCall?.toolName ?? null,
          toolArgs: toolCall?.serializedArgs ?? null,
          agentCode,
          clientId,
          projectId,
          correlationId,
          workflow: normalized.workflow,
          input: jobInput,
          contextNote,
          expectJson: normalized.expectJson,
          status: requiresApproval ? 'AWAITING_APPROVAL' : 'QUEUED',
          approvalState: requiresApproval ? 'PENDING' : 'NOT_REQUIRED',
          requestedBy: input.requestedBy ?? null,
          maxAttempts: AGENT_JOB_DEFAULT_MAX_ATTEMPTS,
          availableAt: new Date(),
        },
      })
      await tx.auditLog.create({
        data: {
          actor: input.requestedBy ?? 'system:agent-job-api',
          action: 'AGENT_JOB_QUEUED',
          entityType: 'AgentJob',
          entityId: created.id,
          clientId,
          projectId,
          details: JSON.stringify({ agentCode, correlationId, status: created.status, approvalState: created.approvalState, taskType: created.taskType }),
        },
      })
      return created
    })
    return { job, created: true }
  } catch (error) {
    if (prismaCode(error) !== 'P2002') throw error
    const raced = await db.agentJob.findUnique({ where: { idempotencyKey } })
    if (!raced) throw error
    if (raced.payloadHash !== hash) throw new AgentJobIdempotencyConflict()
    return { job: raced, created: false }
  }
}

export async function decideAgentJob(input: {
  id: string
  decision: 'APPROVE' | 'REJECT'
  actorId: string
  note?: string
}): Promise<Awaited<ReturnType<typeof db.agentJob.findUniqueOrThrow>>> {
  const current = await db.agentJob.findUnique({ where: { id: input.id } })
  if (!current) throw new AgentJobInputError('Agent job not found')
  if (current.status !== 'AWAITING_APPROVAL' || current.approvalState !== 'PENDING') throw new AgentJobDecisionConflict()

  const now = new Date()
  const approved = input.decision === 'APPROVE'
  const nextStatus = approved ? 'QUEUED' : 'CANCELLED'
  const nextApproval = approved ? 'APPROVED' : 'REJECTED'
  const decision = await db.$transaction(async (tx) => {
    const changed = await tx.agentJob.updateMany({
      where: { id: current.id, status: 'AWAITING_APPROVAL', approvalState: 'PENDING' },
      data: {
        status: nextStatus,
        approvalState: nextApproval,
        approvedBy: input.actorId,
        approvedAt: now,
        approvalNote: input.note?.slice(0, 2000) ?? null,
        availableAt: now,
        completedAt: approved ? null : now,
      },
    })
    if (changed.count !== 1) throw new AgentJobDecisionConflict()
    await tx.auditLog.create({
      data: {
        actor: input.actorId,
        action: approved ? 'AGENT_JOB_APPROVED' : 'AGENT_JOB_REJECTED',
        entityType: 'AgentJob',
        entityId: current.id,
        clientId: current.clientId,
        projectId: current.projectId,
        details: JSON.stringify({ agentCode: current.agentCode, correlationId: current.correlationId, decision: nextApproval }),
      },
    })
    return tx.agentJob.findUniqueOrThrow({ where: { id: current.id } })
  })
  return decision
}

async function recoverExpiredAgentJobs(now: Date): Promise<number> {
  const expired = await db.agentJob.findMany({
    where: { status: 'RUNNING', leaseUntil: { lte: now } },
    orderBy: { leaseUntil: 'asc' },
    take: 50,
  })
  let recovered = 0
  for (const job of expired) {
    const retry = job.attempts < job.maxAttempts
    const status = retry ? 'RETRYING' : 'TIMED_OUT'
    const availableAt = retry ? new Date(now.getTime() + agentJobRetryDelayMs(job.attempts)) : now
    const checkpoint = {
      ...safeCheckpoint(job.checkpoint),
      phase: 'WORKER_LEASE_EXPIRED',
      recoveredAt: now.toISOString(),
    }
    const result = await db.$transaction(async (tx) => {
      const changed = await tx.agentJob.updateMany({
        where: { id: job.id, status: 'RUNNING', leaseUntil: { lte: now } },
        data: {
          status,
          availableAt,
          claimedBy: null,
          leaseUntil: null,
          lastError: 'Worker lease expired; job was recovered after process interruption',
          checkpoint: JSON.stringify(checkpoint),
          completedAt: retry ? null : now,
        },
      })
      if (changed.count !== 1) return false
      await tx.auditLog.create({
        data: {
          actor: 'system:agent-job-recovery',
          action: retry ? 'AGENT_JOB_RECOVERED' : 'AGENT_JOB_TIMED_OUT',
          entityType: 'AgentJob',
          entityId: job.id,
          clientId: job.clientId,
          projectId: job.projectId,
          details: JSON.stringify({ correlationId: job.correlationId, attempts: job.attempts, status }),
        },
      })
      return true
    })
    if (result) recovered += 1
  }
  return recovered
}

export async function claimNextAgentJob(workerId: string, now = new Date()): Promise<Awaited<ReturnType<typeof db.agentJob.findUniqueOrThrow>> | null> {
  const candidate = await db.agentJob.findFirst({
    where: {
      status: { in: ['QUEUED', 'RETRYING'] },
      approvalState: { in: ['NOT_REQUIRED', 'APPROVED'] },
      availableAt: { lte: now },
    },
    orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
  })
  if (!candidate) return null
  if (candidate.attempts >= candidate.maxAttempts) {
    await db.agentJob.updateMany({
      where: { id: candidate.id, status: candidate.status, attempts: candidate.attempts },
      data: { status: 'FAILED', completedAt: now, lastError: 'Maximum attempt count reached before claim' },
    })
    return null
  }

  const leaseMs = resolveAgentTimeoutMs() * 2 + 60_000
  const claimed = await db.$transaction(async (tx) => {
    const changed = await tx.agentJob.updateMany({
      where: { id: candidate.id, status: candidate.status, attempts: candidate.attempts, availableAt: { lte: now } },
      data: {
        status: 'RUNNING',
        attempts: { increment: 1 },
        startedAt: now,
        claimedBy: workerId,
        leaseUntil: new Date(now.getTime() + leaseMs),
      },
    })
    if (changed.count !== 1) return null
    await tx.auditLog.create({
      data: {
        actor: `worker:${workerId}`,
        action: 'AGENT_JOB_CLAIMED',
        entityType: 'AgentJob',
        entityId: candidate.id,
        clientId: candidate.clientId,
        projectId: candidate.projectId,
        details: JSON.stringify({ correlationId: candidate.correlationId, attempt: candidate.attempts + 1 }),
      },
    })
    return tx.agentJob.findUniqueOrThrow({ where: { id: candidate.id } })
  })
  return claimed
}

async function finishClaimedJob(
  job: Awaited<ReturnType<typeof db.agentJob.findUniqueOrThrow>>,
  workerId: string,
  result: { ok: boolean; executionId: string; correlationId: string; output: string; error?: string; status: string },
  now: Date,
): Promise<string> {
  const error = result.error?.slice(0, 2000) ?? null
  const retry = !result.ok && isRetryableAgentJobFailure(result.status, error, job.attempts, job.maxAttempts)
  const nextStatus = result.ok ? 'COMPLETED' : retry ? 'RETRYING' : agentJobTerminalState(result.status, job.attempts, job.maxAttempts)
  const availableAt = retry ? new Date(now.getTime() + agentJobRetryDelayMs(job.attempts)) : now
  const phase = job.taskType === 'TOOL_CALL' ? 'TOOL' : 'INFERENCE'
  const checkpoint = {
    ...safeCheckpoint(job.checkpoint),
    phase: result.ok ? `${phase}_COMPLETED` : retry ? `${phase}_RETRY_SCHEDULED` : `${phase}_FAILED`,
    executionId: result.executionId || null,
    executionCorrelationId: result.correlationId,
    attempt: job.attempts,
    recordedAt: now.toISOString(),
  }

  const saved = await db.$transaction(async (tx) => {
    const changed = await tx.agentJob.updateMany({
      where: { id: job.id, status: 'RUNNING', claimedBy: workerId },
      data: {
        status: nextStatus,
        output: result.ok ? result.output.slice(0, MAX_JOB_OUTPUT) : null,
        lastError: error,
        checkpoint: JSON.stringify(checkpoint),
        availableAt,
        claimedBy: null,
        leaseUntil: null,
        completedAt: nextStatus === 'RETRYING' ? null : now,
      },
    })
    if (changed.count !== 1) return false
    await tx.auditLog.create({
      data: {
        actor: `worker:${workerId}`,
        action: nextStatus === 'COMPLETED' ? 'AGENT_JOB_COMPLETED' : nextStatus === 'RETRYING' ? 'AGENT_JOB_RETRY_SCHEDULED' : 'AGENT_JOB_FAILED',
        entityType: 'AgentJob',
        entityId: job.id,
        clientId: job.clientId,
        projectId: job.projectId,
        details: JSON.stringify({ agentCode: job.agentCode, correlationId: job.correlationId, executionId: result.executionId || null, status: nextStatus, attempt: job.attempts }),
      },
    })
    return true
  })
  return saved ? nextStatus : 'LEASE_LOST'
}

const TRANSIENT_TOOL_DATABASE_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2034'])

function safeToolExecutionError(error: unknown): string {
  if (error instanceof AgentJobToolInputError) return error.message.slice(0, 2000)
  const code = prismaCode(error)
  if (code && TRANSIENT_TOOL_DATABASE_CODES.has(code)) return `TOOL_TEMPORARY_FAILURE: database operation failed (${code})`
  return `TOOL_EXECUTION_FAILED${code ? ` (${code})` : ''}`
}

/**
 * Process a bounded batch of persisted inference or explicitly allowlisted tool
 * jobs. Only the database lease winner can call the model or tool executor;
 * retries and expired-lease recovery preserve state across process restarts.
 * `runInference` is a narrow test seam; production callers use runAgent.
 */
export async function processAgentJobBatch(
  limit = 1,
  options: { runInference?: typeof runAgent } = {},
): Promise<{
  recovered: number
  processed: Array<{ id: string; status: string; executionId?: string; toolName?: string }>
}> {
  const now = new Date()
  const recovered = await recoverExpiredAgentJobs(now)
  const safeLimit = Math.max(1, Math.min(MAX_JOBS_PER_BATCH, Math.floor(limit)))
  const processed: Array<{ id: string; status: string; executionId?: string; toolName?: string }> = []
  const runInference = options.runInference ?? runAgent

  for (let i = 0; i < safeLimit; i += 1) {
    const workerId = randomUUID()
    const job = await claimNextAgentJob(workerId, new Date())
    if (!job) break

    if (job.taskType === 'TOOL_CALL') {
      let toolResult: Awaited<ReturnType<typeof executeAgentJobTool>>
      try {
        toolResult = await executeAgentJobTool({ jobId: job.id, workerId })
      } catch (error) {
        toolResult = { ok: false, status: 'FAILED', output: '', error: safeToolExecutionError(error) }
      }
      if (toolResult.ok || toolResult.status === 'LEASE_LOST') {
        processed.push({ id: job.id, status: toolResult.status, toolName: job.toolName ?? undefined })
        continue
      }
      const failure = {
        ok: false,
        agentCode: job.agentCode,
        executionId: '',
        correlationId: job.correlationId,
        output: '',
        error: toolResult.error,
        status: 'FAILED',
      }
      const status = await finishClaimedJob(job, workerId, failure, new Date())
      processed.push({ id: job.id, status, toolName: job.toolName ?? undefined })
      continue
    }

    let result: Awaited<ReturnType<typeof runAgent>>
    if (job.taskType !== 'INFERENCE') {
      result = { ok: false, agentCode: job.agentCode, executionId: '', correlationId: job.correlationId, output: '', json: null, error: 'Unsupported AgentJob task type', status: 'FAILED' }
    } else {
      try {
        result = await runInference(job.agentCode, {
          input: job.input,
          contextNote: job.contextNote ?? undefined,
          clientId: job.clientId ?? undefined,
          projectId: job.projectId ?? undefined,
          workflow: job.workflow ?? 'DURABLE_AGENT_JOB',
          expectJson: job.expectJson,
          actingForClientId: job.clientId,
          correlationId: job.correlationId,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected worker failure'
        result = { ok: false, agentCode: job.agentCode, executionId: '', correlationId: job.correlationId, output: '', json: null, error: message, status: 'FAILED' }
      }
    }
    const status = await finishClaimedJob(job, workerId, result, new Date())
    processed.push({ id: job.id, status, ...(result.executionId ? { executionId: result.executionId } : {}) })
  }

  return { recovered, processed }
}
