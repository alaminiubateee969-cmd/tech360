/**
 * TECH360 — REA Studio analysis tests.
 *
 * The contract under test is not "does it detect things" but "does it only
 * claim what it can cite". A reverse-engineering tool that over-claims is worse
 * than no tool, because an operator acts on the teardown.
 *
 * So these tests assert:
 *   - determinism: the same capture always produces the same teardown
 *   - citation: no fingerprint exists without a signal and a source
 *   - authority: inferred findings are labelled and limited, never promoted
 *   - no false positives from ordinary English prose in the page copy
 *   - honesty about the blind spots: SPA shells, error pages, single-document
 *     coverage, and everything a browser would have shown
 *   - the reconstruction boundary: an original brief, never the target's brand
 *
 * No network, no database: every module here is pure.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { fingerprint, FINGERPRINT_CATALOGUE_SIZE } from '../src/lib/rea/fingerprint'
import { analyzeDocument } from '../src/lib/rea/analyze-html'
import { inferEndpoints, inferRoutes } from '../src/lib/rea/infer-routes'
import { buildTeardown } from '../src/lib/rea/teardown'
import { planReconstruction, CLONE_REFUSAL, NEVER_COPIED_COUNT } from '../src/lib/rea/reconstruct'
import { buildEvidence, clampAuthority, coverageOf } from '../src/lib/rea/evidence'

// ------------------------------------------------------------------ fixtures

const RICH_HTML = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Northwind — Pipeline Software for Sales Teams</title>
<meta name="description" content="Northwind helps teams track leads and close deals faster.">
<meta name="generator" content="Next.js">
<link rel="canonical" href="https://northwind.example/">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="alternate" hreflang="bn" href="https://northwind.example/bn/">
<link rel="stylesheet" href="/_next/static/css/app.css">
<meta property="og:url" content="https://northwind.example/">
<script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>
<script src="/_next/static/chunks/main-abc123.js"></script>
<script src="https://js.stripe.com/v3/"></script>
<script src="https://www.googletagmanager.com/gtag/js?id=G-ABC12345"></script>
<script type="application/ld+json">{"@type":"Organization","name":"Northwind"}</script>
</head><body class="flex bg-slate-900 text-slate-100">
<a href="#main" class="skip-link">Skip to content</a>
<header><nav><a href="/">Home</a><a href="/pricing">Pricing</a><a href="/features">Features</a><a href="/blog">Blog</a><a href="/docs">Docs</a><a href="/contact">Contact</a></nav></header>
<main id="main">
<section id="hero"><h1>Close more deals</h1><p>Northwind gives sales teams one place to track every lead from first touch to signed contract.</p><button>Start free trial</button></section>
<section id="features"><h2>Everything you need</h2><h3>Pipeline visibility</h3><p>See every deal stage at a glance.</p><h3>Automated follow up</h3><p>Never lose a lead to silence.</p></section>
<section id="testimonials"><h2>What customers say</h2><p>Our pipeline clarity improved within a week.</p></section>
<form action="/api/leads" method="POST"><label for="e">Work email</label><input id="e" name="email" type="email" required><input name="company" type="text"><textarea name="notes"></textarea><button type="submit">Get started</button></form>
<form action="/api/subscribe" method="POST"><input name="newsletter_email" type="email"><button>Subscribe to the newsletter</button></form>
<img src="/hero.png"><img src="/team.png" alt="Our team at work">
<iframe src="https://www.youtube.com/embed/abc123" title="Product tour"></iframe>
</main>
<aside>Related resources</aside>
<footer>© 2026 Northwind Ltd. <a href="/privacy">Privacy</a> <a href="/terms">Terms</a> <a href="/login">Log in</a></footer>
</body></html>`

const HEADERS: Array<[string, string]> = [
  ['server', 'Vercel'],
  ['content-type', 'text/html; charset=utf-8'],
  ['strict-transport-security', 'max-age=63072000'],
  ['x-powered-by', 'Next.js'],
]

const SPA_HTML = `<!doctype html><html><head><title>App</title>
<script src="/assets/index-9f8e7d.js" type="module"></script>
<link rel="stylesheet" href="/assets/index-1a2b3c.css">
</head><body><div id="root"></div><noscript>Enable JavaScript</noscript></body></html>`

/** Copy that must NOT trigger vendor fingerprints. */
const PROSE_HTML = `<!doctype html><html lang="en"><head><title>Essay</title></head><body>
<h1>On signal processing</h1>
<p>The amplitude of the waveform was plausible, and the clarity of the recording
surprised everyone. The team decided to remix the track and segment the audience
by region. Nothing here is a product.</p>
<h2>Method</h2><p>We used a moment of quiet to calibrate the equipment.</p>
</body></html>`

