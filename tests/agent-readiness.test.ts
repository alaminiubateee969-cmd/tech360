/**
 * TECH360 — production AI agent readiness.
 *
 * Ten acceptance areas, each pinned by assertions against the real source or
 * the real modules, so a regression fails CI rather than silently shipping:
 *
 *  1. robots.txt + Content-Signal + private-surface disallow rules
 *  2. canonical URL strategy and unique per-route metadata
 *  3. Organization identity and a truthful `sameAs` list
 *  4. structured data: required types, stable @ids, no fabricated claims
 *  5. crawlable About / Contact / Legal navigation
 *  6. llms.txt and llms-full.txt content and link integrity
 *  7. Markdown content negotiation (pure function + route guard)
 *  8. RFC 8288 Link header targets
 *  9. WebMCP tool registration (progressive enhancement)
 * 10. MCP server card(s), AI catalog and the protocol contract
 *
 * Everything here is static analysis or a pure-function call — no network, no
 * database, no secrets.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { FAQS, INDUSTRIES, LEGAL_DOCS, SERVICES } from '../src/data/site'
import { PUBLIC_AGENT_TOOLS, PUBLIC_AGENT_TOOL_NAMES, getAgentTool } from '../src/lib/agent-tools'
import { agentLinkHeader, renderMarkdownForPath, llmsFullMarkdown } from '../src/lib/agent-content'
import { resolvePublicRoute, getStaticPublicRoutePaths } from '../src/lib/public-route-catalog'
import { pageGraph, siteGraph } from '../src/lib/structured-data'
import { diffTrees } from '../scripts/copy-standalone-assets.mjs'
import { orEmpty } from '../src/lib/safe-db-read'

const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const readJson = (p: string) => JSON.parse(read(p)) as Record<string, unknown>

const SITE = 'https://bdtech360.com'

// ------------------------------------------------------------------
// 1 — robots.txt and Content-Signal
// ------------------------------------------------------------------
describe('1 — robots.txt and Content-Signal', () => {
  const robots = read('public/robots.txt')

  it('allows public crawling and keeps the sitemap directive', () => {
    assert.match(robots, /^User-agent: \*$/m)
    assert.match(robots, /^Allow: \/$/m)
    assert.match(robots, /^Sitemap: https:\/\/bdtech360\.com\/sitemap\.xml$/m)
  })

  it('advertises the content signal exactly as requested', () => {
    assert.match(robots, /^Content-Signal: search=yes, ai-train=no$/m)
  })

  it('does not present Content-Signal as a technical or legal block', () => {
    assert.match(robots, /not a technical or legal restriction|emerging, non-standardised|expresses a preference/i)
  })

  it('disallows every private surface and API', () => {
    for (const path of ['/admin', '/super-admin', '/portal', '/pipeline', '/design-kit', '/factory', '/api/']) {
      assert.match(robots, new RegExp(`^Disallow: ${path.replace('/', '\\/')}$`, 'm'), `missing Disallow for ${path}`)
    }
  })

  it('never claims robots.txt is a security control', () => {
    assert.match(robots, /NOT an authentication or access-control mechanism/i)
  })
})

// ------------------------------------------------------------------
// 2 — canonical URLs and metadata
// ------------------------------------------------------------------
describe('2 — canonical URL and metadata', () => {
  const layout = read('src/app/layout.tsx')
  const pathPage = read('src/app/[...path]/page.tsx')

  it('sets metadataBase and an absolute homepage canonical', () => {
    assert.match(layout, /metadataBase: new URL\(SITE_URL\)/)
    assert.match(layout, /canonical: `\$\{SITE_URL\}/)
  })

  it('gives every catalogued public route a unique title and description', () => {
    const seen = new Map<string, string>()
    for (const path of getStaticPublicRoutePaths()) {
      // Private surfaces legitimately share a generic label.
      if (['/portal', '/pipeline', '/design-kit'].includes(path)) continue
      const route = resolvePublicRoute(path.split('/').filter(Boolean))
      assert.ok(route, `no route resolved for ${path}`)
      assert.ok(route.title.length > 5, `${path} title too short`)
      // Service taglines are intentionally concise; section pages must be substantive.
      const minLength = route.kind === 'service' ? 15 : route.kind === 'industry' ? 30 : 40
      assert.ok(route.description.length >= minLength, `${path} description too short`)
      const duplicate = seen.get(route.title)
      assert.equal(duplicate, undefined, `${path} duplicates the title of ${duplicate}`)
      seen.set(route.title, path)
    }
  })

  it('emits exactly one canonical per document, from the route catalog', () => {
    assert.match(pathPage, /alternates: \{ canonical: route\.path \}/)
    assert.equal((pathPage.match(/canonical:/g) ?? []).length, 2) // blog-post + section branches
  })

  it('advertises the Markdown and RSS alternates', () => {
    assert.match(layout, /'text\/markdown': '\/'/)
    assert.match(layout, /'application\/rss\+xml': '\/rss\.xml'/)
  })

  it('keeps Open Graph and Twitter cards pointing at a real image', () => {
    assert.match(layout, /openGraph:/)
    assert.match(layout, /twitter:/)
    assert.ok(existsSync(join(ROOT, 'public/images/tech360-banner.jpg')), 'og:image asset must exist')
    for (const src of read('src/app/layout.tsx').matchAll(/images: \[\{ url: '([^']+)'/g)) {
      const asset = join(ROOT, 'public', src[1].replace(/^\//, ''))
      assert.ok(existsSync(asset), `Open Graph image missing on disk: ${src[1]}`)
    }
  })
})

// ------------------------------------------------------------------
// 3 — Organization identity and sameAs
// ------------------------------------------------------------------
describe('3 — Organization identity and sameAs', () => {
  const org = siteGraph().find((node) => (node as { '@type': string })['@type'] === 'Organization') as Record<string, unknown>
  const sameAs = org.sameAs as string[]

  it('states the verified legal identity and contact details', () => {
    assert.equal(org.name, 'TECH360 LLC')
    assert.equal(org.url, SITE)
    assert.equal(org.email, 'info@bdtech360.com')
    assert.equal(org.telephone, '+1-816-380-8660')
    assert.match(org['@id'] as string, /#organization$/)
  })

  it('uses the official published logo', () => {
    assert.equal(org.logo, `${SITE}/brand/tech360-circular-logo.jpg`)
    assert.ok(existsSync(join(ROOT, 'public/brand/tech360-circular-logo.jpg')))
  })

  it('only lists same-origin or allow-listed sameAs profiles', () => {
    // Every entry must be a company-controlled, publicly reachable URL. Nothing
    // is invented: adding a social profile requires it to exist first.
    const allowListed = new Set(['github.com'])
    for (const url of sameAs) {
      assert.match(url, /^https:\/\//, `${url} must be HTTPS`)
      const parsed = new URL(url)
      if (parsed.hostname === 'bdtech360.com') continue
      assert.ok(allowListed.has(parsed.hostname), `${url} is not a verified, allow-listed profile`)
    }
    // No bare website-as-profile and no self-referencing duplicate.
    assert.ok(!sameAs.includes(SITE))
  })

  it('shares one @id with the WebSite node publisher', () => {
    const website = siteGraph().find((n) => (n as { '@type': string })['@type'] === 'WebSite') as Record<string, unknown>
    assert.deepEqual(website.publisher, { '@id': org['@id'] })
  })
})

// ------------------------------------------------------------------
// 4 — structured data
// ------------------------------------------------------------------
describe('4 — structured data', () => {
  const types = (nodes: readonly unknown[]) => nodes.map((n) => (n as { '@type': string })['@type'])

  it('emits Organization, WebSite, WebPage, Service and Blog site-wide', () => {
    const t = types(siteGraph())
    for (const required of ['Organization', 'WebSite', 'WebPage', 'Service', 'Blog']) {
      assert.ok(t.includes(required), `site graph is missing ${required}`)
    }
    assert.equal(t.filter((x) => x === 'Service').length, SERVICES.length)
  })

  it('does not present illustrative concepts as real software applications', () => {
    const platform = types(pageGraph('/platform', { title: 'Platform', description: 'x' })!)
    assert.ok(!platform.includes('SoftwareApplication'))
    // ...and not on unrelated pages.
    assert.ok(!types(pageGraph('/about', { title: 'About', description: 'x' })!).includes('SoftwareApplication'))
    assert.ok(!types(siteGraph()).includes('SoftwareApplication'))
  })

  it('emits AboutPage, ContactPage and per-section page types', () => {
    assert.deepEqual(types(pageGraph('/about', { title: 'About', description: 'x' })!), ['AboutPage', 'BreadcrumbList'])
    assert.equal(types(pageGraph('/contact', { title: 'Contact', description: 'x' })!)[0], 'ContactPage')
    assert.equal(types(pageGraph('/services', { title: 'Services', description: 'x' })!)[0], 'CollectionPage')
    assert.equal(types(pageGraph('/faq', { title: 'FAQ', description: 'x' })!)[0], 'FAQPage')
  })

  it('adds Service + BreadcrumbList on a service page and Article on /work', () => {
    // The Service entity is defined once (site graph) and referenced here; the
    // page node must not restate it with different copy.
    const service = pageGraph('/services/custom-crm-development', { title: 'CRM', description: 'x' })!
    assert.deepEqual(types(service), ['WebPage', 'BreadcrumbList'])
    const page = service[0] as { mainEntity: { '@id': string } }
    assert.equal(page.mainEntity['@id'], `${SITE}/services/custom-crm-development#service`)
    const work = types(pageGraph('/work', { title: 'Work', description: 'x' })!)
    assert.ok(work.includes('Article'))
  })

  it('keeps FAQPage markup backed by the FAQ actually published', () => {
    const faqPages = pageGraph('/faq', { title: 'FAQ', description: 'x' })! as { '@type': string; mainEntity?: { name: string }[] }[]
    assert.equal(faqPages.filter((n) => n['@type'] === 'FAQPage').length, 1, 'exactly one FAQPage node')
    const faq = faqPages.find((n) => n.mainEntity) as { mainEntity: { name: string }[] }
    assert.equal(faq.mainEntity.length, FAQS.length)
    assert.deepEqual(faq.mainEntity.map((q) => q.name), FAQS.map((f) => f.q))
  })

  it('uses stable, unique @ids', () => {
    const ids: string[] = []
    const collect = (node: unknown) => {
      const n = node as Record<string, unknown>
      if (typeof n['@id'] === 'string') ids.push(n['@id'])
    }
    siteGraph().forEach(collect)
    for (const path of ['/about', '/faq', '/services', '/contact']) {
      pageGraph(path, { title: 't', description: 'd' })?.forEach(collect)
    }
    assert.equal(new Set(ids).size, ids.length, `duplicate @id: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`)
  })

  it('never defines the same @id twice across the site and page graphs', () => {
    const siteIds = siteGraph().map((n) => (n as { '@id'?: string })['@id']).filter(Boolean) as string[]
    for (const path of ['/about', '/faq', '/services', '/services/custom-crm-development', '/industries/ecommerce', '/work', '/legal/terms', '/contact', '/platform']) {
      const pageIds = (pageGraph(path, { title: 't', description: 'd' }) ?? [])
        .map((n) => (n as { '@id'?: string })['@id'])
        .filter(Boolean) as string[]
      const overlap = pageIds.filter((id) => siteIds.includes(id))
      // The FAQPage is the only node allowed to reuse an id declared elsewhere
      // (it IS the page node on /faq, and the site graph no longer carries one).
      assert.deepEqual(overlap, [], `${path} redefines a site-wide @id: ${overlap.join(', ')}`)
    }
  })

  it('fabricates no prices, ratings, reviews or availability', () => {
    const json = JSON.stringify([...siteGraph(), ...(pageGraph('/platform', { title: 't', description: 'd' }) ?? [])])
    for (const banned of ['aggregateRating', 'reviewCount', '"review"', '"offers"', '"price"', 'availability', 'ratingValue']) {
      assert.ok(!json.includes(banned), `structured data must not contain ${banned}`)
    }
  })

  it('renders a single site graph in the layout and no duplicate FAQPage', () => {
    const layout = read('src/app/layout.tsx')
    assert.equal((layout.match(/application\/ld\+json/g) ?? []).length, 1)
    const t = types(siteGraph())
    assert.equal(t.filter((x) => x === 'FAQPage').length, 0, 'FAQPage belongs on /faq only')
  })

  it('emits the page graph server-side for crawlable routes', () => {
    const pathPage = read('src/app/[...path]/page.tsx')
    assert.match(pathPage, /pageGraph\(route\.path/)
    assert.match(pathPage, /application\/ld\+json/)
  })
})

// ------------------------------------------------------------------
// 5 — company, contact and legal navigation
// ------------------------------------------------------------------
describe('5 — crawlable company, contact and legal navigation', () => {
  const footer = read('src/components/site/SiteFooter.tsx')
  const header = read('src/components/site/SiteHeader.tsx')
  const navStructure = read('src/components/site/nav-structure.ts')

  it('links About, Contact and every legal policy with real hrefs', () => {
    for (const path of ['/about', '/contact', '/legal']) {
      assert.ok(footer.includes(`href="${path}"`) || navStructure.includes(`"${path}"`) || header.includes(`"${path}"`), `no crawlable link to ${path}`)
    }
    // The footer renders the policy list from LEGAL_DOCS, so assert the
    // template is a real path (not a fragment) rather than a literal per doc.
    assert.match(footer, /href=\{`\/legal\/\$\{doc\.slug\}`\}/)
    for (const doc of LEGAL_DOCS) {
      assert.ok(navStructure.includes(`/legal/${doc.slug}`) || footer.includes('href={`/legal/'), `no crawlable link for ${doc.slug}`)
    }
  })

  it('never emits a hash-only public route in navigation or footer', () => {
    for (const [name, source] of [
      ['SiteFooter.tsx', footer],
      ['nav-structure.ts', navStructure],
      ['SiteHeader.tsx', header],
    ] as const) {
      assert.ok(!/["'`]#\/[a-z]/.test(source), `${name} still contains a hash-only public route`)
    }
  })

  it('resolves each linked policy to a real route', () => {
    for (const doc of LEGAL_DOCS) {
      assert.ok(resolvePublicRoute(['legal', doc.slug]), `/legal/${doc.slug} does not resolve`)
    }
    assert.ok(resolvePublicRoute(['about']))
    assert.ok(resolvePublicRoute(['contact']))
  })

  it('keeps the skip link as the only in-page fragment in the shell', () => {
    assert.match(read('src/app/page.tsx'), /href="#main-content"/)
  })

  /**
   * Regression guard for the fragment-link codemod.
   *
   * The codemod rewrote `#/<route>` anchors to `/<route>` across the whole of
   * `src/`, which is correct for public pages but wrong for internal surfaces:
   * `/admin/prompt-library` has no route and no redirect, so the admin deep link
   * 404ed. Internal surfaces keep the hash form, which the SPA understands.
   */
  it('never emits a path-form link to an internal surface without a route', () => {
    const guarded = ['MediaStudioView.tsx', 'SettingsView.tsx', 'BlogStudioView.tsx', 'AdminApp.tsx']
    for (const file of guarded) {
      const source = read(`src/components/admin/${file}`)
      for (const match of source.matchAll(/href=(?:"|\{`)(\/[^"'`$\s]+)/g)) {
        const href = match[1]
        if (!href.startsWith('/admin/') && !href.startsWith('/pipeline') && !href.startsWith('/design-kit')) continue
        // Only the two real documents (and their redirects) may be path-linked.
        assert.ok(
          ['/admin', '/admin/factory-control', '/admin/command-center'].includes(href),
          `${file} links ${href}, which has no route or redirect — use the hash form instead`,
        )
      }
    }
    assert.ok(
      read('src/components/admin/MediaStudioView.tsx').includes('href="#/admin/prompt-library"'),
      'the described admin deep link must keep its hash form',
    )
  })
})

