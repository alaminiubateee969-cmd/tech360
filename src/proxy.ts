import { NextRequest, NextResponse } from 'next/server'
import { homepageMarkdown, sectionMarkdown, renderMarkdownForPath, agentLinkHeader } from '@/lib/agent-content'

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
/**
 * Paths that must never be rendered as Markdown, even if every other rule
 * matches: authenticated surfaces, internal operator tools, APIs and static
 * assets. Expressed defensively (belt and braces on top of the matcher) because
 * a mistake here would publish private content in a machine-readable form.
 */
const MARKDOWN_DENY = [
  /^\/portal(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/super-admin(\/|$)/,
  /^\/pipeline(\/|$)/,
  /^\/design-kit(\/|$)/,
  /^\/factory(\/|$)/,
  /^\/api(\/|$)/,
  /^\/\.well-known(\/|$)/,
  /^\/login(\/|$)/,
]

function markdownAllowed(pathname: string): boolean {
  return !MARKDOWN_DENY.some((pattern) => pattern.test(pathname))
}

export default function proxy(req: NextRequest) {
  const method = req.method
  if (method !== 'GET' && method !== 'HEAD') return NextResponse.next()

  const pathname = req.nextUrl.pathname

  const accept = req.headers.get('accept') ?? ''

  /*
   * Two ways to reach a Markdown representation:
   *
   *  1. Content negotiation — `Accept: text/markdown`, when Markdown is
   *     genuinely preferred. A browser's
   *     `text/html,application/xhtml+xml,*\/*;q=0.8` does not qualify.
   *  2. An explicit `.md` URL — `/services.md`, `/about.md`. The matcher
   *     normally skips dotted paths, so it is widened for `.md` only.
   *
   * (2) exists because Next.js rewrites the `Vary` header on its own responses,
   * so a shared cache cannot be relied on to keep the negotiated
   * representation separate. A distinct URL is the only representation that is
   * unambiguously cacheable, and it is also easier for an agent to cite.
   */
  const explicitMarkdown = pathname.length > 3 && pathname.endsWith('.md')
  // `/index.md` is the explicit form of the homepage's Markdown representation.
  const markdownPath = explicitMarkdown ? (pathname === '/index.md' ? '/' : pathname.slice(0, -3) || '/') : pathname
  const prefersMarkdown = /text\/markdown\s*(?:;\s*q=(?!0(?:\.0*)?\b)([0-9.]+))?/i.test(accept)

  if ((explicitMarkdown || prefersMarkdown) && markdownAllowed(markdownPath)) {
    const body = markdownPath === '/' ? homepageMarkdown() : sectionMarkdown(markdownPath)
    // A route with no public representation must not invent one.
    const explicit = markdownPath === '/' ? body : renderMarkdownForPath(markdownPath)
    const payload = explicit ?? body

    return new Response(method === 'HEAD' ? null : payload, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Signal': 'search=yes, ai-train=no',
        'Link': agentLinkHeader(markdownPath),
        // Cheap because the document is generated, not fetched.
        'Vary': 'Accept',
        'Cache-Control': 'public, max-age=300, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  const res = NextResponse.next()
  // Advertise the alternates without clobbering a framework Link header.
  const existing = res.headers.get('Link')
  const ours = agentLinkHeader(pathname)
  res.headers.set('Link', existing ? `${existing}, ${ours}` : ours)
  // The HTML representation varies by Accept in exactly the same way.
  const existingVary = res.headers.get('Vary')
  if (!existingVary || !/\baccept\b/i.test(existingVary)) {
    res.headers.set('Vary', existingVary ? `${existingVary}, Accept` : 'Accept')
  }
  return res
}

export const config = {
  // Public site paths only: "/", "/about", "/services/…", "/blog/…", etc.
  // Static assets and dotted paths are excluded, except explicit `.md` URLs,
  // which are handled by the proxy itself.
  matcher: [
    '/((?!_next/static|_next/image|api/|admin|factory|portal|brand/|images/|work/|.*\\..*).*)',
    '/((?!_next/|api/|admin|factory|portal|brand/|images/).*\\.md)',
  ],
}
