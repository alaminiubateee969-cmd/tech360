import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { INDUSTRY_REGISTRY } from '../src/data/industries'
import {
  MIN_SOLUTIONS_PER_INDUSTRY,
  validateIndustrySolution,
  validateFlagshipCounts,
} from '../src/data/industries/types'

/**
 * Industry solution-library guarantees.
 *
 * These assertions are the reason the public pages can state "eight or more
 * solution specifications per industry" without a manual audit: the registry
 * cannot drop below the minimum, cannot repeat an ID, and cannot contain
 * non-USD or non-English content without failing here.
 */

describe('industry solution library', () => {
  it('registers all 20 industries', () => {
    assert.equal(INDUSTRY_REGISTRY.length, 20)
  })

  it('gives every industry at least the minimum number of solution specifications', () => {
    for (const entry of INDUSTRY_REGISTRY) {
      assert.ok(
        entry.data.modules.length >= MIN_SOLUTIONS_PER_INDUSTRY,
        `${entry.slug} has only ${entry.data.modules.length} solutions (minimum ${MIN_SOLUTIONS_PER_INDUSTRY})`,
      )
    }
  })

  it('keeps solution IDs unique across the whole library', () => {
    const seen = new Map<string, string>()
    for (const entry of INDUSTRY_REGISTRY) {
      for (const spec of entry.data.modules) {
        const previous = seen.get(spec.id)
        assert.equal(
          previous,
          undefined,
          `solution id ${spec.id} is used by both ${previous} and ${entry.slug}`,
        )
        seen.set(spec.id, entry.slug)
      }
    }
  })

  it('validates every industry payload with zero issues', () => {
    for (const entry of INDUSTRY_REGISTRY) {
      const issues = validateIndustrySolution(entry)
      assert.deepEqual(issues, [], `${entry.slug} validation issues: ${JSON.stringify(issues.slice(0, 3))}`)
    }
  })

  it('keeps the Manufacturing flagship at its pinned workflow and spec counts', () => {
    const flagship = INDUSTRY_REGISTRY.find((entry) => entry.slug === 'manufacturing')
    assert.ok(flagship)
    assert.deepEqual(validateFlagshipCounts(flagship), [])
    assert.ok(flagship.data.workflows.length >= 26)
    assert.ok(flagship.data.modules.length >= 52)
  })

  it('describes the intended industry library size (≥160 sector solutions)', () => {
    const total = INDUSTRY_REGISTRY.reduce((sum, entry) => sum + entry.data.modules.length, 0)
    assert.ok(total >= 160, `expected at least 160 sector solutions, found ${total}`)
  })

  it('does not reuse the platform application planes as sector solutions', () => {
    // The eight platform planes (web/mobile/API/auth/workflow/files/reporting/AI)
    // are shared shells. They must never be counted as the industry minimum, so
    // no sector solution may carry a platform-plane name.
    const platformNames = new Set([
      'Web Application',
      'Mobile Application',
      'API & Integration Services',
      'Authentication & Authorization',
      'Workflow & Notification Services',
      'File & Document Services',
      'Reporting & Analytics Services',
      'AI Agent Services',
    ])
    for (const entry of INDUSTRY_REGISTRY) {
      for (const spec of entry.data.modules) {
        assert.ok(
          !platformNames.has(spec.name),
          `${entry.slug} counts the platform plane "${spec.name}" as a sector solution`,
        )
      }
    }
  })

  it('gives every sector solution a problem statement and acceptance criteria', () => {
    for (const entry of INDUSTRY_REGISTRY) {
      for (const spec of entry.data.modules) {
        assert.ok(spec.problem.length > 20, `${spec.id} has no meaningful problem statement`)
        assert.ok(spec.acceptanceCriteria.length > 0, `${spec.id} has no acceptance criteria`)
        assert.ok(spec.capabilities.length >= 3, `${spec.id} has fewer than three capabilities`)
      }
    }
  })
})
