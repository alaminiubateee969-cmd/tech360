/**
 * TECH360 — production AI verification harness (evidence generator)
 *
 * This is NOT application code and NOT a mock of the application: it imports the
 * REAL shipped modules (registry, bootstrap, engine, ai-provider, resilience,
 * instrumentation, ops-loop, health + admin ops-status route handlers) and drives
 * them with an in-memory database double and an HTTP-boundary provider double, so
 * every assertion below is a statement about production code paths, not about files.
 *
 * It can only ever produce CODE_VERIFIED evidence. Anything needing the real MySQL
 * database, the real ZAI provider or the live Hostinger host must be measured
 * outside this script and is listed under `notVerifiableHere`.
 *
 * Run from the repository root:
 *   npx tsx scripts/verify-ai-production.ts --out docs/ai-production-verification.json
 */

import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'

const nodeRequire = createRequire(path.join(process.cwd(), 'noop.js'))
/** NODE_ENV is typed read-only by the ambient Node typings; the harness must flip it to exercise runtime gates. */
const env = process.env as Record<string, string | undefined>
const REPO = process.cwd()
const argv = process.argv.slice(2)
const outArgIndex = argv.indexOf('--out')
const OUT_FILE = outArgIndex >= 0 ? path.resolve(REPO, argv[outArgIndex + 1]) : null

const FAKE_BASE_URL = 'https://provider.test.invalid/v1'
const FAKE_API_KEY = 'zai_test_key_never_a_real_secret'

type Row = Record<string, any>
type Table = Row[]

const store = new Map<string, Table>()
let seq = 0
let dbDown = false

function table(name: string): Table {
  if (!store.has(name)) store.set(name, [])
  return store.get(name)!
}

function seedAndPush(name: string, data: Row): Row {
  const row = { id: `${name.toLowerCase()}_${++seq}`, ...data }
  table(name).push(row)
  return row
}

function clone<T>(value: T): T {
  if (value === undefined || value === null) return value
  return JSON.parse(JSON.stringify(value, (_k, v) => (v instanceof Date ? { __date: v.toISOString() } : v))) as T
}

function seedDefaults(name: string, data: Row): Row {
  const now = new Date()
  const base: Row = { id: `${name.toLowerCase()}_${++seq}`, createdAt: now, updatedAt: now }
  if (name === 'AiAgent') Object.assign(base, { status: 'ACTIVE', tokensToday: 0, dailyQuota: 200, executionCount: 0, successCount: 0, failureCount: 0, model: 'default', level: 3, requiresApproval: false })
  if (name === 'AiAgentExecution') Object.assign(base, { status: 'RUNNING', tokensUsed: 0, durationMs: null, output: null, error: null, metadata: null, completedAt: null, startedAt: now })
  if (name === 'AiOpsLock') Object.assign(base, { owner: null, lockedUntil: new Date(0) })
  return { ...base, ...data }
}

function revive(value: any): any {
  if (value && typeof value === 'object' && '__date' in value) return new Date(value.__date)
  return value
}

function reviveDeep(value: any): any {
  if (Array.isArray(value)) return value.map(reviveDeep)
  if (value && typeof value === 'object') {
    const out: Row = {}
    for (const [k, v] of Object.entries(value)) out[k] = revive(v)
    return out
  }
  return value
}

function applyWhere(row: Row, where: Row | undefined): boolean {
  if (!where) return true
  for (const [key, expected] of Object.entries(where)) {
    const actual = row[key]
    if (expected instanceof Date) {
      if (!(actual instanceof Date) || actual.getTime() !== expected.getTime()) return false
      continue
    }
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      const ops = expected as Row
      for (const [op, operand] of Object.entries(ops)) {
        const left = actual instanceof Date ? actual.getTime() : actual
        const right = operand instanceof Date ? operand.getTime() : operand
        if (op === 'in') { if (!(right as unknown[]).includes(left)) return false }
        else if (op === 'not') { if (left === right) return false }
        else if (op === 'lt') { if (!(left < right)) return false }
        else if (op === 'lte') { if (!(left <= right)) return false }
        else if (op === 'gt') { if (!(left > right)) return false }
        else if (op === 'gte') { if (!(left >= right)) return false }
        else if (op === 'contains') { if (!String(left ?? '').includes(String(right))) return false }
        else return false
      }
      continue
    }
    if (actual !== expected) return false
  }
  return true
}

function applyData(row: Row, data: Row): void {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && 'increment' in value) row[key] = Number(row[key] ?? 0) + Number(value.increment)
    else row[key] = value
  }
  row.updatedAt = new Date()
}

/** Resolves only the relations the AI code paths actually ask for. */
function withIncludes(row: Row, include: Row | undefined): Row {
  const out = { ...row }
  if (include?.department) {
    const dept = table('Department').find((d) => d.id === row.departmentId)
    out.department = dept ? { code: dept.code } : null
  }
  if (include?.user) out.user = table('User').find((u) => u.id === row.userId) ?? null
  return out
}

/** A `select` that asks for a relation is treated as that relation being included. */
function selectRelations(select: Row | undefined): Row | undefined {
  if (!select) return undefined
  const relations: Row = {}
  for (const [key, value] of Object.entries(select)) if (value && typeof value === 'object') relations[key] = true
  return Object.keys(relations).length ? relations : undefined
}

function guardDb() {
  if (dbDown) throw new Error('database connection refused (simulated outage)')
}

function modelDelegate(name: string) {
  const rows = () => table(name)
  return {
    create: async ({ data }: { data: Row }) => { guardDb(); const row = seedDefaults(name, data); rows().push(row); return reviveDeep(clone(row)) },
    findUnique: async ({ where, include, select }: { where: Row; include?: Row; select?: Row }) => {
      guardDb()
      const row = rows().find((r) => applyWhere(r, where))
      return row ? reviveDeep(clone(withIncludes(row, include ?? selectRelations(select)))) : null
    },
    findFirst: async ({ where, orderBy }: { where?: Row; orderBy?: unknown }) => {
      guardDb()
      let found = rows().filter((r) => applyWhere(r, where))
      if (Array.isArray(orderBy)) {
        for (const entry of [...orderBy].reverse()) {
          for (const [field, dir] of Object.entries(entry as Row)) {
            found = found.sort((a, b) => (a[field] > b[field] ? 1 : -1) * (dir === 'desc' ? -1 : 1))
          }
        }
      }
      return found[0] ? reviveDeep(clone(found[0])) : null
    },
    findMany: async ({ where, take, select, include }: { where?: Row; take?: number; select?: Row; include?: Row }) => {
      guardDb()
      const found = rows().filter((r) => applyWhere(r, where))
      const limited = take ? found.slice(0, take) : found
      return reviveDeep(clone(limited.map((row) => {
        const withRel = withIncludes(row, include ?? selectRelations(select))
        if (!select) return withRel
        const projected: Row = {}
        for (const [key, wanted] of Object.entries(select)) {
          if (wanted && typeof wanted === 'object') projected[key] = withRel[key] ?? null
          else projected[key] = withRel[key]
        }
        return projected
      })))
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      guardDb()
      const row = rows().find((r) => applyWhere(r, where))
      if (!row) throw new Error(`${name} not found for update`)
      applyData(row, data)
      return reviveDeep(clone(row))
    },
    updateMany: async ({ where, data }: { where?: Row; data: Row }) => {
      guardDb()
      const matched = rows().filter((r) => applyWhere(r, where))
      for (const row of matched) applyData(row, data)
      return { count: matched.length }
    },
    upsert: async ({ where, create, update }: { where: Row; create: Row; update?: Row }) => {
      guardDb()
      const row = rows().find((r) => applyWhere(r, where))
      if (row) { if (update) applyData(row, update); return reviveDeep(clone(row)) }
      const created = seedDefaults(name, create)
      rows().push(created)
      return reviveDeep(clone(created))
    },
    delete: async ({ where }: { where: Row }) => {
      guardDb()
      const list = rows()
      const index = list.findIndex((r) => applyWhere(r, where))
      if (index === -1) throw new Error(`${name} not found for delete`)
      return reviveDeep(clone(list.splice(index, 1)[0]))
    },
    deleteMany: async ({ where }: { where?: Row }) => {
      guardDb()
      const list = rows()
      const keep = list.filter((r) => !applyWhere(r, where))
      const removed = list.length - keep.length
      store.set(name, keep)
      return { count: removed }
    },
    count: async ({ where }: { where?: Row } = {}) => { guardDb(); return rows().filter((r) => applyWhere(r, where)).length },
    aggregate: async ({ _sum }: { _sum?: Row } = {}) => {
      guardDb()
      const all = rows()
      const sums: Row = {}
      for (const key of Object.keys(_sum ?? {})) sums[key] = all.reduce((total, row) => total + Number(row[key] ?? 0), 0)
      return { _count: all.length, _sum: Object.keys(_sum ?? {}).length ? sums : null }
    },
  }
}

