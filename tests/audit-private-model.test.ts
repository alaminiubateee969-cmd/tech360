import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, it } from 'node:test'
import { resolveProviderOrder, routeChat } from '../src/lib/model/router'
import { ollamaChat, ollamaEmbed, type OllamaConfig } from '../src/lib/model/providers/ollama'
import { openAiCompatibleChat, openAiCompatibleEmbed } from '../src/lib/model/providers/openai-compatible'

const originalFetch = globalThis.fetch
const config: OllamaConfig = {
  baseUrl: 'http://127.0.0.1:11434', apiKey: null, chatModel: 'audit-local-chat', embeddingModel: 'audit-local-embed', timeoutMs: 2000,
}
const messages = [{ role: 'user' as const, content: 'Synthetic private test input.' }]
const localEnv: NodeJS.ProcessEnv = { NODE_ENV: 'test', LOCAL_OPENAI_BASE_URL: 'http://127.0.0.1:11434/v1' }
const remoteEnv: NodeJS.ProcessEnv = { NODE_ENV: 'test', ZAI_BASE_URL: 'https://audit-remote.invalid/v1', ZAI_API_KEY: 'audit-synthetic-key' }

afterEach(() => { globalThis.fetch = originalFetch })
function respond(value: unknown) {
  globalThis.fetch = (async () => new Response(JSON.stringify(value), { status: 200 })) as typeof fetch
}

describe('audit: private model routing requires an explicit external chain opt-in', () => {
  it('does not send company data remotely just because an unrelated ZAI key is configured', async () => {
    let calls = 0
    globalThis.fetch = (async () => {
      calls += 1
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Synthetic remote answer' } }] }))
    }) as typeof fetch
    const result = await routeChat({ messages }, remoteEnv)
    assert.equal(calls, 0, 'blank AI_PROVIDER_ORDER must not authorize remote fallback')
    assert.equal(result.ok, false)
    assert.deepEqual(resolveProviderOrder({ NODE_ENV: 'test' }), ['ollama', 'openai-compatible'])
  })

  it('does not turn an invalid explicit order into a default remote fallback', async () => {
    let calls = 0
    globalThis.fetch = (async () => { calls += 1; return new Response('{}') }) as typeof fetch
    const result = await routeChat({ messages }, { ...remoteEnv, AI_PROVIDER_ORDER: 'misspelled-provider' })
    assert.equal(calls, 0)
    assert.equal(result.ok, false)
    assert.deepEqual(resolveProviderOrder({ NODE_ENV: 'test', AI_PROVIDER_ORDER: 'misspelled-provider' }), [])
  })

  it('preserves explicitly authorized remote execution and records which provider answered', async () => {
    respond({ choices: [{ message: { content: 'Synthetic opted-in remote answer' } }] })
    const result = await routeChat({ messages }, { ...remoteEnv, AI_PROVIDER_ORDER: 'zai' })
    assert.equal(result.ok, true)
    assert.equal(result.provider, 'zai')
  })
})

