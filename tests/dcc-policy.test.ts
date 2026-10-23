import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DCC_CERTIFICATION_VALIDITY_DAYS,
  DCC_THRESHOLD_VERSION,
  DCC_THRESHOLDS,
  evaluateDcc,
  isCurrentDccCertification,
  type DccMetricEvidence,
  type DccMetricKey,
  type DccMetrics,
  type StoredDccAssessment,
} from '../src/lib/dcc-policy'

const keys = Object.keys(DCC_THRESHOLDS) as DccMetricKey[]

function passingMetrics(): DccMetrics {
  return Object.fromEntries(keys.map((key) => {
    const threshold = DCC_THRESHOLDS[key]
    const value = threshold.value
    return [key, { value, source: `evidence:${key}`, note: `measured ${key}`, numerator: value, denominator: 100 } satisfies DccMetricEvidence]
  })) as DccMetrics
}

describe('DCC thresholds and fail-closed evaluation', () => {
  it('uses the required thresholds exactly', () => {
    assert.deepEqual(DCC_THRESHOLDS, {
      sopCoverage: { label: 'SOP coverage', comparator: 'MIN', value: 95 },
      knowledgeCoverage: { label: 'Knowledge coverage', comparator: 'MIN', value: 95 },
      skillCoverage: { label: 'Skill coverage', comparator: 'MIN', value: 95 },
      testPassRate: { label: 'Test pass rate', comparator: 'MIN', value: 95 },
      kpiAchievement: { label: 'KPI achievement', comparator: 'MIN', value: 90 },
      securityCompliance: { label: 'Security compliance', comparator: 'MIN', value: 100 },
      auditCompliance: { label: 'Audit compliance', comparator: 'MIN', value: 100 },
      selfRecoveryRate: { label: 'Self-recovery success', comparator: 'MIN', value: 90 },
      humanEscalationRate: { label: 'Human escalation rate', comparator: 'MAX', value: 10 },
    })
  })

  it('certifies only when all nine evidenced metrics meet their thresholds', () => {
    const result = evaluateDcc(passingMetrics())
    assert.equal(result.status, 'CERTIFIED')
    assert.equal(result.certified, true)
    assert.equal(result.metrics.length, 9)
  })

  it('does not treat missing evidence as a pass or as zero risk', () => {
    const metrics = passingMetrics()
    metrics.knowledgeCoverage = {
      value: null,
      source: 'schema review',
      note: 'No department-owned knowledge inventory exists.',
    }
    const result = evaluateDcc(metrics)
    assert.equal(result.status, 'UNDER_REVIEW')
    assert.equal(result.certified, false)
    assert.deepEqual(result.missing, ['knowledgeCoverage'])
  })

  it('requires both a numeric value and a traceable evidence source/method', () => {
    const metrics = passingMetrics()
    metrics.securityCompliance = { value: 100, source: '', note: 'passed' }
    const result = evaluateDcc(metrics)
    assert.equal(result.status, 'BLOCKED')
    assert.equal(result.metrics.find((metric) => metric.key === 'securityCompliance')?.status, 'INVALID_EVIDENCE')
  })

  it('blocks a mandatory metric below threshold, even when others are missing', () => {
    const metrics = passingMetrics()
    metrics.sopCoverage.value = 94.99
    metrics.sopCoverage.numerator = 9_499
    metrics.sopCoverage.denominator = 10_000
    metrics.knowledgeCoverage.value = null
    const result = evaluateDcc(metrics)
    assert.equal(result.status, 'BLOCKED')
    assert.ok(result.failed.includes('sopCoverage'))
    assert.ok(result.missing.includes('knowledgeCoverage'))
  })

  it('accepts equality at thresholds and blocks escalation above ten percent', () => {
    const metrics = passingMetrics()
    metrics.humanEscalationRate.value = 10
    metrics.humanEscalationRate.numerator = 10
    metrics.humanEscalationRate.denominator = 100
    assert.equal(evaluateDcc(metrics).status, 'CERTIFIED')
    metrics.humanEscalationRate.value = 10.01
    metrics.humanEscalationRate.numerator = 1_001
    metrics.humanEscalationRate.denominator = 10_000
    assert.equal(evaluateDcc(metrics).status, 'BLOCKED')
  })

  it('rejects non-finite and out-of-range percentages', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -0.1, 100.01]) {
      const metrics = passingMetrics()
      metrics.testPassRate.value = value
      assert.equal(evaluateDcc(metrics).status, 'BLOCKED')
      assert.equal(evaluateDcc(metrics).metrics.find((metric) => metric.key === 'testPassRate')?.status, 'INVALID_EVIDENCE')
    }
  })
})

describe('DCC persisted certification validity', () => {
  const now = new Date('2026-10-23T12:00:00.000Z')

  function certifiedRow(): StoredDccAssessment {
    const metrics = passingMetrics()
    return {
      status: 'CERTIFIED',
      thresholdVersion: DCC_THRESHOLD_VERSION,
      assessedAt: now,
      expiresAt: new Date(now.getTime() + DCC_CERTIFICATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000),
      sopCoverage: metrics.sopCoverage.value,
      knowledgeCoverage: metrics.knowledgeCoverage.value,
      skillCoverage: metrics.skillCoverage.value,
      testPassRate: metrics.testPassRate.value,
      kpiAchievement: metrics.kpiAchievement.value,
      securityCompliance: metrics.securityCompliance.value,
      auditCompliance: metrics.auditCompliance.value,
      selfRecoveryRate: metrics.selfRecoveryRate.value,
      humanEscalationRate: metrics.humanEscalationRate.value,
      evidence: JSON.stringify(metrics),
    }
  }

  it('accepts a current, versioned, revalidated passing snapshot', () => {
    assert.equal(isCurrentDccCertification(certifiedRow(), now), true)
  })

  it('rejects an expired, changed-version, malformed, or failed snapshot', () => {
    const expired = certifiedRow()
    expired.expiresAt = new Date(now.getTime() - 1)
    assert.equal(isCurrentDccCertification(expired, now), false)

    const wrongVersion = certifiedRow()
    wrongVersion.thresholdVersion = 'dcc-old'
    assert.equal(isCurrentDccCertification(wrongVersion, now), false)

    const overlong = certifiedRow()
    overlong.expiresAt = new Date(now.getTime() + (DCC_CERTIFICATION_VALIDITY_DAYS + 1) * 24 * 60 * 60 * 1000)
    assert.equal(isCurrentDccCertification(overlong, now), false)

    const futureAssessment = certifiedRow()
    futureAssessment.assessedAt = new Date(now.getTime() + 1)
    assert.equal(isCurrentDccCertification(futureAssessment, now), false)

    const malformed = certifiedRow()
    malformed.evidence = '{not-json'
    assert.equal(isCurrentDccCertification(malformed, now), false)

    const failed = certifiedRow()
    failed.status = 'BLOCKED'
    assert.equal(isCurrentDccCertification(failed, now), false)
  })
})
