import { createHash } from 'node:crypto'

import { PUBLIC_AGENT_TOOL_NAMES } from '@/lib/agent-tools'

export const dynamic = 'force-static'

// ---------------------------------------------------------------------
// GET /api/mcp/server-card
//
// MCP Server Card — SEP-2127 / modelcontextprotocol/ext-server-card.
//
// SEP-1649 defined a card at `/.well-known/mcp/server-card.json`, was closed on
// 2026-01-26, and continues in SEP-2127, whose experimental extension reserves
// `GET <streamable-http-url>/server-card` with the media type
// `application/mcp-server-card+json`. That reservation is what this route
// implements: the MCP transport lives at /api/mcp, so its card lives at
// /api/mcp/server-card.
//
// The legacy SEP-1649-shaped card is still served from
// public/.well-known/mcp/server-card.json (many clients still probe it) and the
// AI catalog advertises this card as the card of record.
//
// The document here is generated at build time from the same constants the
// endpoint uses, so the declared identity, version and transport cannot drift
// from the running server — the consistency requirement in docs/discovery.md.
// ---------------------------------------------------------------------

const SITE = (process.env.APP_PUBLIC_URL ?? 'https://bdtech360.com').replace(/\/+$/, '')
const PROTOCOL_VERSION = '2025-06-18'
const SERVER_VERSION = '1.1.0'

function buildCard() {
  return {
    $schema: 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
    name: 'com.bdtech360/site',
    title: 'TECH360 Site MCP',
    version: SERVER_VERSION,
    // Schema constraint: maxLength 100.
    description: 'Read-only public TECH360 LLC information: services, products, contact and FAQs.',
    websiteUrl: `${SITE}/`,
    icons: [{ src: `${SITE}/tech360-logo.png`, mimeType: 'image/png', sizes: ['512x512'] }],
    remotes: [
      {
        type: 'streamable-http' as const,
        url: `${SITE}/api/mcp`,
        supportedProtocolVersions: [PROTOCOL_VERSION, '2025-03-26'],
        // No required headers: the endpoint is public and unauthenticated.
        headers: [],
      },
    ],
    _meta: {
      'com.bdtech360/tools': PUBLIC_AGENT_TOOL_NAMES,
      'com.bdtech360/authentication': 'none — public read-only tools',
      'com.bdtech360/documentation': `${SITE}/llms.txt`,
      'com.bdtech360/legacyCard': `${SITE}/.well-known/mcp/server-card.json`,
      'com.bdtech360/note':
        'Tools are read-only and return published marketing information only. No tool writes data, sends messages or exposes customer records.',
    },
  }
}

export async function GET(request: Request) {
  const body = JSON.stringify(buildCard())
  const etag = `"${createHash('sha256').update(body).digest('base64url').slice(0, 27)}"`

  // Conditional GET — honours If-None-Match per docs/discovery.md.
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } })
  }

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/mcp-server-card+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
      'Access-Control-Expose-Headers': 'ETag',
    },
  })
}

export async function HEAD() {
  const response = await GET(new Request('https://placeholder.local/'))
  return new Response(null, { status: 200, headers: response.headers })
}

/** Any other method is not part of the specification. */
export async function POST() {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'GET, HEAD', 'Access-Control-Allow-Origin': '*' },
  })
}
