import { NextRequest } from 'next/server'
import { SERVICES, INDUSTRIES, FAQS } from '@/data/site'
import { COMPANY } from '@/lib/constants'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------
// GET /api/mcp — public, read-only MCP endpoint (Streamable HTTP transport).
//
// Agents discover this endpoint through /.well-known/mcp/server-card.json
// (SEP-1649) and llms.txt. Tools return only public marketing/contact
// information; nothing is written and no authentication is required.
// ---------------------------------------------------------------------

const SERVER_INFO = {
  name: 'bdtech360-site-mcp',
  title: 'TECH360 Site MCP',
  version: '1.0.0',
}

const SITE = (process.env.APP_PUBLIC_URL ?? 'https://bdtech360.com').replace(/\/+$/, '')

const TEXT = (s: string) => ({ content: [{ type: 'text' as const, text: s }] })

type ToolDef = {
  name: string
  title: string
  description: string
  inputSchema: { type: 'object'; properties: Record<string, unknown>; additionalProperties?: boolean }
  run: (args: Record<string, unknown>) => string
}

const TOOLS: ToolDef[] = [
  {
    name: 'get_site_summary',
    title: 'Site summary',
    description:
      'Return a short factual summary of TECH360 LLC: what the company does, where it is registered, and how to contact it. All amounts are USD.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: () =>
      [
        'TECH360 LLC (Tech360, ' + COMPANY.domain + ')',
        'Builds: enterprise websites, eCommerce platforms, custom CRMs, AI-assisted applications, and business automation.',
        'Registered: ' + COMPANY.address,
        'Email: ' + COMPANY.email,
        'Phone: ' + COMPANY.phone,
        'Website: ' + SITE,
        'Money amounts on this site are quoted in USD.',
      ].join('\n'),
  },
  {
    name: 'list_services',
    title: 'List services',
    description: `List all ${SERVICES.length} TECH360 services with slug, title, tagline, and canonical URL. Optional prefix filters by title.`,
    inputSchema: {
      type: 'object',
      properties: { prefix: { type: 'string', description: 'Case-insensitive title prefix filter' } },
      additionalProperties: false,
    },
    run: (args) => {
      const prefix = typeof args.prefix === 'string' ? args.prefix.toLowerCase() : ''
      const rows = SERVICES.filter((s) => s.title.toLowerCase().startsWith(prefix))
      return rows.map((s) => `${s.title} — ${s.tagline} (${SITE}/services/${s.slug})`).join('\n') || 'No matching services.'
    },
  },
  {
    name: 'list_industries',
    title: 'List industries',
    description: `List all ${INDUSTRIES.length} industry solution patterns with slug and canonical URL. Optional prefix filters by title.`,
    inputSchema: {
      type: 'object',
      properties: { prefix: { type: 'string', description: 'Case-insensitive title prefix filter' } },
      additionalProperties: false,
    },
    run: (args) => {
      const prefix = typeof args.prefix === 'string' ? args.prefix.toLowerCase() : ''
      const rows = INDUSTRIES.filter((i) => i.title.toLowerCase().startsWith(prefix))
      return rows.map((i) => `${i.title} — ${i.description} (${SITE}/industries/${i.slug})`).join('\n') || 'No matching industries.'
    },
  },
  {
    name: 'list_faqs',
    title: 'List FAQs',
    description: `Return frequently asked questions and answers (default 5, max ${FAQS.length}).`,
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'How many FAQs to return (1-' + FAQS.length + ')' } },
      additionalProperties: false,
    },
    run: (args) => {
      const limit = Math.max(1, Math.min(FAQS.length, typeof args.limit === 'number' ? Math.floor(args.limit) : 5))
      return FAQS.slice(0, limit)
        .map((f, idx) => `${idx + 1}. Q: ${f.q}\nA: ${f.a}`)
        .join('\n\n')
    },
  },
  {
    name: 'get_contact_info',
    title: 'Contact info',
    description: 'Return TECH360 public contact details (email, phone, postal address, contact page URL).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: () =>
      [
        'Company: ' + COMPANY.legalName,
        'Email: ' + COMPANY.email,
        'Phone: ' + COMPANY.phone,
        'Address: ' + COMPANY.address,
        'Contact form: ' + SITE + '/contact',
      ].join('\n'),
  },
]

const MCP_PROTOCOL = '2025-06-18'

type RpcResult = { jsonrpc: '2.0'; id: string | number | null; result?: unknown; error?: { code: number; message: string } }

function handleRpc(msg: Record<string, unknown>): RpcResult | null {
  const id = (msg.id ?? null) as string | number | null
  const method = typeof msg.method === 'string' ? msg.method : ''

  // Notifications (e.g. notifications/initialized) carry no id → 202, no body.
  if (id === null || msg.id === undefined) return null

  if (method === 'initialize') {
    const initParams = (msg.params ?? {}) as { protocolVersion?: unknown }
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: typeof initParams.protocolVersion === 'string' ? initParams.protocolVersion : MCP_PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions:
          'Read-only tools describing TECH360 public information. Services, industries, FAQs and contact details only; no data is modified. All money amounts are USD.',
      },
    }
  }

  if (method === 'ping') return { jsonrpc: '2.0', id, result: {} }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: TOOLS.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema })),
      },
    }
  }

  if (method === 'tools/call') {
    const params = (msg.params ?? {}) as { name?: string; arguments?: Record<string, unknown> }
    const tool = TOOLS.find((t) => t.name === params.name)
    if (!tool) {
      return { jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown tool: ${params.name ?? '(missing)'}` } }
    }
    try {
      const text = tool.run(params.arguments ?? {})
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: false } }
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: `Tool failed: ${err instanceof Error ? err.message : 'unknown error'}` }], isError: true },
      }
    }
  }

  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } }
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'MCP-Protocol-Version': MCP_PROTOCOL,
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      ...CORS_HEADERS,
    },
  })
}

export async function GET() {
  // No server-initiated SSE stream: this endpoint is request/response only.
  return new Response('Method Not Allowed: use POST for JSON-RPC (Streamable HTTP). Server card: /.well-known/mcp/server-card.json', {
    status: 405,
    headers: { Allow: 'POST, OPTIONS', 'Content-Type': 'text/plain; charset=utf-8', ...CORS_HEADERS },
  })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error: invalid JSON' } }, 400)
  }

  const messages = Array.isArray(payload) ? payload : [payload]
  const results: RpcResult[] = []
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue
    const r = handleRpc(msg as Record<string, unknown>)
    if (r) results.push(r)
  }

  // Batch with only notifications, or a single notification → 202 Accepted.
  if (results.length === 0) return new Response(null, { status: 202, headers: { 'MCP-Protocol-Version': MCP_PROTOCOL, ...CORS_HEADERS } })

  return Array.isArray(payload) ? json(results) : json(results[0])
}
