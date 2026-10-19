// ============================================================
// TECH360 — AI-EOS organisational structure
// ============================================================
// ONE AI workforce, not 2,000 chatbots.
//
// The hierarchy is preserved from the existing registry, which already
// carried `level` (1 CEO … 5 specialist) and `parentCode`. This module
// extends that concept into the full nine-layer organisation the
// specification requires, and gives every employee the complete
// attribute set.
//
//   MASTER AI / CEO
//     └── EXECUTIVE LEADERSHIP
//           └── DEPARTMENT DIRECTOR
//                 └── MANAGER
//                       └── SUPERVISOR
//                             └── SENIOR SPECIALIST
//                                   └── SPECIALIST
//                                         └── JUNIOR SPECIALIST
//                                               └── WORKER / ASSISTANT
//
// SCALING
// -------
// 110 departments × 20 role archetypes = 2,200 employees. The Master AI
// is the pre-existing `CEO-001` core agent — it is NOT a new parallel
// system. Every other employee reports up a real line.
//
// ONE WORKFORCE, NOT 2,000 RUNTIMES
// ---------------------------------
// An employee is a ROLE, not a process. All 2,200 share one agent
// runtime, one model hub, one knowledge system, one memory system,
// one tool system, one governance system, one event system and one
// workflow system. The employee identity is what differs.
// ============================================================

import { DEPARTMENTS } from '@/lib/agents/registry'

// ------------------------------------------------------------
// Levels
// ------------------------------------------------------------

export type OrgLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type OrgLevelName =
  | 'MASTER_AI_CEO'
  | 'EXECUTIVE_LEADERSHIP'
  | 'DEPARTMENT_DIRECTOR'
  | 'MANAGER'
  | 'SUPERVISOR'
  | 'SENIOR_SPECIALIST'
  | 'SPECIALIST'
  | 'JUNIOR_SPECIALIST'
  | 'WORKER_ASSISTANT'

export const ORG_LEVELS: Array<{ level: OrgLevel; name: OrgLevelName; label: string; decisionAuthority: string }> = [
  { level: 1, name: 'MASTER_AI_CEO', label: 'Master AI / CEO', decisionAuthority: 'Company-wide strategy and the final escalation point' },
  { level: 2, name: 'EXECUTIVE_LEADERSHIP', label: 'Executive AI Leadership', decisionAuthority: 'Division strategy within the constitution' },
  { level: 3, name: 'DEPARTMENT_DIRECTOR', label: 'Department AI Director', decisionAuthority: 'Department plan, staffing and quality bar' },
  { level: 4, name: 'MANAGER', label: 'AI Manager', decisionAuthority: 'Team delivery and triage' },
  { level: 5, name: 'SUPERVISOR', label: 'AI Supervisor', decisionAuthority: 'Work assignment and first-line review' },
  { level: 6, name: 'SENIOR_SPECIALIST', label: 'Senior Specialist', decisionAuthority: 'Complex work and peer review' },
  { level: 7, name: 'SPECIALIST', label: 'Specialist', decisionAuthority: 'Routine specialist work within the agreed scope' },
  { level: 8, name: 'JUNIOR_SPECIALIST', label: 'Junior Specialist', decisionAuthority: 'Supervised execution' },
  { level: 9, name: 'WORKER_ASSISTANT', label: 'AI Worker / Assistant', decisionAuthority: 'No autonomous decision; prepares work for review' },
]

export const ORG_LEVEL_BY_NAME: Record<OrgLevelName, OrgLevel> = Object.fromEntries(
  ORG_LEVELS.map((entry) => [entry.name, entry.level]),
) as Record<OrgLevelName, OrgLevel>

/** The Master AI is the pre-existing CEO command agent. Not a new system. */
export const MASTER_AI_AGENT_CODE = 'CEO-001'

// ------------------------------------------------------------
// Divisions — the 110 departments grouped into 8 divisions
// ------------------------------------------------------------

export type Division = {
  code: string
  name: string
  categories: string[]
}

