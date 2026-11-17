import { db } from '@/lib/db'
import { CORE_AGENTS, DEPARTMENTS } from '@/lib/agents/registry'
import { WORKFORCE, validateWorkforce, workforceStats } from '@/lib/agents/workforce'
import { LOGICAL_AGENT_CATALOGUE, LOGICAL_AGENT_COUNT, ROLE_ARCHETYPES } from '@/lib/agents/catalogue'
import { SKILL_CATALOG, CAPABILITY_TEMPLATES } from '@/lib/skills/catalog'
import { SOP_LIBRARY, SOP_ARCHETYPES } from '@/lib/sops/library'
import { promptLibraryIndex, PROMPT_STAGES } from '@/lib/prompts/library'
import { constitutionalRuleStats } from '@/lib/governance/rules'
import { DCC_THRESHOLDS, isCurrentDccCertification } from '@/lib/dcc-policy'

export interface WorkforceReconciliationReport {
  reconciledAt: string
  departments: {
    persistedTotal: number
    activeDepartments: number
    sourceDefinedTotal: number
    archivedDepartments: number
    duplicateCodes: string[]
    preservedAll110: boolean
  }
  aiEmployees: {
    entityModel: 'ORGANIZATIONAL_PROFILE_REGISTRY'
    totalEmployees: number
    activeEmployees: number
    pausedEmployees: number
    retiredEmployees: number
    masterCeoCount: number
    specialistsPerDepartment: number
    duplicateIds: string[]
    targetEmployees: number
    targetSatisfied: boolean
  }
  aiAgents: {
    entityModel: 'PERSISTED_RUNTIME_AND_LOGICAL_CATALOGUE'
    persistedTotal: number
    persistedActive: number
    persistedPaused: number
    persistedRetired: number
    persistedCoreAgents: number
    persistedLoopAgents: number
    logicalCatalogueTotal: number
    duplicatePersistedCodes: string[]
    duplicateLogicalCodes: string[]
    hierarchy: {
      rootAgentCode: string
      level1Count: number
      level2Count: number
      level3Count: number
      agentsWithParentCode: Array<{ code: string; name: string; parentCode: string; level: number; status: string }>
      maxAllowedHierarchyDepth: number
      maxChildrenPerParent: number
    }
    targetAgents: number
    logicalTargetSatisfied: boolean
  }
  enterpriseAssets: {
    skills: {
      persistedCount: number
      sourceCatalogCount: number
      skillsPerDepartment: number
      target: number
      targetSatisfied: boolean
    }
    promptTemplates: {
      persistedCount: number
      sourceCatalogCount: number
      languages: string[]
      stagesPerRole: number
      target: number
      targetSatisfied: boolean
    }
    sops: {
      persistedCount: number
      sourceCatalogCount: number
      sopsPerDepartment: number
      target: number
      targetSatisfied: boolean
    }
    constitutionalRules: {
      coreConstitutionCount: number
      defaultOperationalRulesCount: number
      layeredCatalogCount: number
      target: number
      targetSatisfied: boolean
    }
  }
  dccGovernance: {
    thresholds: typeof DCC_THRESHOLDS
    persistedAssessments: number
    certifiedDepartmentsCount: number
    certifiedDepartmentCodes: string[]
    uncertifiedDepartmentsCount: number
    bypassPermitted: false
  }
  expansionPlan: {
    principle: string
    prohibitions: string[]
    phases: Array<{
      id: 'PHASE_1' | 'PHASE_2' | 'PHASE_3'
      window: string
      title: string
      conversionRule: string
      capacityLimit: string
      prerequisites: string[]
      currentStatus: 'ACTIVE' | 'GATED_BY_DCC'
    }>
  }
}

