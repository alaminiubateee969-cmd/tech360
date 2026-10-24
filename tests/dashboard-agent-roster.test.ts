/**
 * TECH360 — AI agent roster on the ADMIN and SUPER_ADMIN dashboards.
 *
 * Both roles see every registered AI agent (identity and status). The rest of
 * the workforce surface (system prompts, tool and data permissions, memory,
 * run controls) stays SUPER_ADMIN only. These checks are static so they run
 * in CI without a database or a browser.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { hasRole } from '../src/lib/access-policy'
import { AI_WORKFORCE_MIN_ROLE } from '../src/lib/ai-workforce-policy'

const ROOT = join(import.meta.dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const route = read('src/app/api/admin/dashboard/route.ts')
const view = read('src/components/admin/DashboardView.tsx')
const adminApp = read('src/components/admin/AdminApp.tsx')

describe('dashboard roster: who receives it', () => {
  it('ADMIN and SUPER_ADMIN pass the roster gate; STAFF, MANAGER and FINANCE do not', () => {
    for (const role of ['ADMIN', 'SUPER_ADMIN']) assert.equal(hasRole({ role }, 'ADMIN'), true, role)
    for (const role of ['STAFF', 'MANAGER', 'FINANCE', 'SALES', 'SUPPORT']) {
      assert.equal(hasRole({ role }, 'ADMIN'), false, `${role} must not receive the roster`)
    }
  })

  it('the dashboard route gates the roster with hasRole(…, ADMIN)', () => {
    assert.match(route, /hasRole\(g\.user, 'ADMIN'\)\s*\?\s*await db\.aiAgent\.findMany/)
  })

  it('the view renders the roster for ADMIN and SUPER_ADMIN only', () => {
    assert.match(view, /canSeeRoster = role === 'ADMIN' \|\| role === 'SUPER_ADMIN'/)
    assert.match(view, /\{canSeeRoster \? <AgentRosterCard/)
  })

  it('AdminApp passes the signed-in role to the dashboard', () => {
    assert.match(adminApp, /<DashboardView role=\{userRole\}/)
  })
})

describe('dashboard roster: what it exposes', () => {
  const select = route.slice(route.indexOf('db.aiAgent.findMany'), route.indexOf('})\n    : null', route.indexOf('db.aiAgent.findMany')))

  it('selects identity and status fields only', () => {
    for (const field of ['code', 'name', 'title', 'status', 'level', 'executionCount', 'department']) {
      assert.ok(select.includes(field), `roster must include ${field}`)
    }
  })

  it('never selects or returns prompts, tools, permissions, purpose or memory', () => {
    assert.ok(route.indexOf('aiAgents: aiAgents') > 0, 'roster must be returned under aiAgents')
    for (const secret of ['systemPrompt', 'tools', 'permissions', 'purpose', 'tokensToday', 'memory']) {
      assert.equal(new RegExp(`\\b${secret}\\b`).test(select), false, `${secret} must not be selected`)
      assert.equal(new RegExp(`\\b${secret}:`).test(route.slice(route.indexOf('aiAgents: aiAgents'))), false, `${secret} must not be returned`)
    }
  })

  it('the ops status card stays SUPER_ADMIN only (ops-status is a SUPER_ADMIN route)', () => {
    assert.equal(AI_WORKFORCE_MIN_ROLE, 'SUPER_ADMIN')
    assert.match(view, /\{isSuperAdmin \? <AiOpsCard loading=\{loading\} \/> : null\}/)
  })

  it('the "Open AI Workforce" action is SUPER_ADMIN only', () => {
    assert.match(view, /isSuperAdmin \? <Button size="sm" variant="outline" onClick=\{\(\) => onNavigate\('agents'\)\}>/)
  })
})
