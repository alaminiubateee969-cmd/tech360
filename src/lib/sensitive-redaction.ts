// ============================================================
// TECH360 — Sensitive Credential, Secret & Payment Card Redaction
//
// Enforces Security & Data Protection Policy:
//   "Never store plaintext customer credentials, payment card data,
//    or secrets in CRM logs."
//
// Safe against false positives on canonical business identifiers:
//   - TECH-YYYY-NNNNNN, PRJ-YYYY-NNNN, INV-YYYY-NNNN, RCT-YYYY-NNNN, RFD-YYYY-NNNN
//   - Ordinary phone numbers (< 13 digits or non-Luhn)
//   - Monetary amounts, ISO dates, URLs without embedded credentials
//   - Ordinary prose ("we need password reset", "API key management module")
// ============================================================

export interface RedactionReport {
  text: string
  redactedTypes: string[]
  changed: boolean
}

/** Standard Luhn check for 13–19 digit payment card PAN candidates. */
export function passesLuhn(digitsOnly: string): boolean {
  if (!/^\d{13,19}$/.test(digitsOnly)) return false
  // Reject trivial all-zero or single-repeated-digit sequences
  if (/^(\d)\1+$/.test(digitsOnly)) return false
  let sum = 0
  let shouldDouble = false
  for (let i = digitsOnly.length - 1; i >= 0; i -= 1) {
    let digit = digitsOnly.charCodeAt(i) - 48
    if (shouldDouble) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    shouldDouble = !shouldDouble
  }
  return sum % 10 === 0
}

const PRIVATE_KEY_BLOCK = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g
const PRIVATE_KEY_HEADER = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[^\r\n]*/g

const TOKEN_PATTERNS: ReadonlyArray<{ type: string; pattern: RegExp; replacement: string }> = [
  { type: 'STRIPE_SECRET', pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g, replacement: '[REDACTED_SECRET]' },
  { type: 'WEBHOOK_SECRET', pattern: /\bwhsec_[A-Za-z0-9]{16,}\b/g, replacement: '[REDACTED_SECRET]' },
  { type: 'AI_API_KEY', pattern: /\bsk-(?:proj-|or-v1-|ant-)[A-Za-z0-9_-]{16,}\b/g, replacement: '[REDACTED_SECRET]' },
  { type: 'AWS_ACCESS_KEY', pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: '[REDACTED_SECRET]' },
  { type: 'GITHUB_TOKEN', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{22,})\b/g, replacement: '[REDACTED_SECRET]' },
  { type: 'GOOGLE_API_KEY', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g, replacement: '[REDACTED_SECRET]' },
  { type: 'SLACK_TOKEN', pattern: /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/g, replacement: '[REDACTED_SECRET]' },
  { type: 'NPM_TOKEN', pattern: /\bnpm_[A-Za-z0-9]{36,}\b/g, replacement: '[REDACTED_SECRET]' },
  { type: 'BEARER_TOKEN', pattern: /\b(Bearer\s+)[A-Za-z0-9._~+/-]{16,}=*/gi, replacement: '$1[REDACTED_SECRET]' },
  {
    type: 'CONNECTION_URI_SECRET',
    pattern: /\b((?:mysql|postgres|postgresql|mongodb(?:\+srv)?|redis|rediss|smtp|smtps):\/\/[^\s:@/]+:)[^\s@]+(@)/gi,
    replacement: '$1[REDACTED_SECRET]$2',
  },
]

