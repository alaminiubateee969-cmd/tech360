// POST /api/ai-gateway/v1/chat/completions
// Shared AI Gateway inference endpoint. Application-token auth
// (SHA-256 registry), classification policy, model allowlists,
// rate/concurrency/timeout/retry/circuit protection, budget
// gates and secret-safe audit. See docs/AI_GATEWAY.md.
import { NextResponse } from 'next/server'
import { loadGatewayConfig } from '@/lib/ai-gateway/config'
import { authenticateApp, executeGatewayRequest, parseBearer, type AuditEvent } from '@/lib/ai-gateway/core'
import { gatewayProviders } from '@/lib/ai-gateway/providers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function auditSink(event: AuditEvent) {
  // One structured, secret-safe line. The Tech360 AuditLog table
  // requires a platform user context, so gateway service events
  // go to the service log where the host can ship them; fields
  // never include tokens, prompts, or completions.
  console.log(JSON.stringify(event))
}

export async function POST(request: Request) {
  const { config, errors } = loadGatewayConfig()
  if (errors.length) {
    return NextResponse.json({ error: { code: 'CONFIG_INVALID', message: 'Gateway configuration is invalid; refusing to serve (fail-closed)' } }, { status: 503 })
  }
  const raw = await request.text()
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: { code: 'BAD_JSON', message: 'Request body must be JSON' } }, { status: 400 })
  }
  const b = body as { messages?: unknown; model?: string; dataClassification?: never; maxTokens?: number; max_tokens?: number }
  if (!Array.isArray(b.messages)) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'messages must be an array' } }, { status: 400 })
  }
  const result = await executeGatewayRequest(config, { providers: gatewayProviders(config), audit: auditSink }, {
    authHeader: request.headers.get('authorization'),
    rawBytes: new TextEncoder().encode(raw).length,
    request: {
      messages: b.messages as never,
      model: typeof b.model === 'string' ? b.model : undefined,
      dataClassification: b.dataClassification,
      maxTokens: typeof b.maxTokens === 'number' ? b.maxTokens : typeof b.max_tokens === 'number' ? b.max_tokens : undefined,
    },
  })
  return NextResponse.json(result.body, { status: result.status })
}

/** Authenticated callers can read their own app identity. */
export async function GET(request: Request) {
  const { config, errors } = loadGatewayConfig()
  if (errors.length) return NextResponse.json({ status: 'config_invalid' }, { status: 503 })
  const auth = authenticateApp(config, parseBearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: { code: auth.code } }, { status: 401 })
  return NextResponse.json({ app: auth.app.id, dataClassification: auth.app.dataClassification, allowExternal: auth.app.allowExternal, allowedModels: auth.app.allowedModels ?? null })
}
