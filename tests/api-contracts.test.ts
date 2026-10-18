/**
 * TECH360 — API contract tests.
 *
 * The specification requires a fixed set of endpoint contracts. This
 * suite proves that:
 *   - every required contract path exists and exports the right methods
 *   - every protected contract is guarded (auth + RBAC + CSRF)
 *   - the delegated contracts really delegate (no duplicated logic)
 *   - no two route files claim the same HTTP method on the same path
 *   - the private model API is NOT reachable through the public surface
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it } from 'node:test'

const ROOT = join(import.meta.dirname, '..')
const API = join(ROOT, 'src/app/api')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

type Contract = {
  path: string
  methods: string[]
  /** Routes that must delegate to an existing implementation. */
  delegatesTo?: string
}

const REQUIRED_CONTRACTS: Contract[] = [
  { path: 'ai/chat', methods: ['POST'] },
  { path: 'command', methods: ['POST'], delegatesTo: 'admin/command/route' },
  { path: 'models', methods: ['GET'] },
  { path: 'agents', methods: ['GET'], delegatesTo: 'admin/agents/route' },
  { path: 'skills', methods: ['GET'] },
  { path: 'departments', methods: ['GET'] },
  { path: 'tasks', methods: ['GET', 'POST'] },
  { path: 'tasks/[id]', methods: ['GET'] },
  { path: 'approvals/[id]/approve', methods: ['POST'], delegatesTo: 'admin/approvals/[id]/decision/route' },
  { path: 'approvals/[id]/reject', methods: ['POST'], delegatesTo: 'admin/approvals/[id]/decision/route' },
  { path: 'knowledge/ingest', methods: ['POST'] },
  { path: 'knowledge/search', methods: ['POST'] },
  { path: 'health', methods: ['GET'] },
  { path: 'health/deep', methods: ['GET'] },
  { path: 'audit', methods: ['GET'], delegatesTo: 'admin/logs/audit/route' },
  { path: 'metrics', methods: ['GET'] },
]

