import { db } from '@/lib/db'
import { createZaiClient, ZaiProviderError } from '@/lib/ai-provider'
import { withTimeout, resolveAgentTimeoutMs, isTransientRunError, MAX_RETRY_ATTEMPTS, RunTimeoutError } from '@/lib/agents/resilience'
import { newCorrelationId, logError } from '@/lib/security'
import { authorizeAgentTool, agentMayAccessClient, type AgentTool } from '@/lib/ai-workforce-policy'
import { getAgentDefinition } from '@/lib/agents/bootstrap'

// ------------------------------------------------------------
// Real AI agent execution engine (server-side only)
// Every run is persisted: input, output, tokens, duration, errors
// ------------------------------------------------------------

export type AgentRunInput = {
  input: string
  clientId?: string
  projectId?: string
  workflow?: string
  expectJson?: boolean
  contextNote?: string // additional runtime context appended to prompt
  /**
   * The capability this run needs. When set, the agent must hold an explicit
   * grant for it in `AiAgent.permissions` or the run is refused and audited.
   * Least privilege: no tool is implied by simply being ACTIVE.
   */
  tool?: AgentTool
  /** The client this run is acting on behalf of, for tenant isolation. */
  actingForClientId?: string | null
}

export type AgentRunResult = {
  ok: boolean
  agentCode: string
  executionId: string
  correlationId: string
  output: string
  json: Record<string, unknown> | null
  error?: string
  status: string
}

export { createZaiClient }

function providerErrorMessage(error: unknown): string {
  if (error instanceof ZaiProviderError) return `${error.code}: ${error.message}`
  if (error instanceof RunTimeoutError) return `${error.code}: ${error.message}`
  return error instanceof Error ? error.message : String(error)
}

