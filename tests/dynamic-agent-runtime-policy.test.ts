import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isWellFormedDynamicAgent } from '../src/lib/agents/runtime-policy'

const validDynamicAgent = {
  code: 'AGT-A1B2C3D4',
  status: 'PAUSED',
  parentCode: 'CEO-001',
  departmentId: 'dept-row-1',
  department: { code: 'D001' },
  requiresApproval: true,
  purpose: 'Review incoming project files for completeness.',
  systemPrompt: 'You review one bounded input, follow the system policy, and return a concise structured result without external side effects.',
  tools: JSON.stringify(['task.create']),
  permissions: JSON.stringify(['write:tasks']),
}

describe('dynamic agent runtime admission', () => {
  it('accepts a well-formed, paused, persisted least-privilege child draft', () => {
    assert.equal(isWellFormedDynamicAgent(validDynamicAgent), true)
  })

  it('requires the generated code format, parent, and persisted department', () => {
    assert.equal(isWellFormedDynamicAgent({ ...validDynamicAgent, code: 'AGT-1' }), false)
    assert.equal(isWellFormedDynamicAgent({ ...validDynamicAgent, parentCode: null }), false)
    assert.equal(isWellFormedDynamicAgent({ ...validDynamicAgent, department: null }), false)
  })

  it('requires human approval posture and non-empty operating instructions', () => {
    assert.equal(isWellFormedDynamicAgent({ ...validDynamicAgent, requiresApproval: false }), false)
    assert.equal(isWellFormedDynamicAgent({ ...validDynamicAgent, systemPrompt: 'short' }), false)
  })

  it('rejects wildcard and unknown tool/permission grants', () => {
    assert.equal(isWellFormedDynamicAgent({ ...validDynamicAgent, tools: JSON.stringify(['capability:all']) }), false)
    assert.equal(isWellFormedDynamicAgent({ ...validDynamicAgent, tools: JSON.stringify(['db.drop']) }), false)
    assert.equal(isWellFormedDynamicAgent({ ...validDynamicAgent, permissions: JSON.stringify(['root:all']) }), false)
    assert.equal(isWellFormedDynamicAgent({ ...validDynamicAgent, permissions: JSON.stringify(['read:all']) }), false)
  })
})
