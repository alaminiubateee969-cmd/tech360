/**
 * TECH360 — REA Studio: the Evidence contract
 * ============================================
 * A faithful port of the discipline behind `morluto/rea` ("Reverse Engineer
 * Anything", MIT, https://github.com/morluto/rea): every conclusion ships with
 * the observation that supports it, the authority level of that observation,
 * how much of the target was actually covered, what could not be determined,
 * and what remains unknown.
 *
 * This is the same rule the rest of this platform runs on — *a state is
 * reported, never decorated* — expressed as a type system. A teardown that
 * cannot cite its evidence is not a teardown, it is a guess, and this module
 * makes the difference structurally visible.
 *
 * Authority ladder (highest to lowest):
 *   OBSERVED  — read directly from bytes the capture actually contains.
 *   DECLARED  — the target asserted it about itself (a meta tag, a header,
 *               a generator string). Declaration is not proof of behaviour.
 *   INFERRED  — derived from patterns. Candidates, never confirmed facts.
 *   UNKNOWN   — not determined. Recorded, not hidden.
 *
 * Hard rules enforced by the constructors below:
 *   - A finding's authority may never exceed the authority of the evidence it
 *     cites (`clampAuthority`).
 *   - `INFERRED` findings must carry at least one limitation saying so.
 *   - Coverage is always reported, including when it is zero.
 *   - Nothing here performs I/O: these are pure constructors so the contract
 *     is unit-testable without a network or a database.
 */

export type EvidenceAuthority = 'OBSERVED' | 'DECLARED' | 'INFERRED' | 'UNKNOWN'

const AUTHORITY_RANK: Record<EvidenceAuthority, number> = {
  OBSERVED: 3,
  DECLARED: 2,
  INFERRED: 1,
  UNKNOWN: 0,
}

/** The kinds of target REA Studio admits. Mirrors REA's target routing. */
export type ReaTargetKind =
  | 'WEBSITE' // a live http(s) page: structure, scripts, resources, headers
  | 'WEB_APP' // a live http(s) application surface (routes, endpoints, auth)
  | 'HTML_SNIPPET' // operator-pasted markup: no network at all
  | 'HAR_CAPTURE' // a saved network capture the operator supplies
  | 'JS_BUNDLE' // a captured/extracted JavaScript tree or ASAR

export const REA_TARGET_KINDS: readonly ReaTargetKind[] = [
  'WEBSITE',
  'WEB_APP',
  'HTML_SNIPPET',
  'HAR_CAPTURE',
  'JS_BUNDLE',
] as const

/**
 * What REA Studio deliberately does NOT do, as a first-class value so the UI
 * can report it instead of failing silently. Upstream REA needs Ghidra/Hopper/
 * IDA/JADX/Binwalk and a Chrome-family browser attached over CDP; this platform
 * is a hosted web application and ships none of those. Claiming otherwise would
 * be exactly the decoration this repo forbids.
 */
export const REA_UNSUPPORTED_TARGETS = [
  { kind: 'NATIVE_BINARY', reason: 'Needs a decompiler engine (Ghidra / Hopper / IDA / Kuna) on the host. Not installed here.', upstream: 'open_binary, inspect_artifact' },
  { kind: 'ANDROID_APK', reason: 'Needs headless JADX plus a full JDK. Not installed here.', upstream: 'inspect_android_package' },
  { kind: 'IOS_IPA', reason: 'Needs Apple bundle resource tooling and codesign inspection. Not installed here.', upstream: 'open_bundle_resources' },
  { kind: 'DOTNET_ASSEMBLY', reason: 'Needs a managed CIL reader. Not installed here.', upstream: 'inspect_managed_artifact' },
  { kind: 'FIRMWARE_IMAGE', reason: 'Needs Binwalk / Unblob on Linux. Not installed here.', upstream: 'inspect_firmware_regions' },
  { kind: 'MACOS_DESKTOP_APP', reason: 'Needs a local filesystem and native engines on the operator machine. A hosted server cannot see your Mac.', upstream: 'desktop installations' },
  { kind: 'LIVE_BROWSER_SESSION', reason: 'Needs a Chrome-family browser attached over CDP for DOM, accessibility, console and network observation. Not attached here.', upstream: 'inspect_web_page, observe_web_session' },
] as const