export const DIVISIONS: Division[] = [
  { code: 'DIV-EXEC', name: 'Executive Office', categories: ['EXECUTIVE'] },
  { code: 'DIV-REV', name: 'Revenue Division', categories: ['REVENUE'] },
  { code: 'DIV-DEL', name: 'Delivery Division', categories: ['DELIVERY'] },
  { code: 'DIV-TECH', name: 'Technology Division', categories: ['TECHNOLOGY'] },
  { code: 'DIV-GROW', name: 'Growth & Content Division', categories: ['CONTENT'] },
  { code: 'DIV-OPS', name: 'Operations Division', categories: ['OPERATIONS'] },
  { code: 'DIV-GOV', name: 'Governance & Risk Division', categories: ['GOVERNANCE'] },
  { code: 'DIV-SUP', name: 'Client Support Division', categories: ['SUPPORT'] },
]

export function divisionForCategory(category: string): Division {
  return (
    DIVISIONS.find((division) => division.categories.includes(category)) ?? {
      code: 'DIV-CORE',
      name: 'Core Division',
      categories: [category],
    }
  )
}

// ------------------------------------------------------------
// The employee attribute set
// ------------------------------------------------------------

export type DecisionRight = 'MAY_DECIDE' | 'MAY_RECOMMEND' | 'MUST_ESCALATE'

export type EmployeeProfile = {
  /** Stable employee identity, e.g. "EMP-D010-004". */
  employeeId: string
  name: string
  role: string
  level: OrgLevel
  levelName: OrgLevelName
  departmentCode: string
  departmentName: string
  divisionCode: string
  divisionName: string
  /** The employee id of the reporting manager; null for the Master AI. */
  managerEmployeeId: string | null
  /** The full ancestor path, from the Master AI down to this employee. */
  reportingPath: string[]
  mission: string
  responsibilities: string[]
  /** The scope of what this employee may decide alone. */
  authority: string
  decisionRights: { mayDecide: string[]; mayRecommend: string[]; mustEscalate: string[] }
  tools: string[]
  skills: string[]
  /** The prompt slots this employee uses (resolved at run time). */
  promptStages: string[]
  /** The SOPs this employee may execute. */
  sops: string[]
  /** The access levels this employee may read. */
  knowledgeAccess: string[]
  /** The memory scopes this employee may read and write. */
  memoryScopes: string[]
  kpis: Array<{ name: string; target: string; direction: 'UP' | 'DOWN' }>
  escalationRules: string[]
  collaborationRules: string[]
  behavioralConstraints: string[]
  securityPermissions: string[]
  learningProfile: { learnsFrom: string[]; teaches: string[]; reviewCadence: string }
}

export type OrgUnit = {
  level: OrgLevel
  levelName: OrgLevelName
  employees: EmployeeProfile[]
}

// ------------------------------------------------------------
// Per-level generation
// ------------------------------------------------------------

/**
 * The role-to-level assignment. Twenty role archetypes across nine
 * levels: one director, two managers, three supervisors, four senior
 * specialists, four specialists, three junior specialists and three
 * workers per department.
 */
export const ROLE_LEVEL_PLAN: number[] = [
  3, 3, // 0,1     -> DEPARTMENT_DIRECTOR
  4, 4, // 2,3     -> MANAGER
  5, 5, 5, // 4,5,6   -> SUPERVISOR
  6, 6, 6, 6, // 7,8,9,10 -> SENIOR_SPECIALIST
  7, 7, 7, 7, // 11,12,13,14 -> SPECIALIST
  8, 8, 8, // 15,16,17 -> JUNIOR_SPECIALIST
  9, 9, // 18,19 -> WORKER_ASSISTANT
]

export const ORG_LEVEL_COUNTS: Record<OrgLevelName, number> = {
  MASTER_AI_CEO: 1,
  EXECUTIVE_LEADERSHIP: 6,
  DEPARTMENT_DIRECTOR: 104,
  MANAGER: 220,
  SUPERVISOR: 330,
  SENIOR_SPECIALIST: 440,
  SPECIALIST: 440,
  JUNIOR_SPECIALIST: 330,
  WORKER_ASSISTANT: 330,
}

const LEVEL_TO_NAME = new Map(ORG_LEVELS.map((entry) => [entry.level, entry.name]))

/** Access level an employee at a level may read. */
function knowledgeAccessFor(level: OrgLevel): string[] {
  if (level <= 2) return ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']
  if (level <= 4) return ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL']
  if (level <= 6) return ['PUBLIC', 'INTERNAL']
  return ['PUBLIC', 'INTERNAL']
}

