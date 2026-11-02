import { createHash, randomBytes } from 'node:crypto'
import type { Json, StepResult } from './types'

/** Deterministic JSON: sorted object keys, so checksums are reproducible. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

export function checksum(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex')
}

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function jsonText(value: unknown): string {
  return stableStringify(value)
}

/** Reject prototype-pollution keys anywhere in an untrusted object. */
export function isSafeObject(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true
  if (Array.isArray(value)) return value.every(isSafeObject)
  const obj = value as Record<string, unknown>
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return false
    if (!isSafeObject(obj[key])) return false
  }
  return true
}

/** Deep clone + restricted merge. Never mutates the template defaults. */
export function mergeConfig<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
  const out: Record<string, unknown> = JSON.parse(JSON.stringify(base ?? {})) as Record<string, unknown>
  for (const [key, value] of Object.entries(override)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    // undefined is not representable in JSON; leaving it out keeps the
    // template default instead of producing an unparseable "undefined".
    if (value === undefined) continue
    if (value && typeof value === 'object' && !Array.isArray(value) && out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) {
      out[key] = mergeConfig(out[key] as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      out[key] = value === null ? null : (JSON.parse(JSON.stringify(value)) as unknown)
    }
  }
  return out as T
}

const SECRET_PATTERNS: Array<[string, RegExp]> = [
  ['aws access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['github token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['stripe key', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/],
  ['assigned credential', /\b(?:password|passwd|api[_-]?key|access[_-]?token|client[_-]?secret|bearer)\b\s*[:=]\s*\S+/i],
  // JSON form: {"password":"..."} — the plain-word pattern above does not
  // match because of the closing quote between the key and the colon.
  ['assigned credential (JSON)', /"(?:password|passwd|api[_-]?key|access[_-]?token|client[_-]?secret|bearer)"\s*:\s*"(?:[^"\\]|\\.){4,}"/i],
  ['database url with password', /\b(?:mysql|postgres|mongodb):\/\/[^\s:]+:[^\s@]+@/i],
]

/** Returns the reason, or null when no secret-like content is present. */
export function secretLikeReason(value: unknown): string | null {
  const text = stableStringify(value)
  for (const [label, re] of SECRET_PATTERNS) if (re.test(text)) return label
  return null
}

export function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

export function tenantKey(): string {
  return `tk_${randomBytes(24).toString('hex')}`
}

export function nextCode(prefix: string, n: number, width = 5): string {
  return `${prefix}-${String(n).padStart(width, '0')}`
}

export function parseSemver(v: string): { major: number; minor: number; patch: number } | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim())
  return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) } : null
}

export function compareSemver(a: string, b: string): number {
  const x = parseSemver(a)
  const y = parseSemver(b)
  if (!x || !y) return 0
  for (const k of ['major', 'minor', 'patch'] as const) if (x[k] !== y[k]) return x[k] - y[k]
  return 0
}

/** Same major version and not a downgrade = compatible without migration. */
export function isCompatible(current: string, target: string, breaking = false): boolean {
  const a = parseSemver(current)
  const b = parseSemver(target)
  if (!a || !b) return false
  if (breaking) return false
  return a.major === b.major && compareSemver(current, target) <= 0
}

export function summarizeSteps(steps: StepResult[]): { passed: number; failed: number; ok: boolean } {
  const passed = steps.filter((s) => s.status === 'PASS').length
  const failed = steps.filter((s) => s.status === 'FAIL').length
  return { passed, failed, ok: failed === 0 && passed > 0 }
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json
}

export function nowIso(): string {
  return new Date().toISOString()
}
