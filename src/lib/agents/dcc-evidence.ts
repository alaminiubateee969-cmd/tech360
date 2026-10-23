import { db } from '@/lib/db'
import { AGENT_TOOLS } from '@/lib/ai-workforce-policy'
import { CORE_AGENTS } from '@/lib/agents/registry'
import { SKILL_CATALOG } from '@/lib/skills/catalog'
import { hasSkillHandler } from '@/lib/skills/primitives'
import { sopsForDepartment } from '@/lib/sops/library'
import {
  DCC_THRESHOLD_VERSION,
  evaluateDcc,
  type DccMetricEvidence,
  type DccMetrics,
} from '@/lib/dcc-policy'

const MEASUREMENT_WINDOW_DAYS = 30
const MAX_AUDIT_EXECUTION_SAMPLE = 5_000
const MAX_SKILL_ROWS = 1_000
const KNOWN_PERMISSIONS = new Set(CORE_AGENTS.flatMap((agent) => agent.permissions))
const KNOWN_TOOLS = new Set<string>(AGENT_TOOLS.filter((tool) => tool !== 'capability:all'))

function percentage(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 10_000) / 100
}

function noteMetric(
  value: number | null,
  source: string,
  note: string,
  counts?: { numerator?: number; denominator?: number; sampleSize?: number },
): DccMetricEvidence {
  return { value, source, note, ...counts }
}

function parseStringArray(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === 'string')) return null
    return parsed
  } catch {
    return null
  }
}

function safeDetails(agent: { tools: string; permissions: string; status: string; requiresApproval: boolean }) {
  const tools = parseStringArray(agent.tools)
  const permissions = parseStringArray(agent.permissions)
  if (!tools || !permissions) return false
  if (!['ACTIVE', 'PAUSED', 'RETIRED'].includes(agent.status)) return false
  if (tools.some((tool) => !KNOWN_TOOLS.has(tool))) return false
  if (permissions.some((permission) => !KNOWN_PERMISSIONS.has(permission) || permission === '*' || permission.endsWith(':all'))) return false
  return true
}

/**
 * Take a bounded, evidence-backed snapshot from the existing DB and code
 * registries. Any denominator or telemetry that the current architecture
 * cannot establish remains null, and therefore cannot pass DCC.
 */
