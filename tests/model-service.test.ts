/**
 * TECH360 — private model service tests.
 *
 * These exercise the REAL production code:
 *   src/lib/model/providers/ollama.ts   (local inference client)
 *   src/lib/model/providers/openai-compatible.ts
 *   src/lib/model/router.ts             (provider chain)
 *   src/lib/model/gateway.ts            (auth / rate limit / validation)
 *   src/app/api/model/v1/.../route.ts  (the private API surface)
 *
 * A fake Ollama server is started on 127.0.0.1 so the whole private path
 * (request → SSRF check → provider → response) is proven without a GPU or
 * model weights. The Prisma client is stubbed because the schema engine
 * binary cannot be downloaded in every environment.
 */
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { after, before, beforeEach, describe, it, mock } from 'node:test'
import type { AddressInfo } from 'node:net'

// ---- stub @prisma/client so src/lib/db.ts can be imported --------------
type Call = { method: string; args: unknown }
const calls: Call[] = []

class PrismaClientStub {
  auditLog = {
    create: async (args: unknown) => {
      calls.push({ method: 'auditLog.create', args })
      return { id: 'audit_1' }
    },
  }
  errorLog = {
    create: async () => ({ id: 'err_1' }),
  }
  notification = {
    create: async () => ({ id: 'notif_1' }),
  }
}

mock.module('@prisma/client', {
  namedExports: { PrismaClient: PrismaClientStub },
  defaultExport: { PrismaClient: PrismaClientStub },
})

// ---- the modules under test (loaded after the mock is registered) ----
// This test file is compiled to CommonJS, so top-level await is not
// available. The modules are therefore loaded lazily inside `before()`,
// after mock.module() has been registered.
type ModelServiceModules = {
  isPrivateUpstream: (u: string) => boolean
  resolveOllamaConfig: (env: Record<string, string | undefined>) => { config: unknown; reason: string }
  ollamaChat: (c: unknown, r: unknown) => Promise<{ ok: boolean; content: string }>
  ollamaEmbed: (c: unknown, r: unknown) => Promise<{ ok: boolean; vectors: number[][] }>
  authenticateModelRequest: (req: Request, env?: Record<string, string | undefined>) => { ok: boolean } & Record<string, unknown>
  normaliseChatRequest: (b: Record<string, unknown>) => { ok: true; value: { temperature: number; maxTokens: number } } | { ok: false; message: string }
  enforceGatewayRateLimit: (req: Request, keyId: string, limit?: { max: number; windowMs: number }) => { ok: boolean }
  gatewayEnabled: (env?: Record<string, string | undefined>) => boolean
  routeChat: (r: unknown, env?: Record<string, string | undefined>) => Promise<{ ok: boolean; provider: string; content: string; errorCode: string | null; error: string; tokensUsed: number | null; durationMs: number }>
  routeEmbed: (r: unknown, env?: Record<string, string | undefined>) => Promise<{ ok: boolean; vectors: number[][]; dimensions: number | null }>
  modelServiceStatus: (env?: Record<string, string | undefined>) => { state: string; gateway: { enabled: boolean }; providers: Array<{ kind: string; state: string }> }
  resolveProviderOrder: (env: Record<string, string | undefined>) => string[]
  MODEL_CATALOG: Array<{ slug: string; license: string; licenseVerified: boolean; weightsVerified: boolean; weightChecksum: string | null; revision: string | null; ramFootprintMb: number }>
  selectSmallestAcceptingModel: (
    candidates: string[],
    measured: Record<string, unknown>,
  ) => { selected: { slug: string } | null; rejected: Array<{ slug: string; reason: string }> }
  PROFILE_CANDIDATES: Record<string, string[]>
  modelChat: (req: Request) => Promise<Response>
  modelEmbeddings: (req: Request) => Promise<Response>
  modelModels: (req: Request) => Promise<Response>
}

let M: ModelServiceModules

