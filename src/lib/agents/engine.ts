import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { newCorrelationId, logError } from '@/lib/security'
import { authorizeAgentTool, agentMayAccessClient, type AgentTool } from '@/lib/ai-workforce-policy'

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

let zaiPromise: Promise<Awaited<ReturnType<typeof ZAI.create>>> | null = null
async function getZai() {
  if (!zaiPromise) zaiPromise = ZAI.create()
  return zaiPromise
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
export async function runAgent(agentCode: string, run: AgentRunInput): Promise<AgentRunResult> {
  const correlationId = newCorrelationId()
  const agent = await db.aiAgent.findUnique({ where: { code: agentCode } })
  if (!agent) {
    await logError({ source: 'AGENT', code: 'AGENT_NOT_FOUND', message: `Agent ${agentCode} not found`, correlationId })
    return { ok: false, agentCode, executionId: '', correlationId, output: '', json: null, error: 'Agent not found', status: 'FAILED' }
  }
  if (agent.status !== 'ACTIVE') {
    return { ok: false, agentCode, executionId: '', correlationId, output: '', json: null, error: `Agent ${agentCode} is ${agent.status}`, status: 'FAILED' }
  }
  // --- least-privilege tool authorization -------------------------------
  // Holding a tool is not implied by being ACTIVE: the agent must have been
  // granted it explicitly. Every refusal is recorded, so an agent probing for
  // capability it does not have is visible to the Super Admin.
  if (run.tool) {
    const decision = authorizeAgentTool({ status: agent.status, tools: agent.tools, permissions: agent.permissions }, run.tool)
    if (!decision.allowed) {
      await logError({
        source: 'AGENT',
        code: `TOOL_DENIED_${decision.code}`,
        message: `Agent ${agentCode} attempted '${run.tool}' without a grant`,
        correlationId,
        clientId: run.clientId,
        workflow: run.workflow,
      })
      await db.auditLog.create({
        data: {
          actor: agentCode, action: 'AGENT_TOOL_DENIED',
          entityType: 'AiAgent', entityId: agentCode,
          clientId: run.clientId ?? null, projectId: run.projectId ?? null,
          details: JSON.stringify({ tool: run.tool, reason: decision.code, correlationId }),
        },
      }).catch(() => null)
      return { ok: false, agentCode, executionId: '', correlationId, output: '', json: null, error: `Tool '${run.tool}' not permitted (${decision.code})`, status: 'FAILED' }
    }
  }

  // --- tenant isolation --------------------------------------------------
  // An agent acting for one client must not operate on another client's
  // records unless it holds an explicit cross-client grant.
  if (run.clientId && !agentMayAccessClient({ permissions: agent.permissions }, run.actingForClientId ?? null, run.clientId)) {
    await logError({
      source: 'AGENT', code: 'CROSS_CLIENT_DENIED',
      message: `Agent ${agentCode} attempted to act on a client it is not scoped to`,
      correlationId, workflow: run.workflow,
    })
    await db.auditLog.create({
      data: {
        actor: agentCode, action: 'AGENT_CROSS_CLIENT_DENIED',
        entityType: 'AiAgent', entityId: agentCode,
        clientId: run.clientId, projectId: run.projectId ?? null,
        details: JSON.stringify({ correlationId }),
      },
    }).catch(() => null)
    return { ok: false, agentCode, executionId: '', correlationId, output: '', json: null, error: 'Cross-client access denied', status: 'FAILED' }
  }

  if (agent.tokensToday >= agent.dailyQuota * 4000) {
    await logError({ source: 'AGENT', code: 'QUOTA_EXCEEDED', message: `Agent ${agentCode} exceeded daily quota`, correlationId })
    return { ok: false, agentCode, executionId: '', correlationId, output: '', json: null, error: 'Daily quota exceeded', status: 'FAILED' }
  }

  const execution = await db.aiAgentExecution.create({
    data: {
      agentCode, correlationId,
      clientId: run.clientId ?? null,
      projectId: run.projectId ?? null,
      workflow: run.workflow ?? null,
      input: run.input.slice(0, 12000),
      status: 'RUNNING',
    },
  })

  const started = Date.now()
  try {
    const zai = await getZai()
    const userContent = (run.contextNote ? `${run.contextNote}\n\n` : '') + run.input
    const messages: Array<{ role: 'assistant' | 'user'; content: string }> = [
      { role: 'assistant', content: agent.systemPrompt },
      { role: 'user', content: userContent.slice(0, 24000) },
    ]
    const completion = await zai.chat.completions.create({ messages, thinking: { type: 'disabled' } })
    const output = completion.choices[0]?.message?.content ?? ''
    if (!output.trim()) throw new Error('Empty response from model')

    const json = run.expectJson ? extractJson(output) : null
    if (run.expectJson && !json) {
      // execution succeeded but output wasn't parseable — return raw, flag in meta
      await db.aiAgentExecution.update({
        where: { id: execution.id },
        data: {
          output: output.slice(0, 20000), status: 'SUCCESS',
          durationMs: Date.now() - started,
          tokensUsed: Math.ceil((agent.systemPrompt.length + userContent.length + output.length) / 4),
        },
      })
      await db.aiAgent.update({
        where: { code: agentCode },
        data: { executionCount: { increment: 1 }, successCount: { increment: 1 }, tokensToday: { increment: 2 } },
      })
      return { ok: true, agentCode, executionId: execution.id, correlationId, output, json: null, status: 'SUCCESS' }
    }

    await db.aiAgentExecution.update({
      where: { id: execution.id },
      data: {
        output: output.slice(0, 20000), status: 'SUCCESS',
        durationMs: Date.now() - started,
        tokensUsed: Math.ceil((agent.systemPrompt.length + userContent.length + output.length) / 4),
      },
    })
    await db.aiAgent.update({
      where: { code: agentCode },
      data: { executionCount: { increment: 1 }, successCount: { increment: 1 }, tokensToday: { increment: 2 } },
    })
    if (run.tool) {
      await db.auditLog.create({
        data: {
          actor: agentCode, action: 'AGENT_TOOL_INVOKED',
          entityType: 'AiAgent', entityId: agentCode,
          clientId: run.clientId ?? null, projectId: run.projectId ?? null,
          details: JSON.stringify({ tool: run.tool, executionId: execution.id, correlationId }),
        },
      }).catch(() => null)
    }
    return { ok: true, agentCode, executionId: execution.id, correlationId, output, json, status: 'SUCCESS' }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await db.aiAgentExecution.update({
      where: { id: execution.id },
      data: { status: 'FAILED', error: message.slice(0, 2000), durationMs: Date.now() - started },
    }).catch(() => null)
    await db.aiAgent.update({
      where: { code: agentCode },
      data: { executionCount: { increment: 1 }, failureCount: { increment: 1 } },
    }).catch(() => null)
    await logError({ source: 'AGENT', code: 'EXECUTION_FAILED', message: `Agent ${agentCode}: ${message}`, correlationId, clientId: run.clientId, workflow: run.workflow })
    return { ok: false, agentCode, executionId: execution.id, correlationId, output: '', json: null, error: message, status: 'FAILED' }
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
