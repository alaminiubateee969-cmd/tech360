import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  MAX_AGENT_HIERARCHY_DEPTH,
  MAX_CHILD_AGENTS_PER_PARENT,
  evaluateAgentPlacement,
} from '../src/lib/agents/hierarchy-policy'

const validRootParent = {
  parentExists: true,
  parentStatus: 'ACTIVE',
  parentDepartmentCode: 'D010',
  departmentCode: 'D010',
  parentDepth: 1,
  existingChildren: 0,
}

describe('bounded child-agent hierarchy', () => {
  it('uses the requested default depth and child cap', () => {
    assert.equal(MAX_AGENT_HIERARCHY_DEPTH, 2)
    assert.equal(MAX_CHILD_AGENTS_PER_PARENT, 3)
  })

  it('allows a same-department child below an active root', () => {
    assert.deepEqual(evaluateAgentPlacement(validRootParent), { allowed: true, depth: 2 })
  })

  it('blocks a fourth child of the same parent', () => {
    const result = evaluateAgentPlacement({ ...validRootParent, existingChildren: 3 })
    assert.equal(result.allowed, false)
    if (!result.allowed) assert.equal(result.code, 'MAX_CHILDREN_REACHED')
  })

  it('blocks a third hierarchy level', () => {
    const result = evaluateAgentPlacement({ ...validRootParent, parentDepth: 2 })
    assert.equal(result.allowed, false)
    if (!result.allowed) assert.equal(result.code, 'MAX_DEPTH_REACHED')
  })

  it('requires an active persisted parent in the same department', () => {
    assert.equal(evaluateAgentPlacement({ ...validRootParent, parentExists: false }).allowed, false)
    assert.equal(evaluateAgentPlacement({ ...validRootParent, parentStatus: 'PAUSED' }).allowed, false)
    assert.equal(evaluateAgentPlacement({ ...validRootParent, parentDepartmentCode: 'D011' }).allowed, false)
  })

  it('fails closed on an invalid or cyclic ancestry snapshot', () => {
    const result = evaluateAgentPlacement({ ...validRootParent, parentDepth: null })
    assert.equal(result.allowed, false)
    if (!result.allowed) assert.equal(result.code, 'INVALID_HIERARCHY')
  })
})