// `producedAt` is pinned because determinism is a claim about the ANALYSIS, not
// about wall-clock time: two runs of the same capture happen at different
// moments and must still produce an identical teardown. The digest is left
// unset so buildTeardown computes it from the bytes — which is the property
// under test (an evidence id must be content-bound).
const FIXED_TIME = '2026-11-02T00:00:00.000Z'

const teardownOf = (html: string, overrides: Partial<Parameters<typeof buildTeardown>[0]> = {}) =>
  buildTeardown({
    kind: 'WEB_APP',
    url: 'https://northwind.example/',
    finalUrl: 'https://northwind.example/',
    html,
    headers: HEADERS,
    status: 200,
    bytes: Buffer.byteLength(html),
    producedAt: FIXED_TIME,
    ...overrides,
  })

// ------------------------------------------------------------------ evidence

describe('rea: the evidence contract cannot be bypassed', () => {
  it('clamps a finding to the authority of its evidence', () => {
    assert.equal(clampAuthority('OBSERVED', 'INFERRED'), 'INFERRED')
    assert.equal(clampAuthority('OBSERVED', 'OBSERVED'), 'OBSERVED')
    assert.equal(clampAuthority('INFERRED', 'OBSERVED'), 'INFERRED')
    assert.equal(clampAuthority('DECLARED', 'UNKNOWN'), 'UNKNOWN')
  })

  it('demotes an OBSERVED finding that cites no signal, and says so', () => {
    const record = buildEvidence({
      producer: 'test',
      target: { kind: 'WEBSITE', identifier: 'https://x.example/', digest: null },
      normalizedResult: {},
      findings: [{ id: 'f1', area: 'x', title: 'uncited claim', detail: 'd', authority: 'OBSERVED', signals: [], confidence: 1 }],
      coverage: coverageOf(1, 1),
      limitations: [],
      unknowns: [],
    })
    assert.equal(record.normalizedResult.findings[0].authority, 'UNKNOWN')
    assert.ok(record.limitations.some((l) => l.code === 'finding.uncited'))
  })

  it('attaches a limitation whenever a finding is INFERRED', () => {
    const record = buildEvidence({
      producer: 'test',
      target: { kind: 'WEBSITE', identifier: 'https://x.example/', digest: null },
      normalizedResult: {},
      findings: [{ id: 'f1', area: 'x', title: 'guess', detail: 'd', authority: 'INFERRED', signals: ['pattern'], confidence: 0.9 }],
      coverage: coverageOf(1, 1),
      limitations: [],
      unknowns: [],
    })
    assert.ok(record.limitations.some((l) => l.code === 'authority.inferred'))
    // Confidence is capped by authority: an inference cannot read as certain.
    assert.ok(record.normalizedResult.findings[0].confidence <= 1 / 3 + 0.001)
  })

  it('reports zero coverage rather than hiding it', () => {
    const record = buildEvidence({
      producer: 'test',
      target: { kind: 'WEBSITE', identifier: 'https://x.example/', digest: null },
      normalizedResult: {},
      findings: [],
      coverage: coverageOf(0, 5, 'fetch failed'),
      limitations: [],
      unknowns: [],
    })
    assert.equal(record.coverage.complete, false)
    assert.equal(record.coverage.observed, 0)
    assert.equal(record.coverage.admitted, 5)
    assert.equal(record.authority, 'UNKNOWN')
  })
})

// ------------------------------------------------------------------ fingerprints