async function loadModules(): Promise<ModelServiceModules> {
  const [ollama, gateway, router, registry, chat, embeddings, models] = await Promise.all([
    import('../src/lib/model/providers/ollama'),
    import('../src/lib/model/gateway'),
    import('../src/lib/model/router'),
    import('../src/lib/model/registry'),
    import('../src/app/api/model/v1/chat/route'),
    import('../src/app/api/model/v1/embeddings/route'),
    import('../src/app/api/model/v1/models/route'),
  ])
  return {
    ...(ollama as object),
    ...(gateway as object),
    ...(router as object),
    ...(registry as object),
    modelChat: chat.POST,
    modelEmbeddings: embeddings.POST,
    modelModels: models.GET,
  } as unknown as ModelServiceModules
}

// ---- fake Ollama server -------------------------------------------------
let server: Server
let baseUrl = ''
let lastChatBody: Record<string, unknown> = {}
let chatStatus = 200

const EMBEDDING = [0.1, 0.2, 0.3, 0.4]

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data))
  })
}

before(async () => {
  M = await loadModules()
  server = createServer(async (req, res) => {
    const url = req.url ?? ''
    if (url === '/api/chat') {
      const raw = await readBody(req)
      lastChatBody = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
      res.writeHead(chatStatus, { 'Content-Type': 'application/json' })
      if (chatStatus !== 200) {
        res.end(JSON.stringify({ error: 'model not loaded' }))
        return
      }
      res.end(
        JSON.stringify({
          message: { role: 'assistant', content: 'Private local answer.' },
          done: true,
          done_reason: 'stop',
          eval_count: 24,
          prompt_eval_count: 12,
          total_duration: 2_400_000_000,
          load_duration: 400_000_000,
        }),
      )
      return
    }
    if (url === '/api/embeddings') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ embedding: EMBEDDING }))
      return
    }
    if (url === '/api/tags') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          models: [{ name: 'qwen2.5:1.5b-instruct-q4_K_M', size: 1_610_612_736, details: { family: 'qwen2' } }],
        }),
      )
      return
    }
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

const GATEWAY_KEY = 'test-model-key-0123456789abcdefghijklmnop'

beforeEach(() => {
  calls.length = 0
  chatStatus = 200
  lastChatBody = {}
  process.env.MODEL_API_KEY = GATEWAY_KEY
  process.env.LOCAL_MODEL_BASE_URL = baseUrl
  process.env.LOCAL_MODEL_CHAT_MODEL = 'qwen2.5:1.5b-instruct-q4_K_M'
  process.env.LOCAL_MODEL_EMBED_MODEL = 'bge-m3:latest'
  process.env.AI_PROVIDER_ORDER = 'ollama,openai-compatible,zai'
  delete process.env.LOCAL_OPENAI_BASE_URL
  delete process.env.ZAI_BASE_URL
  delete process.env.ZAI_API_KEY
})

function authedRequest(url: string, init: RequestInit = {}): Request {
  return new Request(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GATEWAY_KEY}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  })
}

// ============================================================
describe('private model service — upstream address safety', () => {
  it('accepts loopback and private-network upstreams', () => {
    for (const url of [
      'http://127.0.0.1:11434',
      'http://localhost:11434',
      'http://10.0.0.5:8000',
      'http://192.168.1.20:11434',
      'http://172.16.4.9:11434',
      'http://[::1]:11434',
    ]) {
      assert.equal(M.isPrivateUpstream(url), true, `${url} should be allowed`)
    }
  })

  it('rejects public and malformed upstreams so company data cannot leak', () => {
    for (const url of [
      'https://api.openai.com',
      'https://generativelanguage.googleapis.com',
      'http://8.8.8.8:11434',
      'http://0.0.0.0:11434',
      'ftp://127.0.0.1',
      'not-a-url',
      'http://user:pass@127.0.0.1',
    ]) {
      assert.equal(M.isPrivateUpstream(url), false, `${url} must be rejected`)
    }
  })

  it('refuses to configure an ollama provider on a public address', () => {
    const { config, reason } = M.resolveOllamaConfig({ LOCAL_MODEL_BASE_URL: 'https://ollama.example.com' })
    assert.equal(config, null)
    assert.match(reason, /loopback or private-network/)
  })
})

