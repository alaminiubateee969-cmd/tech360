import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getZaiProviderStatus, resolveZaiEnvConfig, createZaiClient, ZaiProviderError } from '../src/lib/ai-provider'

describe('ZAI provider configuration', () => {
  it('reports NOT_CONFIGURED without either secret or URL', () => {
    assert.deepEqual(getZaiProviderStatus({}), {
      state: 'NOT_CONFIGURED', configured: false, baseUrlConfigured: false, apiKeyConfigured: false,
      detail: 'ZAI_BASE_URL and ZAI_API_KEY are not configured',
    })
  })

  it('reports MISCONFIGURED for a partial or unsafe URL', () => {
    assert.equal(resolveZaiEnvConfig({ ZAI_BASE_URL: 'https://provider.example/v1' }).state, 'MISCONFIGURED')
    assert.equal(resolveZaiEnvConfig({ ZAI_BASE_URL: 'https://user:pass@provider.example/v1', ZAI_API_KEY: 'secret' }).state, 'MISCONFIGURED')
  })

  it('accepts a complete configuration without returning the key in status', () => {
    const status = getZaiProviderStatus({ ZAI_BASE_URL: 'https://provider.example/v1', ZAI_API_KEY: 'secret-value' })
    assert.equal(status.state, 'CONFIGURED')
    assert.equal(status.configured, true)
    assert.equal(JSON.stringify(status).includes('secret-value'), false)
  })

  it('fails honestly before any request when configuration is absent', () => {
    assert.throws(() => createZaiClient({}), (error: unknown) => error instanceof ZaiProviderError && error.code === 'PROVIDER_NOT_CONFIGURED')
  })
})
