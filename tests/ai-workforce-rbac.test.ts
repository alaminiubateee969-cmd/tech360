/**
 * TECH360 — AI Employee workforce security tests.
 *
 * The workforce is an internal system: registry, prompts, memory, execution
 * history, failures, knowledge and workflow definitions are Super Admin only.
 *
 * These tests are deliberately static/unit level so they run in CI without a
 * live server. The route test walks the real filesystem, so a NEW route added
 * under a protected prefix fails the build unless it declares the policy —
 * which is the regression this suite exists to prevent.
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { hasRole, isSuperAdmin } from '../src/lib/access-policy'
import {
  AI_WORKFORCE_API_PREFIXES,
  AI_WORKFORCE_MIN_ROLE,
  AI_WORKFORCE_VIEWS,
  agentMayAccessClient,
  authorizeAgentTool,
  isAiWorkforcePath,
  isAiWorkforceView,
  PRIVILEGED_AGENT_TOOLS,
} from '../src/lib/ai-workforce-policy'

const user = (role: string) => ({ role })
const ROOT = join(import.meta.dirname, '..')

function routeFiles(dir: string): string[] {
  let out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    const full = join(dir, e)
    if (statSync(full).isDirectory()) out = out.concat(routeFiles(full))
    else if (e === 'route.ts') out.push(full)
  }
  return out
}

describe('AI workforce: every protected route is SUPER_ADMIN only', () => {
  const protectedDirs = AI_WORKFORCE_API_PREFIXES.map((p) =>
    join(ROOT, 'src/app', p.replace(/^\/api/, 'api')),
  )
  const files = protectedDirs.flatMap(routeFiles)

  it('finds the protected route files', () => {
    assert.ok(files.length >= 15, `expected the workforce surface, found ${files.length} routes`)
  })

  for (const file of files) {
    const rel = file.slice(ROOT.length + 1)
    it(`${rel} requires SUPER_ADMIN`, () => {
      const src = readFileSync(file, 'utf8')
      const guards = src.match(/guard\(\s*req\s*(?:,\s*\{[\s\S]*?\})?\s*\)/g) ?? []
      assert.ok(guards.length > 0, `${rel} does not call guard() at all`)
      for (const g of guards) {
        const declaresPolicy =
          g.includes('AI_WORKFORCE_MIN_ROLE') || g.includes("minRole: 'SUPER_ADMIN'")
        assert.ok(
          declaresPolicy,
          `${rel} has a guard without SUPER_ADMIN — AI Employee internals would leak:\n${g}`,
        )
      }
    })
  }
})

describe('AI workforce: no non-SUPER_ADMIN role can reach the workforce', () => {
  it('denies CLIENT, STAFF, MANAGER and ADMIN', () => {
    for (const role of ['CLIENT', 'GUEST', 'STAFF', 'MANAGER', 'ADMIN', 'PROJECT_MEMBER']) {
      assert.equal(
        hasRole(user(role), AI_WORKFORCE_MIN_ROLE),
        false,
        `${role} must not reach the AI Employee command center`,
      )
    }
  })

  it('allows only SUPER_ADMIN', () => {
    assert.equal(hasRole(user('SUPER_ADMIN'), AI_WORKFORCE_MIN_ROLE), true)
    assert.equal(isSuperAdmin(user('SUPER_ADMIN')), true)
  })

  it('denies anonymous requests', () => {
    assert.equal(hasRole(null, AI_WORKFORCE_MIN_ROLE), false)
    assert.equal(isSuperAdmin(null), false)
  })
})

describe('AI workforce: surface classification', () => {
  it('recognises agent, memory, log, knowledge and workflow paths', () => {
    for (const p of [
      '/api/admin/agents',
      '/api/admin/agents/CEO-001',
      '/api/admin/agents/CEO-001/run',
      '/api/admin/memory',
      '/api/admin/logs/audit',
      '/api/admin/logs/automation/abc/retry',
      '/api/admin/knowledge/search',
      '/api/admin/n8n/W01_LEAD_INTAKE/download',
      '/api/admin/command',
      '/api/admin/ops-status',
    ]) {
      assert.equal(isAiWorkforcePath(p), true, `${p} must be treated as workforce-internal`)
    }
  })

  it('does not over-claim ordinary business endpoints', () => {
    for (const p of [
      '/api/admin/clients',
      '/api/admin/projects',
      '/api/admin/invoices/INV-2026-0001',
      '/api/health',
      '/api/portal/review/withdraw',
    ]) {
      assert.equal(isAiWorkforcePath(p), false, `${p} must not be swept into the workforce policy`)
    }
  })

  it('does not match a prefix by accident', () => {
    assert.equal(isAiWorkforcePath('/api/admin/agentsomething'), false)
    assert.equal(isAiWorkforcePath('/api/admin/logsx'), false)
  })

  it('classifies admin views', () => {
    for (const v of AI_WORKFORCE_VIEWS) assert.equal(isAiWorkforceView(v), true)
    for (const v of ['dashboard', 'clients', 'projects', 'blog']) {
      assert.equal(isAiWorkforceView(v), false)
    }
  })
})

describe('AI workforce: least-privilege tool permissions', () => {
  const active = (perms: string[]) => ({ status: 'ACTIVE', permissions: JSON.stringify(perms) })

  it('grants nothing by default', () => {
    assert.deepEqual(authorizeAgentTool(active([]), 'READ_CRM'), {
      allowed: false,
      code: 'TOOL_NOT_GRANTED',
    })
  })

  it('grants only what is explicitly listed', () => {
    const a = active(['READ_CRM', 'CREATE_TASK'])
    assert.deepEqual(authorizeAgentTool(a, 'READ_CRM'), { allowed: true })
    assert.deepEqual(authorizeAgentTool(a, 'CREATE_TASK'), { allowed: true })
    assert.deepEqual(authorizeAgentTool(a, 'SEND_EMAIL'), {
      allowed: false,
      code: 'TOOL_NOT_GRANTED',
    })
  })

  it('a disabled agent can never invoke a tool it holds', () => {
    for (const status of ['PAUSED', 'RETIRED', 'DISABLED']) {
      assert.deepEqual(
        authorizeAgentTool({ status, permissions: JSON.stringify(['READ_CRM']) }, 'READ_CRM'),
        { allowed: false, code: 'AGENT_DISABLED' },
      )
    }
  })

  it('rejects unknown tools', () => {
    assert.deepEqual(authorizeAgentTool(active(['DROP_DATABASE']), 'DROP_DATABASE'), {
      allowed: false,
      code: 'UNKNOWN_TOOL',
    })
  })

  it('a wildcard never covers money or asset transfer', () => {
    const wild = active(['*'])
    for (const tool of PRIVILEGED_AGENT_TOOLS) {
      assert.deepEqual(
        authorizeAgentTool(wild, tool),
        { allowed: false, code: 'TOOL_NOT_GRANTED' },
        `wildcard must not grant ${tool}`,
      )
    }
    assert.deepEqual(authorizeAgentTool(wild, 'READ_CRM'), { allowed: true })
  })

  it('malformed permission data grants nothing', () => {
    for (const perms of ['not json', '{}', '', null, undefined]) {
      assert.deepEqual(
        authorizeAgentTool({ status: 'ACTIVE', permissions: perms as string | null }, 'READ_CRM'),
        { allowed: false, code: 'TOOL_NOT_GRANTED' },
      )
    }
  })
})

describe('AI workforce: client/tenant isolation', () => {
  const agent = (perms: string[]) => ({ permissions: JSON.stringify(perms) })

  it('an agent acting for client A cannot read client B', () => {
    assert.equal(agentMayAccessClient(agent([]), 'client-a', 'client-b'), false)
  })

  it('an agent may read the client it is acting for', () => {
    assert.equal(agentMayAccessClient(agent([]), 'client-a', 'client-a'), true)
  })

  it('company-level records are not client-scoped', () => {
    assert.equal(agentMayAccessClient(agent([]), 'client-a', null), true)
  })

  it('cross-client access requires an explicit system grant', () => {
    assert.equal(agentMayAccessClient(agent(['CROSS_CLIENT_READ']), 'client-a', 'client-b'), true)
  })

  it('an unscoped agent still cannot reach an arbitrary client', () => {
    assert.equal(agentMayAccessClient(agent([]), null, 'client-b'), false)
  })
})
