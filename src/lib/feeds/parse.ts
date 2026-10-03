/**
 * TECH360 — Feed Hub parser (RSS 2.0 · Atom · JSON Feed)
 * ======================================================
 * Dependency-free, server-side parsing of public feeds into a normalised item
 * shape. Written for the Feed Hub because the platform must ingest industry
 * sources without shipping a scraping framework or a credential store.
 *
 * Rules:
 *   - Parsing NEVER executes markup. Entities are decoded to text only.
 *   - Summaries are stripped of HTML and clamped, so a hostile feed cannot
 *     inject markup into the console or into a generated asset.
 *   - A feed that cannot be parsed returns `{ ok: false }` with the reason —
 *     the caller stores that as an honest ERROR state.
 */

export const FEED_KINDS = ['RSS', 'ATOM', 'JSON'] as const
export type FeedKind = (typeof FEED_KINDS)[number]

export type ParsedFeedItem = {
  guid: string
  title: string
  link: string
  summary: string | null
  publishedAt: Date | null
  tags: string[]
}

export type ParsedFeed = {
  ok: true
  kind: FeedKind
  title: string | null
  items: ParsedFeedItem[]
} | {
  ok: false
  kind: FeedKind | null
  reason: string
}

const MAX_ITEMS = 40
const MAX_SUMMARY = 1200

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

