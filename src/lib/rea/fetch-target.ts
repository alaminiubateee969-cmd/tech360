/**
 * TECH360 — REA Studio: bounded target capture
 * =============================================
 * The only module in REA Studio that touches the network. Everything else is
 * pure. It exists to collect evidence, and it is deliberately boring:
 *
 *   - Node's own http/https client, no added dependency.
 *   - A custom DNS `lookup` that re-validates EVERY address the socket is
 *     about to connect to. This is what closes DNS-rebinding: checking the URL
 *     literal once is not enough when a public hostname can resolve to
 *     127.0.0.1 between admission and connect.
 *   - `redirect: manual`, so each hop is re-admitted as a fresh target rather
 *     than trusted because the first one was fine.
 *   - Hard caps on bytes, wall clock, redirect count and subresource count.
 *     Truncation is recorded, never silent.
 *   - No cookies, no credentials, no request body, and no secret from this
 *     platform is ever placed in a header. The User-Agent says what it is.
 *
 * What it collects for a web target: the document, response headers, the
 * linked bundles (as bounded text), robots.txt, and the sitemap's <loc> list.
 * It does NOT execute anything it downloads.
 */
import { createHash } from 'node:crypto'
import { request as httpsRequest } from 'node:https'
import { request as httpRequest } from 'node:http'
import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import type { LookupFunction } from 'node:net'
import { REA_LIMITS, admitTarget, assertSafeAddress, hostKey } from './target-policy'
import type { ReaTargetKind } from './evidence'

export const REA_USER_AGENT =
  'TECH360-REA-Studio/1.0 (+https://bdtech360.com; static structural analysis; no execution; respects robots.txt)'

export type CapturedSubresource = {
  url: string
  status: number
  contentType: string
  bytes: number
  truncated: boolean
  /** Bounded text, used only for static fingerprinting. Never executed. */
  text: string
  error?: string
}

export type Capture = {
  ok: boolean
  url: string
  finalUrl: string
  status: number
  contentType: string
  headers: Array<[string, string]>
  html: string
  bytes: number
  digest: string
  truncated: boolean
  truncatedBy: string[]
  redirects: Array<{ from: string; to: string; status: number }>
  subresources: CapturedSubresource[]
  robots: { fetched: boolean; text: string; sitemaps: string[]; disallowCount: number } | null
  sitemap: { fetched: boolean; locs: string[]; truncated: boolean } | null
  durationMs: number
  /** Every refusal, cap or failure encountered, as reportable limitations. */
  limitations: Array<{ code: string; detail: string }>
  error?: string
}

type RateState = Map<string, { windowStart: number; count: number }>
const globalForRate = globalThis as unknown as { __reaRate?: RateState }
function rateState(): RateState {
  globalForRate.__reaRate ??= new Map()
  return globalForRate.__reaRate
}

/**
 * Per-operator and per-host rate limit. The per-host half exists to protect
 * the third party being analyzed: REA Studio must never be usable as a
 * scanner or a way to hammer someone else's server.
 */
export function checkCaptureRate(input: {
  operator: string
  host: string
  now?: number
}): { ok: boolean; reason: string } {
  const now = input.now ?? Date.now()
  const state = rateState()
  for (const [key, max] of [
    [`op:${input.operator}`, REA_LIMITS.perOperatorPerMinute],
    [`host:${input.host}`, REA_LIMITS.perHostPerMinute],
  ] as const) {
    const entry = state.get(key)
    if (!entry || now - entry.windowStart >= 60_000) {
      state.set(key, { windowStart: now, count: 1 })
      continue
    }
    if (entry.count >= max) {
      const scope = key.startsWith('op:') ? 'per-operator' : 'per-target-host'
      return {
        ok: false,
        reason: `Rate limited (${scope}: ${max}/minute). Wait ${Math.ceil((60_000 - (now - entry.windowStart)) / 1000)}s.`,
      }
    }
    entry.count += 1
  }
  return { ok: true, reason: '' }
}

