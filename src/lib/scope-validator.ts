// ============================================================
// 21-SECTION VERSIONED SCOPE OF WORK & CHANGE REQUEST ENGINE
//
// Enforces:
//   1. Canonical 21-section SOW completeness validator before
//      a scope can be finalized (`FINAL` / `APPROVED`).
//   2. Immutability of `APPROVED` and `FINAL` scope versions —
//      post-approval changes MUST create a versioned Change
//      Request (`version = maxVersion + 1`) recording scope,
//      cost, and timeline impact.
//   3. Seamless enrichment of legacy AI-generated SOW JSON so
//      brownfield drafts upgrade cleanly into the 21-section
//      canonical structure.
// ============================================================

export const SCOPE_21_SECTIONS = [
  'clientOverview',
  'projectObjectives',
  'targetUsers',
  'includedFeatures',
  'excludedItems',
  'pagesOrScreens',
  'integrations',
  'techStack',
  'hostingAndDeployment',
  'securityAndPrivacy',
  'performanceAndResponsive',
  'contentAndAssets',
  'previewPolicy',
  'revisionPolicy',
  'timelineAndMilestones',
  'pricingAndCurrency',
  'paymentSchedule',
  'handoverPolicy',
  'acceptanceCriteria',
  'warrantyAndSupport',
  'assumptionsAndDependencies',
] as const

export type ScopeSectionKey = (typeof SCOPE_21_SECTIONS)[number]

export const SCOPE_SECTION_LABELS: Record<ScopeSectionKey, string> = {
  clientOverview: '1. Client Overview & Business Context',
  projectObjectives: '2. Project Objectives',
  targetUsers: '3. Target Users & Roles',
  includedFeatures: '4. Included Features & Modules',
  excludedItems: '5. Out-of-Scope / Excluded Items',
  pagesOrScreens: '6. Pages, Screens & User Flows',
  integrations: '7. Third-Party Integrations & APIs',
  techStack: '8. Architecture & Technology Stack',
  hostingAndDeployment: '9. Hosting, Domain & Deployment Model',
  securityAndPrivacy: '10. Security, Access Control & Data Privacy',
  performanceAndResponsive: '11. Performance & Responsive Standards',
  contentAndAssets: '12. Branding, Content & Client Assets',
  previewPolicy: '13. HTML Preview Before Payment Policy',
  revisionPolicy: '14. Included Revisions & Change Request Policy',
  timelineAndMilestones: '15. Timeline & Delivery Milestones',
  pricingAndCurrency: '16. Pricing Breakdown & Currency',
  paymentSchedule: '17. Payment Schedule & Terms',
  handoverPolicy: '18. Source Code After Full Payment & Handover Package',
  acceptanceCriteria: '19. QA, Testing & Acceptance Criteria',
  warrantyAndSupport: '20. Post-Launch Warranty & Support Terms',
  assumptionsAndDependencies: '21. Client Responsibilities, Assumptions & Dependencies',
}

export const IMMUTABLE_SCOPE_STATUSES = ['APPROVED', 'FINAL', 'SUPERSEDED'] as const

export interface ChangeRequestMetadata {
  isChangeRequest: boolean
  supersedesVersion: number
  reason: string
  costImpact: string
  timelineImpact: string
  requestedBy: string
  createdAt: string
}

export interface ScopeValidationResult {
  valid: boolean
  presentCount: number
  requiredCount: number
  missingSections: ScopeSectionKey[]
  missingLabels: string[]
}

function isNonEmptySectionValue(val: unknown): boolean {
  if (typeof val === 'string') return val.trim().length >= 3
  if (Array.isArray(val)) return val.length > 0 && val.some((entry) => isNonEmptySectionValue(entry))
  if (val && typeof val === 'object') {
    return Object.values(val as Record<string, unknown>).some((v) => isNonEmptySectionValue(v))
  }
  return false
}

export function canEditScopeInPlace(status: string): boolean {
  return !(IMMUTABLE_SCOPE_STATUSES as readonly string[]).includes(status.toUpperCase())
}

export function nextScopeVersionNumber(existingVersions: Iterable<number>): number {
  let max = 0
  for (const v of existingVersions) {
    if (Number.isInteger(v) && v > max) max = v
  }
  return max + 1
}

/**
 * Validates that a Scope of Work payload contains non-empty content for all
 * 21 canonical commercial & technical sections.
 */
