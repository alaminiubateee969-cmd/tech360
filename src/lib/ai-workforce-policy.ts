/**
 * TECH360 — AI Employee workforce access policy.
 *
 * The AI Employee workforce is an INTERNAL operational system. It is not a
 * public feature and it is not a general staff feature: the registry, system
 * prompts, memory, execution history, failures, tool permissions, knowledge
 * sources and workflow definitions are all Super Admin material.
 *
 * This module is the single source of truth for that boundary. The API guard
 * and the admin navigation both read it, and `tests/ai-workforce-rbac.test.ts`
 * asserts that every protected route file actually declares it — so a new
 * route cannot quietly ship with a weaker role.
 */

export const AI_WORKFORCE_MIN_ROLE = 'SUPER_ADMIN' as const

/**
 * API path prefixes that expose AI Employee internals.
 * Every route under these prefixes must guard with AI_WORKFORCE_MIN_ROLE.
 */
export const AI_WORKFORCE_API_PREFIXES = [
  '/api/admin/agents',    // registry, profiles, prompts, execution, export
  '/api/admin/memory',    // agent / company / client memory
  '/api/admin/logs',      // audit, automation runs, agent failures
  '/api/admin/command',   // AI command center
  '/api/admin/ops-status',// autonomous AI operations loop
  '/api/admin/knowledge', // private agent knowledge sources
  '/api/admin/n8n',       // agent workflow definitions
] as const

/** Admin UI views that render AI Employee internals. */
export const AI_WORKFORCE_VIEWS = [
  'agents',
  'command',
  'memory',
  'logs',
  'knowledge',
  'n8n',
  'ops',
] as const

export type AiWorkforceView = (typeof AI_WORKFORCE_VIEWS)[number]

/** True when the given API path belongs to the AI Employee workforce surface. */
export function isAiWorkforcePath(pathname: string): boolean {
  return AI_WORKFORCE_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

/** True when the given admin view belongs to the AI Employee command center. */
export function isAiWorkforceView(view: string): view is AiWorkforceView {
  return (AI_WORKFORCE_VIEWS as readonly string[]).includes(view)
}

/**
 * Least-privilege tool permissions an AI Employee may hold.
 * An agent may only invoke a tool it has been explicitly granted; the grant is
 * stored per-agent in `AiAgent.permissions` and checked at invocation time.
 */
export const AGENT_TOOLS = [
  'READ_CRM',
  'WRITE_CRM',
  'SEND_SMS',
  'SEND_EMAIL',
  'SEND_WHATSAPP',
  'CREATE_PROPOSAL',
  'CREATE_SOW',
  'CREATE_TASK',
  'UPDATE_TASK',
  'ACCESS_PROJECT_FILES',
  'RUN_QA',
  'RUN_SECURITY_CHECK',
  'GENERATE_CONTENT',
  'CREATE_REPORT',
  'REQUEST_PAYMENT',
  'VERIFY_PAYMENT',
  'PREPARE_HANDOVER',
] as const

export type AgentTool = (typeof AGENT_TOOLS)[number]

/** Tools that must never be granted implicitly — they move money or assets. */
export const PRIVILEGED_AGENT_TOOLS: readonly AgentTool[] = [
  'REQUEST_PAYMENT',
  'VERIFY_PAYMENT',
  'PREPARE_HANDOVER',
  'ACCESS_PROJECT_FILES',
  'SEND_SMS',
  'SEND_EMAIL',
  'SEND_WHATSAPP',
]

export type AgentToolDecision =
  | { allowed: true }
  | { allowed: false; code: 'AGENT_DISABLED' | 'TOOL_NOT_GRANTED' | 'UNKNOWN_TOOL' }

/**
 * Authorize a single tool invocation by an AI Employee.
 *
 * Least privilege: an empty permission list grants nothing. A paused or
 * retired agent can never invoke a tool, regardless of its grants.
 */
export function authorizeAgentTool(
  agent: { status: string; permissions: string | string[] | null | undefined },
  tool: string,
): AgentToolDecision {
  if (!(AGENT_TOOLS as readonly string[]).includes(tool)) {
    return { allowed: false, code: 'UNKNOWN_TOOL' }
  }
  if (agent.status !== 'ACTIVE') {
    return { allowed: false, code: 'AGENT_DISABLED' }
  }

  let granted: string[] = []
  if (Array.isArray(agent.permissions)) {
    granted = agent.permissions
  } else if (typeof agent.permissions === 'string' && agent.permissions.trim()) {
    try {
      const parsed: unknown = JSON.parse(agent.permissions)
      if (Array.isArray(parsed)) granted = parsed.filter((x): x is string => typeof x === 'string')
    } catch {
      granted = []
    }
  }

  if (granted.includes('*')) {
    // a wildcard never covers the privileged set
    return PRIVILEGED_AGENT_TOOLS.includes(tool as AgentTool)
      ? { allowed: false, code: 'TOOL_NOT_GRANTED' }
      : { allowed: true }
  }

  return granted.includes(tool) ? { allowed: true } : { allowed: false, code: 'TOOL_NOT_GRANTED' }
}

/**
 * Tenant isolation for AI Employees.
 *
 * An agent acting on behalf of one client must never read another client's
 * records. Cross-client access requires an explicit system-level grant.
 */
export function agentMayAccessClient(
  agent: { permissions: string | string[] | null | undefined },
  actingForClientId: string | null,
  targetClientId: string | null,
): boolean {
  if (!targetClientId) return true // company-level, not client-scoped
  if (actingForClientId && actingForClientId === targetClientId) return true

  let granted: string[] = []
  if (Array.isArray(agent.permissions)) granted = agent.permissions
  else if (typeof agent.permissions === 'string' && agent.permissions.trim()) {
    try {
      const parsed: unknown = JSON.parse(agent.permissions)
      if (Array.isArray(parsed)) granted = parsed.filter((x): x is string => typeof x === 'string')
    } catch {
      granted = []
    }
  }
  return granted.includes('CROSS_CLIENT_READ')
}
