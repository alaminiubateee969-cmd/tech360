import { NextRequest } from 'next/server'
import { officialInfoHtml } from '@/lib/letterhead'
import { guard, isResponse } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'

// GET /api/official-info — Official Information Sheet on the company pad
// SECURITY: Restricted to authenticated Super Admin / Admin only. Anonymous
// visitors receive 404 to hide existence of internal information. Do not
// expose company information publicly (spec §8).
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) {
    // Return 404 for anonymous to hide existence, 403 body is also acceptable per spec
    return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  }
  const origin = process.env.APP_PUBLIC_URL?.replace(/\/$/, '') || req.nextUrl.origin
  return new Response(officialInfoHtml(origin), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