describe('rea: fingerprints cite their evidence', () => {
  const prints = fingerprint({
    html: RICH_HTML,
    headers: HEADERS,
    resources: ['/_next/static/chunks/main-abc123.js', 'https://js.stripe.com/v3/', 'https://www.googletagmanager.com/gtag/js'],
  })

  it('detects the stack that is genuinely present', () => {
    const labels = prints.map((p) => p.label)
    for (const expected of ['Next.js', 'Stripe', 'Google Analytics 4', 'Vercel', 'HSTS enabled', 'YouTube embed', 'PWA manifest']) {
      assert.ok(labels.includes(expected), `expected ${expected} in ${labels.join(', ')}`)
    }
  })

  it('gives every fingerprint a signal AND a source', () => {
    for (const p of prints) {
      assert.ok(p.signal.length > 0, `${p.label} has no cited signal`)
      assert.ok(p.source.length > 0, `${p.label} has no source`)
      assert.ok(['OBSERVED', 'DECLARED', 'INFERRED', 'UNKNOWN'].includes(p.authority))
      assert.ok(p.confidence > 0 && p.confidence <= 1)
    }
  })

  it('keeps a meta generator as DECLARED, never OBSERVED', () => {
    const prints = fingerprint({
      html: '<meta name="generator" content="WordPress 6.7">',
      headers: [],
      resources: [],
    })
    // A generator tag is the site talking about itself. wp-content paths are
    // artifacts only that CMS emits. With only the tag present, the OBSERVED
    // WordPress fingerprint must NOT fire.
    assert.equal(prints.find((p) => p.label === 'WordPress'), undefined)
    const declared = prints.find((p) => p.label === 'WordPress (self-declared)')
    assert.equal(declared?.authority, 'DECLARED')
    // The citation is the claim itself, so a reviewer can check it.
    assert.ok(declared?.signal.includes('WordPress 6.7'), `cites the declared value, got: ${declared?.signal}`)
    const generic = prints.find((p) => p.id === 'generator-meta')
    assert.equal(generic?.authority, 'DECLARED')
    assert.ok(generic?.caveat?.includes('Not proof'))

    // With a real artifact present, the OBSERVED fingerprint fires too.
    const withArtifact = fingerprint({
      html: '<link rel="stylesheet" href="/wp-content/themes/x/style.css">',
      headers: [],
      resources: [],
    })
    assert.equal(withArtifact.find((p) => p.label === 'WordPress')?.authority, 'OBSERVED')
  })

  it('treats an x-generator header as a declaration', () => {
    const prints = fingerprint({
      html: '<html><body>x</body></html>',
      headers: [['x-generator', 'Hugo 0.121']],
      resources: [],
    })
    const hugo = prints.find((p) => p.label === 'Hugo')
    assert.equal(hugo?.authority, 'DECLARED')
    assert.ok(hugo?.signal.includes('Hugo 0.121'))
  })

  it('does not fingerprint ordinary English prose', () => {
    const prose = fingerprint({ html: PROSE_HTML, headers: [], resources: [] })
    const labels = prose.map((p) => p.label)
    for (const falsePositive of ['Microsoft Clarity', 'Plausible', 'Amplitude', 'Mixpanel', 'Remix / React Router', 'Segment', 'Moment.js']) {
      assert.ok(!labels.includes(falsePositive), `false positive: ${falsePositive} matched prose`)
    }
  })

  it('is deterministic for the same capture', () => {
    const again = fingerprint({
      html: RICH_HTML,
      headers: HEADERS,
      resources: ['/_next/static/chunks/main-abc123.js', 'https://js.stripe.com/v3/', 'https://www.googletagmanager.com/gtag/js'],
    })
    assert.deepEqual(again.map((p) => [p.id, p.authority, p.confidence]), prints.map((p) => [p.id, p.authority, p.confidence]))
  })

  it('downgrades a match found only inside bundle text to INFERRED', () => {
    const only = fingerprint({
      html: '<html><body><p>plain page</p></body></html>',
      headers: [],
      resources: [],
      bodyText: 'var x = "connect.facebook.net/en_US/fbevents.js";',
    })
    const pixel = only.find((p) => p.id === 'meta-pixel')
    assert.equal(pixel?.authority, 'INFERRED')
    assert.ok(pixel?.caveat?.includes('bundle text'), 'explains why it is weaker')
  })

  it('publishes a finite catalogue size so the teardown can state its bounds', () => {
    assert.ok(FINGERPRINT_CATALOGUE_SIZE > 50)
    assert.ok(Number.isInteger(FINGERPRINT_CATALOGUE_SIZE))
  })
})

