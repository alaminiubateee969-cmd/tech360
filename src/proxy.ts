import { NextRequest, NextResponse } from 'next/server'
import { homepageMarkdown, sectionMarkdown, AGENT_LINK_HEADER } from '@/lib/agent-content'

/**
 * Agent-readiness proxy (Next 16 convention — formerly middleware.ts).
 *
 * 1. Content negotiation: requests that accept `text/markdown` receive a compact
 *    Markdown document instead of HTML (dramatically lower token cost).
 * 2. Every public HTML response advertises its resources with an RFC 8288
 *    `Link` header: llms.txt and the Markdown alternate.
 *
 * Matcher excludes APIs, the admin/factory/portal surfaces, and any path
 * containing a dot (static files, .well-known, llms.txt, robots.txt, …).
 */
export default function proxy(req: NextRequest) {
  const method = req.method
  if (method !== 'GET' && method !== 'HEAD') return NextResponse.next()

  const accept = req.headers.get('accept') ?? ''
  if (/\btext\/markdown\b/.test(accept)) {
    const body = req.nextUrl.pathname === '/' ? homepageMarkdown() : sectionMarkdown(req.nextUrl.pathname)
    return new Response(method === 'HEAD' ? null : body, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Signal': 'search=yes, ai-train=no',
        'Link': AGENT_LINK_HEADER,
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  const res = NextResponse.next()
  res.headers.set('Link', AGENT_LINK_HEADER)
  return res
}

export const config = {
  // Public site paths only: "/", "/about", "/services/…", "/blog/…", etc.
  matcher: ['/((?!_next/static|_next/image|api/|admin|factory|portal|brand/|images/|work/|.*\\..*).*)'],
}