export type ReaLimitation = {
  /** Stable machine code, e.g. `network.unavailable`, `coverage.truncated`. */
  code: string
  /** Human sentence an operator can act on. */
  detail: string
  /** Which part of the result this limits. Absent means the whole record. */
  scope?: string
}

export type ReaUnknown = {
  id: string
  /** The question that is still open, phrased as a question. */
  question: string
  /** What authority or environment would be required to answer it. */
  authorityRequired: string
  /** Evidence that would resolve it, when known. */
  resolvedBy?: string
}

export type ReaCoverage = {
  /** True only when the producer examined everything it admitted. */
  complete: boolean
  /** Items actually examined. */
  observed: number
  /** Items available to examine. */
  admitted: number
  /** True when a bound (bytes, time, count) cut the examination short. */
  truncated: boolean
  /** Why it was cut short, when it was. */
  truncatedBy?: string
}

export type ReaFinding<Authority extends EvidenceAuthority = EvidenceAuthority> = {
  id: string
  /** Short label, e.g. `stack.framework`, `structure.navigation`. */
  area: string
  title: string
  detail: string
  authority: Authority
  /** The literal signals that support this finding. Never empty for OBSERVED. */
  signals: string[]
  /** Confidence 0..1. A number, not an adjective. */
  confidence: number
}

export type EvidenceRecord<TResult> = {
  evidenceId: string
  /** Which producer created this record, e.g. `rea360.inspect_web_page`. */
  producer: string
  producedAt: string
  target: {
    kind: ReaTargetKind
    /** URL, or a digest/label for non-network targets. */
    identifier: string
    /** SHA-256 of the captured bytes, when bytes were captured. */
    digest?: string | null
    bytes?: number
  }
  /** The operation's own data. Named `normalizedResult` after upstream REA. */
  normalizedResult: TResult
  /** The strongest authority any finding in this record may claim. */
  authority: EvidenceAuthority
  coverage: ReaCoverage
  limitations: ReaLimitation[]
  unknowns: ReaUnknown[]
  /** Set when this record is a view/summary of a larger retained record. */
  parentEvidenceId?: string | null
}

/**
 * A finding may never claim more authority than the evidence behind it.
 * `clampAuthority` is the single place that rule lives so no producer can
 * forget it: an INFERRED signal cannot promote a finding to OBSERVED.
 */
export function clampAuthority(
  requested: EvidenceAuthority,
  evidence: EvidenceAuthority,
): EvidenceAuthority {
  return AUTHORITY_RANK[requested] <= AUTHORITY_RANK[evidence] ? requested : evidence
}

export function authorityRank(authority: EvidenceAuthority): number {
  return AUTHORITY_RANK[authority]
}

/** Deterministic evidence id: same producer + target + digest → same id. */
export function evidenceIdFor(parts: {
  producer: string
  kind: ReaTargetKind
  identifier: string
  digest?: string | null
  salt?: string
}): string {
  const raw = [parts.producer, parts.kind, parts.identifier, parts.digest ?? '', parts.salt ?? '']
    .join('|')
    .replace(/\s+/g, ' ')
    .trim()
  // FNV-1a over the canonical string: stable, dependency-free, and short
  // enough to quote in a teardown sentence. Not a security digest.
  let hash = 0x811c9dc5
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `ev_${hash.toString(16).padStart(8, '0')}`
}

export function limitation(code: string, detail: string, scope?: string): ReaLimitation {
  return scope ? { code, detail, scope } : { code, detail }
}

export function unknown(
  id: string,
  question: string,
  authorityRequired: string,
  resolvedBy?: string,
): ReaUnknown {
  return resolvedBy ? { id, question, authorityRequired, resolvedBy } : { id, question, authorityRequired }
}

