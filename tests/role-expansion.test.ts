import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ROLES, ROLE_RANK } from '../src/lib/constants'
import { ROLE_CAPABILITIES, hasCapability, hasRole, isValidRole } from '../src/lib/access-policy'

describe('MARKETING and DESIGNER roles', () => {
  it('are registered, valid and ranked at staff level', () => {
    for (const role of ['MARKETING', 'DESIGNER'] as const) {
      assert.ok((ROLES as readonly string[]).includes(role), `${role} must be in ROLES`)
      assert.equal(isValidRole(role), true)
      assert.equal(ROLE_RANK[role], 1)
    }
  })

  it('cannot reach admin-level console surfaces', () => {
    for (const role of ['MARKETING', 'DESIGNER']) {
      const user = { role }
      assert.equal(hasRole(user, 'ADMIN'), false, `${role} must not satisfy minRole ADMIN`)
      assert.equal(hasRole(user, 'SUPER_ADMIN'), false)
      assert.equal(hasRole(user, 'MANAGER'), false)
    }
  })

  it('MARKETING can work the CRM but has no finance, scope approval or handover powers', () => {
    const user = { role: 'MARKETING' }
    assert.equal(hasCapability(user, 'crm.read'), true)
    assert.equal(hasCapability(user, 'crm.write'), true)
    assert.equal(hasCapability(user, 'comms.send'), true)
    for (const capability of [
      'finance.read',
      'finance.invoice.write',
      'finance.payment.record',
      'finance.payment.verify',
      'finance.refund.decide',
      'scope.approve',
      'handover.release',
      'team.manage',
      'settings.manage',
      'audit.read',
      'crm.merge',
    ] as const) {
      assert.equal(hasCapability(user, capability), false, `MARKETING must not hold ${capability}`)
    }
  })

  it('DESIGNER can manage previews and read projects but cannot write CRM or touch money', () => {
    const user = { role: 'DESIGNER' }
    assert.equal(hasCapability(user, 'preview.manage'), true)
    assert.equal(hasCapability(user, 'project.read'), true)
    assert.equal(hasCapability(user, 'crm.read'), true)
    for (const capability of [
      'crm.write',
      'comms.send',
      'scope.write',
      'scope.approve',
      'delivery.prepare',
      'handover.release',
      'finance.read',
      'finance.payment.verify',
      'team.manage',
      'settings.manage',
    ] as const) {
      assert.equal(hasCapability(user, capability), false, `DESIGNER must not hold ${capability}`)
    }
  })

  it('keeps SUPER_ADMIN as the only holder of governance capabilities', () => {
    const exclusive = ['finance.payment.verify', 'finance.refund.decide', 'handover.release', 'team.manage', 'settings.manage'] as const
    for (const capability of exclusive) {
      const holders = (Object.keys(ROLE_CAPABILITIES) as Array<keyof typeof ROLE_CAPABILITIES>).filter((role) =>
        ROLE_CAPABILITIES[role].has(capability),
      )
      assert.deepEqual(holders, ['SUPER_ADMIN'], `${capability} must be SUPER_ADMIN-only, found ${holders.join(',')}`)
    }
  })
})
