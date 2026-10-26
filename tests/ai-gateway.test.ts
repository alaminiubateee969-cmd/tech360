/** Shared AI Gateway: fail-closed config, app auth, classification
 *  and model policy, rate/concurrency limits, bounded retries,
 *  circuit breaker, budget gates, audit secret-safety, mock rules
 *  and readiness. Pure unit tests — no network, no database. */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createHash } from 'node:crypto'
import { loadGatewayConfig, type GatewayConfig } from '../src/lib/ai-gateway/config'
import {
  authenticateApp, checkRateLimit, createGatewayState, decideRoute, estimateCostUsd,
  executeGatewayRequest, readiness, type AuditEvent, type ProviderFn,
} from '../src/lib/ai-gateway/core'

const digest = (s: string) => createHash('sha256').update(s).digest('hex')
const CRM_TOKEN = 'crm-token-0123456789abcdef'
const PHD_TOKEN = 'phd-token-0123456789abcdef'

const appsJson = JSON.stringify([
  { id: 'crm', tokenSha256: digest(CRM_TOKEN), dataClassification: 'INTERNAL', allowExternal: false, allowedModels: ['openrouter/free'], requestsPerMinute: 2 },
  { id: 'phd', tokenSha256: digest(PHD_TOKEN), dataClassification: 'CONFIDENTIAL', allowExternal: true, allowedModels: ['local-private', 'openrouter/free'], requestsPerMinute: 60 },
])
const extCfg = { OPENROUTER_API_KEY: 'sk-test', AI_PROVIDER_ALLOWLIST: 'openrouter', AI_EXTERNAL_DATA_POLICY: 'approved' }
const phdReq = { messages: [{ role: 'user' as const, content: 'Summarise this record' }], model: 'openrouter/free' }

function cfg(env: Record<string, string> = {}): GatewayConfig {
  const { config, errors } = loadGatewayConfig({ NODE_ENV: 'test', AI_GATEWAY_APPS: appsJson, ...env })
  assert.deepEqual(errors, [])
  return config
}

describe('gateway config validation (fail closed)', () => {
  it('production without a registry fails', () => {
    const { errors } = loadGatewayConfig({ NODE_ENV: 'production' })
    assert.match(errors.join(' '), /AI_GATEWAY_APPS is required/)
  })
  it('rejects placeholder/invalid digests', () => {
    const bad = JSON.stringify([{ id: 'x', tokenSha256: 'REPLACE_WITH_SHA256', dataClassification: 'INTERNAL' }])
    assert.match(loadGatewayConfig({ NODE_ENV: 'test', AI_GATEWAY_APPS: bad }).errors.join(' '), /64 lowercase hex/)
  })
  it('rejects duplicate app ids and invalid classifications', () => {
    const dup = JSON.stringify([
      { id: 'crm', tokenSha256: digest('a-token-0123456789'), dataClassification: 'INTERNAL' },
      { id: 'crm', tokenSha256: digest('b-token-0123456789'), dataClassification: 'SECRET' },
    ])
    const { errors } = loadGatewayConfig({ NODE_ENV: 'test', AI_GATEWAY_APPS: dup })
    assert.match(errors.join(' '), /Duplicate gateway app id/)
    assert.match(errors.join(' '), /dataClassification/)
  })
  it('forbids mock mode and prompt logging in production', () => {
    const { errors } = loadGatewayConfig({ NODE_ENV: 'production', AI_GATEWAY_APPS: appsJson, AI_GATEWAY_ENABLE_MOCK: 'true', AI_GATEWAY_LOG_PROMPTS: 'true' })
    assert.match(errors.join(' '), /mock.*forbidden in production/i)
    assert.match(errors.join(' '), /LOG_PROMPTS.*forbidden/)
  })
  it('requires the approved data policy for external fallback', () => {
    assert.match(loadGatewayConfig({ NODE_ENV: 'test', AI_GATEWAY_APPS: appsJson, AI_GATEWAY_EXTERNAL_FALLBACK_ENABLED: 'true' }).errors.join(' '), /AI_EXTERNAL_DATA_POLICY=approved/)
  })
  it('valid registry parses with safe defaults', () => {
    const config = cfg()
    assert.equal(config.externalDataPolicy, 'restricted')
    assert.equal(config.apps.find((a) => a.id === 'crm')?.allowExternal, false)
    assert.equal(config.logPrompts, false)
  })
})

describe('application authentication', () => {
  it('accepts the correct token via SHA-256 registry lookup', () => {
    const auth = authenticateApp(cfg(), CRM_TOKEN)
    assert.equal(auth.ok, true)
    if (auth.ok) assert.equal(auth.app.id, 'crm')
  })
  it('rejects incorrect credentials and missing headers', () => {
    assert.equal(authenticateApp(cfg(), 'wrong-token-0123456789').ok, false)
    assert.deepEqual(authenticateApp(cfg(), null), { ok: false, code: 'UNAUTHENTICATED' })
  })
  it('error bodies never echo the presented token', async () => {
    const res = await executeGatewayRequest(cfg(), { providers: {}, state: createGatewayState() }, {
      authHeader: `Bearer ${CRM_TOKEN}-tampered`, rawBytes: 10,
      request: { messages: [{ role: 'user', content: 'hi' }] },
    })
    assert.equal(res.status, 401)
    assert.ok(!JSON.stringify(res.body).includes('tampered'))
  })
})

