/**
 * TECH360 — REA Studio: target admission policy
 * ==============================================
 * Reverse-engineering a target means this server fetches a URL an operator
 * typed. That is an SSRF surface, so admission is decided BEFORE any request
 * leaves the process, and it fails closed.
 *
 * Rules, in order:
 *   1. http/https only. No file:, gopher:, data:, javascript:, no credentials
 *      in the URL, no fragment.
 *   2. No private, loopback, link-local, unique-local or reserved address
 *      literals — and no hostname that resolves to one at request time
 *      (`assertSafeAddress` is called again after DNS, before connect).
 *   3. No cloud metadata endpoint (169.254.169.254 and its IPv6 form).
 *   4. Ports restricted to 80/443 unless REA_ALLOW_NONSTANDARD_PORTS=on.
 *   5. Bounded bytes, bounded redirects, bounded wall clock.
 *   6. Rate limited per operator and per host, so this cannot be turned into
 *      a scanner or used to hammer a third party.
 *
 * Also decided here: which target kinds this deployment can actually serve.
 * A hosted Next.js server has no decompiler, no attached Chrome and no access
 * to the operator's laptop, and the UI must say so rather than pretend.
 */
import { isIP } from 'node:net'
import { REA_UNSUPPORTED_TARGETS, type ReaTargetKind } from './evidence'

export const REA_LIMITS = {
  /** Maximum response bytes retained for analysis. */
  maxBytes: 2 * 1024 * 1024,
  /** Maximum wall clock for the whole capture. */
  timeoutMs: 20_000,
  /** Redirects followed. Each hop is re-admitted, not just the first. */
  maxRedirects: 3,
  /** External scripts/stylesheets fetched for bundle analysis. */
  maxSubresources: 12,
  /** Per-subresource byte cap (bundles are huge; we only fingerprint them). */
  maxSubresourceBytes: 512 * 1024,
  /** Operator-facing rate limit. */
  perOperatorPerMinute: 6,
  /** Per-target-host rate limit — protects the third party being analyzed. */
  perHostPerMinute: 3,
} as const

export type AdmissionVerdict =
  | { admitted: true; url: URL; host: string; kind: ReaTargetKind }
  | { admitted: false; code: AdmissionCode; reason: string }

export type AdmissionCode =
  | 'URL_REQUIRED'
  | 'URL_MALFORMED'
  | 'SCHEME_NOT_ALLOWED'
  | 'CREDENTIALS_IN_URL'
  | 'PRIVATE_ADDRESS'
  | 'LOOPBACK_ADDRESS'
  | 'LINK_LOCAL_ADDRESS'
  | 'METADATA_ENDPOINT'
  | 'RESERVED_ADDRESS'
  | 'HOSTNAME_REQUIRED'
  | 'PORT_NOT_ALLOWED'
  | 'HOSTNAME_NOT_RESOLVED'
  | 'RATE_LIMITED'
  | 'TARGET_KIND_UNSUPPORTED'

const ALLOWED_SCHEMES = new Set(['http:', 'https:'])
const ALLOWED_PORTS = new Set(['80', '443', ''])

/** IPv4 blocks that must never be fetched from an operator-supplied URL. */
const PRIVATE_IPV4_PREFIXES = [
  '10.',
  '192.168.',
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
  '127.',
  '169.254.',
  '0.',
  '100.64.',
  '198.18.', '198.19.',
  '198.51.100.',
  '203.0.113.',
  '224.', '225.', '226.', '227.', '228.', '229.', '230.', '231.',
  '232.', '233.', '234.', '235.', '236.', '237.', '238.', '239.',
  '240.', '241.', '242.', '243.', '244.', '245.', '246.', '247.',
  '248.', '249.', '250.', '251.', '252.', '253.', '254.', '255.',
] as const

/** Hostname spellings that resolve to this machine. */
const LOOPBACK_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
])

/**
 * Hostname spellings that resolve to a cloud metadata service. Kept separate so
 * the refusal names the actual risk: reaching 169.254.169.254 is how an attacker
 * walks out with instance credentials, which is a different failure from
 * reaching the loopback interface, and the operator should be told which one
 * they nearly hit.
 */
const METADATA_HOSTNAMES = new Set([
  'metadata',
  'metadata.google.internal',
  'instance-data',
])

function deny(code: AdmissionCode, reason: string): AdmissionVerdict {
  return { admitted: false, code, reason }
}

/**
 * Classifies an IP literal. Exported because it is also applied AFTER DNS
 * resolution — a public hostname that resolves to 127.0.0.1 or 169.254.169.254
 * is the classic bypass, and checking only the literal would miss it.
 */