export function stripHtml(value: string): string {
  return decodeEntities(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function clamp(value: string, max = MAX_SUMMARY): string {
  const v = value.trim()
  return v.length > max ? `${v.slice(0, max - 1).trimEnd()}…` : v
}

/** First non-empty tag body inside a fragment. */
function tag(fragment: string, names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')
    const m = re.exec(fragment)
    if (m && m[1] !== undefined) {
      const value = decodeEntities(m[1]).trim()
      if (value) return value
    }
  }
  return null
}

function atomLink(fragment: string): string | null {
  const rel = /<link\b[^>]*\brel=["']alternate["'][^>]*>/i.exec(fragment) ?? /<link\b[^>]*>/i.exec(fragment)
  if (!rel) return null
  const href = /\bhref=["']([^"']+)["']/i.exec(rel[0])
  return href ? decodeEntities(href[1]).trim() : null
}

function toDate(value: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function detectFeedKind(body: string, contentType = ''): FeedKind | null {
  const head = body.slice(0, 2000)
  if (/^\s*[[{]/.test(head) && /"(items|version)"\s*:/.test(head)) return 'JSON'
  if (/<feed[\s>]/i.test(head) && /xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom/i.test(head)) return 'ATOM'
  if (/<rss[\s>]|<rdf:RDF|<channel[\s>]/i.test(head)) return 'RSS'
  if (/application\/(rss|atom)\+xml|application\/json/i.test(contentType)) {
    if (/json/i.test(contentType)) return 'JSON'
    if (/atom/i.test(contentType)) return 'ATOM'
    return 'RSS'
  }
  return null
}

function parseXmlFeed(body: string, kind: FeedKind): ParsedFeed {
  const channelTitle = tag(body.slice(0, Math.max(0, body.search(/<item[\s>]|<entry[\s>]/i))), ['title'])
  const blocks = [...body.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map((m) => m[2]).slice(0, MAX_ITEMS)
  if (blocks.length === 0) return { ok: false, kind, reason: 'No <item> or <entry> elements were found in the response.' }

  const items: ParsedFeedItem[] = []
  for (const block of blocks) {
    const title = tag(block, ['title'])
    const link = kind === 'ATOM' ? atomLink(block) : tag(block, ['link']) ?? atomLink(block)
    const guid = tag(block, ['guid', 'id']) ?? link ?? title
    if (!title || !guid) continue
    const summaryRaw = tag(block, kind === 'ATOM' ? ['summary', 'content'] : ['description', 'content:encoded', 'summary'])
    const published = toDate(tag(block, ['pubDate', 'published', 'updated', 'dc:date']))
    const tags = [...block.matchAll(/<category\b([^>]*)(?:\/>|>([\s\S]*?)<\/category>)/gi)]
      .map((m) => {
        const attr = /\b(?:term|label)=["']([^"']+)["']/i.exec(m[1] ?? '')
        return attr ? decodeEntities(attr[1]).trim().slice(0, 40) : stripHtml(m[2] ?? '').slice(0, 40)
      })
      .filter(Boolean)
      .slice(0, 6)
    items.push({
      guid: clamp(decodeEntities(guid), 300),
      title: clamp(stripHtml(title), 220),
      link: link ? decodeEntities(link).slice(0, 500) : '',
      summary: summaryRaw ? clamp(stripHtml(summaryRaw)) || null : null,
      publishedAt: published,
      tags,
    })
  }
  if (items.length === 0) return { ok: false, kind, reason: 'Feed elements were present but none carried a usable title.' }
  return { ok: true, kind, title: channelTitle ? clamp(stripHtml(channelTitle), 160) : null, items }
}

function parseJsonFeed(body: string): ParsedFeed {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return { ok: false, kind: 'JSON', reason: 'Response is not valid JSON.' }
  }
  const root = parsed as { title?: unknown; items?: unknown }
  if (!root || typeof root !== 'object' || !Array.isArray(root.items)) {
    return { ok: false, kind: 'JSON', reason: 'JSON payload has no items[] array (JSON Feed 1.1 expected).' }
  }
  const items: ParsedFeedItem[] = []
  for (const raw of root.items.slice(0, MAX_ITEMS)) {
    const item = raw as Record<string, unknown>
    const title = stripHtml(String(item.title ?? '')).slice(0, 220)
    const link = String(item.url ?? item.external_url ?? '').slice(0, 500)
    const guid = String(item.id ?? link ?? title).slice(0, 300)
    if (!title || !guid) continue
    const summarySource = item.summary ?? item.content_text ?? item.content_html ?? ''
    const summary = summarySource ? clamp(stripHtml(String(summarySource))) || null : null
    const published = toDate(item.date_published ? String(item.date_published) : item.date_modified ? String(item.date_modified) : null)
    const tags = Array.isArray(item.tags) ? (item.tags as unknown[]).map((t) => String(t).slice(0, 40)).slice(0, 6) : []
    items.push({ guid, title, link, summary, publishedAt: published, tags })
  }
  if (items.length === 0) return { ok: false, kind: 'JSON', reason: 'JSON feed contained no usable items.' }
  return { ok: true, kind: 'JSON', title: root.title ? clamp(stripHtml(String(root.title)), 160) : null, items }
}

/** Parse a feed body of unknown type. Never throws. */
export function parseFeed(body: string, contentType = ''): ParsedFeed {
  const text = String(body ?? '')
  if (!text.trim()) return { ok: false, kind: null, reason: 'Empty response body.' }
  const kind = detectFeedKind(text, contentType)
  if (!kind) return { ok: false, kind: null, reason: 'Response is not RSS, Atom or JSON Feed.' }
  try {
    return kind === 'JSON' ? parseJsonFeed(text) : parseXmlFeed(text, kind)
  } catch (err) {
    return { ok: false, kind, reason: `Parser error: ${(err as Error).message}` }
  }
}

/** Extract links from an HTML page — used to discover a feed from a site URL. */
export function discoverFeedLinks(html: string, baseUrl: string): string[] {
  const out: string[] = []
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tagText = m[0]
    if (!/rel=["']alternate["']/i.test(tagText)) continue
    if (!/type=["']application\/(rss|atom)\+xml["']/i.test(tagText)) continue
    const href = /\bhref=["']([^"']+)["']/i.exec(tagText)
    if (!href) continue
    try {
      out.push(new URL(decodeEntities(href[1]), baseUrl).toString())
    } catch {
      /* ignore malformed href */
    }
  }
  return [...new Set(out)].slice(0, 5)
}

/** A feed item becomes a content idea rather than a copied article. */
export function ideaFromItem(item: ParsedFeedItem, sourceName: string): { title: string; angle: string; body: string } {
  const summary = item.summary ?? ''
  return {
    title: `Content idea: ${item.title}`.slice(0, 200),
    angle: `React to this ${sourceName} signal for our audience — never republish the source text.`,
    body: [
      `Source: ${sourceName}`,
      item.link ? `Link: ${item.link}` : '',
      '',
      `What happened: ${item.title}`,
      summary ? `Context: ${summary}` : '',
      '',
      'Our angle (write original copy):',
      '1. What this changes for our clients.',
      '2. What we would do about it this quarter.',
      '3. One concrete next step the reader can take.',
    ]
      .filter(Boolean)
      .join('\n'),
  }
}