// ------------------------------------------------------------------ documents

describe('rea: document analysis', () => {
  const analysis = analyzeDocument(RICH_HTML, 'https://northwind.example/')

  it('extracts the real structure', () => {
    assert.equal(analysis.structure.title, 'Northwind — Pipeline Software for Sales Teams')
    assert.equal(analysis.structure.lang, 'en')
    assert.equal(analysis.structure.canonical, 'https://northwind.example/')
    assert.equal(analysis.structure.forms.length, 2)
    assert.equal(analysis.structure.forms[0].method, 'POST')
    assert.equal(analysis.structure.forms[0].action, '/api/leads')
    assert.deepEqual(analysis.structure.forms[0].fields.map((f) => f.name), ['email', 'company', 'notes'])
    assert.ok(analysis.structure.internalLinks.length >= 8)
    assert.equal(analysis.structure.iframes.length, 1)
    assert.equal(analysis.structure.structuredData[0].type, 'Organization')
  })

  it('counts the accessibility gaps that static markup can prove', () => {
    assert.equal(analysis.structure.a11y.imagesMissingAlt, 1, 'one img has no alt attribute')
    assert.equal(analysis.structure.a11y.landmarks.main, 1)
    assert.equal(analysis.structure.a11y.landmarks.nav, 1)
    assert.equal(analysis.structure.a11y.landmarks.footer, 1)
    assert.equal(analysis.structure.a11y.langDeclared, true)
  })

  it('classifies a server-rendered document as hydrated, with signals', () => {
    assert.equal(analysis.structure.renderModel.model, 'HYDRIDATED')
    assert.ok(analysis.structure.renderModel.signals.length >= 2)
    assert.ok(analysis.structure.renderModel.confidence > 0)
  })

  it('classifies a client-rendered shell as SPA_SHELL', () => {
    const spa = analyzeDocument(SPA_HTML, 'https://app.example/')
    assert.equal(spa.structure.renderModel.model, 'SPA_SHELL')
    assert.ok(spa.structure.renderModel.signals.some((s) => /Empty mount node/.test(s)))
    assert.ok(spa.structure.wordCount < 20)
  })

  it('reports truncation instead of silently analysing a prefix', () => {
    const huge = `<html><body>${'<p>word</p>'.repeat(3000)}${'<a href="/p">x</a>'.repeat(900)}</body></html>`
    const result = analyzeDocument(huge, 'https://x.example/')
    assert.equal(result.bounds.truncated, true)
    assert.ok(result.bounds.truncatedBy.some((t) => /links capped/.test(t)))
    assert.ok(result.structure.links.length <= 400)
  })
})

// ------------------------------------------------------------------ inference