const JSON_CREDENTIAL_PATTERN =
  /("(?:password|passwd|pwd|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|smtp[_-]?pass|private[_-]?key|card[_-]?number|cvv|cvc)"\s*:\s*")(?!\[REDACTED)([^"\\]|\\.)+(")/gi

const KV_CREDENTIAL_PATTERN =
  /(\b(?:password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|smtp[_-]?pass|cpanel[_-]?password|wp[_-]?password|admin[_-]?password)\s*[:=]\s*)(?!\[REDACTED)([^\s,;'")}\]]{3,})/gi

const CVV_PATTERN = /(\b(?:cvv2?|cvc2?|cid|card\s+security\s+code|security\s+code)\s*(?:[:=#-]|\bis\b)\s*)\d{3,4}\b/gi

// Candidate 13–19 digits optionally separated by single spaces or hyphens,
// not immediately preceded/followed by alphanumeric or '+' (avoids E.164 phones with '+' prefix when <13 or non-Luhn, hex strings, IDs).
const PAN_CANDIDATE = /(?<![A-Za-z0-9+])(?:\d[ -]?){12,18}\d(?![A-Za-z0-9])/g

export function redactSensitiveCrmData(input: string): RedactionReport {
  if (!input) return { text: input, redactedTypes: [], changed: false }
  let out = input
  const types = new Set<string>()

  if (PRIVATE_KEY_BLOCK.test(out)) {
    PRIVATE_KEY_BLOCK.lastIndex = 0
    out = out.replace(PRIVATE_KEY_BLOCK, '[REDACTED_PRIVATE_KEY]')
    types.add('PRIVATE_KEY')
  }
  if (PRIVATE_KEY_HEADER.test(out)) {
    PRIVATE_KEY_HEADER.lastIndex = 0
    out = out.replace(PRIVATE_KEY_HEADER, '[REDACTED_PRIVATE_KEY]')
    types.add('PRIVATE_KEY')
  }

  for (const entry of TOKEN_PATTERNS) {
    entry.pattern.lastIndex = 0
    if (entry.pattern.test(out)) {
      entry.pattern.lastIndex = 0
      out = out.replace(entry.pattern, entry.replacement)
      types.add(entry.type)
    }
  }

  JSON_CREDENTIAL_PATTERN.lastIndex = 0
  if (JSON_CREDENTIAL_PATTERN.test(out)) {
    JSON_CREDENTIAL_PATTERN.lastIndex = 0
    out = out.replace(JSON_CREDENTIAL_PATTERN, '$1[REDACTED_CREDENTIAL]$3')
    types.add('CREDENTIAL')
  }

  KV_CREDENTIAL_PATTERN.lastIndex = 0
  if (KV_CREDENTIAL_PATTERN.test(out)) {
    KV_CREDENTIAL_PATTERN.lastIndex = 0
    out = out.replace(KV_CREDENTIAL_PATTERN, '$1[REDACTED_CREDENTIAL]')
    types.add('CREDENTIAL')
  }

  CVV_PATTERN.lastIndex = 0
  if (CVV_PATTERN.test(out)) {
    CVV_PATTERN.lastIndex = 0
    out = out.replace(CVV_PATTERN, '$1[REDACTED_CVV]')
    types.add('PAYMENT_CVV')
  }

  PAN_CANDIDATE.lastIndex = 0
  out = out.replace(PAN_CANDIDATE, (match, offset: number, source: string) => {
    // Never redact canonical TECH360 identifiers or UUID segments
    const prefixSlice = source.slice(Math.max(0, offset - 10), offset)
    if (/(?:TECH|PRJ|INV|RCT|RFD)-\d{4}-$/i.test(prefixSlice)) return match
    const digits = match.replace(/\D/g, '')
    if (digits.length < 13 || digits.length > 19) return match
    // Require consistent separator style (all contiguous, all spaces, or all hyphens)
    const hasSpace = match.includes(' ')
    const hasHyphen = match.includes('-')
    if (hasSpace && hasHyphen) return match
    if (!passesLuhn(digits)) return match
    types.add('PAYMENT_CARD_PAN')
    return `[REDACTED_PAYMENT_CARD_LAST4:${digits.slice(-4)}]`
  })

  return {
    text: out,
    redactedTypes: [...types],
    changed: out !== input,
  }
}

export function sanitizeAndRedactText(input: string): string {
  return redactSensitiveCrmData(input).text
}

/** Recursively redact strings inside structured audit/log metadata before JSON serialization. */
export function redactSensitiveValue(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || value === undefined) return value
  if (typeof value === 'string') return redactSensitiveCrmData(value).text
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => redactSensitiveValue(item, depth + 1))

  const rec = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(rec)) {
    if (
      typeof val === 'string' &&
      val.length > 0 &&
      /^(?:password|passwd|pwd|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|smtp[_-]?pass|private[_-]?key|card[_-]?number|pan|cvv|cvc|.*(?:password|passwd|secret|api[_-]?key|private[_-]?key))$/i.test(key)
    ) {
      out[key] = '[REDACTED_CREDENTIAL]'
    } else {
      out[key] = redactSensitiveValue(val, depth + 1)
    }
  }
  return out
}
