export const DCC_THRESHOLD_VERSION = 'dcc-1.0.0' as const
export const DCC_CERTIFICATION_VALIDITY_DAYS = 30

export const DCC_THRESHOLDS = {
  sopCoverage: { label: 'SOP coverage', comparator: 'MIN', value: 95 },
  knowledgeCoverage: { label: 'Knowledge coverage', comparator: 'MIN', value: 95 },
  skillCoverage: { label: 'Skill coverage', comparator: 'MIN', value: 95 },
  testPassRate: { label: 'Test pass rate', comparator: 'MIN', value: 95 },
  kpiAchievement: { label: 'KPI achievement', comparator: 'MIN', value: 90 },
  securityCompliance: { label: 'Security compliance', comparator: 'MIN', value: 100 },
  auditCompliance: { label: 'Audit compliance', comparator: 'MIN', value: 100 },
  selfRecoveryRate: { label: 'Self-recovery success', comparator: 'MIN', value: 90 },
  humanEscalationRate: { label: 'Human escalation rate', comparator: 'MAX', value: 10 },
} as const

export type DccMetricKey = keyof typeof DCC_THRESHOLDS
export type DccStatus = 'CERTIFIED' | 'BLOCKED' | 'UNDER_REVIEW'
export type DccMetricEvidence = {
  value: number | null
  source: string
  note: string
  numerator?: number
  denominator?: number
  sampleSize?: number
}
export type DccMetrics = Record<DccMetricKey, DccMetricEvidence>
export type DccMetricResult = DccMetricEvidence & {
  key: DccMetricKey
  label: string
  threshold: number
  comparator: 'MIN' | 'MAX'
  status: 'PASS' | 'FAIL' | 'NOT_MEASURED' | 'INVALID_EVIDENCE'
}
export type DccEvaluation = {
  status: DccStatus
  certified: boolean
  metrics: DccMetricResult[]
  failed: DccMetricKey[]
  missing: DccMetricKey[]
}

const METRIC_KEYS = Object.keys(DCC_THRESHOLDS) as DccMetricKey[]

/**
 * Fail-closed DCC decision. A numerical value is not evidence by itself:
 * every metric also needs a traceable source and a human-readable method note.
 * Missing or malformed evidence can never be treated as a pass.
 */
export function evaluateDcc(metrics: Partial<Record<DccMetricKey, DccMetricEvidence>>): DccEvaluation {
  const results: DccMetricResult[] = METRIC_KEYS.map((key) => {
    const threshold = DCC_THRESHOLDS[key]
    const evidence = metrics[key]
    const common = {
      key,
      label: threshold.label,
      threshold: threshold.value,
      comparator: threshold.comparator,
      value: evidence?.value ?? null,
      source: evidence?.source ?? '',
      note: evidence?.note ?? '',
      ...(evidence?.numerator === undefined ? {} : { numerator: evidence.numerator }),
      ...(evidence?.denominator === undefined ? {} : { denominator: evidence.denominator }),
      ...(evidence?.sampleSize === undefined ? {} : { sampleSize: evidence.sampleSize }),
    }

    if (!evidence || evidence.value === null || evidence.value === undefined) {
      return { ...common, status: 'NOT_MEASURED' as const }
    }
    if (
      !Number.isFinite(evidence.value)
      || evidence.value < 0
      || evidence.value > 100
      || !evidence.source.trim()
      || !evidence.note.trim()
      || !Number.isInteger(evidence.numerator)
      || !Number.isInteger(evidence.denominator)
      || (evidence.numerator ?? -1) < 0
      || (evidence.denominator ?? 0) <= 0
      || (evidence.numerator ?? 0) > (evidence.denominator ?? 0)
    ) {
      return { ...common, status: 'INVALID_EVIDENCE' as const }
    }

    const evidencePercentage = Math.round(((evidence.numerator ?? 0) / (evidence.denominator ?? 1)) * 10_000) / 100
    if (Math.abs(evidencePercentage - evidence.value) > 0.01) {
      return { ...common, status: 'INVALID_EVIDENCE' as const }
    }

    const passed = threshold.comparator === 'MIN'
      ? evidence.value >= threshold.value
      : evidence.value <= threshold.value
    return { ...common, status: passed ? 'PASS' as const : 'FAIL' as const }
  })

  const failed = results.filter((metric) => metric.status === 'FAIL' || metric.status === 'INVALID_EVIDENCE').map((metric) => metric.key)
  const missing = results.filter((metric) => metric.status === 'NOT_MEASURED').map((metric) => metric.key)
  const status: DccStatus = failed.length > 0 ? 'BLOCKED' : missing.length > 0 ? 'UNDER_REVIEW' : 'CERTIFIED'

  return { status, certified: status === 'CERTIFIED', metrics: results, failed, missing }
}

