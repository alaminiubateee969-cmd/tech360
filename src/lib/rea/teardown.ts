/**
 * TECH360 — REA Studio: the teardown
 * ===================================
 * Composes a capture into (a) an Evidence record, (b) a human teardown report,
 * and (c) a spoken script for the voice surface.
 *
 * Deterministic and pure: the same capture always produces the same teardown.
 * No model call is involved, which is what makes the output auditable — an
 * operator can diff two teardowns of the same target and see exactly what
 * changed in the target, not what a model felt like saying today.
 *
 * The spoken script obeys the same evidence rule as the report. It never says
 * "this site uses Stripe" when the evidence is an inferred bundle match; it
 * says what was observed, and it reads the limitations out loud. A teardown
 * that sounds confident but hides its unknowns is worse than no teardown.
 */
import { createHash } from 'node:crypto'
import {
  buildEvidence,
  coverageOf,
  limitation,
  unknown,
  type EvidenceRecord,
  type ReaFinding,
  type ReaLimitation,
  type ReaTargetKind,
} from './evidence'
import { fingerprint, groupFingerprints, type Fingerprint } from './fingerprint'
import { analyzeDocument, type DocumentAnalysis } from './analyze-html'
import { inferEndpoints, inferRoutes, type EndpointCandidate, type RouteCandidate } from './infer-routes'

export type TeardownInput = {
  kind: ReaTargetKind
  url: string
  finalUrl?: string
  html: string
  headers: Array<[string, string]>
  status: number
  bytes: number
  digest?: string
  subresources?: Array<{ url: string; text: string; bytes: number; status: number; error?: string }>
  robots?: { fetched: boolean; sitemaps: string[]; disallowCount: number } | null
  sitemap?: { fetched: boolean; locs: string[]; truncated: boolean } | null
  captureLimitations?: Array<{ code: string; detail: string }>
  /** Operator's own words about what they wanted to learn. Quoted in the report. */
  question?: string
  producedAt?: string
}

export type TeardownResult = {
  // `buildEvidence` attaches the findings it validated, so the record type must
  // carry them — the report and the API both read them back off the evidence.
  evidence: EvidenceRecord<TeardownNormalized & { findings: ReaFinding[] }>
  report: TeardownReport
  spoken: string
  markdown: string
}

export type TeardownNormalized = {
  status: number
  bytes: number
  renderModel: DocumentAnalysis['structure']['renderModel']
  document: DocumentAnalysis['structure']
  fingerprints: Fingerprint[]
  routes: ReturnType<typeof inferRoutes>
  endpoints: ReturnType<typeof inferEndpoints>
  bounds: DocumentAnalysis['bounds']
  question: string | null
}

export type TeardownReport = {
  headline: string
  question: string | null
  verdict: string
  /**
   * The target's OWN words and paths, collected once here: navigation labels,
   * heading text, route candidate paths, form field names and button labels.
   *
   * This exists so the reconstruction bridge derives from what the target said,
   * never from this report's own scaffolding. Deriving a vertical from a section
   * titled "Analytics/marketing" would be circular — that label is ours, and a
   * page about plumbing would be classified as a marketing product.
   */
  iaCorpus: string[]
  sections: Array<{
    id: string
    title: string
    /** What was actually observed, with its citation. */
    observations: Array<{ text: string; authority: string; signal?: string }>
    /** What this does not prove. */
    limits: string[]
  }>
  stack: Array<{ label: string; category: string; authority: string; signal: string; source: string; confidence: number; caveat?: string }>
  routeCandidates: RouteCandidate[]
  endpointCandidates: EndpointCandidate[]
  limitations: ReaLimitation[]
  unknowns: Array<{ id: string; question: string; authorityRequired: string }>
  completeness: string[]
  a11y: DocumentAnalysis['structure']['a11y']
  evidenceId: string
  summaryLine: string
}

export const PRODUCER = 'rea360.inspect_web_document'

