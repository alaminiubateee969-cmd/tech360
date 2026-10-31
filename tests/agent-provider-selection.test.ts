import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { getAgentProviderStatus, resolveAgentProvider } from '../src/lib/agents/provider-selection'

const gateway = { AI_GATEWAY_BASE_URL: 'https://gateway.invalid', AGENTOS_GATEWAY_TOKEN: 'gateway-secret-test-value' }
const openrouter = { OPENROUTER_API_KEY: 'openrouter-secret-test-value' }
const zai = { ZAI_BASE_URL: 'https://zai.invalid/v1', ZAI_API_KEY: 'zai-secret-test-value' }

describe('one provider selection contract for execution and diagnostics', () => {
  it('uses the same priority as the execution engine', () => {
    assert.equal(resolveAgentProvider({ ...gateway, ...openrouter, ...zai }), 'ai-gateway')
    assert.equal(resolveAgentProvider({ ...openrouter, ...zai }), 'openrouter')
    assert.equal(resolveAgentProvider(zai), 'zai')
    assert.equal(resolveAgentProvider({}), 'none')
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
      'src/app/api/health/route.ts',
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
