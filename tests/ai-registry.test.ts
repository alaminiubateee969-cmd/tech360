import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AGENT_HANDLER, AGENT_REGISTRY_VERSION, validateAgentRegistry, CORE_AGENTS, DEPARTMENTS } from '../src/lib/agents/registry'

describe('canonical AI registry', () => {
  it('has the production cardinality and valid executable handler metadata', () => {
    const validation = validateAgentRegistry()
    assert.equal(validation.valid, true, JSON.stringify(validation))
    assert.equal(validation.agentCount, 44)
    assert.equal(validation.departmentCount, 110)
    assert.equal(AGENT_HANDLER, 'runAgent')
    assert.match(AGENT_REGISTRY_VERSION, /^44-agents\.110-departments\./)
    assert.equal(CORE_AGENTS.every((agent) => (agent.handler ?? AGENT_HANDLER) === AGENT_HANDLER), true)
    assert.equal(DEPARTMENTS.every((department) => department.code.length > 0), true)
  })
})
