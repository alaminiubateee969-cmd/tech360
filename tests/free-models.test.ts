/** Free-model provider chain (OpenRouter) — unit tests, no network. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  completeWithFreeModels,
  DEFAULT_FREE_MODELS,
  FREE_MODEL_ROUTER,
  freeModelChain,
  openRouterConfigured,
} from '../src/lib/agents/model-provider'
import { gatewayComplete } from '../src/lib/ai-gateway/client'

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

  it('propagates AbortSignal to OpenRouter and AI Gateway requests and stops retry loops when aborted', async () => {
    const controller = new AbortController()
    let calls = 0
    const origFetch = globalThis.fetch
    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      calls += 1
      assert.ok(init?.signal, 'fetch must receive a signal')
      assert.equal(init.signal.aborted, false)
      controller.abort()
      assert.equal(init.signal.aborted, true, 'aborting outer controller must abort fetch signal')
      throw new DOMException('Aborted', 'AbortError')
    }) as typeof fetch

    try {
      await assert.rejects(
        completeWithFreeModels([{ role: 'user', content: 'hi' }], {
          OPENROUTER_API_KEY: 'sk-test',
          OPENROUTER_MODELS: 'model/a:free, model/b:free',
        }, controller.signal),
      )
      assert.equal(calls, 1, 'aborted loop must not keep trying remaining fallback models')

      const gwController = new AbortController()
      let gwSignalSeen: AbortSignal | undefined
      globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
        gwSignalSeen = init?.signal ?? undefined
        return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }], model: 'm', provider: 'p' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }) as typeof fetch

      const res = await gatewayComplete(
        [{ role: 'user', content: 'hi' }],
        { AI_GATEWAY_BASE_URL: 'https://gw.example.com', AGENTOS_GATEWAY_TOKEN: 'tok' },
        gwController.signal,
      )
      assert.equal(res.output, 'ok')
      assert.equal(gwSignalSeen, gwController.signal)
    } finally {
      globalThis.fetch = origFetch
    }

    const engine = readFileSync('src/lib/agents/engine.ts', 'utf8')
    assert.match(engine, /withTimeout\(\(signal\) => gatewayComplete\(messages as ChatMessage\[\], process\.env, signal\)/)
    assert.match(engine, /withTimeout\(\(signal\) => completeWithFreeModels\(messages as ChatMessage\[\], process\.env, signal\)/)
  })
})
