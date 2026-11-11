import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { INDUSTRY_REGISTRY } from '../src/data/industries'
import {
  MATURITY_META,
  MATURITY_ORDER,
  SOLUTION_EVIDENCE,
  assessSolution,
  evidenceCeiling,
  maturitySummary,
} from '../src/data/industries/maturity'
import { verifySolutionEvidence } from '../src/data/industries/maturity-verify'

/**
 * The maturity model is the guard that stops a specification being presented as
 * working software. These tests prove the cap is real, not cosmetic: a claim
 * without evidence is demoted, and evidence for a level is required before that
 * level can be shown.
 */

describe('solution maturity gating', () => {
  it('orders the lifecycle from concept to deployable', () => {
    assert.deepEqual(MATURITY_ORDER, [
      'CONCEPT',
      'SPECIFIED',
      'DESIGN READY',
      'DEMO AVAILABLE',
      'IMPLEMENTED',
      'TESTED',
      'DEPLOYABLE',
    ])
    assert.equal(Object.keys(MATURITY_META).length, MATURITY_ORDER.length)
  })

  it('caps an unsupported claim instead of publishing it', () => {
    const assessment = assessSolution('NOPE-MOD-99', 'TESTED')
    assert.equal(assessment.claimed, 'TESTED')
    assert.equal(assessment.status, 'SPECIFIED')
    assert.equal(assessment.capped, true)
    assert.ok(assessment.missing.includes('sourcePaths'))
    assert.ok(assessment.missing.includes('testFiles'))
    assert.match(assessment.explanation, /Capped/)
  })

  it('refuses DEMO AVAILABLE without a demo route', () => {
    assert.equal(evidenceCeiling(undefined), 'SPECIFIED')
    assert.equal(evidenceCeiling({ designArtifacts: ['docs/design/example.png'] }), 'DESIGN READY')
    assert.equal(evidenceCeiling({ demoRoute: '/demo/example' }), 'DEMO AVAILABLE')
    assert.equal(evidenceCeiling({ sourcePaths: ['src/example.ts'] }), 'IMPLEMENTED')
    assert.equal(
      evidenceCeiling({ sourcePaths: ['src/example.ts'], testFiles: ['tests/example.test.ts'] }),
      'TESTED',
    )
    assert.equal(
      evidenceCeiling({
        sourcePaths: ['src/example.ts'],
        testFiles: ['tests/example.test.ts'],
        deploymentEvidence: ['docs/deploy.md'],
      }),
      'DEPLOYABLE',
    )
  })

  it('never publishes a status above Specified for the current repository contents', () => {
    // The ledger is intentionally empty: no industry solution has been built,
    // tested or deployed for a client.
    assert.deepEqual(Object.keys(SOLUTION_EVIDENCE), [])

    for (const entry of INDUSTRY_REGISTRY) {
      for (const spec of entry.data.modules) {
        const assessment = assessSolution(spec.id, spec.maturity)
        assert.equal(
          assessment.status,
          'SPECIFIED',
          `${spec.id} must not advertise "${assessment.status}" without evidence`,
        )
      }
    }
  })

  it('summarises the whole library as specified and nothing stronger', () => {
    const ids = INDUSTRY_REGISTRY.flatMap((entry) => entry.data.modules.map((m) => m.id))
    const summary = maturitySummary(ids)
    assert.equal(summary.total, ids.length)
    assert.equal(summary.counts.SPECIFIED, ids.length)
    assert.equal(summary.counts['DEMO AVAILABLE'], 0)
    assert.equal(summary.counts.IMPLEMENTED, 0)
    assert.equal(summary.counts.TESTED, 0)
    assert.equal(summary.counts.DEPLOYABLE, 0)
  })

  it('verifies the evidence ledger against the working tree', () => {
    const claims = INDUSTRY_REGISTRY.flatMap((entry) =>
      entry.data.modules.map((spec) => ({ id: spec.id, claimed: spec.maturity })),
    )
    const audit = verifySolutionEvidence(claims)
    assert.deepEqual(audit.missingPaths, [])
    assert.deepEqual(audit.overclaims, [])
    assert.equal(audit.total, claims.length)
  })

  it('reports a missing evidence path rather than trusting the ledger', () => {
    const audit = verifySolutionEvidence([{ id: 'X-MOD-01', claimed: 'IMPLEMENTED' }], {
      ledger: {
        'X-MOD-01': {
          sourcePaths: ['src/this-does-not-exist.ts'],
          testFiles: ['tests/this-does-not-exist.test.ts'],
        },
      },
    })
    assert.equal(audit.missingPaths.length, 2)
  })

  it('demotes an overclaiming solution to the evidence ceiling', () => {
    const audit = verifySolutionEvidence([{ id: 'Y-MOD-01', claimed: 'DEPLOYABLE' }], {
      ledger: { 'Y-MOD-01': { sourcePaths: ['package.json'] } },
    })
    assert.equal(audit.counts.IMPLEMENTED, 1)
    assert.equal(audit.overclaims.length, 1)
    assert.equal(audit.overclaims[0].status, 'IMPLEMENTED')
  })
})