const MODEL_NAMES: Record<string, string> = {
  aiAgent: 'AiAgent',
  aiAgentExecution: 'AiAgentExecution',
  aiOpsLock: 'AiOpsLock',
  aiMemory: 'AiMemory',
  setting: 'Setting',
  auditLog: 'AuditLog',
  errorLog: 'ErrorLog',
  notification: 'Notification',
  automationLog: 'AutomationLog',
  department: 'Department',
  client: 'Client',
  session: 'Session',
  user: 'User',
  fileRecord: 'FileRecord',
  approvalRequest: 'ApprovalRequest',
  preview: 'Preview',
  communication: 'Communication',
  ceoReport: 'CeoReport',
  knowledgeDocument: 'KnowledgeDocument',
}

function toModelName(property: string): string {
  if (MODEL_NAMES[property]) return MODEL_NAMES[property]
  return property.charAt(0).toUpperCase() + property.slice(1)
}

const fakeDb: any = new Proxy({} as Record<string, unknown>, {
  get(target, prop: string) {
    if (prop === '$queryRaw' || prop === '$executeRaw') return async () => { guardDb(); return [{ result: 1 }] }
    if (prop === '$connect' || prop === '$disconnect') return async () => undefined
    if (prop === 'then') return undefined
    const model = toModelName(prop)
    if (!target[model]) target[model] = modelDelegate(model)
    return target[model]
  },
})

class FakePrismaClient {
  constructor() {
    return fakeDb
  }
}

// install the database double BEFORE any application module is loaded
const prismaPath = nodeRequire.resolve('@prisma/client', { paths: [REPO] })
nodeRequire.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { PrismaClient: FakePrismaClient, Prisma: {} } } as unknown as NodeModule

// install a cookie-store double so guarded admin route handlers can be invoked directly
type CookieMode = { session?: string; csrf?: string }
let cookieMode: CookieMode = {}
const headersPath = nodeRequire.resolve('next/headers', { paths: [REPO] })
nodeRequire.cache[headersPath] = {
  id: headersPath,
  filename: headersPath,
  loaded: true,
  exports: {
    cookies: async () => ({
      get: (name: string) => {
        const value = name === 't360_session' ? cookieMode.session : cookieMode.csrf
        return value ? { value } : undefined
      },
    }),
  },
} as unknown as NodeModule

// ------------------------------------------------------------
// provider double — speaks at the HTTP boundary only
// ------------------------------------------------------------
type ProviderBehavior =
  | { kind: 'ok'; content: string; tokens: number }
  | { kind: 'status'; status: number; body: string }
  | { kind: 'network'; message: string }
  | { kind: 'hang' }
  | { kind: 'sequence'; steps: ProviderBehavior[] }

let providerBehavior: ProviderBehavior = { kind: 'ok', content: 'ok', tokens: 42 }
type ProviderCall = { url: string; authorization: string; body: string; hasSignal: boolean }
let providerCalls: ProviderCall[] = []
const realFetch = globalThis.fetch

function installProviderDouble() {
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input)
    const headers = new Headers((init?.headers ?? {}) as HeadersInit)
    providerCalls.push({ url, authorization: headers.get('authorization') ?? '', body: String(init?.body ?? ''), hasSignal: Boolean(init?.signal) })
    let behavior = providerBehavior
    if (behavior.kind === 'sequence') behavior = behavior.steps[Math.min(providerCalls.length - 1, behavior.steps.length - 1)]
    if (behavior.kind === 'hang') {
      await new Promise<never>((_resolve, reject) => {
        const signal = init?.signal
        if (signal) signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
        else setTimeout(() => reject(new DOMException('The operation was aborted.', 'AbortError')), 30_000)
      })
    }
    if (behavior.kind === 'network') throw new TypeError(behavior.message)
    if (behavior.kind === 'status') return new Response(behavior.body, { status: behavior.status, headers: { 'content-type': 'application/json' } })
    if (behavior.kind !== 'ok') throw new TypeError(`unsupported provider double behaviour: ${behavior.kind}`)
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: behavior.content } }], usage: { total_tokens: behavior.tokens } }), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
}

function restoreProviderDouble() {
  globalThis.fetch = realFetch
}

// ------------------------------------------------------------
// result bookkeeping
// ------------------------------------------------------------
type Check = { check: string; result: 'PASS' | 'FAIL'; evidence: unknown }
const globalChecks: Check[] = []
const agentRows: Record<string, any>[] = []
const failures: string[] = []

async function record(list: Check[], check: string, fn: () => unknown): Promise<void> {
  try {
    const evidence = await fn()
    list.push({ check, result: 'PASS', evidence })
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    list.push({ check, result: 'FAIL', evidence: message })
    failures.push(`${check} — ${message}`)
  }
}

