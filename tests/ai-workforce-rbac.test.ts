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
  AGENT_TOOLS,
  CAPABILITY_ALL,
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

describe('AI workforce: capability vocabulary matches the real registry', () => {
  const registry = readFileSync(join(ROOT, 'src/lib/agents/registry.ts'), 'utf8')

  function declared(field: string): Set<string> {
    const out = new Set<string>()
    for (const m of registry.matchAll(new RegExp(`${field}:\\s*\\[([^\\]]*)\\]`, 'g'))) {
      for (const t of m[1].matchAll(/'([^']+)'/g)) out.add(t[1])
    }
    return out
  }

  it('every tool a seeded agent carries is a known capability', () => {
    const known = new Set<string>(AGENT_TOOLS)
    const unknown = [...declared('tools')].filter((t) => !known.has(t))
    assert.deepEqual(unknown, [], `registry tools missing from AGENT_TOOLS: ${unknown.join(', ')}`)
  })

  it('the policy declares no capability the product does not use', () => {
    const used = declared('tools')
    const stale = AGENT_TOOLS.filter((t) => !used.has(t))
    assert.deepEqual(stale, [], `AGENT_TOOLS lists tools no agent has: ${stale.join(', ')}`)
  })

  it('every privileged tool is a real capability', () => {
    const known = new Set<string>(AGENT_TOOLS)
    for (const t of PRIVILEGED_AGENT_TOOLS) assert.ok(known.has(t), `${t} is not a real tool`)
  })
})

describe('AI workforce: canonical department and agent counts', () => {
  const registry = readFileSync(join(ROOT, 'src/lib/agents/registry.ts'), 'utf8')

  function entries(name: string): string[] {
    const m = new RegExp(`export const ${name}[^=]*=\\s*\\[`).exec(registry)
    assert.ok(m, `${name} not found`)
    let i = m!.index + m![0].length
    let depth = 1
    const start = i
    while (depth > 0 && i < registry.length) {
      const c = registry[i]
      if (c === '[') depth++
      else if (c === ']') depth--
      i++
    }
    const body = registry.slice(start, i - 1)
    const out: string[] = []
    let d = 0
    let st = -1
    for (let k = 0; k < body.length; k++) {
      const c = body[k]
      if (c === '{') { if (d === 0) st = k; d++ }
      else if (c === '}') { d--; if (d === 0) out.push(body.slice(st, k + 1)) }
    }
    return out
  }
  const code = (o: string) => /code:\s*'([^']+)'/.exec(o)?.[1] ?? ''

  const depts = entries('DEPARTMENTS').map(code)
  const agents = entries('CORE_AGENTS')

  it('there are exactly 110 departments (NOT 84 — that grep missed 26 hex codes)', () => {
    assert.equal(depts.length, 110)
    assert.equal(new Set(depts).size, 110, 'department codes must be unique')
    const hex = depts.filter((c) => /[A-F]/.test(c.slice(1)))
    assert.equal(hex.length, 26, 'the 26 hex-lettered codes a D[0-9]+ grep misses')
    assert.equal(depts.length - hex.length, 84, 'which is why the old count said 84')
  })

  it('there are exactly 44 core agents', () => {
    assert.equal(agents.length, 44)
    assert.equal(new Set(agents.map(code)).size, 44)
  })

  it('no agent points at a department that does not exist', () => {
    const known = new Set(depts)
    const orphans = agents
      .map((o) => ({ agent: code(o), dept: /dept:\s*'([^']+)'/.exec(o)?.[1] ?? '' }))
      .filter((a) => !known.has(a.dept))
    assert.deepEqual(orphans, [], `orphan department references: ${JSON.stringify(orphans)}`)
  })
})

describe('AI workforce: least-privilege tool permissions', () => {
  const active = (tools: string[]) => ({ status: 'ACTIVE', tools: JSON.stringify(tools) })

  it('grants nothing by default', () => {
    assert.deepEqual(authorizeAgentTool(active([]), 'crm.query'), {
      allowed: false,
      code: 'TOOL_NOT_GRANTED',
    })
  })

  it('grants only what is explicitly listed', () => {
    const a = active(['crm.query', 'task.create'])
    assert.deepEqual(authorizeAgentTool(a, 'crm.query'), { allowed: true })
    assert.deepEqual(authorizeAgentTool(a, 'task.create'), { allowed: true })
    assert.deepEqual(authorizeAgentTool(a, 'email.send'), {
      allowed: false,
      code: 'TOOL_NOT_GRANTED',
    })
  })

  it('a disabled agent can never invoke a tool it holds', () => {
    for (const status of ['PAUSED', 'RETIRED', 'DISABLED']) {
      assert.deepEqual(
        authorizeAgentTool({ status, tools: JSON.stringify(['crm.query']) }, 'crm.query'),
        { allowed: false, code: 'AGENT_DISABLED' },
      )
    }
  })

  it('rejects unknown tools', () => {
    assert.deepEqual(authorizeAgentTool(active(['db.drop']), 'db.drop'), {
      allowed: false,
      code: 'UNKNOWN_TOOL',
    })
  })

  it('capability:all never covers money, assets or outbound messaging', () => {
    const wild = active([CAPABILITY_ALL])
    for (const tool of PRIVILEGED_AGENT_TOOLS) {
      assert.deepEqual(
        authorizeAgentTool(wild, tool),
        { allowed: false, code: 'TOOL_NOT_GRANTED' },
        `capability:all must not grant ${tool}`,
      )
    }
    assert.deepEqual(authorizeAgentTool(wild, 'crm.query'), { allowed: true })
  })

  it('an explicit grant still works for privileged tools', () => {
    assert.deepEqual(authorizeAgentTool(active(['payment.verify']), 'payment.verify'), {
      allowed: true,
    })
  })

  it('malformed tool data grants nothing', () => {
    for (const tools of ['not json', '{}', '', null, undefined]) {
      assert.deepEqual(
        authorizeAgentTool({ status: 'ACTIVE', tools: tools as string | null }, 'crm.query'),
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
    assert.equal(agentMayAccessClient(agent(['read:all']), 'client-a', 'client-b'), true)
  })

  it('an unscoped agent still cannot reach an arbitrary client', () => {
    assert.equal(agentMayAccessClient(agent([]), null, 'client-b'), false)
  })
})
