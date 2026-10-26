/** Free-model provider chain (OpenRouter) — unit tests, no network. */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_FREE_MODELS,
  FREE_MODEL_ROUTER,
  freeModelChain,
  openRouterConfigured,
} from '../src/lib/agents/model-provider'

describe('free model provider', () => {
  it('defaults to the free router plus curated :free models', () => {
    const chain = freeModelChain({})
    assert.equal(chain[0], FREE_MODEL_ROUTER)
    assert.ok(chain.length >= 5)
    for (const m of chain.slice(1)) assert.ok(m.endsWith(':free'), `${m} must be a free model`)
    assert.deepEqual(chain, [...DEFAULT_FREE_MODELS])
  })

  it('honours the OPENROUTER_MODELS override', () => {
    assert.deepEqual(freeModelChain({ OPENROUTER_MODELS: 'a/b:free, c/d:free ' }), ['a/b:free', 'c/d:free'])
    assert.deepEqual(freeModelChain({ OPENROUTER_MODELS: '  ' }), [...DEFAULT_FREE_MODELS])
  })

  it('is configured only with a real key', () => {
    assert.equal(openRouterConfigured({}), false)
    assert.equal(openRouterConfigured({ OPENROUTER_API_KEY: '  ' }), false)
    assert.equal(openRouterConfigured({ OPENROUTER_API_KEY: 'sk-or-...' }), true)
  })
})
