/**
 * TECH360 — REA Studio: reconstruction bridge
 * ============================================
 * "Build my own version." This module turns a teardown into a brief for the
 * platform's existing AI Software Factory (`src/lib/factory/blueprint.ts`),
 * which then produces a real, reviewable Next.js + Prisma + Tailwind project.
 *
 * ── The boundary this module exists to enforce ─────────────────────────────
 * Reverse-engineering a structure is legitimate competitive analysis.
 * Copying someone's work is not. So the bridge derives an ORIGINAL application
 * from the observed information architecture and nothing else:
 *
 *   DERIVED  — nav labels, heading outline, form field *names*, route prefixes,
 *              the presence of a pricing/checkout/blog/login surface. These are
 *              facts about how a product is organised, and they inform which of
 *              our own modules to include.
 *   NEVER    — the target's prose, copy, images, logo, brand or product name,
 *              colour palette, CSS, JavaScript, minified bundles, fonts,
 *              customer data, API keys, or any decompiled/unminified source.
 *              No byte of captured asset content is passed into the generator.
 *
 * The output says so out loud: `provenance.copied` is always an explicit list of
 * the things that were refused, so a reviewer can see the boundary was applied
 * rather than trusting that it was.
 *
 * Deterministic and pure: same teardown → same brief → same factory plan.
 */
import {
  FACTORY_MODULES,
  FACTORY_VERTICALS,
  type FactoryBrief,
  type FactoryModule,
  type FactoryVertical,
} from '@/lib/factory/blueprint'
import type { TeardownReport } from './teardown'

export type ReconstructionProvenance = {
  /** The evidence record this reconstruction descends from. */
  evidenceId: string
  targetUrl: string
  capturedAt: string
  /** What was derived, with the observation behind each decision. */
  derived: Array<{ decision: string; from: string; authority: string }>
  /** What was deliberately refused. Always non-empty — the boundary is explicit. */
  copied: string[]
  /** What could not be reconstructed because it was never observed. */
  notReconstructable: string[]
}

export type Reconstruction = {
  brief: FactoryBrief
  provenance: ReconstructionProvenance
  /** Page list inferred from the observed IA, as an original structure. */
  pages: Array<{ path: string; title: string; purpose: string }>
  confidence: number
  /** Honest statement of what the rebuild is. */
  statement: string
}

const NEVER_COPIED = [
  'Target prose, marketing copy, headings text and body content — our generator writes its own.',
  'Target images, logo, favicon, icons and fonts — none are downloaded, stored or reused.',
  'Target brand name, product name and trademark — the rebuild is named by the operator.',
  'Target CSS, JavaScript, minified bundles and source maps — captured as text for fingerprinting only, never passed to the generator.',
  'Target colour palette and visual design — the rebuild uses the operator\u2019s own brand colour.',
  'Any credential, cookie, token or personal data observed in the capture.',
  'Any decompiled, unminified or recovered proprietary source. REA Studio does not recover source at all.',
] as const

