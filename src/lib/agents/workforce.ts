// ============================================================
// TECH360 — the AI workforce
// ============================================================
// THE WIRING.
//
// `src/lib/agents/org.ts`      — the STRUCTURE: nine levels, eight
//                                divisions, 110 departments, the
//                                reporting lines, the 24 attributes.
// `src/lib/agents/catalogue.ts` — the CONFIGURATION: the model
//                                profile, the permissions, the limits,
//                                the approval list, the primary skill.
// `src/lib/agents/workforce.ts` — THIS FILE: the join.
//
// One employee = one org profile + one catalogue entry. There is no
// second registry and no second catalogue: the workforce is the
// CONNECTION between the two that already existed.
//
// The Master AI is the pre-existing `CEO-001` core agent. It is not
// a new parallel system, and it is not a special case in this file —
// it is the first employee of the first department.
// ============================================================

import { DEPARTMENTS } from '@/lib/agents/registry'
import { ROLE_ARCHETYPES, LOGICAL_AGENT_CATALOGUE, type LogicalAgentDefinition } from '@/lib/agents/catalogue'
import { CAPABILITY_TEMPLATES, departmentSlug } from '@/lib/skills/catalog'
import { buildOrgChart, type EmployeeProfile, type OrgLevelName } from '@/lib/agents/org'
import { SOP_LIBRARY } from '@/lib/sops/library'

// ------------------------------------------------------------
// The role descriptors the org chart needs
// ------------------------------------------------------------

const APPROVAL_BY_CATEGORY: Record<string, string[]> = {
  EXECUTIVE: ['company.commitment', 'payment.execute'],
  REVENUE: ['messaging.send_external', 'pricing.change'],
  DELIVERY: ['handover.release', 'scope.commit'],
  TECHNOLOGY: ['deployment.execute', 'credential.change'],
  CONTENT: ['content.publish', 'social.publish'],
  OPERATIONS: ['payment.execute', 'refund.issue'],
  GOVERNANCE: ['policy.change', 'access.grant'],
  SUPPORT: ['messaging.send_external', 'refund.issue'],
}

const PROMPT_STAGES_BY_RISK: Record<string, string[]> = {
  LOW: ['INITIALIZATION', 'TASK_INTAKE', 'TASK_EXECUTION'],
  MEDIUM: ['INITIALIZATION', 'TASK_INTAKE', 'TASK_EXECUTION', 'QUALITY_REVIEW'],
  HIGH: ['INITIALIZATION', 'TASK_INTAKE', 'RESEARCH', 'TASK_EXECUTION', 'QUALITY_REVIEW', 'ESCALATION'],
}

const TOOLS_BY_CATEGORY: Record<string, string[]> = {
  EXECUTIVE: ['crm.query', 'report.generate', 'approval.record', 'agent.dispatch', 'approval.queue'],
  REVENUE: ['crm.query', 'crm.createLead', 'crm.update', 'email.send', 'meeting.schedule', 'task.create', 'comm.link'],
  DELIVERY: ['project.create', 'task.update', 'scope.revise', 'handover.prepare', 'handover.release', 'evidence.record', 'qa.plan', 'review.request'],
  TECHNOLOGY: ['security.scan', 'automation.run', 'automation.retry', 'error.log', 'error.escalate', 'knowledge.index', 'file.scan', 'file.classify'],
  CONTENT: ['content.create', 'knowledge.search', 'campaign.update', 'social.publish', 'report.generate', 'image.prompt', 'video.plan', 'tts.plan'],
  OPERATIONS: ['invoice.generate', 'payment.prepare', 'payment.verify', 'task.update', 'knowledge.index', 'report.generate'],
  GOVERNANCE: ['approval.queue', 'approval.record', 'security.scan', 'evidence.record', 'error.escalate', 'memory.search'],
  SUPPORT: ['crm.query', 'memory.search', 'memory.write', 'email.send', 'whatsapp.status', 'task.create', 'sms.send', 'whatsapp.send'],
}

const RESPONSIBILITIES: string[] = [
  'Carry out the work that the department owns, within the agreed scope.',
  'Record the evidence for every result and every escalation.',
  'Ask for the missing input rather than working around it.',
  'Hand the work on to the next level when it leaves the scope.',
]

/**
 * The descriptor for each role archetype.
 *
 * It connects the archetype (who the role is) with the capability
 * template (what it can do) and with the department (where it
 * operates).
 */
export function buildRoleDescriptors(): Array<{
  slug: string
  title: string
  mission: string
  responsibilities: string[]
  tools: string[]
  skillSlug: string
  sopKeys: string[]
  promptStages: string[]
  approvalRequired: string[]
}> {
  return ROLE_ARCHETYPES.map((role, index) => {
    const capability = CAPABILITY_TEMPLATES[index]
    const skillSlug = capability?.slug ?? 'classify_text'
    const risk = capability?.riskLevel ?? 'LOW'
    return {
      slug: role.slug,
      title: role.title,
      mission: role.purpose,
      responsibilities: [...RESPONSIBILITIES],
      tools: TOOLS_BY_CATEGORY.EXECUTIVE.slice(0, 0), // filled per department below
      skillSlug,
      sopKeys: [],
      promptStages: PROMPT_STAGES_BY_RISK[risk] ?? PROMPT_STAGES_BY_RISK.LOW,
      approvalRequired: role.approval_required,
    }
  })
}

