import { createHash } from 'node:crypto'

export const dynamic = 'force-static'

// ---------------------------------------------------------------------
// GET /.well-known/ai-catalog.json
//
// AI Catalog (https://github.com/Agent-Card/ai-catalog) served at the
// well-known location reserved by the MCP server-card discovery extension —
// SEP-2127 / modelcontextprotocol/ext-server-card, docs/discovery.md.
//
// The catalog is the discovery entry point: a client fetches it, finds the
// entry typed `application/mcp-server-card+json`, then retrieves the card and
// connects. Exactly one entry is advertised — the TECH360 Site MCP — and only
// capabilities that pass functional tests are described.
// ---------------------------------------------------------------------

const SITE = (process.env.APP_PUBLIC_URL ?? 'https://bdtech360.com').replace(/\/+$/, '')

function buildCatalog() {
  return {
    specVersion: '1.0',
    entries: [
      {
        // Domain-anchored identifier: urn:air:{publisher}:{namespace}:{name}
        identifier: 'urn:air:bdtech360.com:mcp:site',
        type: 'application/mcp-server-card+json',
        url: `${SITE}/api/mcp/server-card`,
      },
    ],
  }
}

export async function GET(request: Request) {
  const body = JSON.stringify(buildCatalog(), null, 2)
  const etag = `"${createHash('sha256').update(body).digest('base64url').slice(0, 27)}"`

  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } })
  }

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/ai-catalog+json; charset=utf-8',
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