/** Observed-surface → our module. Keywords are matched against IA signals. */
const MODULE_SIGNALS: Array<{ module: FactoryModule; keywords: RegExp; why: string }> = [
  { module: 'leads', keywords: /\b(contact|enquir|inquiry|lead|demo|trial|signup|sign up|get started|quote|request)\b/i, why: 'A capture/enquiry surface was observed' },
  { module: 'newsletter', keywords: /\b(newsletter|subscribe|subscription|mailing list|updates)\b/i, why: 'A subscribe surface was observed' },
  { module: 'content', keywords: /\b(blog|articles?|posts?|news|resources|guides?|insights?|stories)\b/i, why: 'A content/editorial surface was observed' },
  { module: 'knowledge', keywords: /\b(docs?|documentation|help center|helpcentre|kb|knowledge|faq|support articles)\b/i, why: 'A documentation/FAQ surface was observed' },
  { module: 'portal', keywords: /\b(login|log in|signin|sign in|account|dashboard|my account|portal|register)\b/i, why: 'An authenticated account surface was observed' },
  { module: 'payments', keywords: /\b(pricing|checkout|cart|buy|purchase|payment|billing|plans|subscribe to plan)\b/i, why: 'A pricing/checkout surface was observed' },
  { module: 'invoices', keywords: /\b(invoice|billing|receipt|tax)\b/i, why: 'A billing surface was observed' },
  { module: 'reviews', keywords: /\b(reviews?|testimonials?|ratings?|case stud|customers say)\b/i, why: 'A social-proof surface was observed' },
  { module: 'chat', keywords: /\b(chat|live support|messenger|whatsapp|talk to us|intercom|crisp|tawk)\b/i, why: 'A chat/support widget surface was observed' },
  { module: 'analytics', keywords: /\b(analytics|reporting|metrics|insights dashboard|stats)\b/i, why: 'An analytics/reporting surface was observed' },
  { module: 'clients', keywords: /\b(clients?|customers?|accounts|teams|organizations)\b/i, why: 'A customer/account concept was observed' },
  { module: 'projects', keywords: /\b(projects?|tasks?|jobs|workspace|boards?)\b/i, why: 'A project/task concept was observed' },
  { module: 'pipeline', keywords: /\b(pipeline|deals?|opportunit|stages?|kanban)\b/i, why: 'A pipeline/deal concept was observed' },
  { module: 'communications', keywords: /\b(comms|messages?|inbox|notifications?|sms|calls?)\b/i, why: 'A communications surface was observed' },
]

const VERTICAL_SIGNALS: Array<{ vertical: FactoryVertical; keywords: RegExp; why: string }> = [
  { vertical: 'ecommerce', keywords: /\b(cart|checkout|shop|product|store|buy now|add to cart)\b/i, why: 'Commerce vocabulary dominates the observed IA' },
  { vertical: 'booking', keywords: /\b(book|booking|appointment|schedule|reservation|availability|calendar)\b/i, why: 'Booking vocabulary dominates the observed IA' },
  { vertical: 'realestate', keywords: /\b(property|properties|listing|lettings|rent|estate|tenan|landlord)\b/i, why: 'Property vocabulary dominates the observed IA' },
  { vertical: 'education', keywords: /\b(course|student|admission|enrol|enroll|training|academy|school|university|tutor)\b/i, why: 'Education vocabulary dominates the observed IA' },
  { vertical: 'support', keywords: /\b(ticket|support desk|helpdesk|help center|kb article|sla)\b/i, why: 'Support-desk vocabulary dominates the observed IA' },
  { vertical: 'marketing', keywords: /\b(campaign|marketing|audience|seo|social|ads|content calendar)\b/i, why: 'Marketing vocabulary dominates the observed IA' },
  { vertical: 'crm', keywords: /\b(crm|pipeline|leads?|deals?|sales)\b/i, why: 'Sales/CRM vocabulary dominates the observed IA' },
]

/**
 * The corpus a derivation may search: ONLY the target's own words, collected by
 * the teardown into `iaCorpus`.
 *
 * The earlier version of this function walked the report's observation text,
 * which contains REA Studio's own section labels — "Analytics/marketing:",
 * "Payments:", "Chat/support:". Deriving a vertical from those words is
 * circular: the label is ours, so a plumbing company's site was classified as a
 * marketing product because our own report used the word "marketing". Using the
 * target's vocabulary alone removes that feedback loop.
 *
 * `iaCorpus` is optional in the type only so an older stored teardown still
 * loads; when it is absent the derivation says so instead of guessing.
 */
function iaCorpus(report: TeardownReport): { text: string; sourced: boolean } {
  const words = Array.isArray(report.iaCorpus) ? report.iaCorpus : []
  if (words.length === 0) return { text: '', sourced: false }
  return { text: words.join('\n'), sourced: true }
}

/**
 * Scores every candidate against the corpus and returns them best-first.
 * First-match-wins was wrong: a single stray word ("product" inside an iframe
 * title) outranked a page dense with CRM vocabulary. Counting matches makes the
 * decision proportional to the evidence, and ties break on catalogue order so
 * the result stays deterministic.
 */