function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null
  // strip code fences and find first JSON object/array
  const cleaned = raw.replace(/```json|```/g, '').trim()
  const start = cleaned.search(/[{[]/)
  if (start === -1) return null
  const endCurly = cleaned.lastIndexOf('}')
  const endSquare = cleaned.lastIndexOf(']')
  const end = Math.max(endCurly, endSquare)
  if (end <= start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Execute an agent by code. Loads its live registry row (DB),
 * enforces governance (status/quota), runs the LLM, records everything.
 */
export async function reapStaleAgentExecutions(now = new Date()): Promise<number> {
  const timeoutMs = resolveAgentTimeoutMs()
  const cutoff = new Date(now.getTime() - (timeoutMs * 2 + 60_000))
  const stale = await db.aiAgentExecution.findMany({
    where: { status: 'RUNNING', createdAt: { lt: cutoff } },
    select: { id: true },
    take: 50,
  })
  if (stale.length === 0) return 0
  const result = await db.aiAgentExecution.updateMany({
    where: { id: { in: stale.map((execution) => execution.id) }, status: 'RUNNING' },
    data: {
      status: 'TIMEOUT',
      error: 'TIMEOUT: stale RUNNING execution reaped by the execution engine',
      durationMs: timeoutMs * 2 + 60_000,
      completedAt: now,
    },
  })
  return result.count
}

/**
 * Execute an agent by code. Loads its live registry row (DB),
 * validates the canonical department mapping, enforces governance,
 * calls the configured provider, and records every terminal outcome.
 */
export async function runAgent(agentCode: string, run: AgentRunInput): Promise<AgentRunResult> {
  await reapStaleAgentExecutions().catch(() => 0)
  const correlationId = newCorrelationId()
  const definition = getAgentDefinition(agentCode)
  const agent = await db.aiAgent.findUnique({
    where: { code: agentCode },
    include: { department: { select: { code: true } } },
  })
  if (!agent || !definition) {
    await logError({ source: 'AGENT', code: 'AGENT_NOT_FOUND', message: `Agent ${agentCode} not found`, correlationId })
    return { ok: false, agentCode, executionId: '', correlationId, output: '', json: null, error: 'Agent not found', status: 'FAILED' }
  }
  if (agent.department?.code !== definition.dept) {
    const error = `Agent ${agentCode} department mapping is invalid`
    await logError({ source: 'AGENT', code: 'AGENT_DEPARTMENT_INVALID', message: error, correlationId })
    return { ok: false, agentCode, executionId: '', correlationId, output: '', json: null, error, status: 'FAILED' }
  }
  if (agent.status !== 'ACTIVE') {
    return { ok: false, agentCode, executionId: '', correlationId, output: '', json: null, error: `Agent ${agentCode} is ${agent.status}`, status: 'FAILED' }
  }

  if (run.tool) {
    const decision = authorizeAgentTool({ status: agent.status, tools: agent.tools, permissions: agent.permissions }, run.tool)
    if (!decision.allowed) {
      await logError({
        source: 'AGENT', code: `TOOL_DENIED_${decision.code}`,
        message: `Agent ${agentCode} attempted '${run.tool}' without a grant`,
        correlationId, clientId: run.clientId, workflow: run.workflow,
      })
      await db.auditLog.create({
        data: {
          actor: agentCode, action: 'AGENT_TOOL_DENIED', entityType: 'AiAgent', entityId: agentCode,
          clientId: run.clientId ?? null, projectId: run.projectId ?? null,
          details: JSON.stringify({ tool: run.tool, reason: decision.code, correlationId }),
        },
      }).catch(() => null)
      return { ok: false, agentCode, executionId: '', correlationId, output: '', json: null, error: `Tool '${run.tool}' not permitted (${decision.code})`, status: 'FAILED' }
    }
  }

  if (run.clientId && !agentMayAccessClient({ permissions: agent.permissions }, run.actingForClientId ?? null, run.clientId)) {
    await logError({ source: 'AGENT', code: 'CROSS_CLIENT_DENIED', message: `Agent ${agentCode} attempted to act on a client it is not scoped to`, correlationId, workflow: run.workflow })
    await db.auditLog.create({
      data: {
        actor: agentCode, action: 'AGENT_CROSS_CLIENT_DENIED', entityType: 'AiAgent', entityId: agentCode,
        clientId: run.clientId, projectId: run.projectId ?? null, details: JSON.stringify({ correlationId }),
      },
    }).catch(() => null)
    return { ok: false, agentCode, executionId: '', correlationId, output: '', json: null, error: 'Cross-client access denied', status: 'FAILED' }
  }

  if (agent.tokensToday >= agent.dailyQuota * 4000) {
    await logError({ source: 'AGENT', code: 'QUOTA_EXCEEDED', message: `Agent ${agentCode} exceeded daily quota`, correlationId })
    return { ok: false, agentCode, executionId: '', correlationId, output: '', json: null, error: 'Daily quota exceeded', status: 'FAILED' }
  }

  const startedAt = new Date()
  const execution = await db.aiAgentExecution.create({
    data: {
      agentCode, correlationId,
      clientId: run.clientId ?? null, projectId: run.projectId ?? null,
      workflow: run.workflow ?? null, input: run.input.slice(0, 12000),
      status: 'RUNNING', startedAt,
    },
  })

  const timeoutMs = resolveAgentTimeoutMs()
  const userContent = (run.contextNote ? `${run.contextNote}\n\n` : '') + run.input
  const messages = [
    { role: 'system' as const, content: agent.systemPrompt },
    { role: 'user' as const, content: userContent.slice(0, 24000) },
  ]
  let lastError: unknown = new Error('Provider did not return a result')
  let completion: Awaited<ReturnType<ReturnType<typeof createZaiClient>['chat']['completions']['create']>> | null = null

  try {
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
      try {
        const client = createZaiClient()
        completion = await withTimeout(
          (signal) => client.chat.completions.create({ messages, thinking: { type: 'disabled' } }, { signal }),
          timeoutMs,
        )
        break
      } catch (error) {
        lastError = error
        if (!isTransientRunError(error) || attempt === MAX_RETRY_ATTEMPTS - 1) throw error
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)))
      }
    }

    const output = completion?.choices[0]?.message?.content ?? ''
    if (!output.trim()) throw new ZaiProviderError('INVALID_PROVIDER_RESPONSE', 'Provider returned empty output')
    const json = run.expectJson ? extractJson(output) : null
    if (run.expectJson && !json) throw new ZaiProviderError('INVALID_PROVIDER_RESPONSE', 'Provider output was not valid JSON')
    const completedAt = new Date()
    const tokensUsed = typeof completion?.usage?.total_tokens === 'number' ? completion.usage.total_tokens : 0
    await db.aiAgentExecution.update({
      where: { id: execution.id },
      data: {
        output: output.slice(0, 20000), status: 'SUCCESS', tokensUsed,
        durationMs: completedAt.getTime() - startedAt.getTime(), completedAt,
        metadata: JSON.stringify({ provider: 'zai' }),
      },
    })
    await db.aiAgent.update({
      where: { code: agentCode },
      data: { executionCount: { increment: 1 }, successCount: { increment: 1 }, tokensToday: { increment: tokensUsed } },
    })
    if (run.tool) {
      await db.auditLog.create({
        data: {
          actor: agentCode, action: 'AGENT_TOOL_INVOKED', entityType: 'AiAgent', entityId: agentCode,
          clientId: run.clientId ?? null, projectId: run.projectId ?? null,
          details: JSON.stringify({ tool: run.tool, executionId: execution.id, correlationId }),
        },
      }).catch(() => null)
    }
    return { ok: true, agentCode, executionId: execution.id, correlationId, output, json, status: 'SUCCESS' }
  } catch (error) {
    lastError = error
    const completedAt = new Date()
    const timeout = error instanceof RunTimeoutError || (error instanceof ZaiProviderError && error.code === 'PROVIDER_TIMEOUT')
    const status = timeout ? 'TIMEOUT' : 'FAILED'
    const message = providerErrorMessage(lastError).slice(0, 2000)
    await db.aiAgentExecution.update({
      where: { id: execution.id },
      data: { status, error: message, durationMs: completedAt.getTime() - startedAt.getTime(), completedAt, metadata: JSON.stringify({ provider: 'zai' }) },
    }).catch(() => null)
    await db.aiAgent.update({
      where: { code: agentCode },
      data: { executionCount: { increment: 1 }, failureCount: { increment: 1 } },
    }).catch(() => null)
    await logError({ source: 'AGENT', code: timeout ? 'EXECUTION_TIMEOUT' : 'EXECUTION_FAILED', message: `Agent ${agentCode}: ${message}`, correlationId, clientId: run.clientId, workflow: run.workflow })
    return { ok: false, agentCode, executionId: execution.id, correlationId, output: '', json: null, error: message, status }
  }
}