export type StoredDccAssessment = {
  status: string
  thresholdVersion: string
  assessedAt: Date | string
  expiresAt: Date | string | null
  sopCoverage: number | null
  knowledgeCoverage: number | null
  skillCoverage: number | null
  testPassRate: number | null
  kpiAchievement: number | null
  securityCompliance: number | null
  auditCompliance: number | null
  selfRecoveryRate: number | null
  humanEscalationRate: number | null
  evidence: string
}

/** Re-evaluate persisted snapshots at the creation boundary; never trust the status column alone. */
export function isCurrentDccCertification(row: StoredDccAssessment | null | undefined, now = new Date()): boolean {
  if (!row || row.status !== 'CERTIFIED' || row.thresholdVersion !== DCC_THRESHOLD_VERSION) return false
  const assessedAt = row.assessedAt instanceof Date ? row.assessedAt : new Date(row.assessedAt)
  const expiresAt = row.expiresAt instanceof Date ? row.expiresAt : row.expiresAt ? new Date(row.expiresAt) : null
  if (
    !Number.isFinite(assessedAt.getTime())
    || assessedAt.getTime() > now.getTime()
    || !expiresAt
    || !Number.isFinite(expiresAt.getTime())
    || expiresAt.getTime() <= now.getTime()
    || expiresAt.getTime() > assessedAt.getTime() + DCC_CERTIFICATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000
  ) return false

  let storedEvidence: Partial<Record<DccMetricKey, DccMetricEvidence>>
  try {
    const parsed: unknown = JSON.parse(row.evidence)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false
    storedEvidence = parsed as Partial<Record<DccMetricKey, DccMetricEvidence>>
  } catch {
    return false
  }

  const values: Record<DccMetricKey, DccMetricEvidence> = {
    sopCoverage: { ...(storedEvidence.sopCoverage ?? { source: '', note: '' }), value: row.sopCoverage },
    knowledgeCoverage: { ...(storedEvidence.knowledgeCoverage ?? { source: '', note: '' }), value: row.knowledgeCoverage },
    skillCoverage: { ...(storedEvidence.skillCoverage ?? { source: '', note: '' }), value: row.skillCoverage },
    testPassRate: { ...(storedEvidence.testPassRate ?? { source: '', note: '' }), value: row.testPassRate },
    kpiAchievement: { ...(storedEvidence.kpiAchievement ?? { source: '', note: '' }), value: row.kpiAchievement },
    securityCompliance: { ...(storedEvidence.securityCompliance ?? { source: '', note: '' }), value: row.securityCompliance },
    auditCompliance: { ...(storedEvidence.auditCompliance ?? { source: '', note: '' }), value: row.auditCompliance },
    selfRecoveryRate: { ...(storedEvidence.selfRecoveryRate ?? { source: '', note: '' }), value: row.selfRecoveryRate },
    humanEscalationRate: { ...(storedEvidence.humanEscalationRate ?? { source: '', note: '' }), value: row.humanEscalationRate },
  }
  return evaluateDcc(values).certified
}