describe('policy router', () => {
  it('denies requests above the app classification ceiling', () => {
    const config = cfg(extCfg)
    const route = decideRoute(config, config.apps[0], 'CONFIDENTIAL')
    assert.equal(route.ok, false)
    if (!route.ok) assert.equal(route.code, 'POLICY_DENIED')
  })
  it('enforces the per-app model allowlist (PHD-style)', () => {
    const config = cfg(extCfg)
    const route = decideRoute(config, config.apps[1], 'INTERNAL', 'unapproved-paid-model')
    assert.equal(route.ok, false)
    if (!route.ok) assert.equal(route.code, 'MODEL_NOT_ALLOWED')
  })
  it('never routes CONFIDENTIAL data externally even with every external gate open', () => {
    const config = cfg(extCfg)
    const route = decideRoute(config, config.apps[1], 'CONFIDENTIAL', 'openrouter/free')
    assert.ok(route.ok === false || route.routes.every((r) => r.provider !== 'external'))
  })
  it('keeps external inference disabled by default (restricted policy)', () => {
    const config = cfg({ OPENROUTER_API_KEY: 'sk-test', AI_PROVIDER_ALLOWLIST: 'openrouter' })
    const route = decideRoute(config, config.apps[1], 'PUBLIC', 'openrouter/free')
    assert.ok(route.ok === false || route.routes.every((r) => r.provider !== 'external'))
  })
  it('prefers local and only falls back externally when fallback is approved on', () => {
    const localEnv = { LOCAL_MODEL_BASE_URL: 'http://127.0.0.1:11434/v1', LOCAL_MODEL_NAME: 'local-private', ...extCfg }
    const noFallback = decideRoute(cfg(localEnv), cfg(localEnv).apps[1], 'INTERNAL')
    assert.ok(noFallback.ok)
    if (noFallback.ok) assert.deepEqual(noFallback.routes.map((r) => r.provider), ['local'])
    const withFallback = decideRoute(cfg({ ...localEnv, AI_GATEWAY_EXTERNAL_FALLBACK_ENABLED: 'true' }), cfg(localEnv).apps[1], 'INTERNAL')
    assert.ok(withFallback.ok)
    if (withFallback.ok) assert.deepEqual(withFallback.routes.map((r) => r.provider), ['local', 'external'])
  })
  it('external route requires the app-level allowExternal flag', () => {
    const config = cfg(extCfg)
    const route = decideRoute(config, config.apps[0], 'INTERNAL', 'openrouter/free') // crm allowExternal=false
    assert.ok(route.ok === false || route.routes.every((r) => r.provider !== 'external'))
  })
})

