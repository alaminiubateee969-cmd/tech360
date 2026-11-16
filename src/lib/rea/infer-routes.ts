/**
 * TECH360 — REA Studio: route and endpoint candidates
 * ====================================================
 * Upstream REA states the rule this module is built around, verbatim from its
 * route-inventory guide: *"Static patterns, inferred deployment bases,
 * heuristic system classification, and unavailable sources never establish
 * route reachability or the complete application route denominator."*
 *
 * So nothing here is a route. Everything here is a **candidate** with a basis
 * and a confidence, and the record carries an explicit denial of completeness:
 * the list is what was visible in the capture, not the application's route
 * table. A candidate is never promoted to a fact by this module.
 *
 * Sources of candidates, strongest first:
 *   1. `<link rel="alternate" hreflang>` and `rel=canonical` — declared.
 *   2. Internal anchors actually present in the document — observed markup.
 *   3. URLs in robots.txt `Sitemap:` and the sitemap's `<loc>` entries.
 *   4. String literals inside captured bundle text — weakest; a path in a
 *      bundle may be dead code, a template, or another app's route.
 * Candidates from (4) are capped and labelled so they can never crowd out (2).
 */
import type { EvidenceAuthority } from './evidence'

export type CandidateBasis =
  | 'anchor'
  | 'canonical'
  | 'hreflang'
  | 'sitemap'
  | 'robots'
  | 'bundle-literal'
  | 'manifest'
  | 'og-url'

export type RouteCandidate = {
  path: string
  basis: CandidateBasis
  authority: EvidenceAuthority
  confidence: number
  /** The literal that produced this candidate. */
  source: string
  /** Link text, when the candidate came from an anchor. */
  label?: string
  external: boolean
}

export type EndpointCandidate = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'UNKNOWN'
  path: string
  authority: EvidenceAuthority
  confidence: number
  source: string
  /** What kind of call it looks like, as a hint only. */
  shape: 'api' | 'form-action' | 'asset' | 'webhook' | 'graphql' | 'unknown'
}

const LIMITS = {
  maxRouteCandidates: 120,
  maxBundleCandidates: 40,
  maxEndpointCandidates: 80,
} as const

/** Path shapes that are navigation noise, not product routes. */
const NOISE = [
  /\.(png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|woff2?|ttf|eot|mp4|webm|pdf|zip|json|xml|txt|map)$/i,
  /^\/(?:wp-(?:content|includes|admin)|cdn-cgi|_next\/|_nuxt\/|assets\/|static\/)/i,
  /^(?:mailto:|tel:|javascript:|data:|blob:)/i,
]

function isNoise(path: string): boolean {
  return NOISE.some((re) => re.test(path))
}

function normalizePath(raw: string, origin: string | null): { path: string; external: boolean } | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed || trimmed === '#') return null
  if (isNoise(trimmed)) return null
  try {
    const url = origin ? new URL(trimmed, origin) : new URL(trimmed)
    const external = origin ? url.origin !== new URL(origin).origin : true
    const path = `${url.pathname}${url.search ? `?${url.search}` : ''}`.slice(0, 300)
    if (!path || path.length > 300) return null
    return { path, external }
  } catch {
    // A relative path with no origin is still a usable candidate.
    if (/^\/[\w\-./[\]{}%@:+?=&]*$/.test(trimmed)) return { path: trimmed.slice(0, 300), external: false }
    return null
  }
}

export type RouteInferenceInput = {
  origin: string | null
  internalLinks: Array<{ href: string; text: string; area: string }>
  externalLinks?: Array<{ href: string }>
  canonical?: string | null
  hreflang?: Array<{ href: string }>
  sitemapLocs?: string[]
  robotsSitemaps?: string[]
  manifestStartUrl?: string | null
  ogUrl?: string | null
  bundleText?: string
}

