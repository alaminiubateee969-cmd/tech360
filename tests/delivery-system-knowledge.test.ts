import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DELIVERY_SYSTEM_KNOWLEDGE, shouldAttachDeliveryKnowledge } from '../src/lib/delivery-system-knowledge'

describe('project delivery knowledge routing', () => {
  it('injects the baseline for deployment agents and domain/hosting work', () => {
    assert.equal(shouldAttachDeliveryKnowledge({ agentCode: 'DEP-037', task: 'prepare release plan' }), true)
    assert.equal(shouldAttachDeliveryKnowledge({ agentCode: 'COM-010', workflow: 'CUSTOM_DOMAIN_REVIEW', task: 'thedreamerit.com shared hosting' }), true)
    assert.equal(shouldAttachDeliveryKnowledge({ agentCode: 'COM-010', workflow: 'GENERAL_REPLY', task: 'hello, thank you' }), false)
  })

  it('covers domain ownership, shared-hosting fit, project isolation and client handoff', () => {
    for (const required of [
      'not proof that it is available',
      'runtime/version',
      'Do not promise a standalone Next.js server',
      'Never deploy TECH360\'s whole internal workforce',
      'DNS/SSL plan and rollback',
      'passwords, OTPs, API keys',
      'preliminary, non-binding proposal',
      'detailed versioned Scope of Work',
    ]) assert.ok(DELIVERY_SYSTEM_KNOWLEDGE.includes(required), `baseline must include: ${required}`)
  })
})
