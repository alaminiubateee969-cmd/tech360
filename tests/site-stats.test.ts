/**
 * TECH360 — homepage stats truth pin.
 *
 * The public homepage "Company facts we can verify" band shows the number of
 * internal departments and automated workflow stages. Those figures must be
 * exactly what the platform ships — the department registry that seeds the
 * database and the pipeline constants that drive the CRM journey — never a
 * marketing guess. This suite fails CI if the marketing copy and the real
 * sources of truth ever drift apart.
 *
 * (Regression origin: the owner audited the homepage and saw "0 internal
 * departments / 0 automated workflow stages" — the old count-up rendered 0
 * in server HTML. The SSR-first fix lives in StatChip.tsx; this test pins
 * the VALUES themselves.)
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

describe('homepage stats are the real platform numbers', () => {
  it('department count equals the seeded registry (110)', () => {
    assert.equal(DEPARTMENTS.length, 110, 'the registry itself changed — update this test AND the marketing stat together')
    const departments = stat('internal departments')
    assert.equal(departments.value, String(DEPARTMENTS.length), 'homepage must display the exact registry department count')
  })

  it('workflow stage count equals the CRM pipeline (20)', () => {
    assert.equal(PIPELINE_STAGES.length, 20, 'the pipeline itself changed — update this test AND the marketing stat together')
    const stages = stat('automated workflow stages')
    assert.equal(stages.value, String(PIPELINE_STAGES.length), 'homepage must display the exact pipeline stage count')
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