function scoreMatches<T extends { keywords: RegExp; why: string }>(candidates: T[], corpus: string): Array<{ candidate: T; matches: string[]; score: number }> {
  const scored = candidates.map((candidate) => {
    const matches: string[] = []
    const re = new RegExp(candidate.keywords.source, candidate.keywords.flags.includes('g') ? candidate.keywords.flags : `${candidate.keywords.flags}g`)
    let m: RegExpExecArray | null
    let guard = 0
    while ((m = re.exec(corpus)) !== null && guard < 200) {
      guard += 1
      const value = m[0].trim().toLowerCase()
      if (!matches.includes(value)) matches.push(value)
      if (m.index === re.lastIndex) re.lastIndex += 1
    }
    return { candidate, matches, score: matches.length }
  })
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score)
}

/**
 * Derives an original brief from the teardown. `appName` and `primaryColor`
 * come from the OPERATOR, never from the target — that is what keeps the
 * rebuild ours rather than theirs.
 */
export function planReconstruction(input: {
  report: TeardownReport
  evidenceId: string
  capturedAt: string
  operator: {
    appName: string
    clientName: string
    primaryColor?: string
    currency?: string
    language?: 'EN' | 'BN' | 'BOTH'
    primaryContact?: string
    notes?: string
  }
}): Reconstruction {
  const { report, evidenceId, capturedAt, operator } = input
  const corpus = iaCorpus(report)
  const derived: ReconstructionProvenance['derived'] = []

  if (!corpus.sourced) {
    derived.push({
      decision: 'derivation ran without target vocabulary',
      from: 'This teardown carries no iaCorpus (it predates that field, or the document contained no navigation, headings, forms or links). Everything below is therefore a default, not a derivation.',
      authority: 'UNKNOWN',
    })
  }

  // ---- vertical: highest-scoring vocabulary wins, ties break deterministically ----
  let vertical: FactoryVertical = 'crm'
  const verticalScores = scoreMatches(VERTICAL_SIGNALS, corpus.text)
  const best = verticalScores[0]
  if (best && (FACTORY_VERTICALS as readonly string[]).includes(best.candidate.vertical)) {
    vertical = best.candidate.vertical
    derived.push({
      decision: `vertical = ${vertical}`,
      from: `${best.candidate.why}; matched ${best.score} distinct term(s): ${best.matches.slice(0, 6).join(', ')}${verticalScores[1] ? `. Runner-up ${verticalScores[1].candidate.vertical} scored ${verticalScores[1].score}.` : ''}`,
      authority: 'INFERRED',
    })
  } else {
    derived.push({ decision: 'vertical = crm (default)', from: 'No vertical vocabulary was observed in the target\u2019s own words; the factory default is used rather than a guess.', authority: 'UNKNOWN' })
  }

  // ---- modules ----
  const modules = new Set<FactoryModule>()
  for (const scored of scoreMatches(MODULE_SIGNALS, corpus.text)) {
    const signal = scored.candidate
    if (!(FACTORY_MODULES as readonly string[]).includes(signal.module)) continue
    modules.add(signal.module)
    derived.push({
      decision: `module + ${signal.module}`,
      from: `${signal.why} (matched ${scored.score}: ${scored.matches.slice(0, 5).join(', ')})`,
      authority: 'INFERRED',
    })
  }
  if (modules.size === 0) {
    modules.add('leads')
    modules.add('clients')
    derived.push({ decision: 'module + leads, clients (default)', from: 'No module vocabulary was observed; the smallest useful workspace is assumed.', authority: 'UNKNOWN' })
  }
  // Every rebuild gets these so it is a deliverable workspace, not a landing page.
  modules.add('communications')

  // ---- pages from the observed IA ----
  const navLabels = report.sections
    .find((s) => s.id === 'architecture')
    ?.observations.find((o) => o.text.startsWith('Navigation labels:'))
    ?.text.replace('Navigation labels:', '')
    .split('·')
    .map((l) => l.trim())
    .filter((l) => l && l !== '(none found)') ?? []

  const seen = new Set<string>()
  const pages: Reconstruction['pages'] = []
  const addPage = (path: string, title: string, purpose: string) => {
    if (seen.has(path)) return
    seen.add(path)
    pages.push({ path, title, purpose })
  }
  addPage('/', operator.appName || 'Home', 'Primary landing surface — original copy written by the factory, not lifted from the target.')

  for (const label of navLabels.slice(0, 12)) {
    const slug = `/${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`
    if (!slug || slug === '/') continue
    addPage(slug, label, `Recreates the observed navigation role of "${label}" with our own content and components.`)
  }
  // Route prefixes we observed but that were not in the nav.
  for (const candidate of report.routeCandidates.slice(0, 20)) {
    const first = candidate.path.split('/').filter(Boolean)[0]
    if (!first || first.startsWith('[')) continue
    const slug = `/${first.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`
    if (seen.has(slug)) continue
    if (/^(wp-|_next|_nuxt|cdn-cgi|assets|static|api)$/i.test(first)) continue
    addPage(slug, titleCase(first), `Observed route prefix "${candidate.path}" (basis: ${candidate.basis}, ${candidate.authority}). Reachability was never confirmed.`)
  }
  if (modules.has('portal')) addPage('/portal', 'Client portal', 'Authenticated client surface, if one was observed on the target.')

  const brief: FactoryBrief = {
    appName: (operator.appName || 'Client Workspace').slice(0, 80),
    clientName: (operator.clientName || 'Client').slice(0, 80),
    vertical,
    modules: [...modules],
    language: operator.language ?? 'EN',
    currency: (operator.currency ?? 'GBP').toUpperCase().slice(0, 3),
    primaryColor: /^#[0-9a-fA-F]{6}$/.test(operator.primaryColor ?? '') ? operator.primaryColor!.toUpperCase() : '#063B8F',
    primaryContact: (operator.primaryContact ?? '').slice(0, 120),
    // The brief is what GENERATES the application, and generated documents can
    // reach a client. So the target's name never enters it: lineage lives in
    // ReaReconstruction.provenance, which is internal. Only the evidence id and
    // the operator's own words travel with the brief.
    notes: [
      operator.notes ?? '',
      `Derived from an internal REA Studio teardown (evidence ${evidenceId}); the analyzed target is recorded in the reconstruction lineage, not here.`,
      'No target copy, asset, brand, colour or source code was used. All content is written fresh by the factory.',
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 4000),
  }

  const notReconstructable = [
    'Backend logic, data model and API contracts — never observable from a document. The factory designs our own from the selected modules.',
    'Authentication and session mechanics — probing or bypassing them is out of scope and never attempted.',
    'Client-rendered interface detail when the target is an SPA shell — the hydrated DOM was not captured.',
    'Performance characteristics, real traffic, conversion rates and business metrics.',
    'The target\u2019s visual design. A structurally equivalent product is not a lookalike, and must not be presented as one.',
    'Any proprietary algorithm. Behaviour behind a compiled or minified bundle is not recovered by this platform.',
  ]

  const observedCount = report.stack.filter((s) => s.authority === 'OBSERVED').length
  const confidence = Number(
    Math.max(
      0.1,
      Math.min(0.85, 0.25 + observedCount * 0.03 + Math.min(navLabels.length, 8) * 0.03 + (pages.length > 3 ? 0.1 : 0)),
    ).toFixed(2),
  )

  return {
    brief,
    pages,
    confidence,
    provenance: {
      evidenceId,
      // Internal lineage only. This value never reaches the factory brief, so a
      // target's brand cannot leak into a generated client document.
      targetUrl: report.headline,
      capturedAt,
      derived,
      copied: [...NEVER_COPIED],
      notReconstructable,
    },
    statement:
      'This rebuild is an ORIGINAL application whose information architecture was informed by what the teardown observed. It shares no code, copy, brand or design asset with the analyzed target. It is a starting point for our own delivery team to review — not a clone, and not a finished product.',
  }
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * The refusal text used when an operator asks REA Studio to reproduce a
 * target's look, copy or code. Kept as a constant so every surface reports the
 * same boundary in the same words.
 */
/**
 * How many distinct things the reconstruction refuses to take. Exported so a
 * test can assert the list never shrinks: a boundary that quietly loses a line
 * is a boundary that stopped being enforced.
 */
export const NEVER_COPIED_COUNT = NEVER_COPIED.length

export const CLONE_REFUSAL =
  'REA Studio will not reproduce a target\u2019s design, copy, brand or code. It derives an original application from observed structure. Rebuilding a lookalike of someone else\u2019s product would infringe their rights and expose the client to a claim we cannot defend.'