// ------------------------------------------------------------------
// 6 — llms.txt
// ------------------------------------------------------------------
describe('6 — llms.txt publication', () => {
  const llms = read('content/llms.txt')

  it('starts with the H1 + blockquote identity summary', () => {
    assert.match(llms, /^# TECH360 LLC\n\n> /)
    assert.match(llms, /Scope of Work/)
  })

  it('lists the public policies, company pages and machine-readable resources', () => {
    for (const path of ['/legal/terms', '/legal/privacy', '/about', '/contact', '/services', '/industries', '/llms-full.txt', '/sitemap.xml']) {
      assert.ok(llms.includes(`${SITE}${path}`), `llms.txt is missing ${path}`)
    }
    for (const doc of LEGAL_DOCS) assert.ok(llms.includes(`/legal/${doc.slug}`), `llms.txt is missing ${doc.slug}`)
  })

  it('uses only real URLs and never leaks credentials, private endpoints or records', () => {
    for (const url of llms.matchAll(/https:\/\/[^\s)]+/g)) {
      assert.ok(url[0].startsWith(SITE), `llms.txt advertises a foreign host: ${url[0]}`)
      assert.ok(!/\/api\/(?!mcp)/.test(url[0]), `llms.txt advertises a private API: ${url[0]}`)
    }
    // Private surfaces may be named only to say they are excluded.
    assert.match(llms, /`\/portal`, `\/admin` and `\/pipeline` are authenticated surfaces/)
    for (const banned of ['password', 'token=', 'CLIENT_', 'apikey', 'BEGIN PRIVATE KEY']) {
      assert.ok(!llms.toLowerCase().includes(banned.toLowerCase()), `llms.txt must not contain ${banned}`)
    }
  })

  it('is served with the Markdown content type from a dedicated route', () => {
    const route = read('src/app/llms.txt/route.ts')
    assert.match(route, /text\/markdown; charset=utf-8/)
    assert.match(route, /Content-Signal/)
    assert.ok(existsSync(join(ROOT, 'content/llms.txt')))
  })

  it('generates a synchronised llms-full.txt from the same registries', () => {
    const full = llmsFullMarkdown()
    assert.match(full, /^# TECH360 LLC — extended index/)
    for (const service of SERVICES) assert.ok(full.includes(`/services/${service.slug}`), `llms-full missing ${service.slug}`)
    for (const industry of INDUSTRIES) assert.ok(full.includes(`/industries/${industry.slug}`), `llms-full missing ${industry.slug}`)
    for (const doc of LEGAL_DOCS) assert.ok(full.includes(`/legal/${doc.slug}`), `llms-full missing ${doc.slug}`)
    assert.ok(!full.includes('/api/admin'), 'llms-full must not advertise admin APIs')
  })
})

// ------------------------------------------------------------------
// 7 — Markdown content negotiation
// ------------------------------------------------------------------
describe('7 — Markdown content negotiation', () => {
  const proxy = read('src/proxy.ts')

  it('returns Markdown for public informational routes with the right type and Vary', () => {
    assert.match(proxy, /text\/markdown; charset=utf-8/)
    assert.match(proxy, /'Vary': 'Accept'/)
    assert.match(proxy, /Content-Signal/)
  })

  it('refuses to render private surfaces as Markdown', () => {
    // The deny list is the single guard; assert each surface is covered by a
    // literal pattern rather than re-deriving a regex here.
    const denyBlock = proxy.slice(proxy.indexOf('const MARKDOWN_DENY'), proxy.indexOf('function markdownAllowed'))
    for (const surface of ['portal', 'admin', 'super-admin', 'pipeline', 'design-kit', 'factory', 'api', 'login']) {
      assert.ok(denyBlock.includes(`/${surface}(`), `proxy does not deny /${surface}`)
    }
    // `.well-known` is escaped in the pattern, so match it literally.
    assert.ok(denyBlock.includes('well-known'), 'proxy does not deny /.well-known')
  })

  it('produces the same facts in both representations', () => {
    const services = renderMarkdownForPath('/services')
    assert.ok(services)
    for (const service of SERVICES) assert.ok(services.includes(service.title), `markdown missing ${service.title}`)
    const about = renderMarkdownForPath('/about')
    assert.match(about!, /TECH360 LLC/)
    assert.match(about!, /info@bdtech360\.com/)
  })

  it('returns null for private paths instead of fabricating a representation', () => {
    assert.equal(renderMarkdownForPath('/portal'), null)
    assert.equal(renderMarkdownForPath('/admin/users'), null)
    assert.equal(renderMarkdownForPath('/api/chat/message'), null)
    assert.equal(renderMarkdownForPath('/design-kit'), null)
  })

  it('only negotiates when Markdown is genuinely preferred', () => {
    assert.match(proxy, /text\\\/markdown\\s\*\(\?:;\\s\*q=/)
  })
})

// ------------------------------------------------------------------
// 8 — HTTP Link headers
// ------------------------------------------------------------------
describe('8 — RFC 8288 Link headers', () => {
  const header = agentLinkHeader('/services')

  it('advertises the index, the per-route Markdown alternate, the catalog and the feed', () => {
    assert.ok(header.includes(`<${SITE}/llms.txt>; rel="llms.txt"`))
    assert.ok(header.includes(`<${SITE}/services>; rel="alternate"; type="text/markdown"`))
    assert.ok(header.includes(`<${SITE}/.well-known/ai-catalog.json>; rel="ai-catalog"`))
    assert.ok(header.includes(`<${SITE}/rss.xml>`))
  })

  it('uses the homepage as the alternate on the homepage', () => {
    assert.ok(agentLinkHeader('/').includes(`<${SITE}/>; rel="alternate"; type="text/markdown"`))
  })

  it('advertises only resources that exist', () => {
    const targets = [...header.matchAll(/<([^>]+)>/g)].map((m) => m[1])
    for (const target of targets) {
      const path = new URL(target).pathname
      // Verified against the production build (see the acceptance report):
      // every one of these returns 200 with the type the header claims.
      const ok =
        path === '/llms.txt' ||
        path === '/llms-full.txt' ||
        path === '/rss.xml' ||
        path === '/.well-known/ai-catalog.json' ||
        path === '/services' ||
        path === '/services.md' ||
        path === '/index.md'
      assert.ok(ok, `Link header advertises an unverified target: ${target}`)
    }
  })

  it('does not overwrite a framework Link header', () => {
    assert.match(read('src/proxy.ts'), /const existing = res\.headers\.get\('Link'\)/)
  })
})

// ------------------------------------------------------------------
// 9 — WebMCP
// ------------------------------------------------------------------
describe('9 — WebMCP browser tools', () => {
  const source = read('src/components/site/WebMCPTools.tsx')

  it('feature-detects the current API surface and degrades silently', () => {
    assert.match(source, /navigator as Navigator & \{ modelContext\?: ModelContextLike \}/)
    assert.match(source, /typeof modelContext\.registerTool !== 'function'/)
    // The removed API may be *mentioned* in the rationale comment, but must
    // never be called.
    assert.ok(!/modelContext\.provideContext|modelContext\.clearContext/.test(source), 'removed API must not be called')
    assert.match(source, /unregisterTool/)
  })

  it('registers exactly the five safe read-only public tools', () => {
    assert.deepEqual([...PUBLIC_AGENT_TOOL_NAMES], [
      'search_public_services',
      'list_public_products',
      'get_company_information',
      'get_public_faq',
      'open_contact_page',
    ])
    assert.match(source, /PUBLIC_AGENT_TOOLS/)
    for (const tool of PUBLIC_AGENT_TOOLS) {
      assert.equal(tool.annotations.readOnlyHint, true, `${tool.name} must be read-only`)
      assert.equal(tool.annotations.destructiveHint, false)
      assert.equal(tool.inputSchema.additionalProperties, false, `${tool.name} must reject unknown arguments`)
    }
  })

  it('never sends a message or touches CRM data', () => {
    assert.ok(!/fetch\(|XMLHttpRequest|db\.|prisma/i.test(source), 'WebMCPTools must not call the network or a database')
    const contact = getAgentTool('open_contact_page')!
    const result = contact.run({})
    assert.ok(result.ok)
    assert.match((result as { text: string }).text, /does not send anything/i)
  })
})

// ------------------------------------------------------------------
// 10 — MCP server cards, AI catalog and protocol
// ------------------------------------------------------------------
describe('10 — MCP server card, AI catalog and protocol', () => {
  const legacy = readJson('public/.well-known/mcp/server-card.json')
  const cardRoute = read('src/app/api/mcp/server-card/route.ts')
  const catalogRoute = read('src/app/.well-known/ai-catalog.json/route.ts')
  const mcp = read('src/app/api/mcp/route.ts')

  it('publishes the legacy SEP-1649 card with the fields clients read', () => {
    for (const key of ['$schema', 'version', 'protocolVersion', 'serverInfo', 'transport', 'capabilities', 'authentication']) {
      assert.ok(key in legacy, `legacy card missing ${key}`)
    }
    assert.equal(legacy.endpointUrl, `${SITE}/api/mcp`)
    assert.equal((legacy.authentication as { required: boolean }).required, false)
    assert.equal(legacy.supersededBy, `${SITE}/api/mcp/server-card`)
  })

  it('serves the SEP-2127 card at the reserved /server-card location', () => {
    assert.match(cardRoute, /https:\/\/static\.modelcontextprotocol\.io\/schemas\/v1\/server-card\.schema\.json/)
    assert.match(cardRoute, /application\/mcp-server-card\+json; charset=utf-8/)
    assert.match(cardRoute, /com\.bdtech360\/site/)
    assert.match(cardRoute, /streamable-http/)
    assert.match(cardRoute, /if-none-match/i, 'must support conditional GET')
  })

  it('publishes an AI catalog entry that points at the card', () => {
    assert.match(catalogRoute, /\.well-known\/ai-catalog\.json/)
    assert.match(catalogRoute, /application\/ai-catalog\+json; charset=utf-8/)
    assert.match(catalogRoute, /urn:air:bdtech360\.com:mcp:site/)
    assert.match(catalogRoute, /application\/mcp-server-card\+json/)
  })

  it('advertises only implemented protocol methods and capabilities', () => {
    for (const method of ['initialize', 'ping', 'tools/list', 'tools/call']) {
      assert.ok(mcp.includes(`'${method}'`), `MCP endpoint does not implement ${method}`)
    }
    assert.match(mcp, /capabilities: \{ tools: \{ listChanged: false \} \}/)
    // tools/list must be derived from the shared registry, never hand-written.
    assert.match(mcp, /agentToolDescriptors\(\)/)
  })

  it('enforces validation, origin checks, rate limiting and structured errors', () => {
    assert.match(mcp, /originAllowed\(/)
    assert.match(mcp, /rateLimit\(`mcp:\$\{ip\}`/)
    assert.match(mcp, /Unknown argument\(s\)/)
    assert.match(mcp, /-32602/)
    assert.match(mcp, /-32601/)
    assert.match(mcp, /-32700/)
    assert.match(mcp, /Retry-After/)
  })

  it('audits tool calls without logging arguments or full IPs', () => {
    assert.match(mcp, /\[agent-audit\]/)
    assert.match(mcp, /\.x\.x/)
    assert.ok(!/JSON\.stringify\(\{[^}]*args/.test(mcp), 'audit log must not include arguments')
  })

  it('exposes no secrets or private data through any tool', () => {
    const everything = PUBLIC_AGENT_TOOLS.map((t) => t.run(t.inputSchema.required ? { query: 'crm' } : {}))
      .map((r) => (r.ok ? r.text : ''))
      .join('\n')
    for (const banned of ['password', 'Bearer ', 'DATABASE_URL', 'CLIENT_ID_', '/api/admin']) {
      assert.ok(!everything.includes(banned), `tool output must not contain ${banned}`)
    }
  })

  it('rejects unknown tools and unknown arguments rather than inventing a result', () => {
    assert.equal(getAgentTool('delete_everything'), undefined)
    const bad = getAgentTool('search_public_services')!.run({ nope: 1 })
    assert.equal(bad.ok, false)
    assert.equal((bad as { error: { code: string } }).error.code, 'INVALID_ARGUMENT')
    const noQuery = getAgentTool('search_public_services')!.run({})
    assert.equal(noQuery.ok, false)
  })

  it('keeps the MCP transport path out of the public Markdown representation', () => {
    assert.equal(renderMarkdownForPath('/api/mcp'), null)
  })
})

// ------------------------------------------------------------------
// 11 — standalone bundle copy is exact, not merge-append
// ------------------------------------------------------------------
describe('standalone static bundle', () => {
  const script = read('scripts/copy-standalone-assets.mjs')

  it('removes the destination before copying, so deleted files cannot linger', () => {
    assert.match(script, /await rm\(destination, \{ recursive: true, force: true \}\)/)
    // A merge-style copy would let a file the repo deleted keep being served.
    assert.ok(
      !/cp -r public \.next\/standalone/.test(read('package.json')),
      'build must not fall back to merge-style `cp -r`',
    )
  })

  it('flags a stale file left behind by a previous build', () => {
    // Reproduces the real defect: `public/llms.txt` was deleted from source,
    // but a merge-style copy leaves the old copy in the bundle.
    const { extra, missing } = diffTrees(
      ['robots.txt', '.well-known/mcp/server-card.json'],
      ['robots.txt', '.well-known/mcp/server-card.json', 'llms.txt'],
    )
    assert.deepEqual(extra, ['llms.txt'])
    assert.deepEqual(missing, [])
  })

  it('flags a copy that did not complete', () => {
    const { extra, missing } = diffTrees(['robots.txt', 'tech360-logo.png'], ['robots.txt'])
    assert.deepEqual(extra, [])
    assert.deepEqual(missing, ['tech360-logo.png'])
  })

  it('reports a faithful copy as clean', () => {
    const { extra, missing } = diffTrees(['robots.txt'], ['robots.txt'])
    assert.deepEqual(extra, [])
    assert.deepEqual(missing, [])
  })

  it('does not confuse llms.txt in content/ with the retired public file', () => {
    // The route handler is the only source of /llms.txt now.
    assert.ok(existsSync(join(ROOT, 'content/llms.txt')))
    assert.ok(!existsSync(join(ROOT, 'public/llms.txt')))
  })
})

// ------------------------------------------------------------------
// 12 — crawler surfaces survive a broken database
// ------------------------------------------------------------------
describe('database-error fallback', () => {
  it('returns the rows when the read succeeds', async () => {
    const rows = await orEmpty(async () => [{ id: 1 }, { id: 2 }])
    assert.deepEqual(rows, [{ id: 1 }, { id: 2 }])
  })

  it('returns an empty list when the read throws SYNCHRONOUSLY', async () => {
    // This is the real Prisma failure: the lazy `db` proxy throws during
    // property access, before any promise exists. A `.catch()` cannot attach
    // to it, which is why the read is passed as a thunk.
    const rows = await orEmpty<{ id: number }>(() => {
      throw new Error('Missing configured driver adapter.')
    })
    assert.deepEqual(rows, [])
  })

  it('returns an empty list when the promise rejects', async () => {
    const rows = await orEmpty(async () => {
      throw new Error('connection refused')
    })
    assert.deepEqual(rows, [])
  })

  it('never lets the feed or sitemap read run unguarded', () => {
    // Both crawler surfaces must go through the guard, and must pass a thunk —
    // calling `orEmpty(db.x.findMany(...))` would throw before the guard ran.
    const rss = read('src/app/rss.xml/route.ts')
    const blog = read('src/lib/public-blog.ts')
    assert.match(rss, /orEmpty\(\(\) =>/)
    assert.match(blog, /orEmpty\(\(\) =>/)
    for (const [name, source] of [
      ['rss.xml', rss],
      ['public-blog', blog],
    ] as const) {
      assert.ok(
        !/orEmpty\(\s*db\./.test(source),
        `${name} must pass a thunk to orEmpty, not an already-evaluated read`,
      )
    }
  })

  it('does not silently swallow errors on the mutation paths', () => {
    // The fallback is for read-only crawler surfaces. If it ever appears in an
    // admin or write path, a failed save would look like success.
    const offenders = ['src/lib/features.ts', 'src/lib/agent-tools.ts']
    for (const file of offenders) {
      assert.ok(!read(file).includes('orEmpty'), `${file} must not use the read fallback`)
    }
  })
})

// ------------------------------------------------------------------
// 13 — operator surfaces are not advertised as indexable
// ------------------------------------------------------------------
describe('operator surface indexability', () => {
  it('sends X-Robots-Tag for every path robots.txt claims', () => {
    const config = read('next.config.ts')
    // robots.txt states these surfaces "additionally send X-Robots-Tag".
    // Before this was pinned, only /factory/* actually did — the claim was false
    // for /admin/command-center, /pipeline, /design-kit and /portal.
    for (const source of ["/admin/:path*", "/pipeline/:path*", "/design-kit/:path*", "/portal/:path*"]) {
      assert.ok(
        config.includes(`source: "${source}"`),
        `next.config.ts must send X-Robots-Tag for ${source}`,
      )
    }
    assert.match(config, /X-Robots-Tag", value: "noindex, nofollow, noarchive"/)
  })

  it('marks the admin console layout noindex so it cannot inherit index, follow', () => {
    // /admin/command-center is a client component, so it cannot export metadata
    // itself. Without a layout it inherited the root layout's `index, follow`
    // and the homepage canonical.
    const layout = read('src/app/admin/layout.tsx')
    assert.match(layout, /index: false/)
    assert.match(layout, /follow: false/)
    assert.match(layout, /noimageindex: true/)
  })

  it('never lets an operator surface inherit the homepage canonical', () => {
    // The root layout sets a canonical of `${SITE_URL}/` for the homepage. Any
    // route that does not override it would advertise itself as the homepage.
    const layout = read('src/app/layout.tsx')
    assert.match(layout, /canonical: `\$\{SITE_URL}\/`/)
    const adminLayout = read('src/app/admin/layout.tsx')
    assert.ok(
      !/alternates/.test(adminLayout),
      'admin layout must not add a canonical that competes with the root one',
    )
  })

  it('states that robots.txt is a preference, not access control', () => {
    const robots = read('public/robots.txt')
    assert.match(robots, /NOT an authentication or access-control mechanism/i)
    assert.match(robots, /Content-Signal: search=yes, ai-train=no/)
    // The Content-Signal must be described as a preference, never as a restriction.
    assert.match(robots, /not a technical restriction/i)
  })
})
