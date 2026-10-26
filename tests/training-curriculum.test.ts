/** Training curriculum — every track is complete and evidence-based. */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { LEARNING_TRACKS, TRAINING_SOURCE_COUNT, maturityFor, trackForCategory } from '../src/lib/agents/training'

describe('agent training curriculum', () => {
  it('covers all 8 department categories', () => {
    assert.deepEqual(LEARNING_TRACKS.map((t) => t.category).sort(),
      ['CONTENT', 'DELIVERY', 'EXECUTIVE', 'GOVERNANCE', 'OPERATIONS', 'REVENUE', 'SUPPORT', 'TECHNOLOGY'])
  })
  it('every track has skills, gaps, sources and a 3-month plan', () => {
    for (const t of LEARNING_TRACKS) {
      assert.ok(t.skills.length >= 3, t.category)
      assert.ok(t.gaps.length >= 1, t.category)
      assert.ok(t.sources.length >= 3, t.category)
      assert.deepEqual(t.months.map((m) => m.month), [1, 2, 3], t.category)
      for (const m of t.months) assert.ok(m.exitCriteria.length > 20)
    }
    assert.ok(TRAINING_SOURCE_COUNT >= 30)
  })
  it('maturity is evidence-based, never calendar-based', () => {
    assert.equal(maturityFor({ executions: 0, successRate: 0 }), 'FOUNDATION')
    assert.equal(maturityFor({ executions: 49, successRate: 0.99 }), 'OPERATIONAL')
    assert.equal(maturityFor({ executions: 50, successRate: 0.9 }), 'AI_MODEL_QUALIFIED')
    assert.equal(maturityFor({ executions: 500, successRate: 0.5 }), 'FOUNDATION')
  })
  it('unknown categories fall back to OPERATIONS, never crash', () => {
    assert.equal(trackForCategory('nope').category, 'OPERATIONS')
    assert.equal(trackForCategory(null).category, 'OPERATIONS')
    assert.equal(trackForCategory('revenue').category, 'REVENUE')
  })
})