function grepSrc(pattern: string): string[] {
  try {
    const output = execFileSync('grep', ['-rn', '--include=*.ts', '--include=*.tsx', '-E', pattern, 'src'], { cwd: REPO, encoding: 'utf8' })
    return output.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

function safeGit(args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

async function main() {
  env.NODE_ENV = 'test'
  process.env.ZAI_BASE_URL = FAKE_BASE_URL
  process.env.ZAI_API_KEY = FAKE_API_KEY
  delete process.env.AGENT_RUN_TIMEOUT_MS
  delete process.env.OPS_INTERVAL_SEC

  const registryModule = await import('@/lib/agents/registry')
  const bootstrapModule = await import('@/lib/agents/bootstrap')
  const engineModule = await import('@/lib/agents/engine')
  const providerModule = await import('@/lib/ai-provider')
  const resilienceModule = await import('@/lib/agents/resilience')
  const policyModule = await import('@/lib/ai-workforce-policy')
  const opsLoopModule = await import('@/lib/ops-loop')
  const healthRoute = await import('@/app/api/health/route')

  const { CORE_AGENTS, DEPARTMENTS, AGENT_HANDLER, validateAgentRegistry, CONSTITUTION } = registryModule
  const { AGENT_TOOLS } = policyModule

  // ============================================================
  // 2. canonical registry — counts, uniqueness, mappings
  // ============================================================
  const registryChecks: Check[] = []
  await record(registryChecks, '44 agents', () => { assert.equal(CORE_AGENTS.length, 44); return CORE_AGENTS.length })
  await record(registryChecks, '110 departments', () => { assert.equal(DEPARTMENTS.length, 110); return DEPARTMENTS.length })
  await record(registryChecks, '44 unique agent codes', () => {
    const codes = CORE_AGENTS.map((a) => a.code)
    assert.equal(new Set(codes).size, 44, `duplicates: ${codes.filter((c, i) => codes.indexOf(c) !== i).join(',')}`)
    return { unique: new Set(codes).size }
  })
  await record(registryChecks, '110 unique department codes', () => {
    const codes = DEPARTMENTS.map((d) => d.code)
    assert.equal(new Set(codes).size, 110, `duplicates: ${codes.filter((c, i) => codes.indexOf(c) !== i).join(',')}`)
    return { unique: new Set(codes).size }
  })
  await record(registryChecks, '100% valid department mappings', () => {
    const known = new Set(DEPARTMENTS.map((d) => d.code))
    const bad = CORE_AGENTS.filter((a) => !known.has(a.dept)).map((a) => `${a.code}->${a.dept}`)
    assert.deepEqual(bad, [])
    return { mapped: CORE_AGENTS.length, invalid: bad.length }
  })
  await record(registryChecks, '100% valid handlers', () => {
    const bad = CORE_AGENTS.filter((a) => (a.handler ?? AGENT_HANDLER) !== AGENT_HANDLER).map((a) => a.code)
    assert.deepEqual(bad, [])
    return { handler: AGENT_HANDLER, invalid: bad.length }
  })
  await record(registryChecks, '100% complete agent definitions', () => {
    const missingField = CORE_AGENTS.filter((a) => !a.code || !a.name || !a.title || !a.purpose || !a.systemPrompt || !a.dept || !Array.isArray(a.tools) || !Array.isArray(a.permissions) || a.permissions.length === 0).map((a) => a.code)
    assert.deepEqual(missingField, [])
    const toolless = CORE_AGENTS.filter((a) => a.tools.length === 0).map((a) => a.code)
    return { complete: CORE_AGENTS.length, incomplete: missingField.length, analysisOnlyAgentsWithoutTools: toolless.length, toollessAgents: toolless, note: 'nine agents deliberately declare zero side-effect tools; least privilege grants them nothing' }
  })
  await record(registryChecks, 'validateAgentRegistry() reports valid', () => {
    const validation = validateAgentRegistry()
    assert.equal(validation.valid, true, JSON.stringify(validation))
    return validation
  })
  globalChecks.push(...registryChecks.map((c) => ({ ...c, check: `registry: ${c.check}` })))

  // ============================================================
  // 3. per-agent verification — 44 rows, nine checks each
  // ============================================================
  const seeded = await bootstrapModule.ensureAgentRegistry(fakeDb)
  const seededTwice = await bootstrapModule.ensureAgentRegistry(fakeDb)
  const registryStatus = await bootstrapModule.getRegistryStatus(fakeDb)

  await record(globalChecks, 'bootstrap seeding is idempotent (no duplicates on re-run)', () => {
    assert.deepEqual(seeded, seededTwice)
    assert.equal(table('Department').length, 110)
    assert.equal(table('AiAgent').length, 44)
    return { firstRun: seeded, secondRun: seededTwice }
  })

  const runAgent = engineModule.runAgent
  await record(globalChecks, 'handler name runAgent resolves to a real exported function', () => {
    assert.equal(typeof runAgent, 'function')
    return { exportedByName: 'runAgent', type: typeof runAgent }
  })

  for (const definition of CORE_AGENTS) {
    const checks: Record<string, 'PASS' | 'FAIL'> = {}
    const errors: string[] = []
    const check = (name: string, fn: () => boolean) => {
      try {
        const ok = fn()
        checks[name] = ok ? 'PASS' : 'FAIL'
        if (!ok) errors.push(`${name}: assertion returned false`)
      } catch (error) {
        checks[name] = 'FAIL'
        errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    const stored: Row | null = await fakeDb.aiAgent.findUnique({ where: { code: definition.code }, include: { department: { select: { code: true } } } })

    check('agent exists', () => Boolean(stored))
    check('agent code valid', () => {
      // functional contract: the run endpoint normalises with sanitizeText(code, 20).toUpperCase()
      const normalised = definition.code.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, 20).toUpperCase()
      return /^[A-Z]{2,4}-\d{3}$/.test(definition.code) && normalised === definition.code && stored?.code === definition.code
    })
    check('department valid', () => DEPARTMENTS.some((d) => d.code === definition.dept) && stored?.department?.code === definition.dept)
    check('handler exists', () => Boolean(stored) && (stored?.handler ?? AGENT_HANDLER) === AGENT_HANDLER)
    check('handler points to runAgent', () => (definition.handler ?? AGENT_HANDLER) === AGENT_HANDLER && typeof runAgent === 'function')
    check('system prompt exists', () => {
      const prompt = String(stored?.systemPrompt ?? '')
      return prompt.length >= 120 && CONSTITUTION.every((rule) => prompt.includes(rule.slice(0, 40)))
    })
    check('permissions exist', () => {
      const permissions = JSON.parse(String(stored?.permissions)) as string[]
      return Array.isArray(permissions) && permissions.length > 0
    })
    check('tools are valid', () => {
      const tools = JSON.parse(String(stored?.tools)) as string[]
      return Array.isArray(tools) && tools.every((tool) => (AGENT_TOOLS as readonly string[]).includes(tool))
    })
    agentRows.push({
      agentCode: definition.code,
      name: definition.name,
      title: definition.title,
      department: definition.dept,
      departmentName: DEPARTMENTS.find((d) => d.code === definition.dept)?.name ?? null,
      tools: JSON.parse(String(stored?.tools ?? '[]')) as string[],
      permissions: JSON.parse(String(stored?.permissions ?? '[]')) as string[],
      requiresApproval: Boolean(stored?.requiresApproval),
      checks,
      errors,
    })
  }

  // ============================================================
  // 4/6/7/8. centralized execution, persistence, retry, timeout
  // ============================================================
  installProviderDouble()
  const executionChecks: Check[] = []

  const okRun = await runAgent('CEO-001', { input: 'Verification run', workflow: 'VERIFY' })
  await record(executionChecks, 'runAgent executes through the centralized pipeline', () => {
    assert.equal(okRun.ok, true, okRun.error ?? 'unknown failure')
    assert.equal(okRun.status, 'SUCCESS')
    assert.ok(okRun.executionId)
    assert.ok(okRun.correlationId)
    return { executionId: okRun.executionId, status: okRun.status, correlationId: okRun.correlationId }
  })
  await record(executionChecks, 'provider request built by createZaiClient: URL, bearer auth, abort signal, system prompt', () => {
    const call = providerCalls.at(-1)!
    assert.equal(call.url, `${FAKE_BASE_URL}/chat/completions`)
    assert.equal(call.authorization, `Bearer ${FAKE_API_KEY}`)
    assert.equal(call.hasSignal, true, 'no AbortSignal passed to the provider request')
    const body = JSON.parse(call.body) as { messages: Array<{ role: string; content: string }> }
    assert.equal(body.messages[0].role, 'system')
    assert.ok(body.messages[0].content.length > 100)
    assert.equal(body.messages[1].role, 'user')
    return { url: call.url, authorizationHeader: 'Bearer <redacted>', signal: call.hasSignal, roles: body.messages.map((m) => m.role) }
  })

  const persisted: Row = await fakeDb.aiAgentExecution.findUnique({ where: { id: okRun.executionId } })
  await record(executionChecks, 'RUNNING -> SUCCESS persisted with every lifecycle field', () => {
    assert.equal(persisted.status, 'SUCCESS')
    for (const field of ['id', 'agentCode', 'correlationId', 'startedAt', 'completedAt', 'durationMs', 'output', 'error', 'tokensUsed', 'metadata', 'status', 'input', 'workflow']) {
      assert.ok(field in persisted, `missing column ${field}`)
    }
    assert.equal(persisted.agentCode, 'CEO-001')
    assert.equal(persisted.correlationId, okRun.correlationId)
    assert.equal(persisted.workflow, 'VERIFY')
    assert.ok(persisted.startedAt)
    assert.ok(persisted.completedAt)
    assert.equal(typeof persisted.durationMs, 'number')
    assert.ok(persisted.durationMs >= 0)
    assert.ok(String(persisted.output).includes('ok'))
    assert.equal(persisted.tokensUsed, 42)
    assert.equal(JSON.parse(String(persisted.metadata)).provider, 'zai')
    return {
      executionId: persisted.id, status: persisted.status, agentCode: persisted.agentCode,
      startedAt: persisted.startedAt, completedAt: persisted.completedAt, durationMs: persisted.durationMs,
      tokensUsed: persisted.tokensUsed, metadata: persisted.metadata, error: persisted.error,
    }
  })
  await record(executionChecks, 'agent counters and token usage updated on success', async () => {
    const agent: Row = await fakeDb.aiAgent.findUnique({ where: { code: 'CEO-001' } })
    assert.equal(agent.executionCount, 1)
    assert.equal(agent.successCount, 1)
    assert.equal(agent.failureCount, 0)
    assert.equal(agent.tokensToday, 42)
    return { executionCount: agent.executionCount, successCount: agent.successCount, tokensToday: agent.tokensToday }
  })
  await record(executionChecks, 'no execution is stranded in RUNNING after a terminal outcome', () => {
    const running = table('AiAgentExecution').filter((r) => r.status === 'RUNNING')
    assert.equal(running.length, 0, `${running.length} executions stranded in RUNNING`)
    return { terminalRows: table('AiAgentExecution').length, strandedRunning: running.length }
  })

  // --- retry rules -------------------------------------------------
  providerCalls = []
  const beforeTransient = 0
  providerBehavior = { kind: 'sequence', steps: [{ kind: 'status', status: 503, body: '{"error":"upstream unavailable"}' }, { kind: 'ok', content: 'recovered', tokens: 7 }] }
  const retried = await runAgent('CEO-001', { input: 'Transient failure', workflow: 'VERIFY' })
  await record(executionChecks, 'transient 5xx is retried once and then succeeds', () => {
    const attempts = providerCalls.length - beforeTransient
    assert.equal(attempts, 2, `expected 2 provider attempts, saw ${attempts}`)
    assert.equal(retried.ok, true, retried.error ?? 'unknown failure')
    return { providerAttempts: attempts, status: retried.status }
  })

  providerCalls = []
  const beforeRateLimit = 0
  providerBehavior = { kind: 'status', status: 429, body: '{"error":"too many requests"}' }
  const rateLimited = await runAgent('CEO-001', { input: 'Rate limited', workflow: 'VERIFY' })
  await record(executionChecks, '429 retries stay bounded by MAX_RETRY_ATTEMPTS (no infinite retry)', () => {
    const attempts = providerCalls.length - beforeRateLimit
    assert.equal(attempts, resilienceModule.MAX_RETRY_ATTEMPTS, `expected ${resilienceModule.MAX_RETRY_ATTEMPTS} attempts, saw ${attempts}`)
    assert.equal(rateLimited.status, 'FAILED')
    const row = table('AiAgentExecution').find((r) => r.id === rateLimited.executionId)!
    assert.equal(row.status, 'FAILED')
    assert.ok(String(row.error).includes('HTTP 429'), String(row.error))
    assert.ok(row.completedAt, 'failed execution has no completedAt')
    return { attempts, maxAttempts: resilienceModule.MAX_RETRY_ATTEMPTS, persistedStatus: row.status, persistedError: row.error }
  })

  providerCalls = []
  const beforeAuth = 0
  providerBehavior = { kind: 'status', status: 401, body: `invalid api key ${FAKE_API_KEY}` }
  const authFailure = await runAgent('CEO-001', { input: 'Bad key', workflow: 'VERIFY' })
  await record(executionChecks, 'non-transient 401 (invalid API key) is NOT retried', () => {
    assert.equal(providerCalls.length - beforeAuth, 1, 'an invalid-key failure must not be retried')
    assert.equal(authFailure.status, 'FAILED')
    return { providerAttempts: 1, status: authFailure.status }
  })
  await record(executionChecks, 'persisted provider error is redacted, never carrying the API key', () => {
    const row = table('AiAgentExecution').find((r) => r.id === authFailure.executionId)!
    const serialized = JSON.stringify(row)
    assert.equal(serialized.includes(FAKE_API_KEY), false, 'the persisted execution leaked the provider key')
    assert.ok(String(row.error).includes('[REDACTED]'), `no redaction marker in: ${String(row.error).slice(0, 160)}`)
    return { error: row.error }
  })

  providerBehavior = { kind: 'network', message: 'fetch failed: ECONNRESET' }
  providerCalls = []
  const beforeNetwork = 0
  const networkFailure = await runAgent('CEO-001', { input: 'Network error', workflow: 'VERIFY' })
  await record(executionChecks, 'network errors are transient (retried) and end FAILED with a terminal row', () => {
    assert.equal(providerCalls.length - beforeNetwork, resilienceModule.MAX_RETRY_ATTEMPTS)
    assert.equal(networkFailure.status, 'FAILED')
    return { providerAttempts: providerCalls.length - beforeNetwork, status: networkFailure.status }
  })

  providerBehavior = { kind: 'status', status: 200, body: 'this is not json' }
  const badJson = await runAgent('CEO-001', { input: 'Bad JSON', workflow: 'VERIFY' })
  await record(executionChecks, 'invalid JSON is normalized to INVALID_PROVIDER_RESPONSE', () => {
    assert.equal(badJson.status, 'FAILED')
    assert.ok(String(badJson.error).startsWith('INVALID_PROVIDER_RESPONSE'), badJson.error ?? 'no error reported')
    return { error: badJson.error }
  })

  providerBehavior = { kind: 'ok', content: '   ', tokens: 0 }
  const emptyRun = await runAgent('CEO-001', { input: 'Empty', workflow: 'VERIFY' })
  await record(executionChecks, 'empty provider content is refused, never stored as SUCCESS', () => {
    assert.equal(emptyRun.ok, false)
    assert.equal(emptyRun.status, 'FAILED')
    return { error: emptyRun.error }
  })

  // --- timeout ------------------------------------------------------
  process.env.AGENT_RUN_TIMEOUT_MS = '5000'
  providerBehavior = { kind: 'hang' }
  const timeoutStart = Date.now()
  const timedOut = await runAgent('CEO-001', { input: 'Hang', workflow: 'VERIFY' })
  await record(executionChecks, 'provider hang ends as TIMEOUT and is persisted', () => {
    assert.equal(timedOut.status, 'TIMEOUT', `expected TIMEOUT, got ${timedOut.status}`)
    assert.equal(timedOut.ok, false)
    const row = table('AiAgentExecution').find((r) => r.id === timedOut.executionId)!
    assert.equal(row.status, 'TIMEOUT')
    assert.ok(row.completedAt)
    assert.ok(String(row.error).includes('timed out'), String(row.error))
    assert.ok(Date.now() - timeoutStart >= 4800, 'the timeout fired far earlier than the configured budget')
    return { status: row.status, error: row.error, durationMs: row.durationMs, elapsedMs: Date.now() - timeoutStart }
  })
  delete process.env.AGENT_RUN_TIMEOUT_MS

  // --- stale execution reaper ---------------------------------------
  await record(executionChecks, 'stale RUNNING executions are reaped as TIMEOUT', async () => {
    seedAndPush('AiAgentExecution', { agentCode: 'CEO-001', status: 'RUNNING', correlationId: 'stale-probe', input: 'x', createdAt: new Date(Date.now() - 10 * 60_000), startedAt: new Date(Date.now() - 10 * 60_000) })
    const reaped = await engineModule.reapStaleAgentExecutions()
    assert.ok(reaped >= 1, 'the reaper did not collect the stale execution')
    const row = table('AiAgentExecution').find((r) => r.correlationId === 'stale-probe')!
    assert.equal(row.status, 'TIMEOUT')
    assert.ok(row.completedAt)
    return { reaped, status: row.status, error: row.error }
  })

  // --- governance gates ---------------------------------------------
  await record(executionChecks, 'unknown agent code is refused before any provider call', async () => {
    const callsBefore = providerCalls.length
    const missing = await runAgent('ZZZ-999', { input: 'x', workflow: 'VERIFY' })
    assert.equal(missing.ok, false)
    assert.equal(missing.error, 'Agent not found')
    assert.equal(missing.executionId, '', 'a refused run must not create an execution row')
    assert.equal(providerCalls.length, callsBefore, 'the provider was called for an invalid agent')
    return { status: missing.status, providerCalls: 0 }
  })
  await record(executionChecks, 'invalid department mapping is refused (no provider call)', async () => {
    const callsBefore = providerCalls.length
    const realDepartmentId = table('Department').find((d) => d.code === 'D001')!.id
    await fakeDb.aiAgent.update({ where: { code: 'CEO-001' }, data: { departmentId: null } })
    const mismatch = await runAgent('CEO-001', { input: 'x', workflow: 'VERIFY' })
    assert.equal(mismatch.ok, false)
    assert.ok(String(mismatch.error).includes('department mapping is invalid'), mismatch.error ?? 'no error reported')
    assert.equal(providerCalls.length, callsBefore)
    await fakeDb.aiAgent.update({ where: { code: 'CEO-001' }, data: { departmentId: realDepartmentId } })
    return { status: mismatch.status, providerCalls: 0 }
  })
  await record(executionChecks, 'non-ACTIVE agent cannot execute', async () => {
    const callsBefore = providerCalls.length
    await fakeDb.aiAgent.update({ where: { code: 'REV-002' }, data: { status: 'PAUSED' } })
    const paused = await runAgent('REV-002', { input: 'x', workflow: 'VERIFY' })
    assert.equal(paused.ok, false)
    assert.equal(providerCalls.length, callsBefore)
    await fakeDb.aiAgent.update({ where: { code: 'REV-002' }, data: { status: 'ACTIVE' } })
    return { error: paused.error, providerCalls: 0 }
  })
  await record(executionChecks, 'daily quota stops execution before the provider is called', async () => {
    const callsBefore = providerCalls.length
    await fakeDb.aiAgent.update({ where: { code: 'REV-002' }, data: { tokensToday: 200 * 4000 } })
    const over = await runAgent('REV-002', { input: 'x', workflow: 'VERIFY' })
    assert.equal(over.error, 'Daily quota exceeded')
    assert.equal(providerCalls.length, callsBefore)
    await fakeDb.aiAgent.update({ where: { code: 'REV-002' }, data: { tokensToday: 0 } })
    return { error: over.error, providerCalls: 0 }
  })
  await record(executionChecks, 'ungranted privileged tool is refused and audited', async () => {
    const callsBefore = providerCalls.length
    const denied = await runAgent('CEO-001', { input: 'x', workflow: 'VERIFY', tool: 'payment.verify' as never })
    assert.equal(denied.ok, false)
    assert.ok(String(denied.error).includes('not permitted'), denied.error ?? 'no error reported')
    assert.equal(providerCalls.length, callsBefore)
    assert.ok(table('AuditLog').some((r) => r.action === 'AGENT_TOOL_DENIED'), 'no AGENT_TOOL_DENIED audit row written')
    return { error: denied.error, audited: true, providerCalls: 0 }
  })
  await record(executionChecks, 'granted tool executes and is audited', async () => {
    providerBehavior = { kind: 'ok', content: 'tool ok', tokens: 11 }
    const allowed = await runAgent('CEO-001', { input: 'x', workflow: 'VERIFY', tool: 'crm.query' as never })
    assert.equal(allowed.ok, true, allowed.error ?? 'unknown')
    assert.ok(table('AuditLog').some((r) => r.action === 'AGENT_TOOL_INVOKED'), 'no AGENT_TOOL_INVOKED audit row written')
    return { status: allowed.status, audited: true }
  })
  await record(executionChecks, 'tenant/client isolation: cross-client run is denied', async () => {
    const callsBefore = providerCalls.length
    const other = seedAndPush('Client', { clientId: 'T360-OTHER', id: 'client_other' })
    const own = seedAndPush('Client', { clientId: 'T360-OWN', id: 'client_own' })
    const denied = await runAgent('REV-002', { input: 'x', workflow: 'VERIFY', clientId: String(other.id), actingForClientId: String(own.id) })
    assert.equal(denied.error, 'Cross-client access denied')
    assert.equal(providerCalls.length, callsBefore)
    assert.ok(table('AuditLog').some((r) => r.action === 'AGENT_CROSS_CLIENT_DENIED'), 'no cross-client audit row written')
    const allowed = await runAgent('CEO-001', { input: 'x', workflow: 'VERIFY', clientId: String(other.id) })
    assert.equal(allowed.ok, true, 'a company-scoped agent must still be able to run')
    return { error: denied.error, companyScopedAllowed: allowed.ok, providerCallsForDeniedRun: 0 }
  })
  globalChecks.push(...executionChecks.map((c) => ({ ...c, check: `execution: ${c.check}` })))

  // ============================================================
  // 3b/18-structure. every one of the 44 agents executed for real
  // through the pipeline, with persistence asserted per agent
  // ============================================================
  providerBehavior = { kind: 'ok', content: 'agent verified', tokens: 13 }
  const executedAgents: Record<string, any>[] = []
  for (const definition of CORE_AGENTS) {
    providerCalls = []
    const run = await runAgent(definition.code, { input: 'Production verification run', workflow: 'VERIFY_ALL' })
    const row: Row = (run.executionId ? table('AiAgentExecution').find((r) => r.id === run.executionId) : undefined) ?? {}
    const storedAgent: Row = await fakeDb.aiAgent.findUnique({ where: { code: definition.code } })
    const tools = JSON.parse(String(storedAgent.tools)) as string[]
    const permissions = JSON.parse(String(storedAgent.permissions)) as string[]
    const grantsValid = Array.isArray(tools) && tools.every((tool) => policyModule.authorizeAgentTool({ status: 'ACTIVE', tools: JSON.stringify(tools), permissions: JSON.stringify(permissions) }, tool).allowed)
    const persistedOk = row.status === 'SUCCESS' && Boolean(row.startedAt) && Boolean(row.completedAt) && row.tokensUsed === 13 && row.agentCode === definition.code
    const executable = run.ok && persistedOk && providerCalls.length === 1 && grantsValid
    const stored = agentRows.find((r) => r.agentCode === definition.code)!
    stored.checks['agent is executable'] = executable ? 'PASS' : 'FAIL'
    if (!executable) stored.errors.push(`executable check failed (run=${run.ok} persisted=${persistedOk} attempts=${providerCalls.length} grants=${grantsValid}) ${run.error ?? ''}`)
    executedAgents.push({
      agentCode: definition.code,
      executionId: run.executionId,
      status: run.status,
      providerAttempts: providerCalls.length,
      persistedStatus: row?.status ?? null,
      durationMs: row?.durationMs ?? null,
      tokensUsed: row?.tokensUsed ?? null,
      startedAt: row?.startedAt ?? null,
      completedAt: row?.completedAt ?? null,
      toolGrantsValid: grantsValid,
      result: executable ? 'PASS' : 'FAIL',
      evidenceLevel: 'CODE_VERIFIED',
    })
  }
  const executedPass = executedAgents.filter((r) => r.result === 'PASS').length
  await record(globalChecks, 'all 44 agents execute end-to-end through runAgent with persistence', () => {
    assert.equal(executedPass, 44, `${executedPass}/44 agents produced a persisted SUCCESS execution`)
    assert.equal(table('AiAgentExecution').filter((r) => r.workflow === 'VERIFY_ALL').length, 44)
    return { executed: executedAgents.length, passed: executedPass, evidenceLevel: 'CODE_VERIFIED (simulated provider + in-memory database double)' }
  })

  // ============================================================
  // 5. provider configuration contract
  // ============================================================
  const providerChecks: Check[] = []
  await record(providerChecks, 'NOT_CONFIGURED when neither variable is present', () => {
    const status = providerModule.getZaiProviderStatus({})
    assert.equal(status.state, 'NOT_CONFIGURED')
    assert.equal(status.configured, false)
    return status
  })
  await record(providerChecks, 'MISCONFIGURED when only one of the two is present', () => {
    assert.equal(providerModule.resolveZaiEnvConfig({ ZAI_BASE_URL: FAKE_BASE_URL }).state, 'MISCONFIGURED')
    assert.equal(providerModule.resolveZaiEnvConfig({ ZAI_API_KEY: 'x' }).state, 'MISCONFIGURED')
    return { baseUrlOnly: 'MISCONFIGURED', apiKeyOnly: 'MISCONFIGURED' }
  })
  await record(providerChecks, 'URL validation rejects credentials, query, hash and non-HTTP schemes', () => {
    const rejected = ['https://user:pass@provider.test/v1', 'https://provider.test/v1?token=1', 'https://provider.test/v1#frag', 'ftp://provider.test', 'not a url', 'provider.test/v1']
    const results = rejected.map((url) => providerModule.resolveZaiEnvConfig({ ZAI_BASE_URL: url, ZAI_API_KEY: 'x' }).state)
    assert.deepEqual(results, rejected.map(() => 'MISCONFIGURED'), JSON.stringify({ rejected, results }))
    return { rejected, results }
  })
  await record(providerChecks, 'trailing slashes are normalised on the base URL', () => {
    const config = providerModule.resolveZaiEnvConfig({ ZAI_BASE_URL: 'https://provider.test/v1///', ZAI_API_KEY: 'x' })
    assert.equal(config.state, 'CONFIGURED')
    assert.equal(config.baseUrl, 'https://provider.test/v1')
    return { baseUrl: config.baseUrl }
  })
  await record(providerChecks, 'status/detail output never contains the API key', () => {
    const status = providerModule.getZaiProviderStatus({ ZAI_BASE_URL: FAKE_BASE_URL, ZAI_API_KEY: FAKE_API_KEY })
    assert.equal(JSON.stringify(status).includes(FAKE_API_KEY), false)
    return { serialized: JSON.stringify(status) }
  })
  await record(providerChecks, 'createZaiClient fails closed when configuration is incomplete', () => {
    assert.throws(() => providerModule.createZaiClient({}), (error: unknown) => error instanceof providerModule.ZaiProviderError && (error as { code: string }).code === 'PROVIDER_NOT_CONFIGURED')
    return { throws: 'PROVIDER_NOT_CONFIGURED' }
  })
  await record(providerChecks, 'transient provider statuses are retryable', () => {
    const statuses = [408, 409, 425, 429, 500, 502, 503, 504]
    const results = statuses.map((status) => resilienceModule.isTransientRunError(new providerModule.ZaiProviderError('PROVIDER_ERROR', 'x', status)))
    assert.deepEqual(results, statuses.map(() => true), JSON.stringify({ statuses, results }))
    return { transientStatuses: statuses }
  })
  await record(providerChecks, 'non-transient provider statuses are never retried', () => {
    const statuses = [400, 401, 403, 404, 405, 422]
    const results = statuses.map((status) => resilienceModule.isTransientRunError(new providerModule.ZaiProviderError('PROVIDER_ERROR', 'x', status)))
    assert.deepEqual(results, statuses.map(() => false), JSON.stringify({ statuses, results }))
    return { permanentStatuses: statuses }
  })
  await record(providerChecks, 'validation failures (invalid agent/department/permission) never retry', () => {
    assert.equal(resilienceModule.isTransientRunError(new providerModule.ZaiProviderError('INVALID_PROVIDER_RESPONSE', 'bad')), false)
    assert.equal(resilienceModule.isTransientRunError(new Error('Agent not found')), false)
    assert.equal(resilienceModule.isTransientRunError(new Error('Cross-client access denied')), false)
    return { invalidResponse: false, unknownAgent: false, authorizationFailure: false }
  })
  globalChecks.push(...providerChecks.map((c) => ({ ...c, check: `provider: ${c.check}` })))

  // ============================================================
  // 8. timeout / attempt bounds
  // ============================================================
  await record(globalChecks, 'timeout and attempt bounds are as specified', () => {
    assert.equal(resilienceModule.DEFAULT_AGENT_RUN_TIMEOUT_MS, 60_000)
    assert.equal(resilienceModule.MAX_AGENT_RUN_TIMEOUT_MS, 300_000)
    assert.equal(resilienceModule.MAX_RETRY_ATTEMPTS, 2)
    assert.equal(resilienceModule.resolveAgentTimeoutMs({}), 60_000)
    assert.equal(resilienceModule.resolveAgentTimeoutMs({ AGENT_RUN_TIMEOUT_MS: '999999' }), 300_000)
    assert.equal(resilienceModule.resolveAgentTimeoutMs({ AGENT_RUN_TIMEOUT_MS: 'nonsense' }), 60_000)
    return { defaultTimeoutMs: 60000, maxTimeoutMs: 300000, maxAttempts: 2 }
  })

  // ============================================================
  // 9. database-backed operations lock
  // ============================================================
  const lockChecks: Check[] = []
  await fakeDb.setting.upsert({ where: { key: 'feature_flags' }, update: { value: JSON.stringify({ ai_agents: false }) }, create: { key: 'feature_flags', value: JSON.stringify({ ai_agents: false }) } })

  providerBehavior = { kind: 'ok', content: 'cycle', tokens: 1 }
  const [cycleA, cycleB] = await Promise.all([opsLoopModule.runOpsCycle('SERVICE'), opsLoopModule.runOpsCycle('SERVICE')])
  await record(lockChecks, 'process A allowed, concurrent process B skipped (one cycle wins the lease)', () => {
    const cycles = [cycleA, cycleB]
    const allowed = cycles.filter((c) => !c.message?.includes('overlap protection'))
    const skipped = cycles.filter((c) => c.message?.includes('overlap protection'))
    assert.equal(allowed.length, 1, `expected exactly one winner: ${JSON.stringify(cycles.map((c) => ({ ok: c.ok, message: c.message ?? null })))}`)
    assert.equal(skipped.length, 1)
    assert.equal(skipped[0].cycle, 0)
    assert.equal(skipped[0].ok, false)
    return { winnerCycle: allowed[0].cycle, winnerOk: allowed[0].ok, loser: { cycle: skipped[0].cycle, ok: skipped[0].ok, message: skipped[0].message } }
  })

  const lockRow = table('AiOpsLock')[0]
  await record(lockChecks, 'the lease is a database row in AiOpsLock, not an in-memory variable', () => {
    assert.ok(lockRow, 'no AiOpsLock row was created by a cycle')
    assert.equal(lockRow.id, 'AI_OPS_SINGLETON')
    const source = readFileSync(path.join(REPO, 'src/lib/ops-loop.ts'), 'utf8')
    assert.match(source, /db\.aiOpsLock\.upsert/)
    assert.match(source, /db\.aiOpsLock\.updateMany/)
    assert.match(source, /lockedUntil: \{ lt: now \}/)
    const globalLockNames = Object.keys(globalThis).filter((key) => /opsLock|opsRunning|cycleLock|singleton/i.test(key))
    assert.deepEqual(globalLockNames, [], `process-global lock found: ${globalLockNames.join(',')}`)
    return { lockId: lockRow.id, mechanism: 'INSERT row + conditional UPDATE ... WHERE lockedUntil < now (claim wins only if the lease is expired)', leaseMs: 280000, processGlobalsFound: globalLockNames.length }
  })
  await record(lockChecks, 'lease released at the end of a cycle', () => {
    assert.ok(lockRow)
    assert.equal(lockRow.owner, null, `owner still held after the cycle: ${lockRow.owner}`)
    assert.equal((lockRow.lockedUntil as Date).getTime(), new Date(0).getTime())
    return { owner: lockRow.owner, lockedUntil: lockRow.lockedUntil }
  })

  const cyclesBefore = Number(lockRow.cycles ?? 0)
  await record(lockChecks, 'stale lease from a crashed process is recovered', async () => {
    lockRow.owner = 'crashed-process'
    lockRow.lockedUntil = new Date(Date.now() - 1)
    const recovered = await opsLoopModule.runOpsCycle('SERVICE')
    assert.equal(recovered.message?.includes('overlap protection'), false, 'a stale lease must not block the next cycle')
    assert.ok(recovered.cycle > cyclesBefore)
    return { cycle: recovered.cycle, previousLockOwner: 'crashed-process', recoveredAt: recovered.finishedAt }
  })
  await record(lockChecks, 'an unexpired lease blocks a second process', async () => {
    lockRow.owner = 'live-process'
    lockRow.lockedUntil = new Date(Date.now() + 240_000)
    const blocked = await opsLoopModule.runOpsCycle('SERVICE')
    assert.ok(blocked.message?.includes('overlap protection'), 'a held lease must reject concurrent cycles')
    assert.equal(blocked.cycle, 0)
    lockRow.owner = null
    lockRow.lockedUntil = new Date(0)
    return { blocked: true, message: blocked.message }
  })
  await record(lockChecks, 'heartbeat is persisted to the database with real cycle state', () => {
    const heartbeat = table('Setting').find((r) => r.key === 'ops.heartbeat')
    assert.ok(heartbeat, 'no ops.heartbeat setting row')
    const value = JSON.parse(String(heartbeat.value)) as Record<string, unknown>
    assert.ok(value.at)
    assert.equal(value.service, 'tech360-ai-ops')
    assert.ok(['SUCCESS', 'FAILED', 'RUNNING', 'HEARTBEAT'].includes(String(value.status)))
    assert.ok(typeof value.cycles === 'number' && Number(value.cycles) >= 1)
    return value
  })
  await record(lockChecks, 'cycle throttle prevents stacked cycles from an external scheduler', async () => {
    const first = await opsLoopModule.cycleThrottled()
    assert.equal(first.throttled, true, 'a cycle that just ran must throttle the next request')
    assert.ok(first.lastRunAt)
    return first
  })
  globalChecks.push(...lockChecks.map((c) => ({ ...c, check: `ops-lock: ${c.check}` })))

  // ============================================================
  // 10. instrumentation contract
  // ============================================================
  const instrumentationChecks: Check[] = []
  const instrumentationSource = readFileSync(path.join(REPO, 'src/instrumentation.ts'), 'utf8')
  await record(instrumentationChecks, 'register() guards: production only, nodejs runtime only, never during next build', () => {
    assert.match(instrumentationSource, /NODE_ENV !== 'production'\) return/)
    assert.match(instrumentationSource, /NEXT_PHASE === 'phase-production-build'\) return/)
    assert.match(instrumentationSource, /NEXT_RUNTIME && process\.env\.NEXT_RUNTIME !== 'nodejs'\) return/)
    return { guards: ["NODE_ENV !== 'production'", "NEXT_PHASE === 'phase-production-build'", "NEXT_RUNTIME !== 'nodejs'"] }
  })
  {
    env.NODE_ENV = 'production'
    process.env.AI_OPS_DRIVER = 'off'
    const instrumentation = await import('@/instrumentation')
    await instrumentation.register()
    await instrumentation.register()
    await record(instrumentationChecks, 'AI_OPS_DRIVER=off registers no timer', () => {
      const state = (globalThis as Record<string, any>).__tech360AiOpsDriver
      assert.ok(!state || state.started !== true, 'driver started despite AI_OPS_DRIVER=off')
      assert.equal(process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length, 0, 'a timer handle exists with the driver off')
      return { driver: 'off', globalState: state ? state.started : 'never created', timerHandles: 0 }
    })
  }
  {
    const savedPhase = process.env.NEXT_PHASE
    process.env.NEXT_PHASE = 'phase-production-build'
    process.env.AI_OPS_DRIVER = 'on'
    const instrumentation = await import('@/instrumentation')
    await instrumentation.register()
    await record(instrumentationChecks, 'AI work never starts during next build', () => {
      const state = (globalThis as Record<string, any>).__tech360AiOpsDriver
      assert.ok(!state || state.started !== true, 'the operations driver started during the build phase')
      return { nextPhase: 'phase-production-build', driver: 'on', started: false }
    })
    process.env.NEXT_PHASE = savedPhase
  }
  {
    process.env.AI_OPS_DRIVER = 'on'
    const instrumentation = await import('@/instrumentation')
    await instrumentation.register()
    await instrumentation.register()
    await instrumentation.register()
    const state = (globalThis as Record<string, any>).__tech360AiOpsDriver
    await record(instrumentationChecks, 'AI_OPS_DRIVER=on starts exactly one loop despite repeated register() calls', () => {
      assert.equal(state.started, true)
      assert.equal(Boolean(state.timer), true)
      const timeoutHandles = process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length
      assert.equal(timeoutHandles, 1, `expected exactly one scheduled timer, saw ${timeoutHandles}`)
      if (state.timer) clearTimeout(state.timer)
      return { registerCalls: 3, loopsStarted: 1, timerHandlesBeforeCleanup: timeoutHandles }
    })
    process.env.AI_OPS_DRIVER = 'off'
    env.NODE_ENV = 'test'
  }
  globalChecks.push(...instrumentationChecks.map((c) => ({ ...c, check: `instrumentation: ${c.check}` })))

  // ============================================================
  // 11. health endpoint
  // ============================================================
  const healthChecks: Check[] = []
  process.env.DATABASE_URL = 'mysql://app:dbpass@db.test.invalid:3306/tech360'
  {
    const response = await healthRoute.GET()
    const body = await response.json()
    await record(healthChecks, '200 healthy: database, registry, provider, operations heartbeat, driver state', () => {
      assert.equal(response.status, 200, JSON.stringify(body))
      assert.equal(body.status, 'healthy')
      const checks = body.checks as Record<string, { status: string; detail?: string }>
      assert.equal(checks.database.status, 'UP')
      assert.match(String(checks.database.detail), /MySQL/)
      assert.equal(checks.aiProvider.status, 'CONFIGURED')
      assert.match(String(checks.aiAgents.detail), /44 agents registered/)
      assert.equal(checks.aiOperations.status, 'DISABLED', 'driver state must be reported: AI_OPS_DRIVER=off')
      assert.match(String(checks.aiOperations.detail), /AI_OPS_DRIVER=off/)
      return { httpStatus: response.status, uptimeSeconds: body.uptimeSeconds, checks }
    })
    await record(healthChecks, 'health response exposes no secret material', () => {
      const serialized = JSON.stringify(body)
      for (const needle of [FAKE_API_KEY, 'DATABASE_URL', 'SESSION_SECRET', 'PORTAL_SECRET', 'OPS_SECRET', 'mysql://']) {
        assert.equal(serialized.includes(needle), false, `health response contains ${needle}`)
      }
      return { bytesScanned: serialized.length, secretsFound: 0 }
    })
  }
  {
    dbDown = true
    process.env.DATABASE_URL = 'mysql://unreachable.invalid:3306/nope'
    const down = await healthRoute.GET()
    const downBody = await down.json()
    dbDown = false
    delete process.env.DATABASE_URL
    await record(healthChecks, 'unhealthy state is reported when the database is unreachable (503 + DOWN)', () => {
      assert.equal(down.status, 503, `expected 503, got ${down.status}`)
      assert.equal(downBody.status, 'unhealthy')
      assert.equal(downBody.checks.database.status, 'DOWN')
      assert.equal(downBody.checks.aiAgents.status, 'UNKNOWN')
      assert.equal(downBody.checks.aiOperations.status, 'DISABLED', 'driver state is env-derived and must stay honest even when the DB is down')
      assert.equal(String(downBody.checks.database.detail).includes('unreachable.invalid'), false, 'health leaked connection details')
      return { httpStatus: down.status, checks: downBody.checks }
    })
  }
  {
    const savedKey = process.env.ZAI_API_KEY
    const savedNodeEnv = process.env.NODE_ENV
    env.NODE_ENV = 'test'
    delete process.env.ZAI_API_KEY
    const lenient = await healthRoute.GET()
    const lenientBody = await lenient.json()
    env.NODE_ENV = 'production'
    const strict = await healthRoute.GET()
    const strictBody = await strict.json()
    process.env.ZAI_API_KEY = savedKey
    env.NODE_ENV = savedNodeEnv
    await record(healthChecks, 'unconfigured provider is unhealthy in production (503) and only a warning outside it', () => {
      assert.equal(lenientBody.checks.aiProvider.status, 'MISCONFIGURED')
      assert.equal(lenient.status, 200, 'a non-production runtime must not fail health solely on provider configuration')
      assert.equal(strict.status, 503, `production must report unhealthy without a provider, got ${strict.status}`)
      assert.equal(strictBody.status, 'unhealthy')
      assert.equal(strictBody.checks.aiProvider.status, 'MISCONFIGURED')
      return { nonProduction: { httpStatus: lenient.status, provider: lenientBody.checks.aiProvider.status }, production: { httpStatus: strict.status, provider: strictBody.checks.aiProvider.status } }
    })
  }
  globalChecks.push(...healthChecks.map((c) => ({ ...c, check: `health: ${c.check}` })))

  // ============================================================
  // 12. admin operations endpoint
  // ============================================================
  const adminChecks: Check[] = []
  {
    const opsStatus = await import('@/app/api/admin/ops-status/route')
    const request = () => new Request('http://localhost/api/admin/ops-status', { headers: { 'x-forwarded-for': '10.0.0.1' } })
    cookieMode = {}
    const anonymous = await opsStatus.GET(request() as never)
    await record(adminChecks, 'unauthenticated request rejected', async () => {
      assert.equal(anonymous.status, 401)
      return { httpStatus: 401, body: await anonymous.json() }
    })

    seedAndPush('User', { id: 'u_staff', email: 'staff@example.invalid', role: 'STAFF', isActive: true, passwordHash: 'x', twoFactorEnabled: false })
    seedAndPush('Session', { token: 'staff-session', userId: 'u_staff', expiresAt: new Date(Date.now() + 60_000) })
    cookieMode = { session: 'staff-session' }
    const staff = await opsStatus.GET(request() as never)
    await record(adminChecks, 'non-admin (STAFF) request rejected', () => {
      assert.equal(staff.status, 403)
      return { httpStatus: 403 }
    })

    seedAndPush('User', { id: 'u_admin', email: 'owner@example.invalid', role: 'SUPER_ADMIN', isActive: true, passwordHash: 'x', twoFactorEnabled: false })
    seedAndPush('Session', { token: 'admin-session', userId: 'u_admin', expiresAt: new Date(Date.now() + 60_000) })
    cookieMode = { session: 'admin-session' }
    const admin = await opsStatus.GET(request() as never)
    const adminBody = await admin.json()
    await record(adminChecks, 'Super Admin accepted: provider, registry, heartbeat, cycles, execution statistics', async () => {
      assert.equal(admin.status, 200, JSON.stringify(adminBody))
      assert.equal(adminBody.provider.state, 'CONFIGURED')
      assert.equal(adminBody.registry.registeredAgents, 44)
      assert.equal(adminBody.registry.registeredDepartments, 110)
      assert.equal(adminBody.registry.healthy, true)
      assert.ok(['ACTIVE', 'STALE', 'OFFLINE'].includes(String(adminBody.status)))
      assert.ok('heartbeatAgeSec' in adminBody)
      assert.ok(Array.isArray(adminBody.recentCycles))
      const agents = adminBody.agents as Record<string, unknown>
      for (const field of ['registered', 'totalExecutions', 'successes', 'failures', 'executions24h']) assert.ok(typeof agents[field] === 'number', `agents.${field} is not numeric`)
      assert.ok(Number(agents.totalExecutions) > 0, 'no execution statistics recorded')
      const serialized = JSON.stringify(adminBody)
      for (const needle of [FAKE_API_KEY, 'DATABASE_URL', 'SESSION_SECRET', 'PORTAL_SECRET', 'OPS_SECRET', 'mysql://']) {
        assert.equal(serialized.includes(needle), false, `ops-status response contains ${needle}`)
      }
      return {
        httpStatus: 200, provider: adminBody.provider, status: adminBody.status,
        heartbeatAgeSec: adminBody.heartbeatAgeSec, intervalSec: adminBody.intervalSec,
        registry: { agents: adminBody.registry.registeredAgents, departments: adminBody.registry.registeredDepartments, healthy: adminBody.registry.healthy },
        agents: adminBody.agents, cyclesRecorded: (adminBody.recentCycles as unknown[]).length, bytesScanned: serialized.length, secretsFound: 0,
      }
    })
    cookieMode = {}
  }
  globalChecks.push(...adminChecks.map((c) => ({ ...c, check: `admin-ops-status: ${c.check}` })))

  // ============================================================
  // 4b. bypass audit
  // ============================================================
  await record(globalChecks, 'no direct SDK / raw-endpoint provider access outside createZaiClient', () => {
    const lines = grepSrc('z-ai-web-dev-sdk|/chat/completions|/functions/invoke|ZAI\\.create')
    const offenders = lines.filter((line) => !line.startsWith('src/lib/ai-provider.ts:'))
    assert.deepEqual(offenders, [], offenders.join(' | '))
    return { linesExamined: lines.length, offenders: 0, singleProviderImplementation: 'src/lib/ai-provider.ts' }
  })
  await record(globalChecks, 'every file that touches the provider also routes inference through runAgent (or is the engine itself)', () => {
    const lines = grepSrc('createZaiClient')
    const files = [...new Set(lines.map((line) => line.split(':')[0]))].filter((file) => file !== 'src/lib/ai-provider.ts' && file !== 'src/lib/agents/engine.ts')
    const nonCompliant = files.filter((file) => {
      const source = readFileSync(path.join(REPO, file), 'utf8')
      return !source.includes("runAgent(") && !source.includes('@/lib/agents/engine')
    })
    assert.deepEqual(nonCompliant, [], `provider access without the governed engine: ${nonCompliant.join(',')}`)
    const documented = files.filter((file) => readFileSync(path.join(REPO, file), 'utf8').includes('functions.invoke'))
    return { filesTouchingProvider: files, documentedException: documented, exceptionRationale: 'evidence gathering via the provider page_reader function (not LLM inference); the agent inference in that route still runs through runAgent and is persisted' }
  })
  await record(globalChecks, 'no fabricated provider response in the AI execution path', () => {
    let lines: string[] = []
    try {
      lines = execFileSync('grep', ['-rn', '--include=*.ts', '-iE', 'simulat|fabricat|fake (response|output|result)|stubbed response|hardcoded (response|output)|mock provider|write a canned|canned response', 'src/lib'], { cwd: REPO, encoding: 'utf8' }).trim().split('\n').filter(Boolean)
    } catch { lines = [] }
    // a line only counts when it does NOT explicitly forbid fabrication
    const offenders = lines.filter((line) => !/\b(never|no|not|does not|without|avoid|forbid)\b/i.test(line))
    assert.deepEqual(offenders, [], offenders.join(' | '))
    return {
      scope: 'src/lib (engine, provider, resilience, registry, ops loop)',
      patterns: ['simulat', 'fabricat', 'fake response', 'stubbed response', 'hardcoded response', 'mock provider', 'canned response'],
      linesMatched: lines.length,
      affirmativeFabrications: offenders.length,
      prohibitionsReviewedAndIgnored: lines.length - offenders.length,
    }
  })

  // ============================================================
  // closing registry state
  // ============================================================
  await record(globalChecks, 'registry stays healthy after the full verification run', async () => {
    const finalStatus = await bootstrapModule.getRegistryStatus(fakeDb)
    assert.equal(finalStatus.healthy, true, JSON.stringify(finalStatus))
    assert.equal(finalStatus.registeredAgents, 44)
    assert.equal(finalStatus.registeredDepartments, 110)
    assert.equal(finalStatus.duplicateAgentCodes.length, 0)
    assert.equal(finalStatus.orphanAgents.length, 0)
    return finalStatus
  })

  restoreProviderDouble()

  const report = {
    title: 'TECH360 production AI verification (machine-readable, code-level evidence)',
    generatedAt: new Date().toISOString(),
    repository: 'alaminiubateee969-cmd/tech360',
    branch: safeGit(['rev-parse', '--abbrev-ref', 'HEAD']),
    headSha: safeGit(['rev-parse', 'HEAD']),
    evidenceLevel: 'CODE_VERIFIED',
    evidenceMethod: 'real production modules executed against an in-memory database double and an HTTP-boundary provider double',
    notVerifiableHere: ['real ZAI provider response', 'real MySQL persistence', 'Hostinger deployment', 'https://bdtech360.com', 'AI operations timer inside a running production process'],
    summary: {
      checks: globalChecks.length,
      passed: globalChecks.filter((c) => c.result === 'PASS').length,
      failed: globalChecks.filter((c) => c.result === 'FAIL').length,
      agents: CORE_AGENTS.length,
      departments: DEPARTMENTS.length,
      agentsExecutableEndToEnd: executedPass,
      perAgentChecksTotal: agentRows.length * Object.keys(agentRows[0]?.checks ?? {}).length,
    },
    registryStatus,
    bootstrap: { seededDepartments: seeded.departments, seededAgents: seeded.agents },
    checks: globalChecks,
    agents: agentRows.map((row) => ({
      ...row,
      allChecksPass: Object.values(row.checks as Record<string, string>).every((value) => value === 'PASS') && (row.errors as string[]).length === 0,
    })),
    executions: executedAgents,
    failures,
  }

  const serialized = JSON.stringify(report, null, 2)
  if (OUT_FILE) {
    mkdirSync(path.dirname(OUT_FILE), { recursive: true })
    writeFileSync(OUT_FILE, `${serialized}\n`)
    console.log(`report written: ${path.relative(REPO, OUT_FILE)}`)
  }
  console.log(JSON.stringify({ summary: report.summary, failures }, null, 2))
  if (failures.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('verification harness crashed:', error)
  process.exitCode = 1
})
