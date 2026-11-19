/**
 * Real service/transaction regressions for the repository hardening audit.
 * Outbound fetch is intercepted; no n8n workflow, paid model or message is sent.
 * Run only via the guarded test command or an explicitly disposable test DB.
 */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'
import { db } from '../src/lib/db'
import { getAgentDefinition } from '../src/lib/agents/bootstrap'
import { runAgent } from '../src/lib/agents/engine'
import * as n8n from '../src/lib/n8n/adapter'
import * as engine from '../src/lib/automation/engine'
import { saveRule, setRuleStatus } from '../src/lib/automation/rules'

const HAS_DB = Boolean(process.env.PREVIEW_SQLITE_URL || process.env.DATABASE_URL)
const RUN = `audit${randomBytes(6).toString('hex')}`
const TENANT = `t-${RUN}`
const SECRET = 'audit-n8n-secret-only-not-production-0123456789'
const ENV_NAMES = [
  'AI_PROVIDER', 'AI_GATEWAY_BASE_URL', 'AGENTOS_GATEWAY_TOKEN',
  'OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL',
  'GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GROQ_API_KEY',
  'ZAI_BASE_URL', 'ZAI_API_KEY', 'N8N_BASE_URL', 'N8N_WEBHOOK_BASE',
  'N8N_OUTBOUND_SECRET', 'N8N_CALLBACK_SECRET', 'N8N_WEBHOOK_SECRET',
] as const
const savedEnv = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]))
const originalFetch = globalThis.fetch
const configured = () => n8n.readN8nConfig({
  N8N_BASE_URL: 'https://audit-n8n.invalid', N8N_OUTBOUND_SECRET: SECRET, N8N_CALLBACK_SECRET: SECRET,
})

function assertDisposableDatabase() {
  assert.notEqual(process.env.NODE_ENV, 'production', 'audit regressions may not run in production mode')
  const url = new URL(process.env.PREVIEW_SQLITE_URL || process.env.DATABASE_URL || '')
  const safe = url.protocol === 'file:'
    ? url.pathname.endsWith('/.preview/test.db')
    : url.protocol === 'mysql:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      && ['tech360_ci', 'tech360_test'].includes(decodeURIComponent(url.pathname.slice(1)))
  assert.ok(safe, 'audit regressions require the disposable offline DB or a loopback tech360_ci/tech360_test schema')
}