// ============================================================
describe('private model gateway — authentication fails closed', () => {
  it('is disabled when no model key is configured', () => {
    delete process.env.MODEL_API_KEY
    assert.equal(M.gatewayEnabled(), false)
    const result = M.authenticateModelRequest(new Request('http://x/api/model/v1/chat'))
    assert.equal(result.ok, false)
    assert.equal(result.ok === false && result.status, 503)
    assert.equal(result.ok === false && result.code, 'MODEL_GATEWAY_DISABLED')
  })

  it('rejects a request with no key', () => {
    const result = M.authenticateModelRequest(new Request('http://x/api/model/v1/chat'))
    assert.equal(result.ok, false)
    assert.equal(result.ok === false && result.status, 401)
  })

  it('rejects a wrong key with 403', () => {
    const result = M.authenticateModelRequest(
      new Request('http://x/api/model/v1/chat', { headers: { Authorization: 'Bearer wrong-key' } }),
    )
    assert.equal(result.ok, false)
    assert.equal(result.ok === false && result.status, 403)
  })

  it('accepts the configured key and exposes only a fingerprint', () => {
    const result = M.authenticateModelRequest(authedRequest('http://x/api/model/v1/chat'))
    assert.equal(result.ok, true)
    const fingerprint = (result as unknown as { keyFingerprint: string }).keyFingerprint
    assert.equal(fingerprint.length, 8)
    assert.notEqual(fingerprint, GATEWAY_KEY)
  })
})

// ============================================================
describe('private model gateway — request validation', () => {
  it('rejects an empty message list', () => {
    const result = M.normaliseChatRequest({ messages: [] })
    assert.equal(result.ok, false)
  })

  it('rejects an unknown role', () => {
    const result = M.normaliseChatRequest({ messages: [{ role: 'root', content: 'x' }] })
    assert.equal(result.ok, false)
  })

  it('rejects an oversized message', () => {
    const result = M.normaliseChatRequest({
      messages: [{ role: 'user', content: 'x'.repeat(33_000) }],
    })
    assert.equal(result.ok, false)
  })

  it('clamps temperature and max tokens into a safe range', () => {
    const result = M.normaliseChatRequest({
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 99,
      maxTokens: 100_000,
    })
    assert.equal(result.ok, true)
    assert.equal(result.ok && result.value.temperature, 2)
    assert.equal(result.ok && result.value.maxTokens, 8192)
  })
})

// ============================================================
describe('private model service — inference through the local provider', () => {
  it('completes a chat turn against the local model server', async () => {
    const result = await M.routeChat({
      messages: [{ role: 'user', content: 'What is our intake SOP?' }],
    })
    assert.equal(result.ok, true)
    assert.equal(result.provider, 'ollama')
    assert.equal(result.content, 'Private local answer.')
    assert.equal(result.tokensUsed, 36)
    assert.equal(typeof result.durationMs, 'number')
  })

  it('sends JSON mode through to the provider when asked for structured output', async () => {
    await M.routeChat({
      messages: [{ role: 'user', content: 'return json' }],
      jsonMode: true,
    })
    assert.equal(lastChatBody.format, 'json')
  })

  it('embeds text through the local provider', async () => {
    const result = await M.routeEmbed({ input: 'chunk' })
    assert.equal(result.ok, true)
    assert.deepEqual(result.vectors[0], EMBEDDING)
    assert.equal(result.dimensions, EMBEDDING.length)
  })

  it('reports an honest failure when the local model is not loaded', async () => {
    chatStatus = 500
    const result = await M.routeChat({ messages: [{ role: 'user', content: 'x' }] })
    assert.equal(result.ok, false)
    // The real provider cause is preserved rather than masked by the chain.
    assert.equal(result.errorCode, 'PROVIDER_ERROR')
    assert.match(result.error, /HTTP 500/)
  })

  it('never reaches a public provider when the local one fails', async () => {
    chatStatus = 500
    process.env.ZAI_BASE_URL = 'https://z-ai.example.com/v1'
    process.env.ZAI_API_KEY = 'should-not-be-used'
    const result = await M.routeChat({ messages: [{ role: 'user', content: 'x' }] })
    assert.equal(result.ok, false)
    // The remote provider must not be used as a silent fallback.
    assert.equal(result.provider, 'ollama')
    assert.equal(result.errorCode, 'PROVIDER_ERROR')
  })
})

