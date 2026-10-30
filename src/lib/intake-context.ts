/**
 * INTAKE CONTEXT — first-party attribution and request fingerprinting
 *
 * Purpose
 * -------
 * The contact pipeline must record where a lead came from, what device and
 * browser it used, and a coarse location — without adding a third-party
 * tracking service, an external geo-IP lookup, or a schema migration.
 *
 * Design rules
 * ------------
 * 1. Pure functions only. Everything here is unit-testable without a database
 *    (see `tests/intake-context.test.ts`).
 * 2. Allowlist, never passthrough. Only known attribution keys survive; the
 *    raw client payload is discarded. Unknown keys are dropped so this module
 *    cannot become a channel for injecting arbitrary JSON into the CRM.
 * 3. Bounded values. Every string is trimmed, control-character stripped and
 *    length-capped via `sanitizeText`, so a hostile form post cannot inflate a
 *    JSON column or break rendering downstream.
 * 4. Location = coarse, header-derived only. We read country/region from
 *    trusted proxy headers (Cloudflare / Vercel / hosting equivalents) and
 *    never call a geo-IP API, so no visitor IP is disclosed to a third party.
 *    Precise coordinates are never stored.
 * 5. Honest absence. When a header is missing the field is `null`, never a
 *    guess. Downstream reporting can then distinguish "unknown" from "known".
 */

import { sanitizeText } from './security'

export type DeviceType = 'DESKTOP' | 'MOBILE' | 'TABLET' | 'BOT' | 'UNKNOWN'

export type Attribution = {
  source: string | null
  medium: string | null
  campaign: string | null
  term: string | null
  content: string | null
  /** Click identifiers used by ad platforms; stored for reconciliation, never trusted for identity. */
  clickId: { type: 'GCLID' | 'FBCLID' | 'TIKTOK' | 'MSCLKID'; value: string } | null
  referrer: string | null
  landingPath: string | null
}

export type RequestContext = {
  device: DeviceType
  browser: string | null
  os: string | null
  /** Coarse, header-derived location. Never precise coordinates. */
  location: { country: string | null; region: string | null; city: string | null; source: 'EDGE_HEADER' | 'NONE' }
  /** True when the request arrived over HTTPS as reported by a trusted proxy header. */
  secure: boolean
  /** ISO timestamp captured server-side. */
  capturedAt: string
}

export type IntakeContext = Attribution & RequestContext

const UTM_KEYS = {
  source: 'utm_source',
  medium: 'utm_medium',
  campaign: 'utm_campaign',
  term: 'utm_term',
  content: 'utm_content',
} as const

const CLICK_ID_HEADERS: Array<{ type: 'GCLID' | 'FBCLID' | 'TIKTOK' | 'MSCLKID'; keys: string[] }> = [
  { type: 'GCLID', keys: ['gclid', 'google_click_id'] },
  { type: 'FBCLID', keys: ['fbclid', 'facebook_click_id'] },
  { type: 'TIKTOK', keys: ['ttclid'] },
  { type: 'MSCLKID', keys: ['msclkid'] },
]

function firstString(input: unknown): string {
  if (typeof input === 'string') return input
  if (Array.isArray(input) && typeof input[0] === 'string') return input[0]
  return ''
}

function readKey(record: Record<string, unknown>, key: string, maxLength = 200): string | null {
  if (!Object.prototype.hasOwnProperty.call(record, key)) return null
  const value = sanitizeText(firstString(record[key]), maxLength)
  return value.length > 0 ? value : null
}

/**
 * Normalize a referrer into a host only. Full referrer URLs can carry search
 * terms and session tokens, so only the origin host is retained.
 */
export function normalizeReferrer(input: unknown): string | null {
  const raw = sanitizeText(firstString(input), 500)
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return sanitizeText(url.hostname.toLowerCase(), 200) || null
  } catch {
    return null
  }
}

/** Normalize a landing path to its pathname (query strings can contain PII). */
export function normalizeLandingPath(input: unknown): string | null {
  const raw = sanitizeText(firstString(input), 500)
  if (!raw) return null
  const withoutQuery = raw.split('?')[0].split('#')[0]
  if (!withoutQuery.startsWith('/')) return null
  return sanitizeText(withoutQuery, 200) || null
}

/**
 * Extract allowlisted attribution from an untrusted client payload.
 * Accepts either { utm: {...}, ref, path } or a flat query-like object.
 */
export function extractAttribution(tracking: unknown): Attribution {
  const record: Record<string, unknown> =
    tracking && typeof tracking === 'object' && !Array.isArray(tracking) ? (tracking as Record<string, unknown>) : {}

  const nested =
    record.utm && typeof record.utm === 'object' && !Array.isArray(record.utm)
      ? (record.utm as Record<string, unknown>)
      : record

  let clickId: Attribution['clickId'] = null
  for (const candidate of CLICK_ID_HEADERS) {
    for (const key of candidate.keys) {
      const value = readKey(nested, key, 255)
      if (value) {
        clickId = { type: candidate.type, value }
        break
      }
    }
    if (clickId) break
  }

  return {
    source: readKey(nested, UTM_KEYS.source, 120),
    medium: readKey(nested, UTM_KEYS.medium, 120),
    campaign: readKey(nested, UTM_KEYS.campaign, 160),
    term: readKey(nested, UTM_KEYS.term, 160),
    content: readKey(nested, UTM_KEYS.content, 160),
    clickId,
    referrer: normalizeReferrer(record.ref ?? record.referrer),
    landingPath: normalizeLandingPath(record.path ?? record.landingPath),
  }
}

/**
 * Classify a User-Agent string.
 * Order matters: bots are checked first because many bot strings also contain
 * mobile tokens (e.g. Googlebot smartphone).
 */
