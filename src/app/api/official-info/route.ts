import { NextRequest } from 'next/server'
import { officialInfoHtml } from '@/lib/letterhead'

export const dynamic = 'force-dynamic'

// GET /api/official-info — public Official Information Sheet on the
// company pad (print → PDF). All facts come from the letterhead
// engine / OFFICIAL_INFO constants; no credentials are ever shown.
export async function GET(req: NextRequest) {
  const origin = process.env.APP_PUBLIC_URL?.replace(/\/$/, '') || req.nextUrl.origin
  return new Response(officialInfoHtml(origin), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