describe('rea: routes and endpoints stay candidates', () => {
  const routes = inferRoutes({
    origin: 'https://northwind.example',
    internalLinks: [
      { href: '/pricing', text: 'Pricing', area: 'nav' },
      { href: '/blog', text: 'Blog', area: 'nav' },
      { href: '/logo.png', text: '', area: 'body' },
    ],
    sitemapLocs: ['https://northwind.example/about'],
    bundleText: 'const p = "/dashboard/settings"; fetch("/api/v1/folders"); "/static/x.js"',
  })

  it('admits real paths and rejects asset noise', () => {
    const paths = routes.candidates.map((c) => c.path)
    assert.ok(paths.includes('/pricing'))
    assert.ok(paths.includes('/about'))
    assert.ok(paths.includes('/dashboard/settings'))
    assert.ok(!paths.includes('/logo.png'), 'assets are not routes')
    assert.ok(!paths.includes('/static/x.js'), 'build artifacts are not routes')
  })

  it('labels anchors OBSERVED and bundle literals INFERRED', () => {
    const anchor = routes.candidates.find((c) => c.path === '/pricing')
    const literal = routes.candidates.find((c) => c.path === '/dashboard/settings')
    assert.equal(anchor?.authority, 'OBSERVED')
    assert.equal(anchor?.basis, 'anchor')
    assert.equal(literal?.authority, 'INFERRED')
    assert.equal(literal?.basis, 'bundle-literal')
    assert.ok(literal!.confidence < anchor!.confidence)
  })

  it('always denies completeness, unconditionally', () => {
    assert.ok(routes.completeness.length >= 3)
    assert.ok(routes.completeness.some((c) => /CANDIDATES, not routes/i.test(c)))
    assert.ok(routes.completeness.some((c) => /not the application route table/i.test(c)))
    // Even an empty result must carry the denial.
    const empty = inferRoutes({ origin: null, internalLinks: [] })
    assert.ok(empty.completeness.length >= 3)
  })

  it('caps bundle-literal candidates separately so they cannot crowd out anchors', () => {
    const noisy = inferRoutes({
      origin: 'https://x.example',
      internalLinks: [{ href: '/real', text: 'Real', area: 'nav' }],
      bundleText: Array.from({ length: 400 }, (_, i) => `"/page${i}"`).join(' '),
    })
    assert.ok(noisy.coverage.truncatedBy.some((t) => /bundle-literal candidates capped/.test(t)))
    assert.ok(noisy.candidates.some((c) => c.path === '/real'))
  })

  it('supersedes an UNKNOWN-method endpoint with an explicit verb for the same path', () => {
    const endpoints = inferEndpoints({
      origin: 'https://northwind.example',
      forms: [{ action: '/api/auth/login', method: 'POST' }],
      bundleText: 'fetch("/api/auth/login"); axios.post("/api/v1/folders")',
    })
    const login = endpoints.candidates.filter((c) => c.path === '/api/auth/login')
    assert.equal(login.length, 1, 'the same path must not appear twice with UNKNOWN and POST')
    assert.equal(login[0].method, 'POST')
    assert.equal(login[0].authority, 'OBSERVED')
  })

  it('states that no request was ever sent to a candidate endpoint', () => {
    const endpoints = inferEndpoints({ origin: null, forms: [], bundleText: 'fetch("/api/x")' })
    assert.ok(endpoints.completeness.some((c) => /No request was sent/i.test(c)))
  })
})

// ------------------------------------------------------------------ teardown

