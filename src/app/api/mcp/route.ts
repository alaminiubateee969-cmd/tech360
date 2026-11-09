import { NextRequest } from 'next/server'
import { agentToolDescriptors, getAgentTool, toMcpContent } from '@/lib/agent-tools'
import { clientIp, rateLimit } from '@/lib/security'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------
// POST /api/mcp — public, read-only MCP endpoint (Streamable HTTP transport).
//
// Discovery:
//   /.well-known/mcp/server-card.json   (SEP-1649 shape, kept for compatibility)
//   /api/mcp/server-card                (SEP-2127 / experimental-ext-server-card)
//   /.well-known/ai-catalog.json        (AI catalog entry pointing at both)
//
// Safety properties (asserted by tests/agent-readiness.test.ts):
//   • Read-only: every tool comes from src/lib/agent-tools.ts and none writes.
//   • Input validation: closed JSON schema; unknown properties are rejected.
//   • Origin check: cross-origin browser callers must send an allowed Origin.
//   • Rate limiting: 60 requests / minute / IP.
//   • Structured errors: JSON-RPC error codes, never a fabricated answer.
//   • No secrets: the process environment is never read into a response.
//   • Audit: one structured line per tool call, containing no arguments or PII.
// ---------------------------------------------------------------------

const SERVER_INFO = {
  name: 'bdtech360-site-mcp',
  title: 'TECH360 Site MCP',
  version: '1.1.0',
}

const SITE = (process.env.APP_PUBLIC_URL ?? 'https://bdtech360.com').replace(/\/+$/, '')
const MCP_PROTOCOL = '2025-06-18'
const SUPPORTED_PROTOCOLS = ['2025-06-18', '2025-03-26']

const RATE_LIMIT = { limit: 60, windowMs: 60_000 }

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Authorization',
  'Access-Control-Expose-Headers': 'MCP-Protocol-Version, ETag',
  'Access-Control-Max-Age': '86400',
}

/**
 * Browser callers must be same-origin. Non-browser clients (curl, agent
 * runtimes) send no Origin at all and are allowed — exactly like every other
 * public read-only API. This blocks a hostile page from driving the endpoint
 * with a victim's ambient credentials in future authenticated variants.
 */
function originAllowed(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    const parsed = new URL(origin)
    return (
      parsed.host === new URL(SITE).host ||
      parsed.host === 'bdtech360.com' ||
      parsed.host === 'www.bdtech360.com' ||
      // Local development and the Arena preview proxy.
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname.endsWith('.e2b.app')
    )
  } catch {
    return false
  }
}

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'MCP-Protocol-Version': MCP_PROTOCOL,
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  })
}