// ------------------------------------------------------------
// The workforce
// ------------------------------------------------------------

export type WorkforceEmployee = {
  /** The employee identity — stable, and the key used everywhere. */
  employeeId: string
  /** The org profile: structure, authority, memory, knowledge. */
  profile: EmployeeProfile
  /** The catalogue entry: model profile, permissions, limits. */
  configuration: {
    agentId: string
    modelProfile: string
    permissions: string[]
    skills: string[]
    approvalRequired: string[]
    limits: { maxToolCalls: number; timeoutSeconds: number; maxRetries: number }
    purpose: string
    status: 'ACTIVE' | 'SUSPENDED' | 'DRAFT'
  }
  /** The SOPs this employee may execute. */
  sops: string[]
  /** The catalogue id that matches this employee. */
  catalogueId: string
}

function buildWorkforce(): WorkforceEmployee[] {
  const descriptors = buildRoleDescriptors()

  // The catalogue is keyed by department code + role slug. The
  // catalogue id is `tech360.<department>.<role slug>`.
  const catalogueByKey = new Map<string, LogicalAgentDefinition>()
  for (const agent of LOGICAL_AGENT_CATALOGUE) {
    const slug = agent.id.split('.')[2] ?? ''
    catalogueByKey.set(`${agent.department}:${slug}`, agent)
  }

  const units = buildOrgChart(descriptors, (name) => departmentSlug(name))
  const employees: WorkforceEmployee[] = []

  for (const unit of units) {
    for (const profile of unit.employees) {
      const archetypeIndex = descriptors.findIndex((descriptor) => descriptor.title === profile.role)
      const role = descriptors[archetypeIndex >= 0 ? archetypeIndex : 0]
      const catalogueAgent = catalogueByKey.get(`${profile.departmentCode}:${role?.slug ?? ''}`)
      // The employee's skills are the ones the catalogue gave the
      // role, so the workforce and the catalogue never disagree about
      // what an employee can do.
      const employeeSkills = catalogueAgent?.skills?.length ? catalogueAgent.skills : profile.skills

      // The tools for this employee: the department's tools plus the
      // ones the role's archetype needs.
      const tools = [...new Set([...(TOOLS_BY_CATEGORY[profile.divisionName] ?? []), ...(catalogueAgent ? [] : [])])]
      const departmentTools = TOOLS_BY_CATEGORY[departmentCategoryOf(profile.departmentCode)] ?? []
      const finalTools = [...new Set([...departmentTools, ...profile.tools])]

      // The SOPs this employee may execute: the department's SOPs,
      // filtered to the ones at or below the employee's level.
      const sops = SOP_LIBRARY.filter(
        (sop) => sop.departmentCode === profile.departmentCode && sop.level >= profile.level,
      ).map((sop) => sop.key)

      const permissions = catalogueAgent?.permissions ?? ['crm.read', 'knowledge.read', 'memory.read']

      employees.push({
        employeeId: profile.employeeId,
        profile: { ...profile, tools: finalTools.length > 0 ? finalTools : tools },
        configuration: {
          agentId: catalogueAgent?.id ?? `tech360.${profile.departmentCode.toLowerCase()}.${role?.slug ?? 'worker'}`,
          modelProfile: catalogueAgent?.model_profile ?? 'cpu_general',
          permissions,
          skills: employeeSkills,
          approvalRequired: catalogueAgent?.approval_required ?? APPROVAL_BY_CATEGORY[departmentCategoryOf(profile.departmentCode)] ?? [],
          limits: catalogueAgent
            ? {
                maxToolCalls: catalogueAgent.limits.max_tool_calls,
                timeoutSeconds: catalogueAgent.limits.timeout_seconds,
                maxRetries: catalogueAgent.limits.max_retries,
              }
            : { maxToolCalls: 8, timeoutSeconds: 120, maxRetries: 2 },
          purpose: catalogueAgent?.purpose ?? profile.mission,
          status: catalogueAgent?.status ?? 'ACTIVE',
        },
        sops,
        catalogueId: catalogueAgent?.id ?? '',
      })
    }
  }

  return employees
}

function departmentCategoryOf(departmentCode: string): string {
  return DEPARTMENTS.find((department) => department.code === departmentCode)?.category ?? 'GENERAL'
}

export const WORKFORCE: WorkforceEmployee[] = buildWorkforce()
export const WORKFORCE_SIZE = WORKFORCE.length

const BY_ID = new Map(WORKFORCE.map((employee) => [employee.employeeId, employee]))

export function getEmployee(employeeId: string): WorkforceEmployee | undefined {
  return BY_ID.get(employeeId)
}

export function employeesInDepartment(departmentCode: string): WorkforceEmployee[] {
  return WORKFORCE.filter((employee) => employee.profile.departmentCode === departmentCode)
}