describe('rea: the teardown', () => {
  const teardown = teardownOf(RICH_HTML, { question: 'How does their lead capture work?' })

  it('is deterministic for the same capture', () => {
    const again = teardownOf(RICH_HTML, { question: 'How does their lead capture work?' })
    assert.equal(again.evidence.evidenceId, teardown.evidence.evidenceId)
    assert.equal(again.markdown, teardown.markdown)
    assert.equal(again.spoken, teardown.spoken)
    assert.equal(again.report.summaryLine, teardown.report.summaryLine)
    assert.equal(again.evidence.producedAt, teardown.evidence.producedAt)
  })

  it('content-binds the evidence id, so different bytes never share one', () => {
    const other = teardownOf(RICH_HTML.replace('Northwind', 'Southwind'), { question: 'How does their lead capture work?' })
    assert.notEqual(other.evidence.evidenceId, teardown.evidence.evidenceId)
    assert.ok(/^ev_[0-9a-f]{8}$/.test(teardown.evidence.evidenceId))
  })

  it('reports a digest mismatch instead of trusting the supplied digest', () => {
    const wrong = teardownOf(RICH_HTML, { digest: 'deadbeef'.repeat(8) })
    assert.ok(wrong.evidence.limitations.some((l) => l.code === 'digest.mismatch'))
    // The id is bound to the computed digest, not the wrong one supplied.
    assert.equal(wrong.evidence.evidenceId, teardown.evidence.evidenceId)
  })

  it('accepts a correct digest without complaint', () => {
    assert.equal(teardown.evidence.target.digest?.length, 64)
    assert.ok(!teardown.evidence.limitations.some((l) => l.code === 'digest.mismatch'))
  })

  it('quotes the operator question verbatim', () => {
    assert.equal(teardown.report.question, 'How does their lead capture work?')
    assert.ok(teardown.spoken.includes('How does their lead capture work?'))
  })

  it('carries the static-only limitation in every teardown', () => {
    const codes = teardown.evidence.limitations.map((l) => l.code)
    assert.ok(codes.includes('engine.no-browser'))
    assert.ok(codes.includes('engine.no-native'))
    assert.ok(codes.includes('engine.no-execution'))
    assert.ok(codes.includes('coverage.single-document'))
  })

  it('records the unknowns a browser or backend access would resolve', () => {
    const ids = teardown.evidence.unknowns.map((u) => u.id)
    for (const expected of ['u-runtime-dom', 'u-runtime-network', 'u-route-table', 'u-auth-model', 'u-data-model', 'u-backend-stack']) {
      assert.ok(ids.includes(expected), `missing unknown ${expected}`)
    }
    for (const u of teardown.evidence.unknowns) {
      assert.ok(u.authorityRequired.length > 10, 'each unknown names what would resolve it')
    }
  })

  it('adds the SPA caveat and a leading unknown for a client-rendered shell', () => {
    const spa = teardownOf(SPA_HTML)
    assert.ok(spa.evidence.limitations.some((l) => l.code === 'render.spa-shell'))
    assert.equal(spa.evidence.unknowns[0].id, 'u-spa-content')
    assert.ok(spa.spoken.includes('client rendered shell'), 'the spoken script warns the listener too')
    assert.ok(spa.report.verdict.includes('client-rendered shell'))
  })

  it('reports an error page as an error page, not as the product', () => {
    const failed = teardownOf('<html><body><h1>500 Internal Server Error</h1></body></html>', { status: 500 })
    assert.ok(failed.evidence.limitations.some((l) => l.code === 'capture.error-status'))
    assert.ok(failed.report.verdict.includes('500'))
    assert.ok(failed.report.verdict.includes('error page'))
  })

  it('reads its own limitations aloud in the spoken script', () => {
    assert.ok(teardown.spoken.includes('could not determine'))
    assert.ok(teardown.spoken.includes('candidates only'))
    assert.ok(/Evidence id ev_[0-9a-f]{8}/.test(teardown.spoken), 'quotes the evidence id')
    // The spoken script must never present an inference as proof.
    assert.ok(!/I can prove these technologies[^.]*Tailwind/.test(teardown.spoken))
  })

  it('bounds the spoken script so a voice surface can actually speak it', () => {
    assert.ok(teardown.spoken.length <= 3800)
    const long = teardownOf(RICH_HTML + '<p>filler</p>'.repeat(5000))
    assert.ok(long.spoken.length <= 3800)
  })

  it('emits markdown with an authority column for every observation', () => {
    assert.ok(teardown.markdown.includes('| Observation | Authority | Signal |'))
    assert.ok(teardown.markdown.includes('## Limitations'))
    assert.ok(teardown.markdown.includes('## Open unknowns'))
    assert.ok(teardown.markdown.includes('No JavaScript was executed'))
  })

  it('propagates the capture limitations it was given', () => {
    const withCapture = teardownOf(RICH_HTML, {
      captureLimitations: [{ code: 'document.truncated', detail: 'capped at 2 MiB' }],
    })
    assert.ok(withCapture.evidence.limitations.some((l) => l.code === 'document.truncated'))
  })
})

// ------------------------------------------------------------------ reconstruction