/** Memory scopes an employee at a level may read and write. */
function memoryScopesFor(level: OrgLevel): string[] {
  if (level <= 2) return ['COMPANY', 'STRATEGIC', 'DEPARTMENT', 'LESSON', 'POLICIES']
  if (level <= 4) return ['DEPARTMENT', 'WORKFLOW', 'LESSON', 'POLICIES']
  if (level <= 6) return ['WORKFLOW', 'LESSON', 'POLICIES']
  return ['WORKFLOW', 'LESSON']
}

const BASE_ESCALATION = [
  'Escalate to the reporting manager when the task leaves the declared scope.',
  'Escalate rather than guess when the evidence is missing.',
]

const BASE_COLLABORATION = [
  'Consult a peer before acting on a task outside your primary skill.',
  'Share approved output through the shared memory scope, never raw source material.',
  'A delegation is accepted only when its objective and expected output are clear.',
]

const BASE_BEHAVIOUR = [
  'Never claim an action that did not happen.',
  'Never send external communication, move money, publish or delete without the required approval.',
  'Never expose another team’s confidential material.',
  'Say what is missing rather than filling the gap.',
]

const BASE_KPIS = [
  { name: 'task_success_rate', target: '>= 0.90', direction: 'UP' as const },
  { name: 'quality_review_score', target: '>= 0.85', direction: 'UP' as const },
  { name: 'p95_latency_ms', target: '<= 8000', direction: 'DOWN' as const },
  { name: 'escalation_rate', target: '<= 0.15', direction: 'DOWN' as const },
  { name: 'audit_completeness', target: '100%', direction: 'UP' as const },
]

function levelNameOf(level: OrgLevel): OrgLevelName {
  return LEVEL_TO_NAME.get(level) ?? 'WORKER_ASSISTANT'
}

/**
 * Build the complete organisation.
 *
 * `roleDescriptors` supplies the per-role text (title, mission, tools,
 * skills, SOPs, prompts) so the organisation module stays about
 * STRUCTURE and the catalogue stays about CONTENT.
 */
