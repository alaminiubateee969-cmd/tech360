/**
 * Regression: the admin department list must report a valid DCC certificate as
 * current. The select in src/app/api/admin/command/route.ts once omitted
 * `assessedAt`, which made every department look uncertified.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { DCC_THRESHOLDS, DCC_THRESHOLD_VERSION, evaluateDcc, isCurrentDccCertification, type DccMetricEvidence, type DccMetricKey, type StoredDccAssessment } from '../src/lib/dcc-policy'

const DAY = 24 * 60 * 60 * 1000

// Evidence that exactly meets every threshold, so evaluateDcc returns CERTIFIED.
function passingEvidence(): Partial<Record<DccMetricKey, DccMetricEvidence>> {
  const out: Partial<Record<DccMetricKey, DccMetricEvidence>> = {}
  for (const key of Object.keys(DCC_THRESHOLDS) as DccMetricKey[]) {
    const value = DCC_THRESHOLDS[key].value
    out[key] = { value, source: 'test-fixture', note: 'threshold-equal fixture', numerator: value, denominator: 100, sampleSize: 100 }
  }
  return out
}

function certifiedRow(now: Date, assessedAt: Date, expiresAt: Date | null): StoredDccAssessment {
  const metrics = passingEvidence()
  const values = Object.fromEntries(Object.entries(metrics).map(([k, v]) => [k, v?.value ?? null])) as Record<DccMetricKey, number | null>
  assert.equal(evaluateDcc(metrics).status, 'CERTIFIED', 'fixture must be genuinely certified')
  void now
  return {
    status: 'CERTIFIED',
    thresholdVersion: DCC_THRESHOLD_VERSION,
    assessedAt,
    expiresAt,
    evidence: JSON.stringify(metrics),
    ...values,
  } as StoredDccAssessment
}

describe('DCC certification currency', () => {
  const now = new Date()
  const assessedAt = new Date(now.getTime() - DAY)
  const expiresAt = new Date(now.getTime() + 20 * DAY)

  it('reports a complete, in-window, genuinely certified row as current', () => {
    assert.equal(isCurrentDccCertification(certifiedRow(now, assessedAt, expiresAt), now), true)
  })

  it('reports the same row as NOT current when assessedAt is missing (the failure mode the select must prevent)', () => {
    const row = certifiedRow(now, assessedAt, expiresAt)
    const { assessedAt: _omit, ...withoutAssessedAt } = row
    assert.equal(isCurrentDccCertification(withoutAssessedAt as unknown as StoredDccAssessment, now), false)
  })

  it('the department list select requests assessedAt from dccAssessments', () => {
    const src = readFileSync(join(import.meta.dirname, '..', 'src/app/api/admin/command/route.ts'), 'utf8')
    const start = src.indexOf('dccAssessments: {')
    assert.ok(start > 0, 'dccAssessments select must exist')
    assert.match(src.slice(start, start + 900), /assessedAt: true/)
  })
})
