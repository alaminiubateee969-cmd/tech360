import { db } from '@/lib/db'
import {
  PRIVILEGED_AGENT_TOOLS,
  agentHasPermission,
  agentMayAccessClient,
  authorizeAgentTool,
  type AgentTool,
} from '@/lib/ai-workforce-policy'
import { getAgentDefinition } from '@/lib/agents/bootstrap'

export const AGENT_JOB_TOOL_ALLOWLIST = ['task.create'] as const
export type AgentJobToolName = (typeof AGENT_JOB_TOOL_ALLOWLIST)[number]

export type CreateTaskToolArgs = {
  title: string
  description: string | null
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
}

export class AgentJobToolInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentJobToolInputError'
  }
}

export type NormalizedAgentJobToolCall = {
  toolName: AgentJobToolName
  args: CreateTaskToolArgs
  serializedArgs: string
}

/**
 * The durable worker intentionally exposes a much smaller executable set than
 * the full agent capability vocabulary. Adding a name to AGENT_TOOLS alone
 * never makes a side effect callable from a job.
 */
export function normalizeAgentJobToolCall(toolName: string, value: unknown): NormalizedAgentJobToolCall {
  if (!(AGENT_JOB_TOOL_ALLOWLIST as readonly string[]).includes(toolName)) {
    throw new AgentJobToolInputError(`Tool '${toolName}' is not executable by durable AgentJobs`)
  }
  if (toolName !== 'task.create') {
    throw new AgentJobToolInputError(`Tool '${toolName}' has no durable executor`)
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgentJobToolInputError("Tool 'task.create' requires a JSON object of arguments")
  }

  const raw = value as Record<string, unknown>
  const allowedKeys = new Set(['title', 'description', 'priority'])
  if (Object.keys(raw).some((key) => !allowedKeys.has(key))) {
    throw new AgentJobToolInputError("Tool 'task.create' received an unsupported argument")
  }

  if (typeof raw.title !== 'string' || raw.title.trim().length < 3 || raw.title.length > 160) {
    throw new AgentJobToolInputError("Tool 'task.create' title must contain 3–160 characters")
  }
  const title = cleanText(raw.title)
  if (title.length < 3) throw new AgentJobToolInputError("Tool 'task.create' title must contain 3–160 characters")

  let description: string | null = null
  if (raw.description !== undefined && raw.description !== null) {
    if (typeof raw.description !== 'string' || raw.description.length > 2000) {
      throw new AgentJobToolInputError("Tool 'task.create' description must be at most 2,000 characters")
    }
    description = cleanText(raw.description) || null
  }

  const priorityValue = raw.priority === undefined ? 'MEDIUM' : String(raw.priority).toUpperCase()
  if (!['LOW', 'MEDIUM', 'HIGH'].includes(priorityValue)) {
    throw new AgentJobToolInputError("Tool 'task.create' priority must be LOW, MEDIUM or HIGH")
  }

  const args: CreateTaskToolArgs = {
    title,
    description,
    priority: priorityValue as CreateTaskToolArgs['priority'],
  }
  return { toolName: 'task.create', args, serializedArgs: JSON.stringify(args) }
}

function cleanText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
}

function parseCheckpoint(value: string | null): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function parseToolArgs(value: string | null): unknown {
  if (!value) throw new AgentJobToolInputError('Tool arguments are missing')
  try {
    return JSON.parse(value) as unknown
  } catch {
    throw new AgentJobToolInputError('Tool arguments are not valid JSON')
  }
}

class LostAgentJobLeaseError extends Error {
  constructor() {
    super('AgentJob worker lease was lost before the tool transaction committed')
    this.name = 'LostAgentJobLeaseError'
  }
}

export type AgentJobToolExecutionResult =
  | { ok: true; status: 'COMPLETED'; output: string; taskId: string }
  | { ok: false; status: 'FAILED' | 'LEASE_LOST'; output: ''; error: string }

/**
 * Execute the currently allowlisted internal task.create capability. The
 * project task insert, AgentJob completion, and audit row share one MySQL
 * transaction. ProjectTask.agentJobId is unique, so a worker restart cannot
 * create a duplicate task for the same durable job.
 */