describe('execution pipeline protections', () => {
  it('rate limits per application', async () => {
    const limitedJson = JSON.stringify([
      { id: 'busy', tokenSha256: digest('busy-token-0123456789'), dataClassification: 'INTERNAL', allowExternal: true, allowedModels: ['openrouter/free'], requestsPerMinute: 2 },
    ])
    const { config } = loadGatewayConfig({ NODE_ENV: 'test', AI_GATEWAY_APPS: limitedJson, ...extCfg })
    const state = createGatewayState()
    const deps = { providers: { external: async () => ({ content: 'x' }) }, state, sleep: async () => {} }
    const input = { authHeader: 'Bearer busy-token-0123456789', rawBytes: 10, request: phdReq }
    assert.equal((await executeGatewayRequest(config, deps, input)).status, 200)
    assert.equal((await executeGatewayRequest(config, deps, input)).status, 200)
    const limited = await executeGatewayRequest(config, deps, input)
    assert.equal(limited.status, 429)
    assert.deepEqual((limited.body as { error: unknown }).error, { code: 'RATE_LIMITED', message: 'Rate limit of 2 requests/minute exceeded for busy' })
    assert.equal(checkRateLimit(state, config.apps[0]), false)
  })

  it('enforces the concurrency cap', async () => {
    const config = cfg({ ...extCfg, AI_GATEWAY_MAX_CONCURRENT_REQUESTS: '1' })
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const slow: ProviderFn = async () => { await gate; return { content: 'done' } }
    const deps = { providers: { external: slow }, state: createGatewayState(), sleep: async () => {} }
    const input = { authHeader: `Bearer ${PHD_TOKEN}`, rawBytes: 10, request: phdReq }
    const pending = executeGatewayRequest(config, deps, input)
    await new Promise((r) => setTimeout(r, 10))
    assert.equal((await executeGatewayRequest(config, deps, input)).status, 429)
    release()
    assert.equal((await pending).status, 200)
  })

  it('retries transient failures a bounded number of times', async () => {
    let calls = 0
    const flaky: ProviderFn = async () => { calls += 1; if (calls < 3) throw new Error('Provider HTTP 503'); return { content: 'recovered' } }
    const res = await executeGatewayRequest(cfg({ ...extCfg, AI_GATEWAY_MAX_RETRIES: '2' }), { providers: { external: flaky }, state: createGatewayState(), sleep: async () => {} }, { authHeader: `Bearer ${PHD_TOKEN}`, rawBytes: 50, request: phdReq })
    assert.equal(res.status, 200)
    assert.equal(calls, 3)
  })

  it('opens the circuit after repeated failures and fails fast', async () => {
    const config = cfg({ ...extCfg, AI_GATEWAY_MAX_RETRIES: '0', AI_GATEWAY_CIRCUIT_FAILURE_THRESHOLD: '2' })
    const state = createGatewayState()
    let calls = 0
    const down: ProviderFn = async () => { calls += 1; throw new Error('Provider HTTP 500') }
    const deps = { providers: { external: down }, state, sleep: async () => {} }
    const input = { authHeader: `Bearer ${PHD_TOKEN}`, rawBytes: 10, request: phdReq }
    await executeGatewayRequest(config, deps, input)
    await executeGatewayRequest(config, deps, input)
    assert.equal((await executeGatewayRequest(config, deps, input)).status, 502)
    assert.equal(calls, 2) // third request never reached the provider
  })

  it('rejects oversized inputs before any provider call', async () => {
    let calls = 0
    const res = await executeGatewayRequest(cfg(extCfg), { providers: { external: async () => { calls += 1; return { content: 'x' } } }, state: createGatewayState() }, {
      authHeader: `Bearer ${PHD_TOKEN}`, rawBytes: 2_000_000, request: phdReq,
    })
    assert.equal(res.status, 413)
    assert.equal(calls, 0)
  })

  it('clamps requested output tokens to the gateway maximum', async () => {
    let seen = 0
    await executeGatewayRequest(cfg({ ...extCfg, AI_GATEWAY_MAX_OUTPUT_TOKENS: '100' }), {
      providers: { external: async ({ maxTokens }) => { seen = maxTokens; return { content: 'x' } } }, state: createGatewayState(),
    }, { authHeader: `Bearer ${PHD_TOKEN}`, rawBytes: 10, request: { ...phdReq, maxTokens: 99999 } })
    assert.equal(seen, 100)
  })

  it('audits success without the token, prompt, or completion text', async () => {
    const events: AuditEvent[] = []
    const res = await executeGatewayRequest(cfg(extCfg), {
      providers: { external: async () => ({ content: 'real model answer', usage: { promptTokens: 10, completionTokens: 5 } }) },
      state: createGatewayState(),
      audit: (e) => { events.push(e) },
    }, { authHeader: `Bearer ${PHD_TOKEN}`, rawBytes: 10, request: phdReq })
    assert.equal(res.status, 200)
    assert.equal(events.length, 1)
    const blob = JSON.stringify(events[0])
    assert.ok(!blob.includes(PHD_TOKEN))
    assert.ok(!blob.includes('Summarise this record'))
    assert.ok(!blob.includes('real model answer'))
    assert.equal(events[0].appId, 'phd')
    assert.equal(events[0].outcome, 'success')
    assert.equal(events[0].provider, 'external')
  })

  it('refuses unknown-cost routes when budgets are configured instead of guessing', async () => {
    const config = cfg({ ...extCfg, AI_MAX_COST_PER_REQUEST: '0.01' })
    let calls = 0
    const res = await executeGatewayRequest(config, { providers: { external: async () => { calls += 1; return { content: 'paid answer' } } }, state: createGatewayState() }, {
      authHeader: `Bearer ${PHD_TOKEN}`, rawBytes: 10, request: { messages: phdReq.messages, model: 'local-private' },
    })
    assert.equal(res.status, 403)
    assert.equal((res.body as { error: { code: string } }).error.code, 'UNKNOWN_COST')
    assert.equal(calls, 0)
    assert.equal(estimateCostUsd('external', 'some-paid-model'), null)
    assert.equal(estimateCostUsd('external', 'openrouter/free'), 0)
  })
})

describe('mock + readiness rules', () => {
  it('mock answers only in non-production and is clearly marked', async () => {
    const config = cfg({ AI_GATEWAY_ENABLE_MOCK: 'true' })
    const res = await executeGatewayRequest(config, { providers: { mock: async () => ({ content: 'mock reply', costUsd: 0 }) }, state: createGatewayState() }, {
      authHeader: `Bearer ${CRM_TOKEN}`, rawBytes: 10, request: { messages: [{ role: 'user', content: 'hi' }] },
    })
    assert.equal(res.status, 200)
    assert.equal((res.body as { mock: boolean }).mock, true)
    assert.equal((res.body as { provider: string }).provider, 'mock')
  })
  it('readiness fails with no registry and no real provider; mock never satisfies it', () => {
    const empty = loadGatewayConfig({ NODE_ENV: 'production', AI_GATEWAY_ENABLE_MOCK: 'true' })
    assert.equal(readiness(empty.config, empty.errors).ready, false)
    assert.equal(readiness(cfg({ OPENROUTER_API_KEY: 'sk-test', AI_PROVIDER_ALLOWLIST: 'openrouter' }), []).ready, true)
  })
})