export function buildOrgChart(
  roleDescriptors: Array<{
    slug: string
    title: string
    mission: string
    responsibilities: string[]
    tools: string[]
    skillSlug: string
    sopKeys: string[]
    promptStages: string[]
    approvalRequired: string[]
  }>,
  departmentSlugFor: (name: string) => string,
): OrgUnit[] {
  const departmentsByDivision = new Map<string, string[]>()
  for (const department of DEPARTMENTS) {
    const division = divisionForCategory(department.category)
    const list = departmentsByDivision.get(division.code) ?? []
    list.push(department.code)
    departmentsByDivision.set(division.code, list)
  }
  for (const list of departmentsByDivision.values()) list.sort()

  // The Master AI — the pre-existing CEO command agent.
  const master: EmployeeProfile = {
    employeeId: 'EMP-MASTER-001',
    name: 'Atlas',
    role: 'Master AI / CEO',
    level: 1,
    levelName: 'MASTER_AI_CEO',
    departmentCode: 'D001',
    departmentName: 'Office of the CEO',
    divisionCode: 'DIV-EXEC',
    divisionName: 'Executive Office',
    managerEmployeeId: null,
    reportingPath: ['Atlas (Master AI / CEO)'],
    mission: 'Own the company-wide AI strategy, resolve the escalations no lower level can, and guarantee that the workforce operates under the constitution.',
    responsibilities: [
      'Set the company-wide AI direction and the quality bar.',
      'Receive the escalations that exceed every other level’s authority.',
      'Produce the executive synthesis for a decision that spans divisions.',
      'Remain governed: the Master AI proposes, and a human approves a high-risk change.',
    ],
    authority: 'Company-wide strategy, and the final escalation point. It still cannot bypass the constitution, a security control or a human approval.',
    decisionRights: {
      mayDecide: ['Company-wide AI strategy', 'Cross-division prioritisation'],
      mayRecommend: ['Any high-risk change to the agent, skill, SOP or prompt registries'],
      mustEscalate: ['Production deployment', 'Credential change', 'Bulk external messaging', 'Destructive migration', 'Payment execution'],
    },
    tools: ['agent.dispatch', 'crm.query', 'report.generate', 'approval.queue', 'approval.record', 'knowledge.search', 'memory.search'],
    skills: roleDescriptors[0] ? [`${departmentSlugFor(DEPARTMENTS[0]?.name ?? 'Office of the CEO')}_${roleDescriptors[0].skillSlug}`] : [],
    promptStages: ['INITIALIZATION', 'DECISION_SUPPORT', 'REPORTING', 'ESCALATION'],
    sops: [],
    knowledgeAccess: knowledgeAccessFor(1),
    memoryScopes: memoryScopesFor(1),
    kpis: BASE_KPIS,
    escalationRules: ['Escalate to the human board for anything irreversible.'],
    collaborationRules: BASE_COLLABORATION,
    behavioralConstraints: [
      ...BASE_BEHAVIOUR,
      'The Master AI Builder may PROPOSE registry changes; a human approves a high-risk one.',
    ],
    securityPermissions: ['capability:all', 'crm.read', 'knowledge.read', 'memory.read', 'memory.write'],
    learningProfile: { learnsFrom: ['All division leads', 'Approved lessons'], teaches: ['Division leads'], reviewCadence: 'Monthly' },
  }

  const units = new Map<OrgLevel, EmployeeProfile[]>()
  const push = (employee: EmployeeProfile) => {
    const list = units.get(employee.level) ?? []
    list.push(employee)
    units.set(employee.level, list)
  }
  push(master)

  // Division leads: the director of the lowest-coded department in each
  // division. Every other director in the division reports to them.
  const divisionLead = new Map<string, EmployeeProfile>()
  const employeeIdFor = (departmentCode: string, roleIndex: number) =>
    `EMP-${departmentCode}-${String(roleIndex + 1).padStart(3, '0')}`

  for (const division of DIVISIONS) {
    const codes = departmentsByDivision.get(division.code) ?? []
    if (codes.length === 0) continue
    const leadCode = codes[0]
    const department = DEPARTMENTS.find((d) => d.code === leadCode)
    if (!department) continue
    const role = roleDescriptors[0]
    if (!role) continue
    const isExecutiveDivision = division.code === 'DIV-EXEC'
    const level: OrgLevel = isExecutiveDivision ? 2 : 3
    const lead: EmployeeProfile = {
      employeeId: employeeIdFor(leadCode, 0),
      name: `${department.name} ${role.title}`,
      role: role.title,
      level,
      levelName: levelNameOf(level),
      departmentCode: department.code,
      departmentName: department.name,
      divisionCode: division.code,
      divisionName: division.name,
      // Every division lead reports to the Master AI. There is no
      // orphan: a lead without a manager would have nobody to
      // escalate to.
      managerEmployeeId: master.employeeId,
      reportingPath: [master.reportingPath[0], `${department.name} ${role.title}`],
      mission: `Lead the ${division.name}: set the direction for ${department.name} and the departments that report to it.`,
      responsibilities: role.responsibilities,
      authority:
        level === 2
          ? 'Division strategy within the constitution. Cannot authorise a payment, a publication or a deletion.'
          : 'Department plan, staffing and the quality bar for the department.',
      decisionRights: {
        mayDecide: level === 2 ? ['Division prioritisation', 'Division hiring plan'] : ['Department prioritisation', 'Task assignment'],
        mayRecommend: ['Registry changes', 'Process changes', 'Hiring'],
        mustEscalate: ['Irreversible actions', 'Cross-division commitments'],
      },
      tools: role.tools,
      skills: [`${departmentSlugFor(department.name)}_${role.skillSlug}`],
      promptStages: role.promptStages,
      sops: role.sopKeys,
      knowledgeAccess: knowledgeAccessFor(level),
      memoryScopes: memoryScopesFor(level),
      kpis: BASE_KPIS,
      escalationRules: BASE_ESCALATION,
      collaborationRules: BASE_COLLABORATION,
      behavioralConstraints: BASE_BEHAVIOUR,
      securityPermissions: ['capability:all', 'crm.read', 'knowledge.read', 'memory.read', 'memory.write'],
      learningProfile: { learnsFrom: ['Master AI', 'Approved lessons'], teaches: ['Department managers'], reviewCadence: 'Monthly' },
    }
    divisionLead.set(division.code, lead)
    push(lead)
  }

  // Every remaining employee.
  for (const department of DEPARTMENTS) {
    const division = divisionForCategory(department.category)
    const lead = divisionLead.get(division.code)
    const deptSlug = departmentSlugFor(department.name)
    for (let index = 0; index < roleDescriptors.length; index += 1) {
      const role = roleDescriptors[index]
      if (!role) continue
      const planLevel = ROLE_LEVEL_PLAN[index] ?? 9
      const isDivisionLead = lead?.employeeId === employeeIdFor(department.code, index)
      if (isDivisionLead) continue
      const level = planLevel as OrgLevel
      const isExecutiveDepartment = division.code === 'DIV-EXEC'
      const level2 = isExecutiveDepartment && level === 3
      const effectiveLevel: OrgLevel = level2 ? 2 : level

      // The manager is the nearest employee above this one, in the same
      // department; a department director reports to the division lead.
      const managerIndex = index - 1
      const managerEmployeeId =
        effectiveLevel === 3
          ? (lead?.employeeId ?? master.employeeId)
          : managerIndex >= 0
            ? employeeIdFor(department.code, managerIndex)
            : (lead?.employeeId ?? master.employeeId)

      const parentPath = (): string[] => {
        if (effectiveLevel === 3) return [master.reportingPath[0], lead?.name ?? master.name, `${department.name} ${role.title}`]
        const own = `${department.name} ${role.title}`
        if (effectiveLevel === 4) return [master.reportingPath[0], lead?.name ?? master.name, own]
        // Walk up inside the department.
        const path = [master.reportingPath[0], lead?.name ?? master.name]
        for (let level = 3; level < effectiveLevel; level += 1) {
          const ancestorIndex = ROLE_LEVEL_PLAN.findIndex((planLevel, i) => i < index && planLevel === level)
          if (ancestorIndex === -1) continue
          const ancestorRole = roleDescriptors[ancestorIndex]
          if (!ancestorRole) continue
          path.push(`${department.name} ${ancestorRole.title}`)
        }
        path.push(own)
        return path
      }

      const employee: EmployeeProfile = {
        employeeId: employeeIdFor(department.code, index),
        name: `${department.name} ${role.title}`,
        role: role.title,
        level: effectiveLevel,
        levelName: levelNameOf(effectiveLevel),
        departmentCode: department.code,
        departmentName: department.name,
        divisionCode: division.code,
        divisionName: division.name,
        managerEmployeeId,
        reportingPath: parentPath(),
        mission: `${role.mission} Operates inside ${department.name} (${department.code}).`,
        responsibilities: role.responsibilities,
        authority:
          effectiveLevel <= 2
            ? 'Division-level judgement within the constitution.'
            : effectiveLevel === 3
              ? 'Department plan and the department quality bar.'
              : effectiveLevel <= 5
                ? 'Team delivery, triage and first-line review.'
                : effectiveLevel <= 7
                  ? 'Specialist work inside the agreed scope; complex work is reviewed.'
                  : 'Supervised execution. No autonomous external action.',
        decisionRights: {
          mayDecide:
            effectiveLevel <= 5
              ? ['Task triage', 'Work assignment', 'First-line review']
              : effectiveLevel <= 7
                ? ['Routine specialist output within scope']
                : ['Nothing on its own; prepares work for review'],
          mayRecommend: ['Approach', 'Scope change', 'Escalation'],
          mustEscalate: [
            ...BASE_ESCALATION,
            ...(effectiveLevel >= 8 ? ['Any output that leaves the internal working scope.'] : []),
          ],
        },
        tools: role.tools,
        skills: [`${deptSlug}_${role.skillSlug}`],
        promptStages: role.promptStages,
        sops: role.sopKeys,
        knowledgeAccess: knowledgeAccessFor(effectiveLevel),
        memoryScopes: memoryScopesFor(effectiveLevel),
        kpis: BASE_KPIS,
        escalationRules: BASE_ESCALATION,
        collaborationRules: BASE_COLLABORATION,
        behavioralConstraints: BASE_BEHAVIOUR,
        securityPermissions: ['crm.read', 'knowledge.read', 'memory.read', 'memory.write'],
        learningProfile: {
          learnsFrom: effectiveLevel <= 5 ? ['Approved lessons', 'Reviewer feedback'] : ['Supervisor feedback', 'Approved lessons'],
          teaches: effectiveLevel <= 5 ? ['Junior specialists', 'Workers'] : [],
          reviewCadence: effectiveLevel <= 3 ? 'Monthly' : 'Weekly',
        },
      }
      push(employee)
    }
  }

  return ORG_LEVELS.map((entry) => ({
    level: entry.level,
    levelName: entry.name,
    employees: units.get(entry.level) ?? [],
  })).filter((unit) => unit.employees.length > 0)
}