export function validate21PointScope(rawContent: unknown): ScopeValidationResult {
  let parsed: Record<string, unknown> = {}
  if (typeof rawContent === 'string') {
    try {
      const obj = JSON.parse(rawContent)
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        parsed = obj as Record<string, unknown>
      }
    } catch {
      parsed = {}
    }
  } else if (rawContent && typeof rawContent === 'object' && !Array.isArray(rawContent)) {
    parsed = rawContent as Record<string, unknown>
  }

  const sectionsObj =
    parsed.sections && typeof parsed.sections === 'object' && !Array.isArray(parsed.sections)
      ? (parsed.sections as Record<string, unknown>)
      : parsed

  const missingSections: ScopeSectionKey[] = []
  for (const key of SCOPE_21_SECTIONS) {
    if (!isNonEmptySectionValue(sectionsObj[key])) {
      missingSections.push(key)
    }
  }

  return {
    valid: missingSections.length === 0,
    presentCount: SCOPE_21_SECTIONS.length - missingSections.length,
    requiredCount: SCOPE_21_SECTIONS.length,
    missingSections,
    missingLabels: missingSections.map((k) => SCOPE_SECTION_LABELS[k]),
  }
}

/**
 * Enriches an AI-generated or operator-authored SOW payload so legacy `items`,
 * `timeline`, and `paymentPolicy` keys remain intact while populating structured
 * defaults for any omitted sections among the 21 required sections.
 */
export function normalizeTo21PointScope(
  raw: Record<string, unknown>,
  context: {
    clientId: string
    clientName: string
    businessName?: string | null
    businessType?: string | null
    plan?: string | null
    budgetRange?: string | null
  },
): Record<string, unknown> {
  const existingSections =
    raw.sections && typeof raw.sections === 'object' && !Array.isArray(raw.sections)
      ? (raw.sections as Record<string, unknown>)
      : {}

  const items = Array.isArray(raw.items) ? (raw.items as Array<Record<string, unknown>>) : []
  const timeline = Array.isArray(raw.timeline) ? (raw.timeline as Array<Record<string, unknown>>) : []
  const pp =
    raw.paymentPolicy && typeof raw.paymentPolicy === 'object'
      ? (raw.paymentPolicy as Record<string, unknown>)
      : {}

  const featureSummary =
    items.length > 0
      ? items.map((i) => `${String(i.name ?? 'Deliverable')}: ${String(i.description ?? 'Included')}`).join('; ')
      : String(raw.summary ?? 'Core web application features as specified by client.')

  const timelineSummary =
    timeline.length > 0
      ? timeline.map((t) => `${String(t.phase ?? 'Phase')} (${String(t.weeks ?? '1')}w): ${String(t.activities ?? 'Delivery')}`).join('; ')
      : 'Phased milestone schedule: Discovery & Scope -> HTML Preview -> Full Build & QA -> Verified Handover.'

  const currency = String(pp.currency ?? 'USD')
  const pick = (key: ScopeSectionKey, fallback: string): unknown => {
    if (isNonEmptySectionValue(existingSections[key])) return existingSections[key]
    if (isNonEmptySectionValue(raw[key])) return raw[key]
    return fallback
  }

  const sections: Record<ScopeSectionKey, unknown> = {
    clientOverview: pick(
      'clientOverview',
      `${context.businessName || context.clientName} (${context.clientId}) — ${context.businessType || 'Digital Business'}.`,
    ),
    projectObjectives: pick(
      'projectObjectives',
      String(raw.summary || `Design, build, verify, and deliver ${String(raw.title || context.plan || 'custom software solution')}.`),
    ),
    targetUsers: pick('targetUsers', 'Public visitors, registered customers/clients, and authorized administrative staff.'),
    includedFeatures: pick('includedFeatures', featureSummary),
    excludedItems: pick(
      'excludedItems',
      'Unlisted third-party paid licenses, custom hardware integration, and post-approval features not covered by a signed Change Request.',
    ),
    pagesOrScreens: pick('pagesOrScreens', featureSummary),
    integrations: pick(
      'integrations',
      'Configured email/WhatsApp notifications and only explicitly approved third-party APIs with client-supplied credentials.',
    ),
    techStack: pick('techStack', 'Modern web stack (HTML5/CSS3/TypeScript/Next.js + relational database) per approved architecture.'),
    hostingAndDeployment: pick('hostingAndDeployment', 'Staging preview hosted by TECH360 LLC; production deployment upon milestone completion.'),
    securityAndPrivacy: pick(
      'securityAndPrivacy',
      'HTTPS/TLS transport, server-side input validation, role-based access control, CSRF protection, and tenant data isolation.',
    ),
    performanceAndResponsive: pick(
      'performanceAndResponsive',
      'Mobile-first responsive layout across desktop, tablet, and smartphone viewports with production build optimization.',
    ),
    contentAndAssets: pick(
      'contentAndAssets',
      'Client provides brand logo, domain access, and approved copy/media; placeholder copy used during HTML preview if pending.',
    ),
    previewPolicy: pick(
      'previewPolicy',
      'HTML Preview Before Payment: TECH360 delivers an interactive staging HTML preview for explicit client review and approval prior to payment collection.',
    ),
    revisionPolicy: pick(
      'revisionPolicy',
      'Includes up to 2 structured revision rounds on the HTML preview within agreed scope. Material additions after approval require a versioned Change Request.',
    ),
    timelineAndMilestones: pick('timelineAndMilestones', timelineSummary),
    pricingAndCurrency: pick(
      'pricingAndCurrency',
      `Quoted in ${currency}${context.budgetRange ? ` (indicative budget: ${context.budgetRange})` : ''}; binding line-item totals governed by official TECH360 invoice.`,
    ),
    paymentSchedule: pick(
      'paymentSchedule',
      `Advance ${String(pp.advancePct ?? 50)}% after HTML preview approval · Milestone ${String(pp.milestonePct ?? 0)}% · Final ${String(pp.finalPct ?? 50)}% prior to source code release (${currency}).`,
    ),
    handoverPolicy: pick(
      'handoverPolicy',
      'Source Code After Full Payment: Full source code, build artifacts, documentation, and credential rotation checklist are released strictly after 100% verified payment.',
    ),
    acceptanceCriteria: pick(
      'acceptanceCriteria',
      'All included features pass functional QA, responsive verification, security baseline checks, and match the approved HTML preview and SOW.',
    ),
    warrantyAndSupport: pick(
      'warrantyAndSupport',
      '14-day post-handover defect warranty on delivered scope; ongoing feature enhancements or managed hosting available under separate agreement.',
    ),
    assumptionsAndDependencies: pick(
      'assumptionsAndDependencies',
      'Timely client feedback, approval sign-offs, and provision of third-party credentials/content within 5 business days of request.',
    ),
  }

  return {
    ...raw,
    schemaVersion: 'SOW-21-v1',
    sections,
  }
}

