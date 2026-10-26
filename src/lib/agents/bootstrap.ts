import { db } from '@/lib/db'
import { AGENT_REGISTRY_VERSION, CORE_AGENTS, DEPARTMENTS, validateAgentRegistry, type AgentSeed } from '@/lib/agents/registry'

export const REGISTRY_VERSION = AGENT_REGISTRY_VERSION

export type RegistryStatus = {
  expectedAgents: number
  registeredAgents: number
  expectedDepartments: number
  registeredDepartments: number
  duplicateAgentCodes: string[]
  duplicateDepartmentCodes: string[]
  missingAgentCodes: string[]
  orphanAgents: string[]
  missingDepartmentCodes: string[]
  healthy: boolean
}

export type BootstrapReport = RegistryStatus & {
  registryVersion: string
  checkedAt: string
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const result = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) result.add(value)
    seen.add(value)
  }
  return [...result].sort()
}

export async function ensureAgentRegistry(client = db): Promise<{ departments: number; agents: number }> {
  const validation = validateAgentRegistry()
  if (!validation.valid) throw new Error(`Canonical AI registry validation failed: ${JSON.stringify(validation)}`)
  const departments = new Map<string, string>()
  for (const department of DEPARTMENTS) {
    const row = await client.department.upsert({
      where: { code: department.code },
      update: {},
      create: department,
      select: { id: true, code: true },
    })
    departments.set(row.code, row.id)
  }

  for (const agent of CORE_AGENTS) {
    const departmentId = departments.get(agent.dept)
    if (!departmentId) throw new Error(`Registry agent ${agent.code} references missing department ${agent.dept}`)
    await client.aiAgent.upsert({
      where: { code: agent.code },
      update: {},
      create: {
        code: agent.code,
        name: agent.name,
        title: agent.title,
        purpose: agent.purpose,
        systemPrompt: agent.systemPrompt,
        tools: JSON.stringify(agent.tools),
        permissions: JSON.stringify(agent.permissions),
        requiresApproval: agent.requiresApproval ?? false,
        level: agent.level ?? 3,
        parentCode: agent.parentCode ?? null,
        departmentId,
      },
    })
  }

  return { departments: DEPARTMENTS.length, agents: CORE_AGENTS.length }
}

export async function getRegistryStatus(client = db): Promise<RegistryStatus> {
  const [agents, departments] = await Promise.all([
    client.aiAgent.findMany({ select: { code: true, department: { select: { code: true } } }, orderBy: { code: 'asc' } }),
    client.department.findMany({ select: { code: true }, orderBy: { code: 'asc' } }),
  ])
  const expectedAgentCodes = CORE_AGENTS.map((agent) => agent.code)
  const expectedDepartmentCodes = DEPARTMENTS.map((department) => department.code)
  const registeredAgentCodes = agents.map((agent) => agent.code)
  const registeredDepartmentCodes = departments.map((department) => department.code)
  const expectedAgentSet = new Set(expectedAgentCodes)
  const expectedDepartmentSet = new Set(expectedDepartmentCodes)

  const missingAgentCodes = expectedAgentCodes.filter((code) => !registeredAgentCodes.includes(code))
  const orphanAgents = agents.filter((agent) => !expectedAgentSet.has(agent.code) || !agent.department || !expectedDepartmentSet.has(agent.department.code)).map((agent) => agent.code)
  const missingDepartmentCodes = expectedDepartmentCodes.filter((code) => !registeredDepartmentCodes.includes(code))
  const duplicateAgentCodes = duplicates(registeredAgentCodes)
  const duplicateDepartmentCodes = duplicates(registeredDepartmentCodes)

  return {
    expectedAgents: CORE_AGENTS.length,
    registeredAgents: agents.length,
    expectedDepartments: DEPARTMENTS.length,
    registeredDepartments: departments.length,
    duplicateAgentCodes,
    duplicateDepartmentCodes,
    missingAgentCodes,
    orphanAgents,
    missingDepartmentCodes,
    healthy: agents.length === CORE_AGENTS.length
      && departments.length === DEPARTMENTS.length
      && missingAgentCodes.length === 0
      && missingDepartmentCodes.length === 0
      && orphanAgents.length === 0
      && duplicateAgentCodes.length === 0
      && duplicateDepartmentCodes.length === 0,
  }
}

export async function getBootstrapReport(client = db): Promise<BootstrapReport> {
  const status = await getRegistryStatus(client)
  return { ...status, registryVersion: REGISTRY_VERSION, checkedAt: new Date().toISOString() }
}

export function getAgentDefinition(code: string): AgentSeed | null {
  return CORE_AGENTS.find((agent) => agent.code === code) ?? null
}
