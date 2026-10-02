// ============================================================
// On-page / technical SEO checks — pure functions (no network, no DB).
// Check list follows the audit framework in coreyhaines31/marketingskills
// (seo-audit, MIT) and the site-audit workflow of every-app/open-seo (MIT):
// crawlability → indexation → on-page → structured data → performance/security.
// Re-implemented from scratch; needs no paid data provider.
// ============================================================

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info'
export type SeoCheck = { id: string; group: string; label: string; status: CheckStatus; detail: string; fix?: string }

export type PageInput = {
  url: string
  status: number
  headers: Record<string, string>
  html: string
  ms: number
  redirects?: string[]
}

const strip = (s: string) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
const text = (s: string) => strip(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim()
const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(2).find((x) => x !== undefined)
const tags = (html: string, re: RegExp) => html.match(re) ?? []
const meta = (html: string, key: string, by: 'name' | 'property' = 'name') => {
  for (const t of tags(html, /<meta\b[^>]*>/gi)) if (attr(t, by)?.toLowerCase() === key) return (attr(t, 'content') ?? '').trim()
  return undefined
}

export function analyzePage(p: PageInput): { checks: SeoCheck[]; facts: Record<string, unknown> } {
  const c: SeoCheck[] = []
  const add = (id: string, group: string, label: string, status: CheckStatus, detail: string, fix?: string) => c.push({ id, group, label, status, detail, fix })
  const html = p.html
  const h = (k: string) => p.headers[k.toLowerCase()]

  // ---- Indexation ----
  add('status', 'Indexation', 'HTTP status', p.status === 200 ? 'pass' : p.status >= 300 && p.status < 400 ? 'warn' : 'fail', `Responded ${p.status}`, p.status === 200 ? undefined : 'The page should answer 200 so search engines can index it.')
  if (p.redirects?.length) add('redirects', 'Indexation', 'Redirect chain', p.redirects.length > 1 ? 'warn' : 'info', `${p.redirects.length} redirect(s) before the final URL`, 'Link directly to the final URL; avoid chains.')
  const robotsMeta = (meta(html, 'robots') ?? '').toLowerCase()
  const xrobots = (h('x-robots-tag') ?? '').toLowerCase()
  const noindex = /noindex/.test(robotsMeta) || /noindex/.test(xrobots)
  add('noindex', 'Indexation', 'Not blocked from indexing', noindex ? 'fail' : 'pass', noindex ? 'A noindex directive is present' : 'No noindex directive', noindex ? 'Remove noindex if this page should rank.' : undefined)
  const canonTag = tags(html, /<link\b[^>]*>/gi).find((t) => attr(t, 'rel')?.toLowerCase() === 'canonical')
  const canonical = canonTag ? attr(canonTag, 'href') : undefined
  add('canonical', 'Indexation', 'Canonical URL', canonical ? 'pass' : 'warn', canonical ? `Canonical: ${canonical}` : 'No canonical link found', canonical ? undefined : 'Add <link rel="canonical"> (Next.js: metadata.alternates.canonical).')

  // ---- On-page ----
  const title = text((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? [])[1] ?? '')
  add('title', 'On-page', 'Title tag', !title ? 'fail' : title.length < 30 || title.length > 65 ? 'warn' : 'pass', title ? `"${title}" (${title.length} chars)` : 'Missing', 'Aim for 30–60 characters with the primary keyword first.')
  const desc = meta(html, 'description') ?? ''
  add('description', 'On-page', 'Meta description', !desc ? 'fail' : desc.length < 70 || desc.length > 165 ? 'warn' : 'pass', desc ? `${desc.length} chars` : 'Missing', 'Write a 70–160 character summary with a call to action.')
  const h1s = tags(html, /<h1\b[\s\S]*?<\/h1>/gi)
  add('h1', 'On-page', 'Exactly one H1', h1s.length === 1 ? 'pass' : h1s.length === 0 ? 'fail' : 'warn', `${h1s.length} H1 element(s)${h1s[0] ? `: "${text(h1s[0]).slice(0, 80)}"` : ''}`, 'Use a single descriptive H1 per page.')
  const h2n = tags(html, /<h2\b/gi).length
  add('h2', 'On-page', 'Subheadings (H2)', h2n > 0 ? 'pass' : 'warn', `${h2n} H2 element(s)`, 'Structure content with H2/H3 headings.')
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? ''
  add('lang', 'On-page', 'Language attribute', attr(htmlTag, 'lang') ? 'pass' : 'warn', attr(htmlTag, 'lang') ? `lang="${attr(htmlTag, 'lang')}"` : 'Missing <html lang>', 'Add lang="en" (or your language).')
  const words = text(html).split(/\s+/).filter(Boolean).length
  add('content', 'On-page', 'Indexable text content', words >= 300 ? 'pass' : words >= 100 ? 'warn' : 'fail', `${words} words in the delivered HTML`, words < 100 ? 'Very little text arrives in the initial HTML. This page is probably rendered in the browser; crawlers may see it as thin. Server-render the main content.' : 'Add more useful, unique copy (300+ words for key pages).')
  const imgs = tags(html, /<img\b[^>]*>/gi)
  const noAlt = imgs.filter((t) => attr(t, 'alt') === undefined || attr(t, 'alt')!.trim() === '').length
  add('img-alt', 'On-page', 'Image alt text', imgs.length === 0 ? 'info' : noAlt === 0 ? 'pass' : noAlt / imgs.length > 0.3 ? 'fail' : 'warn', imgs.length ? `${imgs.length - noAlt}/${imgs.length} images have alt text` : 'No images found', 'Describe every meaningful image in alt text.')
  const anchors = tags(html, /<a\b[^>]*href=[^>]*>[\s\S]*?<\/a>/gi)
  const origin = (() => { try { return new URL(p.url).origin } catch { return '' } })()
  let internal = 0, external = 0, emptyAnchors = 0
  for (const a of anchors) {
    const href = attr(a, 'href') ?? ''
    if (!text(a) && !/<img\b[^>]*alt=["'][^"']+/i.test(a) && !attr(a, 'aria-label')) emptyAnchors++
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue
    if (/^https?:\/\//i.test(href) && !href.startsWith(origin)) external++; else internal++
  }
  add('links', 'On-page', 'Links', emptyAnchors ? 'warn' : 'pass', `${internal} internal, ${external} external${emptyAnchors ? `, ${emptyAnchors} with no anchor text` : ''}`, 'Give every link descriptive anchor text.')

  // ---- Mobile & social ----
  add('viewport', 'Mobile', 'Viewport meta', meta(html, 'viewport') ? 'pass' : 'fail', meta(html, 'viewport') ? 'Present' : 'Missing', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.')
  const og = ['og:title', 'og:description', 'og:image'].filter((k) => !meta(html, k, 'property'))
  add('open-graph', 'Social', 'Open Graph tags', og.length === 0 ? 'pass' : og.length === 3 ? 'fail' : 'warn', og.length ? `Missing: ${og.join(', ')}` : 'og:title, og:description, og:image present', 'Add Open Graph tags so shared links get a preview card.')
  add('twitter', 'Social', 'Twitter/X card', meta(html, 'twitter:card') ? 'pass' : 'warn', meta(html, 'twitter:card') ? `twitter:card=${meta(html, 'twitter:card')}` : 'Missing twitter:card')

  // ---- Structured data ----
  const ld = tags(html, /<script\b[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi)
  const types: string[] = []
  let ldBad = 0
  for (const s of ld) {
    try {
      const j = JSON.parse(s.replace(/^<script[^>]*>|<\/script>$/gi, ''))
      for (const n of Array.isArray(j) ? j : j['@graph'] ?? [j]) if (n?.['@type']) types.push(String(n['@type']))
    } catch { ldBad++ }
  }
  add('json-ld', 'Structured data', 'JSON-LD (schema.org)', ldBad ? 'fail' : types.length ? 'pass' : 'warn', ldBad ? `${ldBad} block(s) are not valid JSON` : types.length ? `Types: ${Array.from(new Set(types)).join(', ')}` : 'No JSON-LD found', 'Add Organization / WebSite / Service / FAQPage / Article markup as relevant.')

  // ---- Performance & security ----
  add('ttfb', 'Performance', 'Response time', p.ms < 800 ? 'pass' : p.ms < 1800 ? 'warn' : 'fail', `${p.ms} ms (incl. redirects, from the audit server)`, 'Enable caching/CDN and optimise server work.')
  const bytes = Buffer.byteLength(html)
  add('html-size', 'Performance', 'HTML size', bytes < 150_000 ? 'pass' : bytes < 500_000 ? 'warn' : 'fail', `${Math.round(bytes / 1024)} KB`, 'Reduce inline data and unused markup.')
  add('compression', 'Performance', 'Compression', /gzip|br|zstd|deflate/.test(h('content-encoding') ?? '') ? 'pass' : 'warn', h('content-encoding') ? `content-encoding: ${h('content-encoding')}` : 'No content-encoding header', 'Enable gzip/brotli at the reverse proxy.')
  add('cache', 'Performance', 'Cache-Control header', h('cache-control') ? 'pass' : 'info', h('cache-control') ?? 'None')
  add('https', 'Security', 'HTTPS', p.url.startsWith('https://') ? 'pass' : 'fail', p.url.startsWith('https://') ? 'Served over HTTPS' : 'Served over HTTP', 'Redirect all HTTP traffic to HTTPS.')
  add('hsts', 'Security', 'HSTS header', h('strict-transport-security') ? 'pass' : 'warn', h('strict-transport-security') ?? 'Missing', 'Add Strict-Transport-Security once HTTPS is stable.')
  const favicon = tags(html, /<link\b[^>]*>/gi).some((t) => /icon/i.test(attr(t, 'rel') ?? ''))
  add('favicon', 'On-page', 'Favicon', favicon ? 'pass' : 'info', favicon ? 'Declared' : 'No <link rel="icon">')

  return { checks: c, facts: { title, description: desc, words, images: imgs.length, internalLinks: internal, externalLinks: external, jsonLdTypes: Array.from(new Set(types)), canonical } }
}

/** robots.txt + sitemap.xml analysis. */
export function analyzeRobots(robots: { status: number; body: string } | null, siteOrigin: string): SeoCheck[] {
  const out: SeoCheck[] = []
  if (!robots || robots.status !== 200) {
    out.push({ id: 'robots', group: 'Crawlability', label: 'robots.txt', status: 'warn', detail: robots ? `HTTP ${robots.status}` : 'Not reachable', fix: 'Publish /robots.txt with a Sitemap: line.' })
    return out
  }
  const blocksAll = /user-agent:\s*\*\s*[\r\n]+(?:(?!user-agent)[^\r\n]*[\r\n]+)*?\s*disallow:\s*\/\s*$/im.test(robots.body)
  out.push({ id: 'robots', group: 'Crawlability', label: 'robots.txt', status: blocksAll ? 'fail' : 'pass', detail: blocksAll ? 'Disallow: / blocks the whole site for all bots' : 'Present and not blocking the whole site', fix: blocksAll ? 'Remove the blanket Disallow: /.' : undefined })
  const sm = robots.body.match(/^\s*sitemap:\s*(\S+)/im)?.[1]
  out.push({ id: 'robots-sitemap', group: 'Crawlability', label: 'Sitemap declared in robots.txt', status: sm ? 'pass' : 'warn', detail: sm ?? 'No Sitemap: line', fix: sm ? undefined : `Add "Sitemap: ${siteOrigin}/sitemap.xml".` })
  return out
}

export function parseSitemapUrls(xml: string, max = 200): string[] {
  return Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1].replace(/&amp;/g, '&')).slice(0, max)
}

export function scoreChecks(checks: SeoCheck[]): { score: number; pass: number; warn: number; fail: number } {
  const scored = checks.filter((x) => x.status !== 'info')
  const pass = scored.filter((x) => x.status === 'pass').length
  const warn = scored.filter((x) => x.status === 'warn').length
  const fail = scored.filter((x) => x.status === 'fail').length
  const score = scored.length ? Math.round(((pass + warn * 0.5) / scored.length) * 100) : 0
  return { score, pass, warn, fail }
}