describe('audit: private model adapters do not report malformed responses as successful inference', () => {
  it('sends generation controls in Ollama options, with JSON format at the request root', async () => {
    let body: Record<string, unknown> = {}
    globalThis.fetch = (async (_url, init) => {
      body = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({ message: { content: '{"ok":true}' } }))
    }) as typeof fetch
    await ollamaChat(config, { messages, temperature: 0.35, maxTokens: 72, topP: 0.8, stop: ['END'], jsonMode: true })
    assert.deepEqual(body.options, { temperature: 0.35, num_predict: 72, top_p: 0.8, stop: ['END'] })
    assert.equal(body.format, 'json')
    assert.equal(body.temperature, undefined)
    assert.equal(body.num_predict, undefined)
  })

  for (const value of [{}, { message: {} }, { message: { content: '  ' } }]) {
    it(`rejects empty Ollama chat output ${JSON.stringify(value)}`, async () => {
      respond(value)
      const result = await ollamaChat(config, { messages })
      assert.equal(result.ok, false)
      assert.equal(result.errorCode, 'INVALID_PROVIDER_RESPONSE')
    })
  }
  for (const value of [{}, { choices: [] }, { choices: [{ message: { content: ' ' } }] }]) {
    it(`rejects empty local OpenAI-compatible output ${JSON.stringify(value)}`, async () => {
      respond(value)
      const result = await openAiCompatibleChat({ messages }, localEnv)
      assert.equal(result.ok, false)
      assert.equal(result.errorCode, 'INVALID_PROVIDER_RESPONSE')
    })
  }

  it('leaves unmeasured first-token latency null rather than presenting average token time as a measurement', async () => {
    respond({ message: { content: 'Synthetic local answer.' }, eval_count: 20, total_duration: 2_000_000_000, load_duration: 400_000_000 })
    const result = await ollamaChat(config, { messages })
    assert.equal(result.ok, true)
    assert.equal(result.firstTokenMs, null, 'a non-streaming response does not measure time to first token')
  })

  for (const vector of [undefined, [], ['not-a-number'], [1, null], [1, '2']]) {
    it(`rejects invalid embedding vectors ${JSON.stringify(vector)} in both adapters`, async () => {
      respond({ embedding: vector })
      const ollama = await ollamaEmbed(config, { input: 'Synthetic text' })
      assert.equal(ollama.ok, false)
      assert.equal(ollama.errorCode, 'INVALID_PROVIDER_RESPONSE')
      respond({ data: [{ embedding: vector }] })
      const compatible = await openAiCompatibleEmbed({ input: 'Synthetic text' }, localEnv)
      assert.equal(compatible.ok, false)
      assert.equal(compatible.errorCode, 'INVALID_PROVIDER_RESPONSE')
    })
  }

  it('embeds an array as separate legacy Ollama prompts, preserving input order and vector count', async () => {
    const prompts: unknown[] = []
    globalThis.fetch = (async (_url, init) => {
      const { prompt } = JSON.parse(String(init?.body))
      prompts.push(prompt)
      return new Response(JSON.stringify({ embedding: prompt === 'first' ? [1, 2] : [3, 4] }))
    }) as typeof fetch
    const result = await ollamaEmbed(config, { input: ['first', 'second'] })
    assert.equal(result.ok, true)
    assert.deepEqual(prompts, ['first', 'second'])
    assert.deepEqual(result.vectors, [[1, 2], [3, 4]])
  })

  it('rejects missing and inconsistent vectors in a local OpenAI-compatible batch', async () => {
    for (const data of [[{ embedding: [1, 2] }], [{ embedding: [1, 2] }, { embedding: [3] }]]) {
      respond({ data })
      const result = await openAiCompatibleEmbed({ input: ['first', 'second'] }, localEnv)
      assert.equal(result.ok, false)
      assert.equal(result.errorCode, 'INVALID_PROVIDER_RESPONSE')
    }
  })
})

async function listen(server: Server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}
async function close(server: Server) {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

describe('audit: private model endpoints cannot redirect prompts to another server', () => {
  for (const kind of ['ollama', 'openai-compatible']) {
    it(`refuses HTTP redirects in the ${kind} adapter (two real loopback fixture servers)`, async () => {
      globalThis.fetch = originalFetch
      let received = 0
      const destination = createServer((_req, res) => {
        received += 1
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ message: { content: 'Redirected answer' }, choices: [{ message: { content: 'Redirected answer' } }] }))
      })
      const destinationUrl = await listen(destination)
      const source = createServer((_req, res) => { res.writeHead(307, { Location: `${destinationUrl}/capture` }); res.end() })
      const sourceUrl = await listen(source)
      try {
        const result = kind === 'ollama'
          ? await ollamaChat({ ...config, baseUrl: sourceUrl }, { messages })
          : await openAiCompatibleChat({ messages }, { NODE_ENV: 'test', LOCAL_OPENAI_BASE_URL: sourceUrl })
        assert.equal(received, 0, 'private data must not follow a redirect outside the admitted upstream')
        assert.equal(result.ok, false)
      } finally {
        await close(source)
        await close(destination)
      }
    })
  }
})
