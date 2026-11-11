import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const dynamic = 'force-static'

// ---------------------------------------------------------------------
// GET /llms.txt
//
// Serves `content/llms.txt` with an explicit `text/markdown; charset=utf-8`
// content type. The Markdown file is the single source of truth (it is reviewed
// and diffed like any other content); this route only fixes the media type,
// because Next's static handler sends `text/plain` for `.txt`.
//
// If the file cannot be read the route fails loudly with a 500 rather than
// serving a stale or partial index.
// ---------------------------------------------------------------------

const FALLBACK_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=3600',
  'Content-Signal': 'search=yes, ai-train=no',
}

export async function GET() {
  try {
    const body = await readFile(join(process.cwd(), 'content', 'llms.txt'), 'utf8')
    return new Response(body, {
      status: 200,
      headers: { ...FALLBACK_HEADERS, 'Content-Type': 'text/markdown; charset=utf-8' },
    })
  } catch {
    return new Response('llms.txt is temporarily unavailable.', {
      status: 500,
      headers: { ...FALLBACK_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
}