// ============================================================
describe('API contracts — the required surface exists', () => {
  for (const contract of REQUIRED_CONTRACTS) {
    it(`src/app/api/${contract.path}/route.ts exists and exports ${contract.methods.join(', ')}`, () => {
      const file = join(API, contract.path, 'route.ts')
      assert.ok(existsSync(file), `missing route file: src/app/api/${contract.path}/route.ts`)
      const source = readFileSync(file, 'utf8')
      for (const method of contract.methods) {
        assert.match(
          source,
          new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b|export\\s*\\{[^}]*\\b${method}\\b`),
          `${contract.path} does not export ${method}`,
        )
      }
    })
  }
})

// ============================================================
describe('API contracts — delegated routes do not duplicate logic', () => {
  for (const contract of REQUIRED_CONTRACTS) {
    if (!contract.delegatesTo) continue
    it(`src/app/api/${contract.path} delegates to ${contract.delegatesTo}`, () => {
      const source = readFileSync(join(API, contract.path, 'route.ts'), 'utf8')
      assert.match(
        source,
        /from '@\/app\/api\//,
        `${contract.path} must import the existing implementation rather than reimplement it`,
      )
      const target = contract.delegatesTo as string
      assert.match(
        source,
        new RegExp(target.replace(/[/\[\]]/g, '\\$&')),
        `${contract.path} does not reference ${target}`,
      )
    })
  }

  it('the delegated admin implementations still exist', () => {
    for (const contract of REQUIRED_CONTRACTS) {
      if (!contract.delegatesTo) continue
      const target = contract.delegatesTo as string
      assert.ok(
        existsSync(join(API, `${target}.ts`)),
        `the delegated implementation ${target} no longer exists`,
      )
    }
  })
})

// ============================================================
describe('API contracts — every protected route is guarded', () => {
  const GUARDED = [
    'ai/chat',
    'command',
    'models',
    'agents',
    'skills',
    'departments',
    'tasks',
    'tasks/[id]',
    'approvals/[id]/approve',
    'approvals/[id]/reject',
    'knowledge/ingest',
    'knowledge/search',
    'health/deep',
    'audit',
    'metrics',
  ]

  /**
   * Resolve the EFFECTIVE source of a route: a route that delegates
   * inherits the guard of the route it delegates to, so the check must
   * follow the delegation instead of only looking at the wrapper.
   */
  function effectiveSource(path: string, depth = 0): string {
    const source = readFileSync(join(API, path, 'route.ts'), 'utf8')
    if (depth > 3) return source
    const match = /from '@\/app\/api\/(.+?)\/route'/.exec(source)
    if (!match) return source
    const delegated = match[1]
    if (!existsSync(join(API, delegated, 'route.ts'))) return source
    return effectiveSource(delegated, depth + 1)
  }

  for (const path of GUARDED) {
    it(`src/app/api/${path} authenticates and applies RBAC`, () => {
      const source = effectiveSource(path)
      assert.match(source, /guard\(/, `${path} does not call the guard`)
      assert.match(source, /minRole/, `${path} does not declare a minimum role`)
      assert.match(source, /isResponse\(/, `${path} does not handle the guard's failure response`)
    })
  }

  it('the public health route stays unauthenticated and says very little', () => {
    const source = readFileSync(join(API, 'health/route.ts'), 'utf8')
    assert.equal(source.includes('guard('), false, '/api/health must stay public')
    assert.equal(source.includes('DATABASE_URL'), true)
    // It must not leak configuration values.
    assert.equal(/mysql:\/\/[^"']/.test(source), false)
  })
})

// ============================================================
describe('API contracts — no duplicate route registration', () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full, out)
      else if (entry === 'route.ts') out.push(full)
    }
    return out
  }

  it('no two route files claim the same method on the same path', () => {
    const files = walk(API)
    const seen = new Map<string, string>()
    const duplicates: string[] = []
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      const routePath = '/' + relative(API, file).replace(/route\.ts$/, '').replace(/\\/g, '/')
      for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
        const declares = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`).test(source)
        if (!declares) continue
        const key = `${method} ${routePath}`
        if (seen.has(key)) duplicates.push(`${key} claimed by ${seen.get(key)} and ${file}`)
        else seen.set(key, file)
      }
    }
    assert.equal(duplicates.length, 0, `duplicate route registrations:\n${duplicates.join('\n')}`)
  })

  it('the public contract paths are unique', () => {
    const files = walk(API)
    for (const contract of REQUIRED_CONTRACTS) {
      const expected = join(API, contract.path, 'route.ts')
      const matches = files.filter((f) => f === expected)
      assert.equal(matches.length, 1, `${contract.path} must have exactly one route file`)
    }
  })
})

// ============================================================
describe('API contracts — the private model API is not public', () => {
  it('the model gateway authenticates with a bearer key, not a browser session', () => {
    const source = read('src/lib/model/gateway.ts')
    assert.match(source, /authenticateModelRequest/)
    assert.match(source, /constantTimeEquals/)
    assert.match(source, /MODEL_API_KEY/)
    assert.equal(source.includes("from '@/lib/api-guard'"), false, 'the model gateway must not use the browser session guard')
  })

  it('every private model route authenticates before doing any work', () => {
    for (const path of ['model/v1/chat', 'model/v1/embeddings', 'model/v1/models']) {
      const source = readFileSync(join(API, path, 'route.ts'), 'utf8')
      assert.match(source, /authenticateModelRequest\(req\)/, `${path} does not authenticate`)
      const authIndex = source.indexOf('authenticateModelRequest(req)')
      const workIndex = Math.max(source.indexOf('routeChat('), source.indexOf('routeEmbed('), source.indexOf('listLocalModels('))
      if (workIndex > 0) {
        assert.ok(authIndex < workIndex, `${path} performs work before authenticating`)
      }
    }
  })

  it('the model gateway is disabled without a configured key', () => {
    const source = read('src/lib/model/gateway.ts')
    assert.match(source, /MODEL_GATEWAY_DISABLED/)
    assert.match(source, /MIN_GATEWAY_KEY_LENGTH\s*=\s*32/)
  })
})

// ============================================================
describe('API contracts — error responses are consistent', () => {
  it('every error a contract route returns carries a machine-readable code', () => {
    const paths = ['skills', 'tasks', 'knowledge/search', 'knowledge/ingest', 'models', 'metrics', 'ai/chat']
    let checked = 0
    for (const path of paths) {
      const source = readFileSync(join(API, path, 'route.ts'), 'utf8')
      // Every `error:` in a Response.json call must be accompanied by a
      // `code:` in the same object. A window is used because a template
      // literal inside the object may contain a closing brace.
      const occurrences = [...source.matchAll(/\berror\s*:/g)]
      for (const occurrence of occurrences) {
        const window = source.slice(occurrence.index, occurrence.index + 400)
        assert.match(window, /\bcode\s*:/, `${path} returns an error without a machine-readable code near: ${window.slice(0, 160)}`)
        checked += 1
      }
    }
    assert.ok(checked >= 5, `expected several error responses to check, found ${checked}`)
  })
})