/**
 * The DNS lookup that guards every socket. Node calls it with the hostname it
 * is about to resolve; we resolve ALL addresses, then refuse the connection
 * unless every one of them is publicly routable.
 *
 * Resolving all and rejecting on any is deliberate: picking the first safe
 * address would still let a hostile resolver answer with a public address first
 * and a loopback address second on a later call, and Node may reconnect. Refusing
 * the whole name is the only answer that cannot be sequenced around.
 */
export function safeLookup(): LookupFunction {
  type LookupCallback = (
    err: NodeJS.ErrnoException | null,
    address: string | LookupAddress[],
    family?: number,
  ) => void

  const fn = (hostname: string, options: unknown, callback: LookupCallback) => {
    // Node's own overload set allows (hostname, callback) as well as
    // (hostname, options, callback); normalise both shapes here.
    const cb: LookupCallback = typeof options === 'function'
      ? (options as LookupCallback)
      : callback
    const wantsAll = Boolean(options && typeof options === 'object' && (options as { all?: boolean }).all)

    dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err) return cb(err, '')
      const list = (addresses ?? []) as LookupAddress[]
      if (list.length === 0) {
        const empty = new Error(`Refused to connect: ${hostname} resolved to no address.`) as NodeJS.ErrnoException
        empty.code = 'ENOTFOUND'
        return cb(empty, '')
      }
      for (const candidate of list) {
        const verdict = assertSafeAddress(candidate.address)
        if (!verdict.safe) {
          const error = new Error(
            `Refused to connect: ${hostname} resolved to ${candidate.address} — ${verdict.reason}`,
          ) as NodeJS.ErrnoException
          // ENOTFOUND rather than EACCES: the socket layer must treat this as a
          // name that cannot be reached, so nothing retries it as transient.
          error.code = 'ENOTFOUND'
          return cb(error, '')
        }
      }
      if (wantsAll) return cb(null, list)
      return cb(null, list[0].address, list[0].family)
    })
  }

  return fn as unknown as LookupFunction
}

type RawFetch = {
  status: number
  headers: Array<[string, string]>
  body: string
  bytes: number
  truncated: boolean
  contentType: string
  location?: string
  error?: string
}

/** One bounded request. Follows nothing; the caller decides about redirects. */
function fetchBounded(url: URL, opts: { maxBytes: number; deadline: number; accept?: string }): Promise<RawFetch> {
  return new Promise((resolve) => {
    const remaining = opts.deadline - Date.now()
    if (remaining <= 0) {
      resolve({ status: 0, headers: [], body: '', bytes: 0, truncated: false, contentType: '', error: 'deadline exceeded before request' })
      return
    }
    const isHttps = url.protocol === 'https:'
    const request = isHttps ? httpsRequest : httpRequest
    const chunks: Buffer[] = []
    let bytes = 0
    let truncated = false

    const req = request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        lookup: safeLookup(),
        timeout: Math.min(remaining, REA_LIMITS.timeoutMs),
        headers: {
          'user-agent': REA_USER_AGENT,
          accept: opts.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5',
          'accept-language': 'en;q=0.9,bn;q=0.8',
          connection: 'close',
          // Explicitly no cookie, no authorization, no referer.
        },
      },
      (res) => {
        res.on('data', (chunk: Buffer) => {
          bytes += chunk.length
          if (bytes > opts.maxBytes) {
            truncated = true
            chunks.push(chunk.subarray(0, Math.max(0, opts.maxBytes - (bytes - chunk.length))))
            res.destroy()
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () => finish(res.statusCode ?? 0, res.headers, res.headers.location ? String(res.headers.location) : undefined))
        res.on('error', () => finish(res.statusCode ?? 0, res.headers))
      },
    )

    req.on('timeout', () => { req.destroy(); resolve({ status: 0, headers: [], body: '', bytes, truncated: true, contentType: '', error: `timed out after ${Math.min(remaining, REA_LIMITS.timeoutMs)}ms` }) })
    req.on('error', (err) => resolve({ status: 0, headers: [], body: '', bytes, truncated, contentType: '', error: err.message }))
    req.end()

    function finish(status: number, rawHeaders: Record<string, unknown>, location?: string) {
      const headers: Array<[string, string]> = Object.entries(rawHeaders ?? {})
        .filter(([, v]) => typeof v === 'string' || Array.isArray(v))
        .map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(', ') : String(v)] as [string, string])
      const body = Buffer.concat(chunks).toString('utf8')
      const contentType = headers.find(([k]) => k === 'content-type')?.[1] ?? ''
      resolve({
        status,
        headers: redactHeaders(headers),
        body,
        bytes,
        truncated,
        contentType,
        ...(location ? { location } : {}),
      })
    }
  })
}