export type RouteInference = {
  candidates: RouteCandidate[]
  /** The distinct path prefixes, as a shape hint only. */
  prefixes: Array<{ prefix: string; count: number }>
  coverage: { observedLinks: number; admitted: number; complete: boolean; truncatedBy: string[] }
  /** Explicit denial of completeness — always present, never conditional. */
  completeness: string[]
}

export function inferRoutes(input: RouteInferenceInput): RouteInference {
  const map = new Map<string, RouteCandidate>()
  const truncatedBy: string[] = []
  let admitted = 0

  const add = (raw: string, basis: CandidateBasis, authority: EvidenceAuthority, confidence: number, label?: string) => {
    admitted += 1
    const normalized = normalizePath(raw, input.origin)
    if (!normalized) return
    if (normalized.external && basis !== 'anchor') return
    const key = `${normalized.path}`
    const existing = map.get(key)
    const candidate: RouteCandidate = {
      path: normalized.path,
      basis,
      authority,
      confidence,
      source: raw.slice(0, 200),
      ...(label ? { label: label.slice(0, 80) } : {}),
      external: normalized.external,
    }
    // Prefer the strongest basis for a path seen more than once.
    if (!existing || rank(authority) > rank(existing.authority)) map.set(key, candidate)
  }

  if (input.canonical) add(input.canonical, 'canonical', 'DECLARED', 0.85)
  if (input.ogUrl) add(input.ogUrl, 'og-url', 'DECLARED', 0.7)
  if (input.manifestStartUrl) add(input.manifestStartUrl, 'manifest', 'DECLARED', 0.7)
  for (const alt of input.hreflang ?? []) add(alt.href, 'hreflang', 'DECLARED', 0.8)
  for (const sm of input.robotsSitemaps ?? []) add(sm, 'robots', 'DECLARED', 0.6)
  for (const loc of input.sitemapLocs ?? []) add(loc, 'sitemap', 'DECLARED', 0.8)

  // The strongest source: markup that actually shipped.
  for (const link of input.internalLinks) add(link.href, 'anchor', 'OBSERVED', 0.9, link.text)

  // Weakest source: string literals in bundle text. Bounded separately so a
  // large bundle can never displace observed anchors.
  if (input.bundleText) {
    let bundleHits = 0
    const literalRe = /["'`](\/[a-z0-9\-_./[\]{}%]{2,80})["'`]/gi
    let m: RegExpExecArray | null
    while ((m = literalRe.exec(input.bundleText)) !== null) {
      if (bundleHits >= LIMITS.maxBundleCandidates) {
        truncatedBy.push(`bundle-literal candidates capped at ${LIMITS.maxBundleCandidates}`)
        break
      }
      const value = m[1]
      if (isNoise(value)) continue
      if (/^\/(?:static|assets|_next|_nuxt|node_modules|src|dist|build)\//i.test(value)) continue
      add(value, 'bundle-literal', 'INFERRED', 0.35)
      bundleHits += 1
    }
  }

  const all = [...map.values()].sort(
    (a, b) => rank(b.authority) - rank(a.authority) || b.confidence - a.confidence || a.path.localeCompare(b.path),
  )
  const candidates = all.slice(0, LIMITS.maxRouteCandidates)
  if (all.length > candidates.length) truncatedBy.push(`route candidates capped at ${LIMITS.maxRouteCandidates} of ${all.length}`)

  const prefixCounts = new Map<string, number>()
  for (const c of candidates) {
    const prefix = `/${c.path.split('/').filter(Boolean)[0] ?? ''}`
    prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1)
  }
  const prefixes = [...prefixCounts.entries()]
    .map(([prefix, count]) => ({ prefix, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25)

  return {
    candidates,
    prefixes,
    coverage: {
      observedLinks: input.internalLinks.length,
      admitted,
      complete: truncatedBy.length === 0,
      truncatedBy,
    },
    completeness: [
      'These are CANDIDATES, not routes. Nothing here establishes that any path is reachable, returns 200, or is part of the deployed application.',
      'This is not the application route table. Routes with no inbound link, no sitemap entry and no bundle literal are invisible to a static capture and are absent from this list.',
      'A path found only in bundle text may be dead code, a template placeholder, or another application\u2019s route.',
      'Confirming reachability requires an authorized request per path, which REA Studio does not perform automatically.',
    ],
  }
}

/**
 * Endpoint candidates. Weaker than routes and labelled as such: an endpoint
 * guess from static text has never been observed on the wire.
 */
export function inferEndpoints(input: {
  origin: string | null
  forms: Array<{ action: string; method: string }>
  bundleText?: string
  sitemapLocs?: string[]
}): { candidates: EndpointCandidate[]; completeness: string[] } {
  const map = new Map<string, EndpointCandidate>()

  const add = (method: EndpointCandidate['method'], raw: string, authority: EvidenceAuthority, confidence: number, shape: EndpointCandidate['shape'], source: string) => {
    const normalized = normalizePath(raw, input.origin)
    if (!normalized) return
    const key = `${method} ${normalized.path}`
    if (map.size >= LIMITS.maxEndpointCandidates) return
    map.set(key, { method, path: normalized.path, authority, confidence, source: source.slice(0, 200), shape })
  }

  for (const form of input.forms) {
    if (!form.action) continue
    const method = (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(form.method) ? form.method : 'GET') as EndpointCandidate['method']
    add(method, form.action, 'OBSERVED', 0.8, 'form-action', `<form action="${form.action}" method="${form.method}">`)
  }

  if (input.bundleText) {
    const apiRe = /["'`](\/(?:api|v\d+|graphql|webhooks?|trpc|rest)\/[a-z0-9\-_./[\]{}%:]{1,90})["'`]/gi
    let m: RegExpExecArray | null
    while ((m = apiRe.exec(input.bundleText)) !== null) {
      const path = m[1]
      const shape = /^\/graphql/i.test(path) ? 'graphql' : /^\/webhooks?/i.test(path) ? 'webhook' : 'api'
      add('UNKNOWN', path, 'INFERRED', 0.4, shape, `bundle literal "${path}"`)
    }
    const verbRe = /\b(fetch|axios\.(get|post|put|patch|delete)|\.post|\.get)\s*\(\s*["'`](\/[^"'`]{2,90})["'`]/gi
    while ((m = verbRe.exec(input.bundleText)) !== null) {
      const verb = (m[2] ?? '').toUpperCase()
      const method: EndpointCandidate['method'] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(verb)
        ? (verb as EndpointCandidate['method'])
        : 'UNKNOWN'
      add(method, m[3], 'INFERRED', 0.45, 'api', `call site ${m[0].slice(0, 80)}`)
    }
  }

  // An explicit verb supersedes an UNKNOWN-method guess for the same path, so
  // the list never shows both `POST /api/x` and `UNKNOWN /api/x`.
  const pathsWithVerb = new Set(
    [...map.values()].filter((c) => c.method !== 'UNKNOWN').map((c) => c.path),
  )
  const candidates = [...map.values()]
    .filter((c) => c.method !== 'UNKNOWN' || !pathsWithVerb.has(c.path))
    .sort((a, b) => rank(b.authority) - rank(a.authority) || b.confidence - a.confidence)

  return {
    candidates,
    completeness: [
      'Endpoint candidates are INFERENCES from static text, never confirmed network behaviour.',
      'No request was sent to any candidate endpoint. Method, payload shape, authentication and response are all unknown unless a form declared them.',
      'Server-to-server calls, WebSocket frames and dynamically built URLs are invisible to a static capture.',
    ],
  }
}

function rank(authority: EvidenceAuthority): number {
  return { OBSERVED: 3, DECLARED: 2, INFERRED: 1, UNKNOWN: 0 }[authority]
}