describe('rea: reconstruction derives an original brief', () => {
  const report = teardownOf(RICH_HTML).report
  const reconstruction = planReconstruction({
    report,
    evidenceId: report.evidenceId,
    capturedAt: '2026-11-02T00:00:00.000Z',
    operator: { appName: 'Meridian Client Hub', clientName: 'Internal', primaryColor: '#123456', currency: 'bd' },
  })

  it('uses the operator name and colour, never the target’s', () => {
    assert.equal(reconstruction.brief.appName, 'Meridian Client Hub')
    assert.equal(reconstruction.brief.primaryColor, '#123456')
    assert.equal(reconstruction.brief.currency, 'BD')
    // The brief is what GENERATES the app, and generated documents can reach a
    // client — so the target's brand must not appear anywhere in it.
    assert.ok(!JSON.stringify(reconstruction.brief).toLowerCase().includes('northwind'), 'the target brand must not leak into the brief')
    // Lineage still records it, because that record is internal.
    assert.ok(reconstruction.provenance.targetUrl.toLowerCase().includes('northwind'), 'internal lineage keeps the target identity')
  })

  it('derives modules from the observed information architecture', () => {
    const modules = reconstruction.brief.modules
    assert.ok(modules.includes('leads'), 'a lead form was observed')
    assert.ok(modules.includes('newsletter'), 'a subscribe form was observed')
    assert.ok(modules.includes('content'), 'a /blog route was observed')
    assert.ok(modules.includes('knowledge'), 'a /docs route was observed')
    assert.ok(modules.includes('portal'), 'a /login link was observed')
    assert.ok(modules.includes('payments'), 'a /pricing route was observed')
    assert.ok(modules.includes('reviews'), 'a testimonials section was observed')
  })

  it('picks a vertical from vocabulary rather than defaulting blindly', () => {
    assert.equal(reconstruction.brief.vertical, 'crm')
    assert.ok(reconstruction.provenance.derived.some((d) => d.decision.includes('vertical')))
  })

  it('records every decision with the observation behind it', () => {
    assert.ok(reconstruction.provenance.derived.length >= 5)
    for (const d of reconstruction.provenance.derived) {
      assert.ok(d.from.length > 10, `${d.decision} must say what it came from`)
      assert.ok(['OBSERVED', 'DECLARED', 'INFERRED', 'UNKNOWN'].includes(d.authority))
    }
  })

  it('lists what was refused, and never returns an empty refusal list', () => {
    assert.ok(reconstruction.provenance.copied.length >= NEVER_COPIED_COUNT)
    const joined = reconstruction.provenance.copied.join(' ').toLowerCase()
    for (const forbidden of ['prose', 'images', 'brand', 'javascript', 'colour', 'credential', 'source']) {
      assert.ok(joined.includes(forbidden), `the refusal list must name ${forbidden}`)
    }
  })

  it('lists what cannot be reconstructed at all', () => {
    const joined = reconstruction.provenance.notReconstructable.join(' ').toLowerCase()
    assert.ok(joined.includes('backend'))
    assert.ok(joined.includes('authentication'))
    assert.ok(joined.includes('visual design'))
  })

  it('derives original pages from nav labels and route prefixes', () => {
    const paths = reconstruction.pages.map((p) => p.path)
    assert.ok(paths.includes('/'))
    assert.ok(paths.includes('/pricing'))
    assert.ok(paths.includes('/blog'))
    // Build artifacts never become pages.
    assert.ok(!paths.some((p) => /_next|wp-|cdn-cgi/.test(p)))
    for (const page of reconstruction.pages) {
      assert.ok(page.purpose.length > 20)
    }
  })

  it('caps confidence below certainty and states the provenance', () => {
    assert.ok(reconstruction.confidence > 0 && reconstruction.confidence <= 0.85)
    assert.equal(reconstruction.provenance.evidenceId, report.evidenceId)
    assert.ok(reconstruction.statement.includes('ORIGINAL'))
    assert.ok(reconstruction.statement.includes('not a clone'))
  })

  it('is deterministic', () => {
    const again = planReconstruction({
      report,
      evidenceId: report.evidenceId,
      capturedAt: '2026-11-02T00:00:00.000Z',
      operator: { appName: 'Meridian Client Hub', clientName: 'Internal', primaryColor: '#123456', currency: 'bd' },
    })
    assert.deepEqual(again.brief, reconstruction.brief)
    assert.deepEqual(again.pages, reconstruction.pages)
    assert.equal(again.confidence, reconstruction.confidence)
  })

  it('falls back to a usable brief when the target revealed almost nothing', () => {
    const sparse = teardownOf('<html><head><title>x</title></head><body><div id="root"></div></body></html>').report
    const result = planReconstruction({
      report: sparse,
      evidenceId: 'ev_test',
      capturedAt: '2026-11-02T00:00:00.000Z',
      operator: { appName: 'Blank Slate', clientName: 'Internal' },
    })
    assert.ok(result.brief.modules.length >= 2)
    assert.ok(result.brief.appName === 'Blank Slate')
    assert.ok(result.confidence <= 0.5, 'a sparse capture must not produce a confident brief')
    assert.ok(result.provenance.derived.some((d) => d.authority === 'UNKNOWN'))
  })

  it('publishes a clone refusal that names the legal exposure', () => {
    assert.ok(CLONE_REFUSAL.includes('will not reproduce'))
    assert.ok(CLONE_REFUSAL.includes('infringe'))
  })
})