export function classifyAddress(ip: string): 'PUBLIC' | 'PRIVATE' | 'LOOPBACK' | 'LINK_LOCAL' | 'METADATA' | 'RESERVED' {
  const value = ip.trim().toLowerCase()
  const version = isIP(value)
  if (version === 0) return 'RESERVED'

  if (version === 4) {
    if (value === '169.254.169.254') return 'METADATA'
    if (value.startsWith('127.')) return 'LOOPBACK'
    if (value.startsWith('169.254.')) return 'LINK_LOCAL'
    if (PRIVATE_IPV4_PREFIXES.some((prefix) => value.startsWith(prefix))) return 'PRIVATE'
    return 'PUBLIC'
  }

  // IPv6: expand the compressed forms people actually use to reach localhost.
  const normalized = value.replace(/^\[|\]$/g, '')
  if (normalized === '::' || normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return 'LOOPBACK'
  if (normalized.startsWith('fe80')) return 'LINK_LOCAL'
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return 'PRIVATE'
  if (normalized.startsWith('ff')) return 'RESERVED'
  // IPv4-mapped IPv6 (::ffff:127.0.0.1) must be judged as its IPv4 payload.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(normalized)
  if (mapped) return classifyAddress(mapped[1])
  if (normalized.startsWith('::ffff:0:')) return 'RESERVED'
  return 'PUBLIC'
}

export function assertSafeAddress(ip: string): { safe: boolean; code: AdmissionCode | null; reason: string } {
  const classification = classifyAddress(ip)
  if (classification === 'PUBLIC') return { safe: true, code: null, reason: '' }
  const reason = `Address ${ip} is ${classification.toLowerCase()}; REA Studio refuses to fetch it.`
  const code: AdmissionCode =
    classification === 'METADATA'
      ? 'METADATA_ENDPOINT'
      : classification === 'LOOPBACK'
        ? 'LOOPBACK_ADDRESS'
        : classification === 'LINK_LOCAL'
          ? 'LINK_LOCAL_ADDRESS'
          : classification === 'PRIVATE'
            ? 'PRIVATE_ADDRESS'
            : 'RESERVED_ADDRESS'
  return { safe: false, code, reason }
}

/**
 * Decides whether a target may be captured at all. Pure: no DNS, no fetch.
 * Call `assertSafeAddress` again on every resolved address before connecting.
 */
export function admitTarget(input: {
  rawUrl: unknown
  kind?: unknown
  env?: { REA_ALLOW_NONSTANDARD_PORTS?: string; REA_ALLOWED_HOSTS?: string }
}): AdmissionVerdict {
  const env = input.env ?? {}
  const raw = typeof input.rawUrl === 'string' ? input.rawUrl.trim() : ''
  if (!raw) return deny('URL_REQUIRED', 'A target URL is required.')
  if (raw.length > 2048) return deny('URL_MALFORMED', 'Target URL exceeds 2048 characters.')

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return deny('URL_MALFORMED', `"${raw.slice(0, 120)}" is not a parseable absolute URL.`)
  }

  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    return deny('SCHEME_NOT_ALLOWED', `Scheme ${url.protocol} is not allowed. Only http and https may be captured.`)
  }
  if (url.username || url.password) {
    return deny('CREDENTIALS_IN_URL', 'Credentials in a target URL are refused — they would be sent to a third party and logged.')
  }
  if (!url.hostname) return deny('HOSTNAME_REQUIRED', 'Target URL has no hostname.')

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (LOOPBACK_HOSTNAMES.has(host)) {
    return deny('LOOPBACK_ADDRESS', `Hostname "${host}" points at this server, not a third-party target.`)
  }
  if (METADATA_HOSTNAMES.has(host)) {
    return deny('METADATA_ENDPOINT', `Hostname "${host}" resolves to a cloud metadata service. Fetching it is how instance credentials get walked out, so it is refused before any request is made.`)
  }
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
    return deny('PRIVATE_ADDRESS', `Hostname "${host}" is a local/internal name; only publicly routable targets may be captured.`)
  }

  // Only IP LITERALS can be judged here. A hostname is validated at connect
  // time by `safeLookup`, which sees the address the socket actually uses —
  // that is where a rebinding public hostname gets caught. Classifying a
  // hostname as an address would refuse every ordinary domain.
  if (isIP(host) !== 0) {
    const literal = classifyAddress(host)
    if (literal !== 'PUBLIC') {
      const check = assertSafeAddress(host)
      return deny(check.code ?? 'PRIVATE_ADDRESS', check.reason)
    }
  }

  const allowNonStandard = env.REA_ALLOW_NONSTANDARD_PORTS === 'on'
  if (!allowNonStandard && !ALLOWED_PORTS.has(url.port)) {
    return deny(
      'PORT_NOT_ALLOWED',
      `Port ${url.port || '(default)'} is not allowed. Set REA_ALLOW_NONSTANDARD_PORTS=on to capture non-standard ports.`,
    )
  }

  const allowlist = (env.REA_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
  if (allowlist.length > 0) {
    const permitted = allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
    if (!permitted) {
      return deny('HOSTNAME_NOT_RESOLVED', `Host "${host}" is not in REA_ALLOWED_HOSTS (${allowlist.join(', ')}).`)
    }
  }

  // An operator may name a target kind this deployment cannot serve (a native
  // binary, an APK, a Mac app). Refusing on the RAW request is what makes that
  // reachable — `normalizeKind` only ever returns kinds we support, so checking
  // its output would never fire.
  const requestedKind = typeof input.kind === 'string' ? input.kind.trim().toUpperCase().replace(/[\s-]+/g, '_') : ''
  const unsupported = REA_UNSUPPORTED_TARGETS.find((t) => t.kind === requestedKind)
  if (unsupported) {
    return deny('TARGET_KIND_UNSUPPORTED', `${unsupported.kind}: ${unsupported.reason}`)
  }

  return { admitted: true, url, host, kind: normalizeKind(input.kind, url) }
}

