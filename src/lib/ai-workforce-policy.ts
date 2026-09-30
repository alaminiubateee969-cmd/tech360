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
 * The AI Employee capability vocabulary, taken verbatim from
 * `src/lib/agents/registry.ts`. These are the names the 44 seeded agents
 * actually carry in `AiAgent.tools`.
 *
 * This list is asserted against the registry by
 * `tests/ai-workforce-rbac.test.ts`, so the two cannot drift apart.
 */
export const AGENT_TOOLS = [
  'agent.create', 'agent.dispatch', 'approval.queue', 'approval.record',
  'automation.retry', 'automation.run', 'campaign.update', 'capability:all',
  'comm.link', 'content.create', 'crm.createLead', 'crm.query', 'crm.update',
  'delivery.confirm', 'delivery.prepare', 'email.send', 'error.escalate',
  'error.log', 'evidence.record', 'file.classify', 'file.scan',
  'handover.prepare', 'handover.release', 'image.prompt', 'invoice.generate',
  'knowledge.index', 'knowledge.search', 'meeting.schedule', 'memory.search',
  'memory.write', 'payment.prepare', 'payment.verify', 'project.create',
  'qa.plan', 'referral.request', 'report.generate', 'review.request',
  'scope.revise', 'security.scan', 'sms.send', 'social.publish',
  'social.receive', 'task.create', 'task.update', 'tts.plan', 'video.plan',
  'whatsapp.send', 'whatsapp.status',
] as const

export type AgentTool = (typeof AGENT_TOOLS)[number]

/** Wildcard capability some executive agents carry. */
export const CAPABILITY_ALL = 'capability:all'

/**
 * Tools that move money, release owned assets, or speak to a customer in the
 * company's name. These always require an explicit per-agent grant — the
 * `capability:all` wildcard deliberately does NOT cover them.
 */
export const PRIVILEGED_AGENT_TOOLS: readonly AgentTool[] = [
  'payment.prepare',
  'payment.verify',
  'invoice.generate',
  'handover.prepare',
  'handover.release',
  'delivery.confirm',
  'sms.send',
  'email.send',
  'whatsapp.send',
  'social.publish',
  'agent.create',
]

export type AgentToolDecision =
  | { allowed: true }
  | { allowed: false; code: 'AGENT_DISABLED' | 'TOOL_NOT_GRANTED' | 'UNKNOWN_TOOL' }

/** Parse a JSON-string-or-array column into a string list, failing closed. */
function toList(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === 'string')
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string')
    } catch {
      return []
    }
  }
  return []
}

/**
 * Authorize a single tool invocation by an AI Employee.
 *
 * Capabilities live in `AiAgent.tools` (what the agent can do); `AiAgent.
 * permissions` holds data scopes (`read:clients`, `write:payments`) and is
 * checked separately by the data layer.
 *
 * Least privilege: an empty tool list grants nothing, a non-ACTIVE agent can
 * never invoke anything, and privileged tools are never granted by wildcard.
 */
export function authorizeAgentTool(
  agent: { status: string; tools?: string | string[] | null; permissions?: string | string[] | null },
  tool: string,
): AgentToolDecision {
  if (!(AGENT_TOOLS as readonly string[]).includes(tool)) {
    return { allowed: false, code: 'UNKNOWN_TOOL' }
  }
  if (agent.status !== 'ACTIVE') {
    return { allowed: false, code: 'AGENT_DISABLED' }
  }

  const granted = toList(agent.tools)
  if (granted.includes(tool)) return { allowed: true }

  if (granted.includes(CAPABILITY_ALL)) {
    return PRIVILEGED_AGENT_TOOLS.includes(tool as AgentTool)
      ? { allowed: false, code: 'TOOL_NOT_GRANTED' }
      : { allowed: true }
  }

  return { allowed: false, code: 'TOOL_NOT_GRANTED' }
}

/**
 * Tenant isolation for AI Employees.
 *
 * An agent acting on behalf of one client must never read another client's
 * records. Cross-client reach requires an explicit company-wide scope, which
 * only executive/governance agents carry (`read:all`).
 */
export function agentMayAccessClient(
  agent: { permissions?: string | string[] | null },
  actingForClientId: string | null,
  targetClientId: string | null,
): boolean {
  if (!targetClientId) return true // company-level record, not client-scoped
  if (actingForClientId && actingForClientId === targetClientId) return true
  return toList(agent.permissions).includes('read:all')
}