export async function collectDepartmentDccEvidence(input: { departmentId: string; departmentCode: string }) {
  const { departmentId, departmentCode } = input
  const since = new Date(Date.now() - MEASUREMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const expectedSops = sopsForDepartment(departmentCode)
  const expectedSkills = SKILL_CATALOG.filter((skill) => skill.departmentCode === departmentCode)

  const [
    persistedSops,
    persistedSkillCount,
    persistedSkills,
    persistedAgentCount,
    agents,
  ] = await Promise.all([
    db.sop.findMany({
      where: { departmentCode, status: 'ACTIVE', key: { in: expectedSops.map((sop) => sop.key) } },
      select: { key: true },
    }),
    db.skill.count({ where: { departmentCode, status: 'ACTIVE' } }),
    db.skill.findMany({
      where: { departmentCode, status: 'ACTIVE' },
      select: { slug: true, handler: true },
      orderBy: { slug: 'asc' },
      take: MAX_SKILL_ROWS + 1,
    }),
    db.aiAgent.count({ where: { departmentId } }),
    db.aiAgent.findMany({
      where: { departmentId },
      select: { code: true, status: true, tools: true, permissions: true, requiresApproval: true },
      orderBy: { code: 'asc' },
      take: 1_001,
    }),
  ])

  const activeSopKeys = new Set<string>((persistedSops as Array<{ key: string }>).map((row) => row.key))
  const expectedSopKeys = new Set(expectedSops.map((sop) => sop.key))
  const coveredSops = [...activeSopKeys].filter((key) => expectedSopKeys.has(key)).length
  const sopCoverage = expectedSops.length > 0 ? percentage(coveredSops, expectedSops.length) : null

  let skillCoverage: number | null = null
  let coveredSkillCount: number | null = null
  let skillNote: string
  if (expectedSkills.length === 0) {
    skillNote = 'No code-defined skill baseline exists for this department; coverage is unmeasured.'
  } else if (persistedSkillCount > MAX_SKILL_ROWS || persistedSkills.length > MAX_SKILL_ROWS) {
    skillNote = `The persisted active skill rows exceed the ${MAX_SKILL_ROWS}-row assessment bound; no partial percentage is used.`
  } else {
    const expectedById = new Map(expectedSkills.map((skill) => [skill.id, skill.handler]))
    const coveredSkills = new Set(
      persistedSkills
        .filter((skill) => expectedById.get(skill.slug) === skill.handler && hasSkillHandler(skill.handler))
        .map((skill) => skill.slug),
    )
    coveredSkillCount = coveredSkills.size
    skillCoverage = percentage(coveredSkillCount, expectedSkills.length)
    skillNote = `${coveredSkillCount} of ${expectedSkills.length} code-defined skills have a matching ACTIVE persisted Skill row and registered executable handler. This is registry coverage, not a per-skill test result.`
  }

  const agentCodes = agents.map((agent) => agent.code)
  const agentSecurityPasses = agents.filter(safeDetails).length
  const agentRowsComplete = persistedAgentCount <= 1_000 && agents.length === persistedAgentCount
  const securityCompliance = agentRowsComplete && persistedAgentCount > 0
    ? percentage(agentSecurityPasses, persistedAgentCount)
    : null
  const securityNote = persistedAgentCount === 0
    ? 'No persisted agent rows belong to this department; security compliance is unmeasured, not assumed to be 100%.'
    : !agentRowsComplete
      ? `The ${persistedAgentCount} persisted agents exceed the 1,000-row assessment bound; no partial security percentage is used.`
      : `${agentSecurityPasses} of ${persistedAgentCount} persisted department agents have parseable tool/permission lists restricted to known registry capabilities. This is a registry ACL check, not a complete application penetration test.`

  let auditCompliance: number | null = null
  let auditedExecutionCount: number | null = null
  let auditNote = 'No persisted execution records exist in the measurement window; audit coverage is unmeasured.'
  let executionCount = 0
  if (!agentRowsComplete) {
    auditNote = 'The persisted agent rows exceed the assessment bound; a partial audit denominator is not used, so audit coverage is unmeasured.'
  } else if (agentCodes.length > 0) {
    const executionWhere = { agentCode: { in: agentCodes }, createdAt: { gte: since } }
    executionCount = await db.aiAgentExecution.count({ where: executionWhere })
    if (executionCount > 0 && executionCount <= MAX_AUDIT_EXECUTION_SAMPLE) {
      const executions = await db.aiAgentExecution.findMany({
        where: executionWhere,
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: MAX_AUDIT_EXECUTION_SAMPLE,
      })
      const audits = await db.auditLog.findMany({
        where: { action: 'AGENT_EXECUTION_OUTCOME', entityType: 'AiAgentExecution', entityId: { in: executions.map((execution) => execution.id) } },
        select: { entityId: true },
        take: MAX_AUDIT_EXECUTION_SAMPLE,
      })
      const auditedIds = new Set(audits.map((entry) => entry.entityId).filter((id): id is string => Boolean(id)))
      const auditedCount = executions.filter((execution) => auditedIds.has(execution.id)).length
      auditedExecutionCount = auditedCount
      auditCompliance = percentage(auditedCount, executions.length)
      auditNote = `${auditedCount} of ${executions.length} persisted agent execution records have a directly linked AuditLog row in the last ${MEASUREMENT_WINDOW_DAYS} days.`
    } else if (executionCount > MAX_AUDIT_EXECUTION_SAMPLE) {
      auditNote = `The ${executionCount} execution records exceed the ${MAX_AUDIT_EXECUTION_SAMPLE}-row assessment bound; no partial audit percentage is used.`
    }
  }

  const terminalStatuses = ['SUCCESS', 'FAILED', 'TIMEOUT', 'AWAITING_APPROVAL']
  const [executionStatuses, retriedJobs, completedRetriedJobs] = agentRowsComplete && agentCodes.length > 0
    ? await Promise.all([
        db.aiAgentExecution.groupBy({
          by: ['status'],
          where: { agentCode: { in: agentCodes }, createdAt: { gte: since }, status: { in: terminalStatuses } },
          _count: { _all: true },
        }),
        db.agentJob.count({
          where: { agentCode: { in: agentCodes }, createdAt: { gte: since }, attempts: { gt: 1 }, status: { in: ['COMPLETED', 'FAILED', 'TIMED_OUT'] } },
        }),
        db.agentJob.count({
          where: { agentCode: { in: agentCodes }, createdAt: { gte: since }, attempts: { gt: 1 }, status: 'COMPLETED' },
        }),
      ])
    : [[], 0, 0] as const

  const totalTerminalExecutions = executionStatuses.reduce((sum, row) => sum + row._count._all, 0)
  const awaitingApproval = executionStatuses.find((row) => row.status === 'AWAITING_APPROVAL')?._count._all ?? 0
  const humanEscalationRate = percentage(awaitingApproval, totalTerminalExecutions)
  // Queue retries are not equivalent to the platform's separate self-healing
  // capability; retain the proxy counts but never certify from that proxy.
  const selfRecoveryRate: number | null = null

  const metrics: DccMetrics = {
    sopCoverage: noteMetric(
      sopCoverage,
      'src/lib/sops/library.ts + persisted Sop rows',
      expectedSops.length > 0
        ? `${coveredSops} of ${expectedSops.length} source-defined department SOPs are represented by matching ACTIVE persisted Sop rows.`
        : 'No code-defined SOP baseline exists for this department; coverage is unmeasured.',
      { numerator: coveredSops, denominator: expectedSops.length },
    ),
    knowledgeCoverage: noteMetric(
      null,
      'KnowledgeDocument / KnowledgeIngestRecord / KnowledgeEntity schema review',
      'The current schema has no department-owned knowledge inventory or expected-source denominator. Documents or graph nodes cannot be treated as coverage without that mapping.',
    ),
    skillCoverage: noteMetric(
      skillCoverage,
      'src/lib/skills/catalog.ts + persisted Skill rows',
      skillNote,
      { numerator: coveredSkillCount ?? undefined, denominator: expectedSkills.length },
    ),
    testPassRate: noteMetric(
      null,
      'Prisma schema / persisted test telemetry review',
      'SkillRun stores operational executions, not test-run outcomes. The repository has no persisted per-department test-run denominator/result, so test pass rate is unmeasured.',
    ),
    kpiAchievement: noteMetric(
      null,
      'Prisma schema / persisted KPI telemetry review',
      'Configured profile KPI targets are source-defined; no persisted department KPI target-and-outcome records exist to calculate achievement.',
    ),
    securityCompliance: noteMetric(
      securityCompliance,
      'persisted AiAgent tool and permission rows + canonical capability allowlists',
      securityNote,
      { numerator: securityCompliance === null ? undefined : agentSecurityPasses, denominator: persistedAgentCount, sampleSize: agentRowsComplete ? persistedAgentCount : undefined },
    ),
    auditCompliance: noteMetric(
      auditCompliance,
      'AiAgentExecution joined to AuditLog action=AGENT_EXECUTION_OUTCOME',
      auditNote,
      { numerator: auditedExecutionCount ?? undefined, denominator: executionCount, sampleSize: executionCount },
    ),
    selfRecoveryRate: noteMetric(
      selfRecoveryRate,
      'persisted AgentJob retry outcomes (last 30 days)',
      !agentRowsComplete
        ? 'The persisted department agents exceed the assessment bound, and the architecture has no separate persisted self-healing outcome record; self-recovery is unmeasured.'
        : retriedJobs > 0
          ? `${completedRetriedJobs} of ${retriedJobs} terminal AgentJobs that required more than one attempt completed. This bounded-queue retry rate is a proxy and does not establish autonomous self-healing.`
          : 'No terminal retried AgentJobs were observed in the measurement window; the architecture has no separate persisted self-healing outcome record, so self-recovery is unmeasured.',
      { numerator: completedRetriedJobs, denominator: retriedJobs, sampleSize: retriedJobs },
    ),
    humanEscalationRate: noteMetric(
      humanEscalationRate,
      'persisted AiAgentExecution.status=AWAITING_APPROVAL (last 30 days)',
      !agentRowsComplete
        ? 'The persisted department agents exceed the assessment bound; a partial execution set is not used, so escalation rate is unmeasured.'
        : totalTerminalExecutions > 0
          ? `${awaitingApproval} of ${totalTerminalExecutions} terminal agent executions ended in AWAITING_APPROVAL. This measures recorded approval escalations only.`
          : 'No terminal agent executions were observed in the measurement window; escalation rate is unmeasured, not assumed to be 0%.',
      { numerator: awaitingApproval, denominator: totalTerminalExecutions, sampleSize: totalTerminalExecutions },
    ),
  }

  const evaluation = evaluateDcc(metrics)
  return {
    thresholdVersion: DCC_THRESHOLD_VERSION,
    status: evaluation.status,
    certified: evaluation.certified,
    metrics,
    evaluation,
    windowStart: since,
    windowEnd: new Date(),
    departmentId,
    departmentCode,
  }
}