export function buildTeardown(input: TeardownInput): TeardownResult {
  const analysis = analyzeDocument(input.html, input.finalUrl ?? input.url)
  const { structure } = analysis

  // The evidence id is content-bound. A caller-supplied digest is used when it
  // is present, but it is ALWAYS recomputed and compared: two captures of
  // different bytes must never share an evidence id, because the id is what a
  // reviewer cites. A mismatch is reported rather than silently trusted.
  const computedDigest = createHash('sha256').update(input.html ?? '').digest('hex')
  const digestMatches = input.digest ? input.digest === computedDigest : true
  const digest = computedDigest

  const subresourceText = (input.subresources ?? [])
    .map((s) => s.text)
    .join('\n')
    .slice(0, 1_500_000)

  const prints = fingerprint({
    html: input.html,
    headers: input.headers ?? [],
    resources: structure.externalScriptUrls.concat(structure.stylesheets),
    bodyText: subresourceText,
  })

  const routes = inferRoutes({
    origin: safeOrigin(input.finalUrl ?? input.url),
    internalLinks: structure.internalLinks,
    canonical: structure.canonical,
    hreflang: structure.links.filter((l) => l.rel && /alternate/i.test(l.rel)).map((l) => ({ href: l.href })),
    sitemapLocs: input.sitemap?.locs ?? [],
    robotsSitemaps: input.robots?.sitemaps ?? [],
    manifestStartUrl: structure.manifest,
    ogUrl: structure.ogTags.find((t) => t.name.toLowerCase() === 'og:url')?.content ?? null,
    bundleText: subresourceText,
  })

  const endpoints = inferEndpoints({
    origin: safeOrigin(input.finalUrl ?? input.url),
    forms: structure.forms,
    bundleText: subresourceText,
    sitemapLocs: input.sitemap?.locs ?? [],
  })

  const findings: ReaFinding[] = []
  let n = 0
  const push = (area: string, title: string, detail: string, authority: ReaFinding['authority'], signals: string[], confidence: number) => {
    n += 1
    findings.push({ id: `f${String(n).padStart(3, '0')}`, area, title, detail, authority, signals, confidence })
  }

  // ---- observations that markup alone can support ----
  push('transport.response', `Target responded HTTP ${input.status}`, `${input.bytes.toLocaleString('en-US')} bytes captured from ${input.finalUrl ?? input.url}.`, input.status > 0 ? 'OBSERVED' : 'UNKNOWN', [`status ${input.status}`, `${input.bytes} bytes`], input.status > 0 ? 1 : 0)

  push('structure.render-model', `Render model: ${structure.renderModel.model}`, structure.renderModel.signals.join(' '), structure.renderModel.model === 'UNKNOWN' ? 'UNKNOWN' : 'INFERRED', structure.renderModel.signals, structure.renderModel.confidence)

  if (structure.title) push('structure.title', `Document title: "${structure.title}"`, 'The <title> element as shipped.', 'OBSERVED', [`<title>${structure.title}</title>`], 1)
  if (structure.description) push('seo.meta', 'Meta description present', structure.description.slice(0, 200), 'OBSERVED', ['<meta name="description">'], 1)
  else push('seo.meta', 'No meta description in the document', 'Absence in the captured markup. A description may still be injected client-side.', 'INFERRED', ['meta[name=description] absent'], 0.5)

  if (structure.lang) push('i18n.lang', `Document language declared: ${structure.lang}`, 'The <html lang> attribute as shipped.', 'DECLARED', [`lang="${structure.lang}"`], 0.9)
  else push('i18n.lang', 'No <html lang> declared', 'An accessibility gap that is observable in the static document.', 'OBSERVED', ['html[lang] absent'], 0.9)

  if (structure.canonical) push('seo.canonical', `Canonical: ${structure.canonical}`, 'Declared by the document.', 'DECLARED', [`rel="canonical" href="${structure.canonical}"`], 0.85)

  push('structure.headings', `${structure.headings.length} heading(s), ${structure.headings.filter((h) => h.level === 1).length} at h1`, structure.headingOutline.slice(0, 12).join(' / '), 'OBSERVED', [`${structure.headings.length} heading elements`], structure.headings.length > 0 ? 0.95 : 0.4)

  push('structure.navigation', `${structure.navItems.length} navigation label(s)`, structure.navItems.slice(0, 16).join(' · ') || 'No labelled navigation found in the static document.', structure.navItems.length ? 'OBSERVED' : 'UNKNOWN', [`${structure.navItems.length} nav anchors`], structure.navItems.length ? 0.85 : 0.1)

  push('structure.forms', `${structure.forms.length} form(s) with ${structure.forms.reduce((t, f) => t + f.fields.length, 0)} field(s)`, structure.forms.map((f) => `${f.method} ${f.action || '(no action)'}: ${f.fields.map((x) => x.name || x.type).join(', ')}`).join(' | ') || 'No <form> element in the static document.', structure.forms.length ? 'OBSERVED' : 'INFERRED', [`${structure.forms.length} form elements`], structure.forms.length ? 0.9 : 0.4)

  push('structure.content', `${structure.wordCount} words of visible text in the initial document`, structure.textSample.slice(0, 300), 'OBSERVED', [`${structure.wordCount} words`], 0.9)

  push('structure.assets', `${structure.images.length} image(s), ${structure.imagesMissingAlt} missing alt text`, `${structure.images.filter((i) => i.lazy).length} lazy-loaded.`, 'OBSERVED', [`${structure.images.length} img elements`], structure.images.length ? 0.9 : 0.4)

  push('structure.scripts', `${structure.externalScriptUrls.length} external script(s), ${structure.inlineScriptCount} inline`, structure.externalScriptUrls.slice(0, 10).join(', '), 'OBSERVED', [`${structure.externalScriptUrls.length} script[src]`], 0.9)

  // ---- stack fingerprints, one finding each, each carrying its citation ----
  for (const print of prints) {
    push(`stack.${print.category}`, `${print.label}`, print.caveat ?? `${print.label} detected from ${print.source}.`, print.authority, [`${print.source} → ${print.signal}`], print.confidence)
  }

  // ---- routes and endpoints: candidates only ----
  push('routes.candidates', `${routes.candidates.length} route candidate(s)`, `Prefixes: ${routes.prefixes.slice(0, 10).map((p) => `${p.prefix} (${p.count})`).join(', ') || 'none'}. ${routes.completeness[0]}`, routes.candidates.some((c) => c.authority === 'OBSERVED') ? 'INFERRED' : 'INFERRED', [`${routes.candidates.length} candidates from ${new Set(routes.candidates.map((c) => c.basis)).size} basis type(s)`], 0.5)

  push('endpoints.candidates', `${endpoints.candidates.length} endpoint candidate(s)`, endpoints.candidates.slice(0, 8).map((e) => `${e.method} ${e.path}`).join(', ') || 'none observed', 'INFERRED', [`${endpoints.candidates.length} candidates`], 0.4)

  if (structure.structuredData.length) {
    push('seo.structured-data', `${structure.structuredData.length} JSON-LD block(s): ${structure.structuredData.map((s) => s.type).join(', ')}`, 'Structured data is a declaration by the site, not verified fact.', 'DECLARED', structure.structuredData.map((s) => `@type ${s.type}`), 0.8)
  }

  if (structure.iframes.length) {
    push('structure.embeds', `${structure.iframes.length} iframe embed(s)`, structure.iframes.map((f) => f.src).filter(Boolean).slice(0, 8).join(', '), 'OBSERVED', structure.iframes.map((f) => `iframe src=${f.src}`).slice(0, 8), 0.9)
  }

  // ---- limitations: the capture's own, plus the structural ones ----
  const limitations: ReaLimitation[] = (input.captureLimitations ?? []).map((l) => limitation(l.code, l.detail))

  limitations.push(
    limitation('engine.no-browser', 'No Chrome-family browser is attached in this deployment. Upstream REA observes the live DOM, accessibility tree, console, workers and network over CDP; REA Studio observes the shipped document only. Everything the browser would build later is UNKNOWN, not absent.', 'runtime'),
    limitation('engine.no-native', 'Native, mobile, firmware and managed-binary targets are not supported here: no Ghidra, Hopper, IDA, Kuna, JADX, Binwalk or Unblob is installed. Those target kinds are refused at admission rather than partially analysed.', 'target-routing'),
    limitation('engine.no-execution', 'Captured JavaScript was read as text and never executed. A string in a bundle proves the string shipped, not that the code path runs.', 'bundles'),
  )

  if (structure.renderModel.model === 'SPA_SHELL') {
    limitations.push(
      limitation('render.spa-shell', `The document is a client-rendered shell (${structure.renderModel.signals.join('; ')}). Most of the real interface is built in the browser after this capture, so the structure, content and route findings below describe the shell, not the product the user sees.`, 'document'),
    )
  }
  if (input.status >= 400) {
    limitations.push(limitation('capture.error-status', `The target answered ${input.status}. Any structural finding describes the error page, not the application.`, 'document'))
  }
  if (analysis.bounds.truncated) {
    limitations.push(limitation('capture.truncated', `Capture bounds were hit: ${analysis.bounds.truncatedBy.join('; ')}. Collections are partial.`, 'document'))
  }
  if (!digestMatches) {
    limitations.push(
      limitation('digest.mismatch', `The supplied digest (${String(input.digest).slice(0, 16)}…) does not match the SHA-256 of the captured bytes (${computedDigest.slice(0, 16)}…). The computed digest is used, so the evidence id is bound to what was actually analyzed.`, 'evidence'),
    )
  }
  if (!input.sitemap?.fetched) {
    limitations.push(limitation('coverage.no-sitemap', 'No sitemap was available, so declared route coverage is limited to links present in this one document. Sibling pages were not crawled.', 'routes'))
  }
  limitations.push(limitation('coverage.single-document', 'One document was captured. REA Studio does not crawl: sibling pages, authenticated areas and anything behind a form submission were not visited, so they contribute no findings.', 'routes'))

  // ---- unknowns: what would resolve each ----
  const unknowns = [
    unknown('u-runtime-dom', 'What does the interface look like after hydration?', 'A Chrome-family browser attached over CDP (upstream REA `inspect_web_page`), or an operator-supplied capture of the rendered DOM.'),
    unknown('u-runtime-network', 'Which endpoints does the application actually call, with what payloads?', 'An authorized runtime network capture (HAR) or upstream REA `observe_web_session`.'),
    unknown('u-route-table', 'What is the complete route table?', 'The application\u2019s own router configuration or an authorized crawl; a static capture cannot bound it.'),
    unknown('u-auth-model', 'How does authentication and session handling work?', 'An authorized account plus runtime observation. REA Studio never probes, guesses or bypasses authentication.'),
    unknown('u-data-model', 'What is the server-side data model?', 'Backend source or authorized API documentation. Client markup reveals field names, not schema.'),
    unknown('u-backend-stack', 'What is the backend language, framework and database?', 'Response headers hint at the edge only. The origin stack is not observable from a document.'),
    unknown('u-a11y-tree', 'What is the real accessibility tree and screen-reader experience?', 'A browser accessibility snapshot (CDP `Accessibility.getFullAXTree`).'),
  ]
  if (structure.renderModel.model === 'SPA_SHELL') {
    unknowns.unshift(unknown('u-spa-content', 'What content does this page actually show a visitor?', 'A rendered capture of the hydrated page — the static shell does not contain it.'))
  }

  const coverage = coverageOf(
    1 + (input.subresources?.length ?? 0) + (input.robots?.fetched ? 1 : 0) + (input.sitemap?.fetched ? 1 : 0),
    1 + (input.subresources?.length ?? 0) + 2,
    analysis.bounds.truncated ? 'document byte cap' : undefined,
  )

  const evidence = buildEvidence({
    producer: PRODUCER,
    target: {
      kind: input.kind,
      identifier: input.url,
      digest,
      bytes: input.bytes,
    },
    normalizedResult: {
      status: input.status,
      bytes: input.bytes,
      renderModel: structure.renderModel,
      document: structure,
      fingerprints: prints,
      routes,
      endpoints,
      bounds: analysis.bounds,
      question: input.question ?? null,
    },
    findings,
    coverage,
    limitations,
    unknowns,
    producedAt: input.producedAt,
  })

  const report = composeReport({ evidence, structure, prints, routes, endpoints, question: input.question ?? null, status: input.status, url: input.finalUrl ?? input.url })
  const spoken = composeSpoken({ report, structure, prints, routes, limitations })
  const markdown = composeMarkdown({ report, evidence, structure, prints, routes, endpoints })

  return { evidence, report, spoken, markdown }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function composeReport(input: {
  evidence: EvidenceRecord<TeardownNormalized & { findings: ReaFinding[] }>
  structure: DocumentAnalysis['structure']
  prints: Fingerprint[]
  routes: ReturnType<typeof inferRoutes>
  endpoints: ReturnType<typeof inferEndpoints>
  question: string | null
  status: number
  url: string
}): TeardownReport {
  const { evidence, structure, prints, routes, endpoints, question, status, url } = input
  const groups = groupFingerprints(prints)
  const observedCount = prints.filter((p) => p.authority === 'OBSERVED').length

  const frameworks = (groups.framework ?? []).map((f) => f.label)
  const cms = (groups.cms ?? []).map((f) => f.label)
  const commerce = (groups.commerce ?? []).map((f) => f.label)
  const styling = (groups.styling ?? []).map((f) => f.label)
  const uiKit = (groups.ui_kit ?? []).map((f) => f.label)
  const hosting = (groups.hosting ?? []).map((f) => f.label)
  const analytics = [...(groups.analytics ?? []), ...(groups.ads ?? []), ...(groups.tag_manager ?? [])].map((f) => f.label)
  const payments = (groups.payments ?? []).map((f) => f.label)
  const chat = (groups.chat ?? []).map((f) => f.label)

  const headline = `${structure.title || new URL(url).hostname} — ${structure.renderModel.model} · ${observedCount} observed technologies`

  const verdictParts: string[] = []
  if (status >= 400) verdictParts.push(`The target answered HTTP ${status}, so this teardown describes an error page rather than the product.`)
  else if (structure.renderModel.model === 'SPA_SHELL') verdictParts.push('This is a client-rendered shell: the document we captured contains almost none of the interface a visitor sees. The structural findings below are real but shallow, and confirming the product requires a rendered capture.')
  else verdictParts.push(`A server-delivered document with ${structure.wordCount.toLocaleString('en-US')} words of visible content, ${structure.sections.length} content sections and ${structure.internalLinks.length} internal links — enough structure to reconstruct an equivalent information architecture from our own components.`)
  verdictParts.push(`${prints.length} technology fingerprint(s): ${frameworks.concat(cms, commerce).join(', ') || 'no framework identified'}${styling.length ? `, styled with ${styling.join(', ')}` : ''}${hosting.length ? `, served via ${hosting.join(', ')}` : ''}.`)
  verdictParts.push(`${routes.candidates.length} route candidate(s) and ${endpoints.candidates.length} endpoint candidate(s) — all candidates, none confirmed reachable.`)

  const sections: TeardownReport['sections'] = [
    {
      id: 'identity',
      title: '1. What this page says it is',
      observations: [
        { text: `Title: ${structure.title || '(none)'}`, authority: 'OBSERVED', signal: '<title>' },
        { text: `Description: ${structure.description ?? '(none declared)'}`, authority: structure.description ? 'OBSERVED' : 'UNKNOWN', signal: 'meta[name=description]' },
        { text: `Language: ${structure.lang ?? '(not declared)'}`, authority: structure.lang ? 'DECLARED' : 'OBSERVED', signal: 'html[lang]' },
        { text: `Generator: ${structure.generator ?? '(none declared)'}`, authority: structure.generator ? 'DECLARED' : 'UNKNOWN', signal: 'meta[name=generator]' },
        { text: `Canonical: ${structure.canonical ?? '(none)'}`, authority: structure.canonical ? 'DECLARED' : 'UNKNOWN' },
        { text: `Open Graph / Twitter tags: ${structure.ogTags.length}`, authority: 'OBSERVED' },
        { text: `Structured data: ${structure.structuredData.map((s) => s.type).join(', ') || 'none'}`, authority: structure.structuredData.length ? 'DECLARED' : 'OBSERVED' },
      ],
      limits: ['Meta and structured data are declarations by the site about itself. They are not verified facts about its behaviour.'],
    },
    {
      id: 'render',
      title: '2. How it reaches the visitor',
      observations: [
        { text: `Render model: ${structure.renderModel.model} (confidence ${structure.renderModel.confidence})`, authority: 'INFERRED' },
        ...structure.renderModel.signals.map((s) => ({ text: s, authority: 'OBSERVED' })),
        { text: `${structure.wordCount} words of visible text in the shipped document`, authority: 'OBSERVED' },
        { text: `${structure.externalScriptUrls.length} external scripts, ${structure.inlineScriptCount} inline scripts, ${structure.stylesheets.length} stylesheets`, authority: 'OBSERVED' },
      ],
      limits: [
        'Render model is classified from markup patterns, not from watching the page load.',
        'No browser was attached, so hydration behaviour, client-only routes and lazy-loaded content are unknown.',
      ],
    },
    {
      id: 'architecture',
      title: '3. Information architecture',
      observations: [
        { text: `Heading outline: ${structure.headingOutline.slice(0, 14).join(' → ') || '(no headings)'}`, authority: 'OBSERVED' },
        { text: `Navigation labels: ${structure.navItems.slice(0, 20).join(' · ') || '(none found)'}`, authority: structure.navItems.length ? 'OBSERVED' : 'UNKNOWN' },
        { text: `${structure.sections.length} <section> element(s): ${structure.sections.map((s) => s.id || s.classes.split(' ')[0] || '(unlabelled)').slice(0, 14).join(', ') || 'none'}`, authority: 'OBSERVED' },
        { text: `${structure.internalLinks.length} internal links, ${structure.externalLinks.length} external links`, authority: 'OBSERVED' },
        { text: `Route prefixes: ${routes.prefixes.slice(0, 12).map((p) => `${p.prefix}×${p.count}`).join(', ') || '(none)'}`, authority: 'INFERRED' },
        { text: `Footer: ${structure.footerText.slice(0, 240) || '(none captured)'}`, authority: structure.footerText ? 'OBSERVED' : 'UNKNOWN' },
      ],
      limits: routes.completeness,
    },
    {
      id: 'stack',
      title: '4. Technology stack (each with its citation)',
      observations: prints.map((p) => ({
        text: `${p.label} — ${p.category}`,
        authority: p.authority,
        signal: `${p.source} → ${p.signal}`,
      })),
      limits: [
        'A fingerprint proves a signal was present in the capture. It does not prove a version, a licence, or that the feature is used on this page.',
        ...(prints.filter((p) => p.caveat).map((p) => `${p.label}: ${p.caveat}`)),
      ],
    },
    {
      id: 'interaction',
      title: '5. Interaction surface',
      observations: [
        { text: `${structure.forms.length} form(s): ${structure.forms.map((f) => `${f.method} ${f.action || '(no action)'} [${f.fields.map((x) => x.name || x.type).join(', ')}]`).join(' | ') || 'none in the static document'}`, authority: structure.forms.length ? 'OBSERVED' : 'INFERRED' },
        { text: `${structure.buttons.length} button label(s): ${structure.buttons.slice(0, 20).join(' · ') || '(none)'}`, authority: structure.buttons.length ? 'OBSERVED' : 'UNKNOWN' },
        { text: `Endpoint candidates: ${endpoints.candidates.slice(0, 14).map((e) => `${e.method} ${e.path}`).join(', ') || '(none)'}`, authority: 'INFERRED' },
        { text: `Payments: ${payments.join(', ') || 'none detected'}`, authority: payments.length ? 'OBSERVED' : 'UNKNOWN' },
        { text: `Chat/support: ${chat.join(', ') || 'none detected'}`, authority: chat.length ? 'OBSERVED' : 'UNKNOWN' },
        { text: `Analytics/marketing: ${analytics.join(', ') || 'none detected'}`, authority: analytics.length ? 'OBSERVED' : 'UNKNOWN' },
        { text: `${structure.iframes.length} iframe embed(s): ${structure.iframes.map((f) => f.src).filter(Boolean).slice(0, 6).join(', ') || 'none'}`, authority: 'OBSERVED' },
      ],
      limits: endpoints.completeness,
    },
    {
      id: 'a11y',
      title: '6. Accessibility and quality signals (static subset)',
      observations: [
        { text: `Landmarks — header:${structure.a11y.landmarks.header} nav:${structure.a11y.landmarks.nav} main:${structure.a11y.landmarks.main} footer:${structure.a11y.landmarks.footer} aside:${structure.a11y.landmarks.aside}`, authority: 'OBSERVED' },
        { text: `Heading order ${structure.a11y.headingsInOrder ? 'is sequential' : `skips level(s): ${structure.a11y.headingGaps.join(', ')}`}`, authority: 'OBSERVED' },
        { text: `${structure.a11y.imagesMissingAlt} image(s) missing alt text`, authority: 'OBSERVED' },
        { text: `${structure.a11y.inputsMissingLabel} input(s) with no label or placeholder`, authority: 'OBSERVED' },
        { text: `<html lang> ${structure.a11y.langDeclared ? `declared (${structure.lang})` : 'not declared'}`, authority: 'OBSERVED' },
        { text: `Viewport meta: ${structure.viewport ?? '(absent)'}`, authority: structure.viewport ? 'OBSERVED' : 'UNKNOWN' },
      ],
      limits: ['This is the static subset only. Contrast, focus order, keyboard traps, ARIA correctness and the real accessibility tree require a browser.'],
    },
  ]

  const iaCorpus = collectIaCorpus(structure, routes)

  return {
    headline,
    question,
    verdict: verdictParts.join(' '),
    iaCorpus,
    sections,
    stack: prints.map((p) => ({
      label: p.label, category: p.category, authority: p.authority, signal: p.signal, source: p.source, confidence: p.confidence,
      ...(p.caveat ? { caveat: p.caveat } : {}),
    })),
    routeCandidates: routes.candidates,
    endpointCandidates: endpoints.candidates,
    limitations: evidence.limitations,
    unknowns: evidence.unknowns.map((u) => ({ id: u.id, question: u.question, authorityRequired: u.authorityRequired })),
    completeness: [...routes.completeness, ...endpoints.completeness],
    a11y: structure.a11y,
    evidenceId: evidence.evidenceId,
    summaryLine: [
      `${prints.filter((p) => p.authority === 'OBSERVED').length} observed technologies`,
      `${prints.filter((p) => p.authority === 'INFERRED').length} inferred`,
      `${routes.candidates.length} route candidates`,
      `${endpoints.candidates.length} endpoint candidates`,
      `${evidence.limitations.length} limitations`,
      `${evidence.unknowns.length} open unknowns`,
      evidence.coverage.complete ? 'coverage complete' : 'coverage partial',
    ].join(' · '),
  }
}

// ---------------------------------------------------------------------------
// Spoken script
// ---------------------------------------------------------------------------

/**
 * Written to be read aloud, not to be read on a screen: short sentences, no
 * punctuation soup, no citations that sound like noise, numbers spelled out
 * where a listener needs them. Readiness is capped so the voice surface never
 * receives ten minutes of prose it cannot speak in one breath.
 */
export function composeSpoken(input: {
  report: TeardownReport
  structure: DocumentAnalysis['structure']
  prints: Fingerprint[]
  routes: ReturnType<typeof inferRoutes>
  limitations: ReaLimitation[]
}, maxChars = 3800): string {
  const { report, structure, prints, routes, limitations } = input
  const host = safeHost(report.headline)
  const lines: string[] = []

  lines.push(`Teardown for ${host}.`)
  if (report.question) lines.push(`You asked: ${report.question.slice(0, 160)}.`)

  const observed = prints.filter((p) => p.authority === 'OBSERVED')
  const inferred = prints.filter((p) => p.authority === 'INFERRED')

  lines.push(
    structure.renderModel.model === 'SPA_SHELL'
      ? `First, an important caveat. This page is a client rendered shell. The document we captured holds only ${structure.wordCount} words, so most of the real interface is built later in the browser. What follows describes the shell, not the finished product.`
      : `The server delivered a full document: ${structure.wordCount} words of visible text across ${structure.sections.length} content sections.`,
  )

  if (observed.length) {
    lines.push(`I can prove these technologies, because I saw the artifact itself. ${observed.slice(0, 10).map((p) => p.label).join('. ')}.`)
  }
  if (inferred.length) {
    lines.push(`These next ones are inferences, not proof: ${inferred.slice(0, 6).map((p) => p.label).join(', ')}. Treat them as leads to check.`)
  }
  if (!observed.length && !inferred.length) {
    lines.push('I found no recognizable technology fingerprints in this capture. That is a result, not a failure: the stack may be entirely custom, or the document may be too small to fingerprint.')
  }

  if (structure.navItems.length) {
    lines.push(`The navigation is: ${structure.navItems.slice(0, 10).join(', ')}.`)
  }
  if (structure.headingOutline.length) {
    lines.push(`The content outline runs: ${structure.headings.slice(0, 8).map((h) => h.text).join(', then ')}.`)
  }
  if (structure.forms.length) {
    const f = structure.forms[0]
    lines.push(`There ${structure.forms.length === 1 ? 'is one form' : `are ${structure.forms.length} forms`}. The first submits ${f.method} to ${f.action || 'no explicit action'}, asking for ${f.fields.slice(0, 6).map((x) => x.name || x.type).join(', ')}.`)
  }

  lines.push(`I found ${routes.candidates.length} route candidates. These are candidates only. Nothing here proves any of them is reachable, and this is not the complete route table.`)

  const a11y = structure.a11y
  const a11yNotes: string[] = []
  if (!a11y.langDeclared) a11yNotes.push('the document declares no language')
  if (a11y.imagesMissingAlt > 0) a11yNotes.push(`${a11y.imagesMissingAlt} images have no alt text`)
  if (!a11y.headingsInOrder) a11yNotes.push('the heading order skips a level')
  if (a11y.landmarks.main === 0) a11yNotes.push('there is no main landmark')
  lines.push(a11yNotes.length ? `Accessibility gaps in the static markup: ${a11yNotes.join(', ')}.` : 'The static accessibility signals look clean: language declared, landmarks present, heading order sequential.')

  lines.push(`Now what I could not determine. ${limitations.slice(0, 3).map((l) => l.detail.split('.')[0]).join('. ')}.`)
  lines.push(`Still open: the interface after hydration, the endpoints actually called at runtime, the complete route table, the authentication model, and the backend stack. Each of those needs an authority I do not have from a static document.`)
  lines.push(`Evidence id ${report.evidenceId}. ${report.summaryLine}.`)

  const text = lines.join(' ').replace(/\s+/g, ' ').trim()
  return text.length > maxChars ? `${text.slice(0, maxChars).replace(/\s\S*$/, '')} [truncated for speech]` : text
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

function composeMarkdown(input: {
  report: TeardownReport
  evidence: EvidenceRecord<TeardownNormalized & { findings: ReaFinding[] }>
  structure: DocumentAnalysis['structure']
  prints: Fingerprint[]
  routes: ReturnType<typeof inferRoutes>
  endpoints: ReturnType<typeof inferEndpoints>
}): string {
  const { report, evidence, prints, routes, endpoints } = input
  const out: string[] = []
  out.push(`# Teardown — ${report.headline}`)
  out.push('')
  out.push(`**Evidence ID:** \`${evidence.evidenceId}\` · **Producer:** \`${evidence.producer}\` · **Captured:** ${evidence.producedAt}`)
  out.push(`**Target:** ${evidence.target.identifier} (${evidence.target.kind}) · **Digest:** \`${evidence.target.digest ?? 'n/a'}\` · **Bytes:** ${evidence.target.bytes ?? 0}`)
  out.push(`**Authority ceiling:** ${evidence.authority} · **Coverage:** ${evidence.coverage.observed}/${evidence.coverage.admitted}${evidence.coverage.complete ? ' (complete)' : ' (partial)'}`)
  out.push('')
  if (report.question) { out.push(`> Operator question: ${report.question}`, '') }
  out.push(`## Verdict`, '', report.verdict, '')

  for (const section of report.sections) {
    out.push(`## ${section.title}`, '')
    out.push('| Observation | Authority | Signal |')
    out.push('|---|---|---|')
    for (const o of section.observations) {
      out.push(`| ${escapeCell(o.text)} | ${o.authority} | ${escapeCell(o.signal ?? '—')} |`)
    }
    out.push('')
    if (section.limits.length) {
      out.push('**What this does not prove:**', '')
      for (const l of section.limits.slice(0, 12)) out.push(`- ${l}`)
      out.push('')
    }
  }

  out.push('## Route candidates', '', '> Candidates, not routes. Reachability was never tested.', '')
  if (routes.candidates.length) {
    out.push('| Path | Basis | Authority | Confidence |')
    out.push('|---|---|---|---|')
    for (const c of routes.candidates.slice(0, 60)) out.push(`| \`${escapeCell(c.path)}\` | ${c.basis} | ${c.authority} | ${c.confidence} |`)
  } else out.push('_None visible in this capture._')
  out.push('')

  out.push('## Endpoint candidates', '', '> Inferences from static text. No request was sent to any of them.', '')
  if (endpoints.candidates.length) {
    out.push('| Method | Path | Authority | Source |')
    out.push('|---|---|---|---|')
    for (const c of endpoints.candidates.slice(0, 40)) out.push(`| ${c.method} | \`${escapeCell(c.path)}\` | ${c.authority} | ${escapeCell(c.source)} |`)
  } else out.push('_None visible in this capture._')
  out.push('')

  out.push('## Limitations', '')
  for (const l of evidence.limitations) out.push(`- **\`${l.code}\`**${l.scope ? ` _(${l.scope})_` : ''} — ${l.detail}`)
  out.push('')
  out.push('## Open unknowns', '')
  out.push('| Unknown | What would resolve it |')
  out.push('|---|---|')
  for (const u of evidence.unknowns) out.push(`| ${escapeCell(u.question)} | ${escapeCell(u.authorityRequired)} |`)
  out.push('')
  out.push('## Stack fingerprints', '')
  for (const p of prints) {
    out.push(`- **${p.label}** \`${p.category}\` — ${p.authority} (${p.confidence}) · \`${p.source}\` → \`${p.signal.slice(0, 100)}\`${p.caveat ? `\n  - ${p.caveat}` : ''}`)
  }
  out.push('')
  out.push('---', `_Produced by REA Studio (TECH360). Static analysis of a public document. No JavaScript was executed, no proprietary source was recovered, and no target credential was captured or stored._`)
  return out.join('\n')
}

/**
 * Collects only target-derived vocabulary. Nothing in this list is a label
 * REA Studio wrote; every entry came out of the captured document.
 */
function collectIaCorpus(
  structure: DocumentAnalysis['structure'],
  routes: ReturnType<typeof inferRoutes>,
): string[] {
  const words: string[] = [
    ...structure.navItems,
    ...structure.headings.map((h) => h.text),
    ...structure.buttons,
    ...structure.forms.flatMap((f) => [f.action, ...f.fields.map((x) => `${x.name} ${x.label ?? ''}`)]),
    ...structure.sections.map((s) => `${s.id} ${s.classes}`),
    ...routes.candidates.map((c) => `${c.path} ${c.label ?? ''}`),
    ...structure.iframes.map((f) => f.title),
  ]
  return words
    .map((w) => (w ?? '').trim())
    .filter((w) => w.length > 0)
    .slice(0, 400)
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 300)
}

function safeHost(value: string): string {
  const url = /https?:\/\/[^/\s]+/.exec(value)?.[0]
  if (url) { try { return new URL(url).hostname } catch { /* fall through */ } }
  return value.split('—')[0]?.trim().slice(0, 60) || 'this target'
}

function safeOrigin(url: string): string | null {
  try { const u = new URL(url); return u.origin } catch { return null }
}