export function coverageOf(observed: number, admitted: number, truncatedBy?: string): ReaCoverage {
  const truncated = Boolean(truncatedBy) || observed < admitted
  return {
    complete: !truncated && observed === admitted,
    observed,
    admitted,
    truncated,
    ...(truncatedBy ? { truncatedBy } : {}),
  }
}

/**
 * Builds a record and enforces the contract on the way in:
 *   - INFERRED findings must be accompanied by a limitation that says so.
 *   - OBSERVED findings must cite at least one signal.
 *   - confidence is clamped to 0..1 and capped by authority.
 * The record's own authority is the strongest finding authority, never higher.
 */
export function buildEvidence<TResult>(input: {
  producer: string
  target: EvidenceRecord<TResult>['target']
  normalizedResult: TResult
  findings: ReaFinding[]
  coverage: ReaCoverage
  limitations: ReaLimitation[]
  unknowns: ReaUnknown[]
  producedAt?: string
  parentEvidenceId?: string | null
}): EvidenceRecord<TResult & { findings: ReaFinding[] }> {
  const limitations = [...input.limitations]

  const findings = input.findings.map((finding) => {
    const cappedConfidence = Math.max(
      0,
      Math.min(1, Math.min(finding.confidence, AUTHORITY_RANK[finding.authority] / 3)),
    )
    return { ...finding, confidence: Number(cappedConfidence.toFixed(3)), signals: [...finding.signals] }
  })

  const inferred = findings.filter((f) => f.authority === 'INFERRED')
  if (inferred.length > 0 && !limitations.some((l) => l.code === 'authority.inferred')) {
    limitations.push(
      limitation(
        'authority.inferred',
        `${inferred.length} finding(s) are INFERRED from patterns, not observed behaviour. They are candidates to verify, not facts.`,
      ),
    )
  }

  const unobserved = findings.filter((f) => f.authority === 'OBSERVED' && f.signals.length === 0)
  if (unobserved.length > 0) {
    limitations.push(
      limitation(
        'finding.uncited',
        `${unobserved.length} OBSERVED finding(s) cite no signal and are demoted to UNKNOWN: ${unobserved
          .map((f) => f.id)
          .join(', ')}.`,
      ),
    )
  }

  const normalized = findings.map((f) =>
    f.authority === 'OBSERVED' && f.signals.length === 0 ? { ...f, authority: 'UNKNOWN' as const } : f,
  )

  const strongest = normalized.reduce<EvidenceAuthority>(
    (best, f) => (AUTHORITY_RANK[f.authority] > AUTHORITY_RANK[best] ? f.authority : best),
    'UNKNOWN',
  )

  return {
    evidenceId: evidenceIdFor({
      producer: input.producer,
      kind: input.target.kind,
      identifier: input.target.identifier,
      digest: input.target.digest,
    }),
    producer: input.producer,
    producedAt: input.producedAt ?? new Date().toISOString(),
    target: input.target,
    normalizedResult: { ...input.normalizedResult, findings: normalized },
    authority: strongest,
    coverage: input.coverage,
    limitations,
    unknowns: input.unknowns,
    parentEvidenceId: input.parentEvidenceId ?? null,
  }
}

/**
 * Renders the honest summary line that every REA Studio surface shows next to
 * a result: what was proven, what was guessed, and what is still open.
 */
export function evidenceSummaryLine(record: EvidenceRecord<{ findings?: ReaFinding[] }>): string {
  const findings = record.normalizedResult.findings ?? []
  const observed = findings.filter((f) => f.authority === 'OBSERVED').length
  const declared = findings.filter((f) => f.authority === 'DECLARED').length
  const inferred = findings.filter((f) => f.authority === 'INFERRED').length
  return [
    `${observed} observed`,
    `${declared} declared`,
    `${inferred} inferred`,
    `${record.limitations.length} limitation(s)`,
    `${record.unknowns.length} open unknown(s)`,
    record.coverage.complete ? 'coverage complete' : 'coverage partial',
  ].join(' · ')
}