describe('audit: explicit AI policy reaches the real persisted execution engine', { skip: !HAS_DB }, () => {
  const CODE = 'VOX-043'
  let priorAgent: Awaited<ReturnType<typeof db.aiAgent.findUnique>>
  let ownedAgentId: string | undefined
  const requests: Array<{ url: string; body: Record<string, unknown> }> = []

  before(async () => {
    assertDisposableDatabase()
    const definition = getAgentDefinition(CODE)!
    assert.ok(definition)
    const department = await db.department.upsert({
      where: { code: definition.dept },
      create: { code: definition.dept, name: `Audit ${definition.dept}`, category: 'CONTENT' }, update: {},
    })
    priorAgent = await db.aiAgent.findUnique({ where: { code: CODE } })
    if (!priorAgent) {
      const agent = await db.aiAgent.create({ data: {
        code: CODE, name: `Audit ${RUN}`, departmentId: department.id,
        purpose: definition.purpose, systemPrompt: definition.systemPrompt,
        tools: JSON.stringify(definition.tools), permissions: JSON.stringify(definition.permissions),
      } })
      ownedAgentId = agent.id
    }
  })

  beforeEach(async () => {
    requests.length = 0
    for (const name of ENV_NAMES) delete process.env[name]
    process.env.OPENAI_API_KEY = 'audit-synthetic-openai-key'
    process.env.OPENAI_BASE_URL = 'https://audit-openai.invalid/v1'
    await db.aiAgent.update({ where: { code: CODE }, data: { status: 'ACTIVE', model: 'openai:audit-model' } })
    globalThis.fetch = (async (input, init) => {
      requests.push({ url: String(input), body: JSON.parse(String(init?.body || '{}')) })
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Audited local test response.' } }], usage: { total_tokens: 8 } }), { status: 200 })
    }) as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    for (const name of ENV_NAMES) {
      if (savedEnv[name] === undefined) delete process.env[name]
      else process.env[name] = savedEnv[name]
    }
  })

  after(async () => {
    await db.aiAgentExecution.deleteMany({ where: { agentCode: CODE, workflow: RUN } })
    if (ownedAgentId) await db.aiAgent.deleteMany({ where: { id: ownedAgentId } })
    else if (priorAgent) await db.aiAgent.update({ where: { id: priorAgent.id }, data: { model: priorAgent.model, status: priorAgent.status } })
  })

  for (const disabled of ['none', 'off', 'disabled']) {
    it(`does not send a prefixed OpenAI agent request while AI_PROVIDER=${disabled}`, async () => {
      process.env.AI_PROVIDER = disabled
      const result = await runAgent(CODE, { input: 'Local policy regression only.', workflow: RUN })
      assert.equal(requests.length, 0, 'a persisted model prefix must not bypass intentional no-AI mode')
      assert.equal(result.ok, false)
      assert.equal(result.status, 'FAILED')
      assert.match(result.error ?? '', /PROVIDER_NOT_CONFIGURED/)
      const row = await db.aiAgentExecution.findUniqueOrThrow({ where: { id: result.executionId } })
      assert.equal(row.status, 'FAILED')
      assert.ok(row.completedAt)
      assert.equal(row.output, null)
    })
  }

  it('fails closed for an explicitly selected missing gateway, despite a configured prefixed OpenAI model', async () => {
    process.env.AI_PROVIDER = 'ai-gateway'
    const result = await runAgent(CODE, { input: 'Local policy regression only.', workflow: RUN })
    assert.equal(requests.length, 0, 'do not switch to a billable provider without an automatic selection policy')
    assert.equal(result.ok, false)
  })

  it('does not let a persisted model prefix override a different explicitly selected provider', async () => {
    process.env.AI_PROVIDER = 'zai'
    process.env.ZAI_BASE_URL = 'https://audit-zai.invalid/v1'
    process.env.ZAI_API_KEY = 'audit-synthetic-zai-key'
    const result = await runAgent(CODE, { input: 'Local policy regression only.', workflow: RUN })
    assert.equal(result.ok, true, result.error ?? 'Expected a successful intercepted provider response')
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, 'https://audit-zai.invalid/v1/chat/completions')
  })

  it('keeps configured per-agent prefixes working when the operator selected automatic mode', async () => {
    process.env.AI_PROVIDER = 'auto'
    const result = await runAgent(CODE, { input: 'Local policy positive control.', workflow: RUN })
    assert.equal(result.ok, true, result.error ?? 'Expected a successful automatic-mode positive control')
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, 'https://audit-openai.invalid/v1/chat/completions')
    assert.equal(requests[0].body.model, 'audit-model')
  })
})