// ============================================================
describe('private model API surface', () => {
  it('serves an authenticated chat request', async () => {
    const res = await M.modelChat(
      authedRequest('http://x/api/model/v1/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
      }),
    )
    assert.equal(res.status, 200)
    const body = (await res.json()) as { content: string; provider: string; id: string }
    assert.equal(body.content, 'Private local answer.')
    assert.equal(body.provider, 'ollama')
    assert.ok(body.id.length > 0)
  })

  it('refuses an unauthenticated chat request', async () => {
    const res = await M.modelChat(
      new Request('http://x/api/model/v1/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
      }),
    )
    assert.equal(res.status, 401)
  })

  it('returns 503 when the gateway key is not configured', async () => {
    delete process.env.MODEL_API_KEY
    const res = await M.modelChat(
      new Request('http://x/api/model/v1/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
      }),
    )
    assert.equal(res.status, 503)
  })

  it('rejects a malformed chat body with 400', async () => {
    const res = await M.modelChat(
      authedRequest('http://x/api/model/v1/chat', { method: 'POST', body: JSON.stringify({}) }),
    )
    assert.equal(res.status, 400)
  })

  it('writes an audit record for every served request', async () => {
    await M.modelChat(
      authedRequest('http://x/api/model/v1/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: [{ role: 'user', content: 'audit me' }] }),
      }),
    )
    const auditCalls = calls.filter((c) => c.method === 'auditLog.create')
    assert.equal(auditCalls.length, 1)
    const details = (auditCalls[0].args as { data: { details: string; action: string } }).data
    assert.equal(details.action, 'MODEL_INFERENCE')
    // The prompt itself must never be written to the audit trail.
    assert.equal(details.details.includes('audit me'), false)
    assert.match(details.details, /promptDigest/)
  })

  it('rate limits the gateway', () => {
    const req = new Request('http://x/api/model/v1/chat', {
      headers: { Authorization: `Bearer ${GATEWAY_KEY}` },
    })
    let allowed = 0
    for (let i = 0; i < 5; i++) {
      if (M.enforceGatewayRateLimit(req, 'fingerprint', { max: 2, windowMs: 60_000 }).ok) allowed++
    }
    assert.equal(allowed, 2)
  })

  it('serves embeddings and the model catalogue through the private API', async () => {
    const embedRes = await M.modelEmbeddings(
      authedRequest('http://x/api/model/v1/embeddings', {
        method: 'POST',
        body: JSON.stringify({ input: 'hello' }),
      }),
    )
    assert.equal(embedRes.status, 200)
    const embedBody = (await embedRes.json()) as { data: Array<{ embedding: number[] }> }
    assert.deepEqual(embedBody.data[0].embedding, EMBEDDING)

    const modelsRes = await M.modelModels(authedRequest('http://x/api/model/v1/models'))
    assert.equal(modelsRes.status, 200)
    const modelsBody = (await modelsRes.json()) as {
      installed: Array<{ name: string }>
      catalogue: Array<{ slug: string }>
      gateway: { enabled: boolean }
    }
    assert.equal(modelsBody.gateway.enabled, true)
    assert.equal(modelsBody.installed[0].name, 'qwen2.5:1.5b-instruct-q4_K_M')
    assert.ok(modelsBody.catalogue.length >= 4)
  })
})

