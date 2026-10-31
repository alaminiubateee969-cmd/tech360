import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { canAccessAdminView, VIEW_MIN_ROLE } from '../src/lib/admin-view-policy'
import { AI_OPERATOR_MIN_ROLE, AI_WORKFORCE_MIN_ROLE } from '../src/lib/ai-workforce-policy'

describe('Admin / Super Admin console access', () => {
  it('both operator roles can open agents and commands', () => {
    for (const role of ['ADMIN', 'SUPER_ADMIN']) {
      for (const view of ['dashboard', 'agents', 'command']) assert.equal(canAccessAdminView(role, view), true, `${role}: ${view}`)
    }
    assert.equal(VIEW_MIN_ROLE.agents, AI_OPERATOR_MIN_ROLE)
    assert.equal(VIEW_MIN_ROLE.command, AI_OPERATOR_MIN_ROLE)
  })

  it('does not promote Admin to infrastructure or governance', () => {
    for (const view of ['settings', 'team', 'models', 'logs', 'memory', 'knowledge', 'workforce', 'dcc', 'ops', 'backup', 'integrations']) {
      assert.equal(canAccessAdminView('ADMIN', view), false, view)
      assert.equal(canAccessAdminView('SUPER_ADMIN', view), true, view)
      assert.equal(VIEW_MIN_ROLE[view], AI_WORKFORCE_MIN_ROLE)
    }
  })

  it('denies workforce access to lower-rank and unknown roles', () => {
    for (const role of [undefined, null, '', 'STAFF', 'MANAGER', 'SALES', 'SUPPORT', 'FINANCE', 'PROJECT_MANAGER', 'DEVELOPER', 'AUDITOR', 'CLIENT', 'made-up-role', '__proto__', 'constructor']) {
      for (const view of ['agents', 'command', 'settings']) assert.equal(canAccessAdminView(role, view), false, `${role}: ${view}`)
    }
  })

  it('preserves specialized role restrictions and rejects unknown views', () => {
    assert.equal(canAccessAdminView('FINANCE', 'payments'), true)
    assert.equal(canAccessAdminView('FINANCE', 'projects'), false)
    assert.equal(canAccessAdminView('AUDITOR', 'payments'), true)
    assert.equal(canAccessAdminView('AUDITOR', 'command'), false)
    assert.equal(canAccessAdminView('DEVELOPER', 'projects'), true)
    assert.equal(canAccessAdminView('DEVELOPER', 'payments'), false)
    assert.equal(canAccessAdminView('SUPER_ADMIN', 'toString'), false)
    assert.equal(canAccessAdminView('SUPER_ADMIN', 'unknown-view'), false)
  })

  it('sidebar, module directory and navigation use the same policy', () => {
    const app = readFileSync('src/components/admin/AdminApp.tsx', 'utf8')
    const dashboard = readFileSync('src/components/admin/DashboardView.tsx', 'utf8')
    assert.match(app, /canAccessAdminView\(me\?\.role, v\)/)
    assert.match(app, /canAccessAdminView\(userRole, id\)/)
    assert.match(dashboard, /canAccessAdminView\(role, m\.id\)/)
    assert.match(app, /view === 'settings' && canAccessView\('settings'\)/)
  })

  it('friendly dashboard aliases lead to the authenticated hash console', () => {
    const config = readFileSync('next.config.ts', 'utf8')
    assert.match(config, /source: "\/admin", destination: "\/#\/admin"/)
    assert.match(config, /source: "\/super-admin", destination: "\/#\/admin"/)
  })
})
