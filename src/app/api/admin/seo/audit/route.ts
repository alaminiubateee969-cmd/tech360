import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, readJson, sanitizeText } from '@/lib/security'
import { safeFetch, UnsafeUrlError } from '@/lib/safe-fetch'
import { analyzePage, analyzeRobots, parseSitemapUrls, scoreChecks, type SeoCheck } from '@/lib/seo-audit-core'

export const dynamic = 'force-dynamic'

// Free, self-hosted SEO audit (open-seo / marketingskills inspired). MANAGER+.
// POST { url } -> on-page + technical checks, robots.txt, sitemap.xml and a
// sample of sitemap URLs (catches sitemaps that point at pages returning 404).
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER', limit: { max: 20, windowMs: 60_000 } })
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const input = sanitizeText(raw.url, 500)
  if (!input) return Response.json({ error: 'A URL is required' }, { status: 400 })

  try {
    const page = await safeFetch(input)
    const headers: Record<string, string> = {}
    page.headers.forEach((v, k) => { headers[k.toLowerCase()] = v })
    const { checks, facts } = analyzePage({ url: page.url, status: page.status, headers, html: page.body, ms: page.ms, redirects: page.redirects })
    const origin = new URL(page.url).origin

    const side = async (path: string) =>
      safeFetch(origin + path, { maxBytes: 600_000, timeoutMs: 8000 }).then((r) => ({ status: r.status, body: r.body })).catch(() => null)
    const [robots, sitemap] = await Promise.all([side('/robots.txt'), side('/sitemap.xml')])
    const all: SeoCheck[] = [...checks, ...analyzeRobots(robots, origin)]

    if (!sitemap || sitemap.status !== 200) {
      all.push({ id: 'sitemap', group: 'Crawlability', label: 'sitemap.xml', status: 'warn', detail: sitemap ? `HTTP ${sitemap.status}` : 'Not reachable', fix: 'Publish /sitemap.xml and submit it in Google Search Console.' })
    } else {
      const urls = parseSitemapUrls(sitemap.body)
      all.push({ id: 'sitemap', group: 'Crawlability', label: 'sitemap.xml', status: urls.length ? 'pass' : 'warn', detail: `${urls.length} URL(s) listed` })
      const sample = urls.filter((u) => u.startsWith(origin)).slice(0, 6)
      const probes = await Promise.all(
        sample.map(async (u) => ({ u, r: await safeFetch(u, { maxBytes: 20_000, timeoutMs: 8000 }).catch(() => null) })),
      )
      const dead = probes.filter((p) => !p.r || p.r.status >= 400)
      if (probes.length) {
        all.push({
          id: 'sitemap-live', group: 'Crawlability', label: 'Sitemap URLs resolve',
          status: dead.length === 0 ? 'pass' : dead.length === probes.length ? 'fail' : 'warn',
          detail: dead.length
            ? `${dead.length}/${probes.length} sampled URLs fail: ${dead.map((d) => d.u.replace(origin, '') || '/').join(', ')}`
            : `All ${probes.length} sampled URLs return 200`,
          fix: dead.length ? 'Every sitemap URL must return 200 on its own path. Hash routes (/#/page) are not separate pages to Google — expose real paths.' : undefined,
        })
      }
    }

    const summary = scoreChecks(all)
    await audit({ actor: g.user.email, action: 'SEO_AUDIT_RUN', userId: g.user.id, ip: g.ip, details: { url: page.url, score: summary.score } })
    return Response.json({ url: page.url, fetchedAt: new Date().toISOString(), ms: page.ms, ...summary, facts, checks: all })
  } catch (e) {
    if (e instanceof UnsafeUrlError) return Response.json({ error: e.message }, { status: 400 })
    return Response.json({ error: 'The page could not be fetched. Check the URL and try again.' }, { status: 502 })
  }
}