export function buildChangeRequestScopeContent(input: {
  priorContent: Record<string, unknown>
  priorVersion: number
  updatedSections?: Partial<Record<ScopeSectionKey, unknown>>
  summary?: string
  reason: string
  costImpact: string
  timelineImpact: string
  requestedBy: string
  now?: Date
}): { ok: true; content: Record<string, unknown> } | { ok: false; code: string; error: string } {
  if (input.reason.trim().length < 5) {
    return { ok: false, code: 'CHANGE_REASON_REQUIRED', error: 'Change Request requires a clear reason (at least 5 characters).' }
  }
  if (!input.costImpact.trim()) {
    return { ok: false, code: 'COST_IMPACT_REQUIRED', error: 'Change Request must explicitly state cost impact (e.g. "+$500 USD" or "$0 — no cost change").' }
  }
  if (!input.timelineImpact.trim()) {
    return { ok: false, code: 'TIMELINE_IMPACT_REQUIRED', error: 'Change Request must explicitly state timeline impact (e.g. "+5 business days" or "No schedule change").' }
  }

  const baseSections =
    input.priorContent.sections && typeof input.priorContent.sections === 'object' && !Array.isArray(input.priorContent.sections)
      ? { ...(input.priorContent.sections as Record<string, unknown>) }
      : {}

  if (input.updatedSections) {
    for (const key of SCOPE_21_SECTIONS) {
      if (input.updatedSections[key] !== undefined) {
        baseSections[key] = input.updatedSections[key]
      }
    }
  }

  const changeRequest: ChangeRequestMetadata = {
    isChangeRequest: true,
    supersedesVersion: input.priorVersion,
    reason: input.reason.trim(),
    costImpact: input.costImpact.trim(),
    timelineImpact: input.timelineImpact.trim(),
    requestedBy: input.requestedBy,
    createdAt: (input.now ?? new Date()).toISOString(),
  }

  const priorHistory = Array.isArray(input.priorContent.changeHistory)
    ? [...(input.priorContent.changeHistory as unknown[])]
    : []
  priorHistory.push(changeRequest)

  return {
    ok: true,
    content: {
      ...input.priorContent,
      ...(input.summary ? { summary: input.summary.trim() } : {}),
      schemaVersion: 'SOW-21-v1',
      sections: baseSections,
      changeRequest,
      changeHistory: priorHistory,
    },
  }
}