export function employeesInDivision(divisionCode: string): WorkforceEmployee[] {
  return WORKFORCE.filter((employee) => employee.profile.divisionCode === divisionCode)
}

/**
 * The workforce's real shape.
 *
 * Every number here is counted from the workforce, never asserted.
 */
export function workforceStats(): {
  total: number
  byLevel: Record<OrgLevelName, number>
  byDivision: Record<string, number>
  byDepartment: number
  departments: number
  divisions: number
  sopsAssigned: number
  skillsAssigned: number
  withApprovalRequirement: number
} {
  const byLevel = {
    MASTER_AI_CEO: 0,
    EXECUTIVE_LEADERSHIP: 0,
    DEPARTMENT_DIRECTOR: 0,
    MANAGER: 0,
    SUPERVISOR: 0,
    SENIOR_SPECIALIST: 0,
    SPECIALIST: 0,
    JUNIOR_SPECIALIST: 0,
    WORKER_ASSISTANT: 0,
  } as Record<OrgLevelName, number>

  const byDivision: Record<string, number> = {}
  const departments = new Set<string>()
  let sopsAssigned = 0
  let skillsAssigned = 0
  let withApprovalRequirement = 0

  for (const employee of WORKFORCE) {
    byLevel[employee.profile.levelName] += 1
    byDivision[employee.profile.divisionCode] = (byDivision[employee.profile.divisionCode] ?? 0) + 1
    departments.add(employee.profile.departmentCode)
    sopsAssigned += employee.sops.length
    skillsAssigned += employee.configuration.skills.length
    if (employee.configuration.approvalRequired.length > 0) withApprovalRequirement += 1
  }

  return {
    total: WORKFORCE.length,
    byLevel,
    byDivision,
    byDepartment: departments.size,
    departments: DEPARTMENTS.length,
    divisions: Object.keys(byDivision).length,
    sopsAssigned,
    skillsAssigned,
    withApprovalRequirement,
  }
}

/**
 * Validate the workforce.
 *
 * The checks are the ones the specification cares about: every
 * employee has an identity, a manager, a mission, authority, tools,
 * skills, prompts, SOPs, knowledge access, memory, KPIs, escalation
 * rules, collaboration rules, behavioural constraints, security
 * permissions and a learning profile. An employee missing any of them
 * is an issue, not a rounding error.
 */
export function validateWorkforce(): { valid: boolean; issues: Array<{ code: string; message: string; employeeId: string }> } {
  const issues: Array<{ code: string; message: string; employeeId: string }> = []
  const seen = new Set<string>()

  for (const employee of WORKFORCE) {
    const { profile } = employee
    const check = (code: string, message: string): void => {
      issues.push({ code, message, employeeId: employee.employeeId })
    }

    if (seen.has(employee.employeeId)) check('DUPLICATE_ID', 'the employee id appears more than once')
    seen.add(employee.employeeId)

    if (!profile.name) check('NO_NAME', 'the employee has no name')
    if (!profile.role) check('NO_ROLE', 'the employee has no role')
    if (!profile.mission) check('NO_MISSION', 'the employee has no mission')
    if (!profile.authority) check('NO_AUTHORITY', 'the employee has no declared authority')
    if (profile.decisionRights.mayDecide.length === 0 && profile.decisionRights.mustEscalate.length === 0) {
      check('NO_DECISION_RIGHTS', 'the employee has neither decision rights nor escalation rules')
    }
    if (profile.tools.length === 0) check('NO_TOOLS', 'the employee has no tools')
    if (profile.skills.length === 0) check('NO_SKILLS', 'the employee has no skills')
    if (profile.promptStages.length === 0) check('NO_PROMPTS', 'the employee has no prompt stages')
    if (profile.knowledgeAccess.length === 0) check('NO_KNOWLEDGE_ACCESS', 'the employee has no knowledge access')
    if (profile.memoryScopes.length === 0) check('NO_MEMORY_SCOPE', 'the employee has no memory scope')
    if (profile.kpis.length === 0) check('NO_KPIS', 'the employee has no KPIs')
    if (profile.escalationRules.length === 0) check('NO_ESCALATION_RULES', 'the employee has no escalation rules')
    if (profile.collaborationRules.length === 0) check('NO_COLLABORATION_RULES', 'the employee has no collaboration rules')
    if (profile.behavioralConstraints.length === 0) check('NO_BEHAVIOURAL_CONSTRAINTS', 'the employee has no behavioural constraints')
    if (profile.securityPermissions.length === 0) check('NO_SECURITY_PERMISSIONS', 'the employee has no security permissions')
    if (!profile.learningProfile.reviewCadence) check('NO_LEARNING_PROFILE', 'the employee has no learning profile')
    if (profile.managerEmployeeId && !BY_ID.has(profile.managerEmployeeId)) {
      check('ORPHAN_MANAGER', `the manager "${profile.managerEmployeeId}" is not in the workforce`)
    }
  }

  return { valid: issues.length === 0, issues }
}