// ============================================================
describe('model catalogue integrity', () => {
  it('records a licence and a weight-verification flag for every model', () => {
    for (const model of M.MODEL_CATALOG) {
      assert.ok(model.license.length > 0, `${model.slug} has no licence`)
      assert.equal(typeof model.licenseVerified, 'boolean')
      assert.equal(typeof model.weightsVerified, 'boolean')
    }
  })

  it('does not claim a checksum it cannot prove', () => {
    for (const model of M.MODEL_CATALOG) {
      if (!model.weightsVerified) {
        assert.equal(model.weightChecksum, null, `${model.slug} claims an unverified checksum`)
        assert.equal(model.revision, null, `${model.slug} claims an unverified revision`)
      }
    }
  })

  it('keeps every profile pointed at real catalogue entries', () => {
    for (const [profile, slugs] of Object.entries(M.PROFILE_CANDIDATES)) {
      for (const slug of slugs) {
        assert.ok(
          M.MODEL_CATALOG.some((m) => m.slug === slug),
          `${profile} points at unknown model ${slug}`,
        )
      }
    }
  })

  it('selects the smallest model that passes acceptance', () => {
    const measured = {
      'qwen2.5-0.5b-instruct-q4': {
        slug: 'qwen2.5-0.5b-instruct-q4',
        passed: false,
        failureReasons: ['ENGLISH_SCORE_BELOW_FLOOR'],
        firstTokenMs: 900,
        tokensPerSecond: 20,
        ramMb: 700,
        banglaScore: 0.1,
        englishScore: 0.4,
        structuredOutputOk: false,
        toolSelectionOk: false,
        groundedAnswerOk: false,
        abstentionOk: false,
        injectionResistant: true,
      },
      'qwen2.5-1.5b-instruct-q4': {
        slug: 'qwen2.5-1.5b-instruct-q4',
        passed: true,
        failureReasons: [],
        firstTokenMs: 1100,
        tokensPerSecond: 9,
        ramMb: 1500,
        banglaScore: 0.42,
        englishScore: 0.7,
        structuredOutputOk: true,
        toolSelectionOk: true,
        groundedAnswerOk: true,
        abstentionOk: true,
        injectionResistant: true,
      },
      'qwen2.5-3b-instruct-q4': {
        slug: 'qwen2.5-3b-instruct-q4',
        passed: true,
        failureReasons: [],
        firstTokenMs: 2200,
        tokensPerSecond: 6,
        ramMb: 2500,
        banglaScore: 0.55,
        englishScore: 0.75,
        structuredOutputOk: true,
        toolSelectionOk: true,
        groundedAnswerOk: true,
        abstentionOk: true,
        injectionResistant: true,
      },
    }
    const { selected, rejected } = M.selectSmallestAcceptingModel(
      ['qwen2.5-0.5b-instruct-q4', 'qwen2.5-1.5b-instruct-q4', 'qwen2.5-3b-instruct-q4'],
      measured,
    )
    assert.equal(selected?.slug, 'qwen2.5-1.5b-instruct-q4')
    assert.equal(rejected.length, 1)
    assert.equal(rejected[0].slug, 'qwen2.5-0.5b-instruct-q4')
  })

  it('selects nothing when no model was measured', () => {
    const { selected } = M.selectSmallestAcceptingModel(['qwen2.5-1.5b-instruct-q4'], {})
    assert.equal(selected, null)
  })
})

// ============================================================
describe('model service status reporting', () => {
  it('reports the local provider as available when it is configured', () => {
    const status = M.modelServiceStatus()
    assert.equal(status.state, 'AVAILABLE')
    assert.equal(status.providers.find((p) => p.kind === 'ollama')?.state, 'CONFIGURED')
    assert.equal(status.gateway.enabled, true)
  })

  it('reports degraded when only the remote provider is configured', () => {
    delete process.env.LOCAL_MODEL_BASE_URL
    process.env.ZAI_BASE_URL = 'https://z-ai.example.com/v1'
    process.env.ZAI_API_KEY = 'configured'
    const status = M.modelServiceStatus()
    assert.equal(status.state, 'DEGRADED')
  })

  it('reports unavailable when nothing is configured', () => {
    delete process.env.LOCAL_MODEL_BASE_URL
    delete process.env.ZAI_BASE_URL
    delete process.env.ZAI_API_KEY
    const status = M.modelServiceStatus()
    assert.equal(status.state, 'UNAVAILABLE')
  })

  it('defaults to local providers first', () => {
    delete process.env.AI_PROVIDER_ORDER
    assert.deepEqual(M.resolveProviderOrder({}), ['ollama', 'openai-compatible', 'zai'])
  })
})