export async function reconcileEnterpriseWorkforce(client = db): Promise<WorkforceReconciliationReport> {
  const [
    departments,
    agents,
    persistedSkillsCount,
    persistedSopsCount,
    persistedPromptsCount,
    dccRows,
  ] = await Promise.all([
    client.department.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    }),
    client.aiAgent.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        level: true,
        parentCode: true,
        dailyQuota: true,
        model: true,
      },
      orderBy: { code: 'asc' },
    }),
    client.skill.count(),
    client.sop.count(),
    client.promptTemplate.count(),
    client.departmentCapabilityAssessment.findMany({
      orderBy: [{ assessedAt: 'desc' }],
      include: { department: { select: { code: true } } },
    }),
  ])

  // Check duplicate department codes
  const seenDeptCodes = new Set<string>()
  const duplicateDeptCodes: string[] = []
  for (const d of departments) {
    if (seenDeptCodes.has(d.code)) duplicateDeptCodes.push(d.code)
    seenDeptCodes.add(d.code)
  }

  // Validate AI Employee registry
  const wfStats = workforceStats()
  const wfValidation = validateWorkforce()
  const activeEmployees = WORKFORCE.filter((e) => e.configuration.status === 'ACTIVE').length
  const pausedEmployees = WORKFORCE.filter((e) => e.configuration.status === 'SUSPENDED').length
  const retiredEmployees = WORKFORCE.filter((e) => e.configuration.status === 'DRAFT').length

  // Validate Persisted AI Agents & Logical Agent Catalogue
  const seenAgentCodes = new Set<string>()
  const duplicatePersistedCodes: string[] = []
  for (const a of agents) {
    if (seenAgentCodes.has(a.code)) duplicatePersistedCodes.push(a.code)
    seenAgentCodes.add(a.code)
  }

  const seenLogicalCodes = new Set<string>()
  const duplicateLogicalCodes: string[] = []
  for (const la of LOGICAL_AGENT_CATALOGUE) {
    if (seenLogicalCodes.has(la.id)) duplicateLogicalCodes.push(la.id)
    seenLogicalCodes.add(la.id)
  }

  const coreCodes = new Set(CORE_AGENTS.map((a) => a.code))
  const persistedCoreAgents = agents.filter((a) => coreCodes.has(a.code)).length
  const persistedLoopAgents = agents.filter((a) => /^AGT-[A-F0-9]{8}$/.test(a.code) || !coreCodes.has(a.code)).length

  const latestByDept = new Map<string, (typeof dccRows)[number]>()
  for (const row of dccRows) {
    const code = row.department?.code
    if (code && !latestByDept.has(code)) {
      latestByDept.set(code, row)
    }
  }

  const now = new Date()
  const certifiedDepartmentCodes: string[] = []
  for (const [code, row] of latestByDept.entries()) {
    if (isCurrentDccCertification(row, now)) {
      certifiedDepartmentCodes.push(code)
    }
  }

  const promptStats = promptLibraryIndex(ROLE_ARCHETYPES.length)
  const ruleStats = constitutionalRuleStats()

  return {
    reconciledAt: now.toISOString(),
    departments: {
      persistedTotal: departments.length,
      activeDepartments: departments.length,
      sourceDefinedTotal: DEPARTMENTS.length,
      archivedDepartments: 0,
      duplicateCodes: duplicateDeptCodes,
      preservedAll110: departments.length === 110 && duplicateDeptCodes.length === 0,
    },
    aiEmployees: {
      entityModel: 'ORGANIZATIONAL_PROFILE_REGISTRY',
      totalEmployees: wfStats.total,
      activeEmployees,
      pausedEmployees,
      retiredEmployees,
      masterCeoCount: 1,
      specialistsPerDepartment: ROLE_ARCHETYPES.length,
      duplicateIds: wfValidation.issues
        .filter((i) => i.code === 'DUPLICATE_ID' || i.message.toLowerCase().includes('duplicate'))
        .map((i) => i.employeeId),
      targetEmployees: 2000,
      targetSatisfied: wfStats.total >= 2000 && wfValidation.valid,
    },
    aiAgents: {
      entityModel: 'PERSISTED_RUNTIME_AND_LOGICAL_CATALOGUE',
      persistedTotal: agents.length,
      persistedActive: agents.filter((a) => a.status === 'ACTIVE').length,
      persistedPaused: agents.filter((a) => a.status === 'PAUSED').length,
      persistedRetired: agents.filter((a) => a.status === 'RETIRED').length,
      persistedCoreAgents,
      persistedLoopAgents,
      logicalCatalogueTotal: LOGICAL_AGENT_COUNT + 1, // 2,200 specialists + CEO-001 = 2,201
      duplicatePersistedCodes,
      duplicateLogicalCodes,
      hierarchy: {
        rootAgentCode: 'CEO-001',
        level1Count: agents.filter((a) => a.level === 1).length,
        level2Count: agents.filter((a) => a.level === 2).length,
        level3Count: agents.filter((a) => a.level === 3).length,
        agentsWithParentCode: agents
          .filter((a) => a.parentCode !== null)
          .map((a) => ({
            code: a.code,
            name: a.name,
            parentCode: a.parentCode as string,
            level: a.level,
            status: a.status,
          })),
        maxAllowedHierarchyDepth: 2,
        maxChildrenPerParent: 3,
      },
      targetAgents: 2000,
      logicalTargetSatisfied: LOGICAL_AGENT_COUNT >= 2000,
    },
    enterpriseAssets: {
      skills: {
        persistedCount: persistedSkillsCount,
        sourceCatalogCount: SKILL_CATALOG.length,
        skillsPerDepartment: CAPABILITY_TEMPLATES.length,
        target: 10000,
        targetSatisfied: SKILL_CATALOG.length >= 10000,
      },
      promptTemplates: {
        persistedCount: persistedPromptsCount,
        sourceCatalogCount: promptStats.size,
        languages: ['en', 'bn'],
        stagesPerRole: PROMPT_STAGES.length,
        target: 50000,
        targetSatisfied: promptStats.size >= 50000,
      },
      sops: {
        persistedCount: persistedSopsCount,
        sourceCatalogCount: SOP_LIBRARY.length,
        sopsPerDepartment: SOP_ARCHETYPES.length,
        target: 500,
        targetSatisfied: SOP_LIBRARY.length >= 500,
      },
      constitutionalRules: {
        coreConstitutionCount: ruleStats.coreConstitutionCount,
        defaultOperationalRulesCount: ruleStats.defaultOperationalRulesCount,
        layeredCatalogCount: ruleStats.total,
        target: 500,
        targetSatisfied: ruleStats.total >= 500,
      },
    },
    dccGovernance: {
      thresholds: DCC_THRESHOLDS,
      persistedAssessments: dccRows.length,
      certifiedDepartmentsCount: certifiedDepartmentCodes.length,
      certifiedDepartmentCodes,
      uncertifiedDepartmentsCount: Math.max(0, departments.length - certifiedDepartmentCodes.length),
      bypassPermitted: false,
    },
    expansionPlan: {
      principle:
        'Controlled, non-destructive workforce expansion gated strictly by 9-metric Department Capability Certification (DCC) and hierarchical supervision.',
      prohibitions: [
        'Never delete legitimate existing records to reach a target count.',
        'Never generate fake database rows or synthetic telemetry merely to display a target number.',
        'Never conflate AI Employees (EMP-*), persisted AI Agents, and dynamic child Loop Agents (AGT-*).',
        'Never bypass DCC certification or spawn uncontrolled background processes.',
      ],
      phases: [
        {
          id: 'PHASE_1',
          window: 'Months 0–2',
          title: 'Approved Models → Specialized Agents',
          conversionRule: '1 Approved AI Model → up to 5 Specialized Agents',
          capacityLimit: 'Max 5 specialized agents per approved model configuration',
          prerequisites: [
            'Model provider configured and health-verified',
            'Department SOPs (5/dept) and Skills (91/dept) mapped',
            'Role-specific system prompts and permission boundaries assigned',
            'Department DCC 9-metric assessment = CERTIFIED',
          ],
          currentStatus: 'ACTIVE',
        },
        {
          id: 'PHASE_2',
          window: 'Months 2–4',
          title: 'Certified Agents → Specialized Loop Agents',
          conversionRule: '1 Certified Eligible Parent Agent → up to 3 Specialized Child Loop Agents',
          capacityLimit: 'Max 3 child Loop Agents per parent; max hierarchy depth = 2',
          prerequisites: [
            'Current, non-expired DCC CERTIFIED status on the target department',
            'Eligible parent agent in the same department with < 3 active children',
            'Child daily token quota <= parent daily token quota',
            'Child tools and permissions strictly subset-bounded by governance policy',
          ],
          currentStatus: certifiedDepartmentCodes.length > 0 ? 'ACTIVE' : 'GATED_BY_DCC',
        },
        {
          id: 'PHASE_3',
          window: 'Months 4–6',
          title: 'Controlled Enterprise Scale (2,000+ Workforce Capacity)',
          conversionRule: 'Incremental materialization of Logical Agent Catalogue (AGENT-0001..AGENT-2200) per DCC-certified department',
          capacityLimit: '20 specialists per department × 110 departments = 2,200 specialist capacity (+ CEO-001)',
          prerequisites: [
            'All 9 DCC metrics passing across target departments (SOP >= 95%, Knowledge >= 95%, Skill >= 95%, Test >= 95%, KPI >= 90%, Security = 100%, Audit = 100%, Self-Recovery >= 90%, Escalation <= 10%)',
            'Continuous 6-check output evaluation and automatic pause on >= 50% failure rate over 6 runs',
            'Super Admin approval for high-risk tool actions and budget thresholds',
          ],
          currentStatus: 'GATED_BY_DCC',
        },
      ],
    },
  }
}