export function parseUserAgent(userAgent: string | null | undefined): {
  device: DeviceType
  browser: string | null
  os: string | null
} {
  const ua = sanitizeText(userAgent ?? '', 512)
  if (!ua) return { device: 'UNKNOWN', browser: null, os: null }

  const lower = ua.toLowerCase()

  if (/bot|crawler|spider|crawling|slurp|bingpreview|headlesschrome|facebookexternalhit|whatsapp|telegrambot|curl\/|wget\/|python-requests|axios\//.test(lower)) {
    const name = /whatsapp/.test(lower)
      ? 'WhatsApp Link Preview'
      : /facebookexternalhit/.test(lower)
        ? 'Facebook Link Preview'
        : /telegrambot/.test(lower)
          ? 'Telegram Link Preview'
          : /googlebot/.test(lower)
            ? 'Googlebot'
            : /bingbot/.test(lower)
              ? 'Bingbot'
              : 'Automated Client'
    return { device: 'BOT', browser: name, os: null }
  }

  let os: string | null = null
  if (/iphone|ipad|ipod/.test(lower)) os = 'iOS'
  else if (/android/.test(lower)) os = 'Android'
  else if (/windows nt/.test(lower)) os = 'Windows'
  else if (/mac os x|macintosh/.test(lower)) os = 'macOS'
  else if (/cros/.test(lower)) os = 'ChromeOS'
  else if (/linux/.test(lower)) os = 'Linux'

  let browser: string | null = null
  if (/edg\//.test(lower)) browser = 'Edge'
  else if (/opr\/|opera/.test(lower)) browser = 'Opera'
  else if (/samsungbrowser/.test(lower)) browser = 'Samsung Internet'
  else if (/firefox\/|fxios/.test(lower)) browser = 'Firefox'
  else if (/crios/.test(lower)) browser = 'Chrome iOS'
  else if (/chrome\/|chromium/.test(lower)) browser = 'Chrome'
  else if (/safari\//.test(lower)) browser = 'Safari'
  else if (/bot|spider/.test(lower)) browser = 'Automated Client'

  // iPadOS 13+ reports a desktop macOS UA; touch capability cannot be seen
  // server-side, so it is classified as DESKTOP deliberately.
  let device: DeviceType = 'DESKTOP'
  if (/ipad|tablet|playbook|silk/.test(lower) || (/android/.test(lower) && !/mobile/.test(lower))) device = 'TABLET'
  else if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(lower)) device = 'MOBILE'

  return { device, browser, os }
}

/**
 * Resolve a coarse location from trusted edge headers only.
 *
 * Accepted (in order):
 *   CF-IPCountry        (Cloudflare)
 *   X-Vercel-IP-Country (Vercel)
 *   X-Country-Code     (generic hosting/proxy)
 *   CF-Region / X-Vercel-IP-City where present
 *
 * City-level headers are only honoured when the hosting provider supplies them;
 * we never derive city from IP ourselves.
 */
export function resolveLocation(headers: { get(name: string): string | null }): RequestContext['location'] {
  // Validate the FULL header value before truncating: slicing "XX1" to "XX"
  // would invent a plausible-looking country code that the edge never sent.
  const readCountry = (names: string[]): string | null => {
    for (const name of names) {
      const raw = (headers.get(name) ?? '').trim().toUpperCase()
      if (/^[A-Z]{2}$/.test(raw)) return raw
    }
    return null
  }
  const country = readCountry(['cf-ipcountry', 'x-vercel-ip-country', 'x-country-code']) ?? ''
  const region =
    sanitizeText(headers.get('cf-region') ?? '', 80) || sanitizeText(headers.get('x-vercel-ip-country-region') ?? '', 80)
  const city = sanitizeText(headers.get('cf-ipcity') ?? '', 80) || sanitizeText(headers.get('x-vercel-ip-city') ?? '', 80)

  const normalizedCountry = country ? country : null
  const normalizedRegion = region ? decodeURIComponent(region) : null
  const normalizedCity = city ? decodeURIComponent(city) : null

  const used = Boolean(normalizedCountry || normalizedRegion || normalizedCity)
  return {
    country: normalizedCountry,
    region: sanitizeText(normalizedRegion ?? '', 80) || null,
    city: sanitizeText(normalizedCity ?? '', 80) || null,
    source: used ? 'EDGE_HEADER' : 'NONE',
  }
}

/**
 * Build the stored intake context.
 * `headers` is the Request headers object; `tracking` is the untrusted client payload.
 */
export function buildIntakeContext(input: {
  headers: { get(name: string): string | null }
  tracking?: unknown
  now?: Date
}): IntakeContext {
  const attribution = extractAttribution(input.tracking)
  const ua = parseUserAgent(input.headers.get('user-agent'))
  const proto = sanitizeText(input.headers.get('x-forwarded-proto') ?? '', 10).toLowerCase()
  return {
    ...attribution,
    ...ua,
    location: resolveLocation(input.headers),
    secure: proto === 'https',
    capturedAt: (input.now ?? new Date()).toISOString(),
  }
}

/** True when any first-touch attribution signal is present. */
export function hasAttribution(context: Attribution): boolean {
  return Boolean(
    context.source ||
      context.medium ||
      context.campaign ||
      context.term ||
      context.content ||
      context.clickId ||
      context.referrer,
  )
}

/** Compact, human-readable source label for CRM task titles. */
export function describeSource(context: Attribution): string {
  if (context.source && context.medium) return `${context.source} / ${context.medium}`
  if (context.source) return context.source
  if (context.referrer) return context.referrer
  return 'direct'
}
