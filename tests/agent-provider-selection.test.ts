import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { getAgentProviderStatus, listAgentProviders, resolveAgentProvider } from '../src/lib/agents/provider-selection'
import { completeWithGemini, completeWithGroq, completeWithOpenAi } from '../src/lib/agents/model-provider'

const gateway = { AI_GATEWAY_BASE_URL: 'https://gateway.invalid', AGENTOS_GATEWAY_TOKEN: 'gateway-secret-test-value' }
const openrouter = { OPENROUTER_API_KEY: 'openrouter-secret-test-value' }
const openai = { OPENAI_API_KEY: 'openai-secret-test-value', OPENAI_MODEL: 'gpt-4o-mini' }
const gemini = { GEMINI_API_KEY: 'gemini-secret-test-value', GEMINI_MODEL: 'gemini-2.5-flash' }
const groq = { GROQ_API_KEY: 'groq-secret-test-value', GROQ_MODEL: 'llama-3.3-70b-versatile' }
const zai = { ZAI_BASE_URL: 'https://zai.invalid/v1', ZAI_API_KEY: 'zai-secret-test-value' }

describe('one provider selection contract for execution and diagnostics', () => {
  it('uses the same priority as the execution engine', () => {
    assert.equal(resolveAgentProvider({ ...gateway, ...openrouter, ...zai }), 'ai-gateway')
    assert.equal(resolveAgentProvider({ ...openrouter, ...zai }), 'openrouter')
    assert.equal(resolveAgentProvider({ ...openai, ...zai }), 'openai')
    assert.equal(resolveAgentProvider({ ...gemini, ...zai }), 'gemini')
    assert.equal(resolveAgentProvider({ GOOGLE_GENERATIVE_AI_API_KEY: 'google-secret', ...zai }), 'gemini')
    assert.equal(resolveAgentProvider({ ...groq, ...zai }), 'groq')
    assert.equal(resolveAgentProvider(zai), 'zai')
    assert.equal(resolveAgentProvider({}), 'none')
  })

  it('honors explicit AI_PROVIDER selection and AI_PROVIDER=none override', () => {
    const all = { ...gateway, ...openrouter, ...openai, ...gemini, ...groq, ...zai }
    assert.equal(resolveAgentProvider({ ...all, AI_PROVIDER: 'openai' }), 'openai')
    assert.equal(resolveAgentProvider({ ...all, AI_PROVIDER: 'gemini' }), 'gemini')
    assert.equal(resolveAgentProvider({ ...all, AI_PROVIDER: 'groq' }), 'groq')
    assert.equal(resolveAgentProvider({ ...all, AI_PROVIDER: 'openrouter' }), 'openrouter')
    assert.equal(resolveAgentProvider({ ...all, AI_PROVIDER: 'zai' }), 'zai')
    assert.equal(resolveAgentProvider({ ...all, AI_PROVIDER: 'none' }), 'none')
  })

  it('lists all 6 supported external provider entries with active state', () => {
    const list = listAgentProviders({ ...openai, ...groq })
    assert.equal(list.length, 6)
    const oa = list.find((p) => p.kind === 'openai')
    const gr = list.find((p) => p.kind === 'groq')
    assert.equal(oa?.configured, true)
    assert.equal(oa?.active, true)
    assert.equal(gr?.configured, true)
    assert.equal(gr?.active, false)
  })

  it('executes OpenAI, Gemini, and Groq adapters against OpenAI-compatible chat endpoints', async () => {
    const prevFetch = globalThis.fetch
    const calls: Array<{ url: string; model: string }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const parsed = JSON.parse(String(init?.body ?? '{}')) as { model?: string }
      calls.push({ url, model: parsed.model ?? '' })
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"status":"ok"}' } }],
          usage: { total_tokens: 42 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }) as typeof fetch

    try {
      const msgs = [{ role: 'user' as const, content: 'Ping' }]
      const oaRes = await completeWithOpenAi(msgs, openai)
      assert.equal(oaRes.output, '{"status":"ok"}')
      assert.equal(oaRes.tokensUsed, 42)
      assert.equal(oaRes.model, 'openai:gpt-4o-mini')

      const gemRes = await completeWithGemini(msgs, gemini)
      assert.equal(gemRes.model, 'gemini:gemini-2.5-flash')

      const groqRes = await completeWithGroq(msgs, groq)
      assert.equal(groqRes.model, 'groq:llama-3.3-70b-versatile')
      assert.equal(calls.length, 3)
    } finally {
      globalThis.fetch = prevFetch
    }
  })

  it('does not treat whitespace or partial gateway configuration as complete', () => {
    assert.equal(resolveAgentProvider({ OPENROUTER_API_KEY: '   ' }), 'none')
    assert.equal(resolveAgentProvider({ AI_GATEWAY_BASE_URL: gateway.AI_GATEWAY_BASE_URL }), 'none')
    assert.equal(resolveAgentProvider({ AGENTOS_GATEWAY_TOKEN: gateway.AGENTOS_GATEWAY_TOKEN }), 'none')
    assert.equal(getAgentProviderStatus({ ZAI_API_KEY: zai.ZAI_API_KEY }).state, 'MISCONFIGURED')
    assert.equal(getAgentProviderStatus({ ZAI_BASE_URL: 'not-a-url', ZAI_API_KEY: zai.ZAI_API_KEY }).state, 'MISCONFIGURED')
  })

  it('reports configuration, not an unperformed health check, and never returns secrets', () => {
    for (const env of [gateway, openrouter, zai]) {
      const status = getAgentProviderStatus(env)
      assert.equal(status.configured, true)
      assert.equal(status.state, 'CONFIGURED')
      assert.match(status.detail, /execution/)
      for (const value of Object.values(env)) assert.equal(JSON.stringify(status).includes(value), false)
    }
    const missing = getAgentProviderStatus({})
    assert.equal(missing.configured, false)
    assert.match(missing.detail, /OPENROUTER_API_KEY/)
    assert.match(missing.detail, /AI_GATEWAY_BASE_URL/)
    assert.match(missing.detail, /ZAI_BASE_URL/)
  })

  it('wires health, chat, ops and both operator dashboards to the selected provider', () => {
    for (const file of [
      // Operator health diagnostics (served by authenticated /api/health/deep;
      // the public /api/health is intentionally minimal).
      'src/lib/health/ai-diagnostics.ts',
      'src/app/api/admin/ops-status/route.ts',
      'src/app/api/admin/agents/route.ts',
      'src/app/api/admin/dashboard/route.ts',
      'src/app/api/chat/session/route.ts',
      'src/lib/chat-orchestrator.ts',
      'src/lib/agents/engine.ts',
    ]) {
      const source = readFileSync(file, 'utf8')
      assert.match(source, /provider-selection/, file)
      assert.doesNotMatch(source, /getZaiProviderStatus\(/, file)
    }
  })
})
