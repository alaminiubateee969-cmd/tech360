/**
 * TECH360 — homepage stats truth pin.
 *
 * The public homepage may show source-definition counts only when clearly
 * labeled as catalogue/code definitions. These figures do not prove that
 * departments are deployed/staffed or workflow stages are automated in
 * production. This suite pins the source counts and their caveats.
 *
 * The SSR-first stat rendering remains covered elsewhere; this suite also
 * guards against presenting source definitions as production deployment facts.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DEPARTMENTS } from '../src/lib/agents/registry'
import { PIPELINE_STAGES } from '../src/lib/constants'
import { STATS } from '../src/data/site'

function stat(label: string): { value: string; note: string } {
  const found = STATS.find((s) => s.label === label)
  assert.ok(found, `homepage stats must include "${label}"`)
  return found
}

describe('homepage stats are accurate and distinguish source counts from live operation', () => {
  it('department count is labeled as source definitions, not deployed teams', () => {
    assert.equal(DEPARTMENTS.length, 110, 'the registry source changed — update this test AND the source-count stat together')
    const departments = stat('department definitions')
    assert.equal(departments.value, String(DEPARTMENTS.length), 'homepage must display the exact source registry count')
    assert.match(departments.note, /catalogue count/i)
    assert.match(departments.note, /not a claim that .* deployed or staffed/i)
  })

  it('workflow stage count is labeled as source definitions, not automated coverage', () => {
    assert.equal(PIPELINE_STAGES.length, 20, 'the pipeline source changed — update this test AND the definition-count stat together')
    const stages = stat('pipeline-stage definitions')
    assert.equal(stages.value, String(PIPELINE_STAGES.length), 'homepage must display the exact source pipeline count')
    assert.match(stages.note, /defined in source/i)
    assert.match(stages.note, /Live usage, automation coverage,/i)
    assert.match(stages.note, /not been verified/i)
  })

  it('never ships a zero or empty stat value', () => {
    for (const s of STATS) {
      assert.ok(s.value.trim().length > 0, `stat "${s.label}" has an empty value`)
      assert.notEqual(s.value.trim(), '0', `stat "${s.label}" displays zero`)
      assert.ok(s.note.trim().length > 10, `stat "${s.label}" needs its verifiable note`)
    }
  })

  it('department code uniqueness holds (seed integrity precondition)', () => {
    const codes = new Set(DEPARTMENTS.map((d) => d.code))
    assert.equal(codes.size, DEPARTMENTS.length, 'duplicate department codes would break idempotent seeding')
  })
})