/**
 * Strips values that could carry a third party's secrets into our database.
 * `set-cookie` and `authorization` are never persisted: they belong to the
 * target's users, not to this analysis, and storing them would make REA Studio
 * a credential collector.
 */
const REDACTED_HEADERS = new Set(['set-cookie', 'authorization', 'proxy-authorization', 'x-api-key', 'x-auth-token'])
export function redactHeaders(headers: Array<[string, string]>): Array<[string, string]> {
  return headers.map(([name, value]) =>
    REDACTED_HEADERS.has(name.toLowerCase()) ? [name, '[REDACTED — not persisted by REA Studio]'] : [name, value.slice(0, 500)],
  )
}

export type CaptureOptions = {
  rawUrl: string
  kind?: ReaTargetKind
  operator: string
  env?: Record<string, string | undefined>
  fetchSubresources?: boolean
  fetchRobots?: boolean
  fetchSitemap?: boolean
  now?: () => number
}

/**
 * Captures a target. Returns a `Capture` with its limitations attached; a
 * refusal is a reported outcome, not a thrown exception, because the teardown
 * must be able to say *why* nothing was observed.
 */
export async function captureTarget(options: CaptureOptions): Promise<Capture> {
  const started = Date.now()
  const limitations: Array<{ code: string; detail: string }> = []
  const env = options.env ?? {}

  const admission = admitTarget({ rawUrl: options.rawUrl, kind: options.kind, env })
  if (!admission.admitted) {
    return {
      ok: false, url: String(options.rawUrl ?? ''), finalUrl: String(options.rawUrl ?? ''), status: 0,
      contentType: '', headers: [], html: '', bytes: 0, digest: '', truncated: false,
      truncatedBy: [], redirects: [], subresources: [], robots: null, sitemap: null,
      durationMs: Date.now() - started,
      limitations: [{ code: `admission.${admission.code.toLowerCase()}`, detail: admission.reason }],
      error: admission.reason,
    }
  }

  const rate = checkCaptureRate({ operator: options.operator, host: hostKey(admission.url), now: options.now?.() })
  if (!rate.ok) {
    return {
      ok: false, url: admission.url.toString(), finalUrl: admission.url.toString(), status: 0, contentType: '',
      headers: [], html: '', bytes: 0, digest: '', truncated: false, truncatedBy: [], redirects: [],
      subresources: [], robots: null, sitemap: null, durationMs: Date.now() - started,
      limitations: [{ code: 'rate.limited', detail: rate.reason }], error: rate.reason,
    }
  }

  const deadline = started + REA_LIMITS.timeoutMs
  const redirects: Capture['redirects'] = []
  let current = admission.url
  let result: RawFetch | null = null

  for (let hop = 0; hop <= REA_LIMITS.maxRedirects; hop += 1) {
    result = await fetchBounded(current, { maxBytes: REA_LIMITS.maxBytes, deadline })
    if (result.error) {
      limitations.push({ code: 'network.error', detail: `${current.toString()}: ${result.error}` })
      break
    }
    if (result.status >= 300 && result.status < 400 && result.location) {
      if (hop === REA_LIMITS.maxRedirects) {
        limitations.push({ code: 'redirect.cap', detail: `Stopped after ${REA_LIMITS.maxRedirects} redirects; the final destination was not captured.` })
        break
      }
      let next: URL
      try { next = new URL(result.location, current) } catch {
        limitations.push({ code: 'redirect.malformed', detail: `Location header "${result.location.slice(0, 120)}" is not a usable URL.` })
        break
      }
      // Every hop is admitted again as its own target.
      const hopAdmission = admitTarget({ rawUrl: next.toString(), kind: admission.kind, env })
      if (!hopAdmission.admitted) {
        limitations.push({ code: 'redirect.refused', detail: `Redirect to ${next.toString().slice(0, 160)} refused: ${hopAdmission.reason}` })
        break
      }
      redirects.push({ from: current.toString(), to: next.toString(), status: result.status })
      current = next
      continue
    }
    break
  }

  if (!result || result.status === 0) {
    return {
      ok: false, url: admission.url.toString(), finalUrl: current.toString(), status: result?.status ?? 0,
      contentType: result?.contentType ?? '', headers: result?.headers ?? [], html: '', bytes: 0, digest: '',
      truncated: false, truncatedBy: [], redirects, subresources: [], robots: null, sitemap: null,
      durationMs: Date.now() - started,
      limitations,
      error: result?.error ?? 'No response was received from the target.',
    }
  }

  if (result.truncated) limitations.push({ code: 'document.truncated', detail: `Document capped at ${REA_LIMITS.maxBytes} bytes; analysis covers only the captured prefix.` })
  if (result.status >= 400) limitations.push({ code: `http.${result.status}`, detail: `Target responded ${result.status}. The captured body is an error page, not the product interface.` })
  const isHtml = /text\/html|application\/xhtml\+xml/i.test(result.contentType)
  if (!isHtml && result.contentType) {
    limitations.push({ code: 'content-type.not-html', detail: `Target returned ${result.contentType}. REA Studio analyzes HTML documents; this body was captured as text only.` })
  }

  // ---------------- robots.txt ----------------
  let robots: Capture['robots'] = null
  if (options.fetchRobots !== false) {
    try {
      const robotsUrl = new URL('/robots.txt', current)
      const robotAdmission = admitTarget({ rawUrl: robotsUrl.toString(), env })
      if (robotAdmission.admitted) {
        const r = await fetchBounded(robotsUrl, { maxBytes: 64 * 1024, deadline, accept: 'text/plain' })
        if (!r.error && r.status === 200) {
          const sitemaps = [...r.body.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]).slice(0, 10)
          const disallowCount = [...r.body.matchAll(/^\s*disallow:/gim)].length
          robots = { fetched: true, text: r.body.slice(0, 8000), sitemaps, disallowCount }
          if (disallowCount > 0) {
            limitations.push({ code: 'robots.disallow', detail: `robots.txt declares ${disallowCount} Disallow rule(s). REA Studio only fetched the document the operator named; it does not crawl disallowed paths.` })
          }
        } else {
          robots = { fetched: false, text: '', sitemaps: [], disallowCount: 0 }
        }
      }
    } catch {
      limitations.push({ code: 'robots.unavailable', detail: 'robots.txt could not be fetched; crawl policy for this target is unknown.' })
    }
  }

  // ---------------- sitemap ----------------
  let sitemap: Capture['sitemap'] = null
  const sitemapUrl = robots?.sitemaps[0] ?? new URL('/sitemap.xml', current).toString()
  if (options.fetchSitemap !== false) {
    try {
      const admissionSitemap = admitTarget({ rawUrl: sitemapUrl, env })
      if (admissionSitemap.admitted) {
        const s = await fetchBounded(admissionSitemap.url, { maxBytes: 256 * 1024, deadline, accept: 'application/xml,text/xml' })
        if (!s.error && s.status === 200 && /<urlset|<sitemapindex/i.test(s.body)) {
          const locs = [...s.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim())
          sitemap = { fetched: true, locs: locs.slice(0, 300), truncated: locs.length > 300 }
          if (sitemap.truncated) limitations.push({ code: 'sitemap.truncated', detail: `Sitemap lists ${locs.length} URLs; only the first 300 were admitted as candidates.` })
        } else {
          sitemap = { fetched: false, locs: [], truncated: false }
          limitations.push({ code: 'sitemap.unavailable', detail: 'No usable sitemap was found, so declared route coverage is limited to in-document links.' })
        }
      }
    } catch {
      sitemap = { fetched: false, locs: [], truncated: false }
    }
  }

  // ---------------- subresources (bounded, static only) ----------------
  const subresources: CapturedSubresource[] = []
  if (options.fetchSubresources !== false) {
    const scriptUrls = [...result.body.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)]
      .map((m) => m[1])
      .filter(Boolean)
      .slice(0, REA_LIMITS.maxSubresources)
    const totalScripts = [...result.body.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].length
    if (totalScripts > REA_LIMITS.maxSubresources) {
      limitations.push({ code: 'subresource.cap', detail: `${totalScripts} external scripts linked; only the first ${REA_LIMITS.maxSubresources} were fetched for static fingerprinting. The rest are unknown.` })
    }
    for (const raw of scriptUrls) {
      if (Date.now() > deadline) {
        limitations.push({ code: 'deadline.exceeded', detail: `Wall-clock cap (${REA_LIMITS.timeoutMs}ms) reached; remaining scripts were not fetched.` })
        break
      }
      try {
        const absolute = new URL(raw, current)
        const subAdmission = admitTarget({ rawUrl: absolute.toString(), env })
        if (!subAdmission.admitted) {
          subresources.push({ url: absolute.toString(), status: 0, contentType: '', bytes: 0, truncated: false, text: '', error: `refused: ${subAdmission.reason}` })
          limitations.push({ code: 'subresource.refused', detail: `Script ${absolute.toString().slice(0, 140)} was not fetched: ${subAdmission.reason}` })
          continue
        }
        const r = await fetchBounded(absolute, { maxBytes: REA_LIMITS.maxSubresourceBytes, deadline, accept: '*/*' })
        subresources.push({
          url: absolute.toString(), status: r.status, contentType: r.contentType, bytes: r.bytes,
          truncated: r.truncated, text: r.body.slice(0, REA_LIMITS.maxSubresourceBytes),
          ...(r.error ? { error: r.error } : {}),
        })
      } catch (e) {
        subresources.push({ url: raw, status: 0, contentType: '', bytes: 0, truncated: false, text: '', error: (e as Error).message })
      }
    }
  }

  limitations.push({
    code: 'authority.static-only',
    detail:
      'This is a STATIC capture of the initial document and its linked bundles. No browser was attached and no JavaScript was executed, so the post-hydration DOM, the accessibility tree, runtime network calls, WebSocket frames, console output, workers and storage are all UNKNOWN.',
  })
  limitations.push({
    code: 'authority.no-proprietary-recovery',
    detail:
      'REA Studio reports structure and fingerprints. It does not decompile, unminify, or reproduce a target\u2019s source code, copy, design assets or proprietary algorithms.',
  })

  const html = result.body
  return {
    ok: result.status >= 200 && result.status < 400,
    url: admission.url.toString(),
    finalUrl: current.toString(),
    status: result.status,
    contentType: result.contentType,
    headers: result.headers,
    html,
    bytes: result.bytes,
    digest: createHash('sha256').update(html).digest('hex'),
    truncated: result.truncated,
    truncatedBy: result.truncated ? [`document capped at ${REA_LIMITS.maxBytes} bytes`] : [],
    redirects,
    subresources,
    robots,
    sitemap,
    durationMs: Date.now() - started,
    limitations,
  }
}