// ------------------------------------------------------------
// Memory — persistent, database-backed
// ------------------------------------------------------------
export async function rememberMemory(entry: { scope: string; key: string; content: string; clientId?: string; projectId?: string; agentCode?: string; importance?: number }) {
  const existing = await db.aiMemory.findFirst({
    where: { scope: entry.scope, key: entry.key, clientId: entry.clientId ?? null },
  })
  if (existing) {
    return db.aiMemory.update({ where: { id: existing.id }, data: { content: entry.content, importance: entry.importance ?? existing.importance, updatedAt: new Date() } })
  }
  return db.aiMemory.create({
    data: {
      scope: entry.scope, key: entry.key, content: entry.content,
      clientId: entry.clientId ?? null, projectId: entry.projectId ?? null,
      agentCode: entry.agentCode ?? null, importance: entry.importance ?? 5,
    },
  })
}

export async function recallMemory(query: { scope?: string; clientId?: string; key?: string }) {
  return db.aiMemory.findMany({
    where: {
      scope: query.scope,
      clientId: query.clientId ?? undefined,
      key: query.key ? { contains: query.key } : undefined,
    },
    orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
    take: 50,
  })
}

// ------------------------------------------------------------
// Knowledge search for agents
// ------------------------------------------------------------
export async function searchKnowledge(query: string, limit = 5) {
  const docs = await db.knowledgeDocument.findMany({
    where: { status: { in: ['INDEXED', 'APPROVED'] } },
    take: 200,
    orderBy: { updatedAt: 'desc' },
  })
  const q = query.toLowerCase()
  return docs
    .map((d) => {
      const text = (d.extractedText ?? '').toLowerCase()
      const title = d.title.toLowerCase()
      let score = 0
      for (const term of q.split(/\s+/).filter((t) => t.length > 2)) {
        if (title.includes(term)) score += 3
        if (text.includes(term)) score += 1
      }
      return { doc: d, score }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