type RpcResult = {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

/** Audit log — structured, no arguments, no caller identity beyond a hashed IP. */
function audit(event: { method: string; tool?: string; outcome: string; ip: string }) {
  const line = JSON.stringify({
    at: new Date().toISOString(),
    surface: 'mcp',
    method: event.method,
    tool: event.tool ?? null,
    outcome: event.outcome,
    // Truncated so the log cannot be used to rebuild a client IP.
    caller: event.ip.split('.').slice(0, 2).join('.') + '.x.x',
  })
  console.info(`[agent-audit] ${line}`)
}

function handleRpc(msg: Record<string, unknown>, ip: string): RpcResult | null {
  const id = (msg.id ?? null) as string | number | null
  const method = typeof msg.method === 'string' ? msg.method : ''

  // Notifications (e.g. notifications/initialized) carry no id → 202, no body.
  if (id === null || msg.id === undefined) return null

  if (method === 'initialize') {
    const initParams = (msg.params ?? {}) as { protocolVersion?: unknown }
    const requested = typeof initParams.protocolVersion === 'string' ? initParams.protocolVersion : MCP_PROTOCOL
    return {
      jsonrpc: '2.0',
      id,
      result: {
        // Only echo a protocol version this server actually implements.
        protocolVersion: SUPPORTED_PROTOCOLS.includes(requested) ? requested : MCP_PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          'Read-only tools describing TECH360 LLC public information: services, products, company details, FAQs and the contact page. No tool writes data or sends messages. All money amounts are USD. Server card: ' +
          SITE +
          '/api/mcp/server-card',
      },
    }
  }

  if (method === 'ping') return { jsonrpc: '2.0', id, result: {} }

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: agentToolDescriptors() } }
  }

  if (method === 'tools/call') {
    const params = (msg.params ?? {}) as { name?: unknown; arguments?: unknown }
    if (typeof params.name !== 'string') {
      return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params: "name" must be a string.' } }
    }
    const tool = getAgentTool(params.name)
    if (!tool) {
      audit({ method, tool: params.name, outcome: 'unknown-tool', ip })
      return { jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown tool: ${params.name}` } }
    }
    if (params.arguments !== undefined && (params.arguments === null || typeof params.arguments !== 'object')) {
      return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params: "arguments" must be an object.' } }
    }
    const args = (params.arguments ?? {}) as Record<string, unknown>

    // Reject unknown properties rather than silently ignoring them.
    const allowed = new Set(Object.keys(tool.inputSchema.properties))
    const unexpected = Object.keys(args).filter((key) => !allowed.has(key))
    if (unexpected.length > 0) {
      audit({ method, tool: tool.name, outcome: 'invalid-arguments', ip })
      return {
        jsonrpc: '2.0',
        id,
        result: toMcpContent({
          ok: false,
          error: { code: 'INVALID_ARGUMENT', message: `Unknown argument(s): ${unexpected.join(', ')}` },
        }),
      }
    }

    try {
      const result = tool.run(args)
      audit({ method, tool: tool.name, outcome: result.ok ? 'ok' : 'tool-error', ip })
      return { jsonrpc: '2.0', id, result: toMcpContent(result) }
    } catch {
      // Never leak an exception message (it can contain internals) to a caller.
      audit({ method, tool: tool.name, outcome: 'exception', ip })
      return {
        jsonrpc: '2.0',
        id,
        result: toMcpContent({
          ok: false,
          error: { code: 'INTERNAL', message: 'The tool could not complete this request.' },
        }),
      }
    }
  }

  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } }
}

export async function GET() {
  // No server-initiated SSE stream: this endpoint is request/response only.
  return new Response(
    'Method Not Allowed: use POST for JSON-RPC (Streamable HTTP). Server card: ' +
      SITE +
      '/api/mcp/server-card',
    { status: 405, headers: { Allow: 'POST, OPTIONS', 'Content-Type': 'text/plain; charset=utf-8', ...CORS_HEADERS } },
  )
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)

  if (!originAllowed(req)) {
    audit({ method: 'POST', outcome: 'origin-rejected', ip })
    return json(
      { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Origin not allowed.' } },
      403,
    )
  }

  const rl = rateLimit(`mcp:${ip}`, RATE_LIMIT.limit, RATE_LIMIT.windowMs)
  if (!rl.ok) {
    audit({ method: 'POST', outcome: 'rate-limited', ip })
    return json(
      { jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Rate limit exceeded. Retry later.' } },
      429,
      { 'Retry-After': String(rl.retryAfter) },
    )
  }

  // Explicitly declared content type keeps CORS simple and blocks form posts.
  const contentType = req.headers.get('content-type') ?? ''
  if (!/application\/json/i.test(contentType)) {
    return json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Content-Type must be application/json.' } },
      415,
    )
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error: invalid JSON' } }, 400)
  }

  if (Array.isArray(payload) && payload.length > 20) {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Batch too large (max 20).' } }, 400)
  }

  const messages = Array.isArray(payload) ? payload : [payload]
  const results: RpcResult[] = []
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue
    const r = handleRpc(msg as Record<string, unknown>, ip)
    if (r) results.push(r)
  }

  // A batch containing only notifications → 202 Accepted with no body.
  if (results.length === 0) {
    return new Response(null, { status: 202, headers: { 'MCP-Protocol-Version': MCP_PROTOCOL, ...CORS_HEADERS } })
  }

  const requestedVersion = req.headers.get('mcp-protocol-version')
  return json(Array.isArray(payload) ? results : results[0], 200, {
    'MCP-Protocol-Version': SUPPORTED_PROTOCOLS.includes(requestedVersion ?? '') ? (requestedVersion as string) : MCP_PROTOCOL,
  })
}
