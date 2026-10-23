import { AGENT_TOOLS } from '@/lib/ai-workforce-policy'
import { CORE_AGENTS } from '@/lib/agents/registry'

export const DYNAMIC_AGENT_CODE_PATTERN = /^AGT-[A-F0-9]{8}$/

const DYNAMIC_AGENT_TOOLS = new Set<string>(AGENT_TOOLS.filter((tool) => tool !== 'capability:all'))
const DYNAMIC_AGENT_PERMISSIONS = new Set<string>(
  CORE_AGENTS.flatMap((agent) => agent.permissions).filter((permission) => permission !== '*' && !permission.endsWith(':all')),
)

function stringArray(value: string | string[] | null | undefined): string[] | null {
  if (Array.isArray(value)) return value.every((entry) => typeof entry === 'string') ? value : null
  if (typeof value !== 'string') return null
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string') ? parsed : null
  } catch {
    return null
  }
}

export type DynamicAgentRecord = {
  code: string
  status: string
  parentCode: string | null
  requiresApproval: boolean
  purpose: string
  systemPrompt: string
  tools: string | string[] | null
  permissions: string | string[] | null
  department?: { code: string } | null
  departmentId?: string | null
}

/** DB-backed dynamic agents are accepted only when created through the bounded, least-privilege draft workflow. */
export function isWellFormedDynamicAgent(agent: DynamicAgentRecord | null | undefined): boolean {
  if (!agent || !DYNAMIC_AGENT_CODE_PATTERN.test(agent.code)) return false
  if (!agent.parentCode || !/^[A-Z0-9_-]{2,20}$/.test(agent.parentCode)) return false
  if (!agent.department?.code || !agent.departmentId) return false
  if (!['PAUSED', 'ACTIVE'].includes(agent.status) || agent.requiresApproval !== true) return false
  if (typeof agent.purpose !== 'string' || agent.purpose.trim().length < 10) return false
  if (typeof agent.systemPrompt !== 'string' || agent.systemPrompt.trim().length < 50) return false

  const tools = stringArray(agent.tools)
  const permissions = stringArray(agent.permissions)
  if (!tools || !permissions || tools.length > 40 || permissions.length > 40) return false
  if (new Set(tools).size !== tools.length || new Set(permissions).size !== permissions.length) return false
  if (tools.some((tool) => !DYNAMIC_AGENT_TOOLS.has(tool))) return false
  if (permissions.some((permission) => !DYNAMIC_AGENT_PERMISSIONS.has(permission))) return false
  return true
}