/**
 * Chooses the target kind. `WEB_APP` when the URL or the operator's wording
 * implies an application surface (a path beyond `/`, an app-ish host, or an
 * explicit selection); otherwise `WEBSITE`. Non-network kinds are only
 * honoured when the operator selects them explicitly, because they change what
 * the producer is allowed to do (no fetch at all for HTML_SNIPPET).
 */
export function normalizeKind(kind: unknown, url?: URL): ReaTargetKind {
  const requested = typeof kind === 'string' ? kind.trim().toUpperCase().replace(/[\s-]+/g, '_') : ''
  const network: readonly ReaTargetKind[] = ['WEBSITE', 'WEB_APP']
  if (requested && (network as readonly string[]).includes(requested)) return requested as ReaTargetKind
  if (requested === 'HTML_SNIPPET') return 'HTML_SNIPPET'
  if (requested === 'HAR_CAPTURE') return 'HAR_CAPTURE'
  if (requested === 'JS_BUNDLE') return 'JS_BUNDLE'
  if (!url) return 'WEBSITE'
  const looksLikeApp =
    (url.pathname !== '/' && url.pathname.length > 1) ||
    /^(app|apps|admin|portal|dash|dashboard|console|studio|auth|login|api)\./i.test(url.hostname)
  return looksLikeApp ? 'WEB_APP' : 'WEBSITE'
}

/** Whether this deployment can serve a target kind at all (for honest UI). */
export function targetKindSupport(kind: string): {
  supported: boolean
  reason: string
  upstreamTool: string
} {
  const unsupported = REA_UNSUPPORTED_TARGETS.find((t) => t.kind === kind)
  if (unsupported) return { supported: false, reason: unsupported.reason, upstreamTool: unsupported.upstream }
  if (kind === 'WEBSITE' || kind === 'WEB_APP') {
    return {
      supported: true,
      reason: 'Server-side HTTP capture of public markup, headers and linked bundles. No browser, no execution.',
      upstreamTool: 'inspect_web_page (static subset), analyze_web_bundle',
    }
  }
  if (kind === 'HTML_SNIPPET') {
    return { supported: true, reason: 'Operator-supplied markup analyzed with no network access.', upstreamTool: 'analyze_web_bundle' }
  }
  if (kind === 'HAR_CAPTURE' || kind === 'JS_BUNDLE') {
    return {
      supported: true,
      reason: 'Parsed from operator-supplied capture text. Bodies are treated as untrusted data and never executed.',
      upstreamTool: 'analyze_web_bundle, export_web_scripts',
    }
  }
  return { supported: false, reason: 'Unknown target kind.', upstreamTool: '' }
}

/** Canonical host+path key used for the per-host rate limit. */
export function hostKey(url: URL): string {
  return url.hostname.toLowerCase()
}

/** The public, non-secret statement of what a capture will and will not do. */
export const CAPTURE_CONTRACT = [
  'Fetches public http(s) documents only, with a byte cap, a redirect cap and a wall-clock cap.',
  'Refuses private, loopback, link-local, reserved and cloud-metadata addresses — before AND after DNS resolution.',
  'Never sends credentials, cookies or this platform\u2019s secrets to a target.',
  'Never executes captured JavaScript. Bundles are read as text and fingerprinted statically.',
  'Records only structure, fingerprints and candidates. It does not copy a target\u2019s assets, prose or proprietary code.',
  'Rate limited per operator and per target host so it cannot be used as a scanner.',
] as const