describe('audit: n8n callback/outbound races preserve durable state', { skip: !HAS_DB }, () => {
  const codes: string[] = []
  const rules: string[] = []
  const restoreInterpositions: Array<() => void> = []

  function interpose(method: 'update' | 'updateMany', replacement: unknown) {
    // Prisma delegates expose methods through a proxy without property
    // descriptors, so node:test mock.method cannot wrap them. Assignment is
    // supported; always restore it even when an assertion fails.
    const delegate = db.automationRun
    const original = delegate[method]
    Reflect.set(delegate, method, replacement)
    restoreInterpositions.push(() => { Reflect.set(delegate, method, original) })
  }

  before(() => assertDisposableDatabase())
  beforeEach(() => {
    process.env.N8N_BASE_URL = 'https://audit-n8n.invalid'
    process.env.N8N_OUTBOUND_SECRET = SECRET
    process.env.N8N_CALLBACK_SECRET = SECRET
    globalThis.fetch = (async () => { throw new Error('Unexpected fetch in an audit regression') }) as typeof fetch
  })
  afterEach(() => {
    for (const restore of restoreInterpositions.splice(0).reverse()) restore()
    globalThis.fetch = originalFetch
    for (const name of ENV_NAMES) {
      if (savedEnv[name] === undefined) delete process.env[name]
      else process.env[name] = savedEnv[name]
    }
  })
  after(async () => {
    await db.n8nExecution.deleteMany({ where: { tenantId: TENANT } })
    await db.n8nWorkflow.deleteMany({ where: { code: { in: codes }, tenantId: TENANT } })
    await db.automationRun.deleteMany({ where: { tenantId: TENANT } })
    await db.automationRuleVersion.deleteMany({ where: { ruleId: { in: rules } } })
    await db.automationRule.deleteMany({ where: { id: { in: rules }, tenantId: TENANT } })
    await db.automationEvent.deleteMany({ where: { tenantId: TENANT } })
    await db.notification.deleteMany({ where: { title: { contains: RUN } } })
  })

  async function workflow() {
    const code = `AUDIT_${RUN}_${codes.length}`.toUpperCase()
    codes.push(code)
    await db.n8nWorkflow.create({ data: {
      tenantId: TENANT, code, name: code, category: 'TEST', definition: '{}', enabled: true, webhookPath: 'audit/test',
    } })
    return code
  }

  async function pendingRule(code: string) {
    const key = `${RUN}-${rules.length}`
    const { rule } = await saveRule(TENANT, {
      key, name: key, triggerType: 'LEAD_CREATED', conditions: [{ field: 'payload.audit', op: 'eq', value: key }],
      actions: [
        { type: 'N8N_EXECUTE', params: { workflowCode: code } },
        { type: 'NOTIFY_TEAM', params: { title: `completed ${key}` } },
      ], maxAttempts: 2,
    }, 'audit@example.invalid')
    rules.push(rule.id)
    await setRuleStatus(TENANT, rule.id, 'ACTIVE', 'audit@example.invalid')
    const emitted = await engine.emitAutomationEvent({
      tenantId: TENANT, type: 'LEAD_CREATED', source: 'AUDIT', payload: { audit: key }, dedupeKey: key,
    }, { process: false })
    return { key, eventId: emitted.event.id }
  }

  for (const status of ['RUNNING', 'SUCCEEDED', 'FAILED']) {
    it(`preserves a ${status} callback received before the outbound HTTP response completes`, async () => {
      const code = await workflow()
      const execution = await n8n.requestN8nExecution({ tenantId: TENANT, workflowCode: code, payload: {} }, {
        config: configured(), fetch: async (_url, init) => {
          const { correlationId } = JSON.parse(String(init?.body))
          const result = await n8n.handleN8nCallback({ correlationId, status, output: { audit: RUN }, error: status === 'FAILED' ? 'Workflow rejected the test input' : undefined })
          assert.equal(result.ok, true)
          return new Response('{"accepted":true}', { status: 200 })
        },
      })
      assert.equal(execution.status, status)
      assert.ok(execution.callbackReceivedAt)
      assert.deepEqual(JSON.parse(execution.responseBody!), { audit: RUN })
      assert.equal(Boolean(execution.finishedAt), status !== 'RUNNING')
      assert.equal(execution.attempts, 1)
      const stored = await db.n8nWorkflow.findUniqueOrThrow({ where: { code } })
      assert.equal(stored.lastRunStatus, status)
    })
  }

  for (const failure of ['500', 'network']) {
    it(`does not resend or downgrade a completed workflow if its HTTP acknowledgement ends in ${failure}`, async () => {
      const code = await workflow()
      let calls = 0
      const execution = await n8n.requestN8nExecution({ tenantId: TENANT, workflowCode: code, payload: {} }, {
        config: configured(), maxAttempts: 2, fetch: async (_url, init) => {
          calls += 1
          const { correlationId } = JSON.parse(String(init?.body))
          await n8n.handleN8nCallback({ correlationId, status: 'SUCCEEDED', output: { audit: RUN } })
          if (failure === 'network') throw new Error('Synthetic lost acknowledgement')
          return new Response('Synthetic lost acknowledgement', { status: 500 })
        },
      })
      assert.equal(calls, 1, 'a verified callback already proves that n8n received the execution')
      assert.equal(execution.status, 'SUCCEEDED')
      assert.deepEqual(JSON.parse(execution.responseBody!), { audit: RUN })
    })
  }

  it('continues remaining actions after an early terminal callback without becoming stuck or sending twice', async () => {
    const code = await workflow()
    const rule = await pendingRule(code)
    let calls = 0
    globalThis.fetch = (async (_url, init) => {
      calls += 1
      const { correlationId } = JSON.parse(String(init?.body))
      await n8n.handleN8nCallback({ correlationId, status: 'SUCCEEDED', output: { audit: RUN } })
      return new Response('{}', { status: 200 })
    }) as typeof fetch
    const [runId] = await engine.processAutomationEvent(rule.eventId)
    const run = await db.automationRun.findUniqueOrThrow({ where: { id: runId } })
    assert.equal(run.status, 'SUCCEEDED')
    assert.equal(run.attempts, 1)
    assert.equal(calls, 1)
    assert.equal(await db.notification.count({ where: { title: `completed ${rule.key}` } }), 1)
    assert.equal(await db.n8nExecution.count({ where: { automationRunId: runId } }), 1)
  })

  it('reconciles a callback that wins just before the WAITING_EXTERNAL step is persisted', async () => {
    const code = await workflow()
    const rule = await pendingRule(code)
    let correlationId = ''
    globalThis.fetch = (async (_url, init) => {
      correlationId = JSON.parse(String(init?.body)).correlationId
      return new Response('{}', { status: 200 })
    }) as typeof fetch
    const delegate = db.automationRun
    const update = delegate.update.bind(delegate)
    let injected = false
    // Interpose an actual callback at the write boundary; the original update
    // still runs against the real test DB. No DB result is fabricated.
    interpose('update', async (args: Parameters<typeof update>[0]) => {
      if (!injected && args.data.status === 'WAITING_EXTERNAL') {
        injected = true
        await n8n.handleN8nCallback({ correlationId, status: 'SUCCEEDED', output: { audit: RUN } })
      }
      return update(args)
    })
    const [runId] = await engine.processAutomationEvent(rule.eventId)
    assert.equal(injected, true)
    const run = await db.automationRun.findUniqueOrThrow({ where: { id: runId } })
    assert.equal(run.status, 'SUCCEEDED', 'a durable terminal callback cannot be lost before the waiting step exists')
    assert.equal(run.attempts, 1)
    assert.equal(await db.notification.count({ where: { title: `completed ${rule.key}` } }), 1)
  })

  it('retries run resumption on a duplicate callback after a transient resume write failure', async () => {
    const code = await workflow()
    const rule = await pendingRule(code)
    globalThis.fetch = (async () => new Response('{}', { status: 200 })) as typeof fetch
    const [runId] = await engine.processAutomationEvent(rule.eventId)
    const execution = await db.n8nExecution.findFirstOrThrow({ where: { automationRunId: runId } })
    assert.equal((await db.automationRun.findUniqueOrThrow({ where: { id: runId } })).status, 'WAITING_EXTERNAL')
    const delegate = db.automationRun
    const updateMany = delegate.updateMany.bind(delegate)
    let failed = false
    interpose('updateMany', async (args: Parameters<typeof updateMany>[0]) => {
      if (!failed && args?.where?.id === runId && args?.where?.status === 'WAITING_EXTERNAL') {
        failed = true
        throw new Error('Synthetic transient resume failure')
      }
      return updateMany(args)
    })
    await assert.rejects(() => n8n.handleN8nCallback({ correlationId: execution.correlationId, status: 'SUCCEEDED' }), /Synthetic transient resume failure/)
    assert.equal((await db.n8nExecution.findUniqueOrThrow({ where: { id: execution.id } })).status, 'SUCCEEDED')
    // A contrary duplicate must use the durable original outcome, not turn a
    // previously successful execution into a failed automation run.
    const retry = await n8n.handleN8nCallback({ correlationId: execution.correlationId, status: 'FAILED', error: 'late contrary duplicate' })
    assert.equal(retry.ok && retry.duplicate, true)
    assert.equal((await db.automationRun.findUniqueOrThrow({ where: { id: runId } })).status, 'SUCCEEDED')
    assert.equal(await db.notification.count({ where: { title: `completed ${rule.key}` } }), 1)
  })
})