export async function executeAgentJobTool(input: {
  jobId: string
  workerId: string
  now?: Date
}): Promise<AgentJobToolExecutionResult> {
  const job = await db.agentJob.findUnique({ where: { id: input.jobId } })
  if (!job) return { ok: false, status: 'FAILED', output: '', error: 'AGENT_JOB_NOT_FOUND' }
  if (job.taskType !== 'TOOL_CALL' || !job.toolName) {
    return { ok: false, status: 'FAILED', output: '', error: 'AGENT_JOB_TOOL_ENVELOPE_INVALID' }
  }

  let invocation: NormalizedAgentJobToolCall
  try {
    invocation = normalizeAgentJobToolCall(job.toolName, parseToolArgs(job.toolArgs))
  } catch (error) {
    return { ok: false, status: 'FAILED', output: '', error: error instanceof Error ? error.message : 'AGENT_JOB_TOOL_INPUT_INVALID' }
  }

  const [agent, project] = await Promise.all([
    db.aiAgent.findUnique({
      where: { code: job.agentCode },
      select: { code: true, status: true, requiresApproval: true, tools: true, permissions: true, department: { select: { code: true } } },
    }),
    job.projectId
      ? db.project.findUnique({
          where: { id: job.projectId },
          select: { id: true, clientId: true, status: true, deletedAt: true, client: { select: { id: true, deletedAt: true } } },
        })
      : Promise.resolve(null),
  ])
  const definition = getAgentDefinition(job.agentCode)
  if (!agent || !definition || agent.status !== 'ACTIVE') {
    return { ok: false, status: 'FAILED', output: '', error: 'AGENT_INACTIVE_OR_UNREGISTERED' }
  }
  if (agent.department?.code !== definition.dept) {
    return { ok: false, status: 'FAILED', output: '', error: 'AGENT_DEPARTMENT_INVALID' }
  }
  if (!definition.tools.includes(invocation.toolName)) {
    return { ok: false, status: 'FAILED', output: '', error: 'TOOL_NOT_IN_CANONICAL_AGENT_REGISTRY' }
  }
  const toolDecision = authorizeAgentTool(agent, invocation.toolName as AgentTool)
  if (!toolDecision.allowed) {
    return { ok: false, status: 'FAILED', output: '', error: `TOOL_DENIED_${toolDecision.code}` }
  }
  if (!agentHasPermission(agent, 'write:tasks') || !definition.permissions.includes('write:tasks')) {
    return { ok: false, status: 'FAILED', output: '', error: 'TOOL_DENIED_WRITE_TASKS' }
  }
  const requiresApproval = agent.requiresApproval
    || definition.requiresApproval === true
    || PRIVILEGED_AGENT_TOOLS.includes(invocation.toolName as AgentTool)
  if (requiresApproval && job.approvalState !== 'APPROVED') {
    return { ok: false, status: 'FAILED', output: '', error: 'TOOL_APPROVAL_REQUIRED' }
  }
  if (!project || project.deletedAt || project.client.deletedAt || ['COMPLETED', 'CANCELLED', 'ON_HOLD'].includes(project.status)) {
    return { ok: false, status: 'FAILED', output: '', error: 'TOOL_PROJECT_NOT_ACTIVE' }
  }
  if (!job.clientId || project.clientId !== job.clientId || !agentMayAccessClient({ permissions: agent.permissions }, job.clientId, project.clientId)) {
    return { ok: false, status: 'FAILED', output: '', error: 'TOOL_CROSS_CLIENT_DENIED' }
  }

  const now = input.now ?? new Date()
  try {
    const completed = await db.$transaction(async (tx) => {
      const claim = await tx.agentJob.findFirst({
        where: {
          id: job.id,
          taskType: 'TOOL_CALL',
          status: 'RUNNING',
          approvalState: { in: ['NOT_REQUIRED', 'APPROVED'] },
          claimedBy: input.workerId,
          leaseUntil: { gt: now },
        },
        select: { id: true, checkpoint: true },
      })
      if (!claim) throw new LostAgentJobLeaseError()

      // Re-read the authority and tenant boundary in the same transaction as
      // the side effect, so a changed grant/project cannot be trusted from the
      // earlier preflight snapshot.
      const currentAgent = await tx.aiAgent.findUnique({
        where: { code: job.agentCode },
        select: { code: true, status: true, requiresApproval: true, tools: true, permissions: true, department: { select: { code: true } } },
      })
      const currentProject = job.projectId
        ? await tx.project.findUnique({
            where: { id: job.projectId },
            select: { id: true, clientId: true, status: true, deletedAt: true, client: { select: { id: true, deletedAt: true } } },
          })
        : null
      if (!currentAgent || currentAgent.status !== 'ACTIVE' || currentAgent.department?.code !== definition.dept) {
        throw new AgentJobToolInputError('Agent is inactive or its canonical department mapping changed')
      }
      if (!definition.tools.includes(invocation.toolName) || !authorizeAgentTool(currentAgent, invocation.toolName).allowed) {
        throw new AgentJobToolInputError('Tool grant changed before execution')
      }
      if (!agentHasPermission(currentAgent, 'write:tasks') || !definition.permissions.includes('write:tasks')) {
        throw new AgentJobToolInputError('write:tasks permission was removed before execution')
      }
      const currentRequiresApproval = currentAgent.requiresApproval
        || definition.requiresApproval === true
        || PRIVILEGED_AGENT_TOOLS.includes(invocation.toolName as AgentTool)
      if (currentRequiresApproval && job.approvalState !== 'APPROVED') {
        throw new AgentJobToolInputError('Tool approval is required before execution')
      }
      if (!currentProject || currentProject.deletedAt || currentProject.client.deletedAt || ['COMPLETED', 'CANCELLED', 'ON_HOLD'].includes(currentProject.status)) {
        throw new AgentJobToolInputError('Project is no longer eligible for task creation')
      }
      if (!job.clientId || currentProject.clientId !== job.clientId || !agentMayAccessClient({ permissions: currentAgent.permissions }, job.clientId, currentProject.clientId)) {
        throw new AgentJobToolInputError('Project/client isolation check failed before execution')
      }

      const existingTask = await tx.projectTask.findUnique({ where: { agentJobId: job.id } })
      let task = existingTask
      if (task && task.projectId !== currentProject.id) {
        throw new AgentJobToolInputError('Existing idempotent task is bound to a different project')
      }
      if (!task) {
        task = await tx.projectTask.create({
          data: {
            projectId: currentProject.id,
            agentJobId: job.id,
            title: invocation.args.title,
            description: invocation.args.description,
            status: 'TODO',
            priority: invocation.args.priority,
            assigneeType: 'HUMAN',
          },
        })
      }

      const output = JSON.stringify({
        tool: invocation.toolName,
        taskId: task.id,
        projectId: currentProject.id,
        taskStatus: task.status,
        assignedTo: 'HUMAN',
      })
      const checkpoint = {
        ...parseCheckpoint(claim.checkpoint),
        phase: 'TOOL_EXECUTED',
        toolName: invocation.toolName,
        resultId: task.id,
        completedAt: now.toISOString(),
      }
      const updated = await tx.agentJob.updateMany({
        where: { id: job.id, taskType: 'TOOL_CALL', status: 'RUNNING', claimedBy: input.workerId, leaseUntil: { gt: now } },
        data: {
          status: 'COMPLETED',
          output,
          lastError: null,
          checkpoint: JSON.stringify(checkpoint),
          claimedBy: null,
          leaseUntil: null,
          completedAt: now,
        },
      })
      if (updated.count !== 1) throw new LostAgentJobLeaseError()

      await tx.auditLog.create({
        data: {
          actor: `worker:${input.workerId}`,
          action: 'AGENT_JOB_TOOL_EXECUTED',
          entityType: 'AgentJob',
          entityId: job.id,
          clientId: job.clientId,
          projectId: currentProject.id,
          details: JSON.stringify({ toolName: invocation.toolName, taskId: task.id, correlationId: job.correlationId }),
        },
      })
      return { output, taskId: task.id }
    })
    return { ok: true, status: 'COMPLETED', output: completed.output, taskId: completed.taskId }
  } catch (error) {
    if (error instanceof LostAgentJobLeaseError) {
      return { ok: false, status: 'LEASE_LOST', output: '', error: 'LEASE_LOST' }
    }
    throw error
  }
}
