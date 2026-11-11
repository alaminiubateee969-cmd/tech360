/**
 * TECH360 — REA Studio: static fingerprints
 * ==========================================
 * Upstream REA's `analyze_web_bundle` derives "vendor fingerprints" from script
 * artifacts without executing them. This module is the same idea applied to
 * what a hosted server can actually see: the HTML document, its response
 * headers, and the URLs/text of the scripts and stylesheets it links.
 *
 * The non-negotiable rule here is CITATION. A fingerprint never returns a
 * bare label like "Next.js". It returns the label plus the literal signal
 * that produced it (`__NEXT_DATA__`, `x-powered-by: Next.js`,
 * `/_next/static/…`) plus an authority level. An operator reading the teardown
 * must be able to check every claim against the capture in one glance.
 *
 * Pure and deterministic: same inputs → same fingerprints, in the same order.
 */
import { clampAuthority, type EvidenceAuthority } from './evidence'

export type FingerprintCategory =
  | 'framework'
  | 'library'
  | 'styling'
  | 'ui_kit'
  | 'cms'
  | 'commerce'
  | 'hosting'
  | 'analytics'
  | 'ads'
  | 'tag_manager'
  | 'chat'
  | 'payments'
  | 'auth'
  | 'forms'
  | 'media'
  | 'maps'
  | 'social'
  | 'security'
  | 'feature'
  | 'language'

export type Fingerprint = {
  id: string
  label: string
  category: FingerprintCategory
  /** What was seen, verbatim, so the claim is checkable. */
  signal: string
  /** Where it was seen: `html`, `header:<name>`, `script:<url>`, `body`. */
  source: string
  authority: EvidenceAuthority
  confidence: number
  /** What this fingerprint does NOT prove. */
  caveat?: string
  version?: string | null
}

type Signal = {
  id: string
  label: string
  category: FingerprintCategory
  /** Matched against the lowercased HTML text. */
  html?: RegExp
  /** Matched against `name: value` header strings, lowercased name. */
  header?: { name: string; value?: RegExp }
  /** Matched against absolute/relative subresource URLs. */
  resource?: RegExp
  /** Authority this signal can support at best. */
  authority: EvidenceAuthority
  confidence: number
  caveat?: string
  /** Capture a version when the signal carries one. */
  version?: RegExp
}

/**
 * The catalogue. Ordered: framework first, then the layers on top of it, then
 * third parties. `authority` is the ceiling — a meta generator tag is a
 * DECLARATION (the site said it about itself), a build-artifact path like
 * `/_next/static/` is an OBSERVATION (only that toolchain emits it).
 */
const SIGNALS: Signal[] = [
  // ---------------- frameworks ----------------
  { id: 'next', label: 'Next.js', category: 'framework', html: /__next_data__|\/_next\/static\/|next\.config|__next_f\b/, resource: /\/_next\/(static|image|data)\//, authority: 'OBSERVED', confidence: 0.97, caveat: 'Proves the React App Router/Pages build artifacts, not the rendering mode (SSR/SSG/ISR) or the version.' },
  { id: 'nuxt', label: 'Nuxt', category: 'framework', html: /__nuxt__|id="__nuxt"|\/_nuxt\//, resource: /\/_nuxt\//, authority: 'OBSERVED', confidence: 0.96 },
  { id: 'remix', label: 'Remix / React Router', category: 'framework', html: /__remixcontext|\/build\/_shared\/|remix\.route|@remix-run/i, resource: /\/build\/_shared\//, authority: 'OBSERVED', confidence: 0.85 },
  { id: 'sveltekit', label: 'SvelteKit', category: 'framework', html: /__sveltekit|sveltekit|data-sveltekit/, resource: /_app\/immutable\//, authority: 'OBSERVED', confidence: 0.93 },
  { id: 'astro', label: 'Astro', category: 'framework', html: /astro-island|data-astro-|generator["']?\s*content=["']astro/, authority: 'OBSERVED', confidence: 0.94 },
  { id: 'angular', label: 'Angular', category: 'framework', html: /ng-version=|ng-app|_ngcontent-/, authority: 'OBSERVED', confidence: 0.95 },
  { id: 'vue', label: 'Vue', category: 'framework', html: /data-v-[0-9a-f]{8}|__vue__|vue\.runtime|vue@/, resource: /vue(\.runtime)?(\.min)?\.js|\/vue\//, authority: 'OBSERVED', confidence: 0.85 },
  { id: 'react', label: 'React', category: 'framework', html: /data-reactroot|data-reactid|react-dom|__react_container|react\.production\.min\.js/, resource: /react(-dom)?(\.production|\.development)?(\.min)?\.js/, authority: 'OBSERVED', confidence: 0.9, caveat: 'React may be present as a dependency of a framework; this does not establish which one owns the page.' },
  { id: 'gatsby', label: 'Gatsby', category: 'framework', html: /___gatsby|gatsby-/, authority: 'OBSERVED', confidence: 0.95 },
  // A generator meta tag / x-generator header is the site describing ITSELF.
  // It is reported at DECLARED authority, with the literal it declared, and never
  // promoted to OBSERVED — a page can claim any generator it likes.
  { id: 'generator-meta', label: 'Self-declared generator', category: 'cms', html: /<meta\b[^>]*name\s*=\s*["']generator["'][^>]*>/, authority: 'DECLARED', confidence: 0.7, caveat: 'Whatever the document says about itself. Not proof of the actual toolchain; a hand-written page can declare any generator.' },
  { id: 'wordpress', label: 'WordPress', category: 'cms', html: /wp-content\/|wp-includes\/|wp-json\/|wp-json\b/, resource: /wp-(content|includes|json)\//, authority: 'OBSERVED', confidence: 0.97, caveat: 'Build-artifact paths only. A generator meta tag on its own is reported separately as a declaration.' },
  { id: 'drupal', label: 'Drupal', category: 'cms', html: /drupalsettings|sites\/default\/files|data-drupal-/, authority: 'OBSERVED', confidence: 0.9 },
  { id: 'hugo', label: 'Hugo', category: 'framework', header: { name: 'x-generator', value: /hugo/i }, html: /generator["']?\s*content=["']hugo/i, authority: 'DECLARED', confidence: 0.8 },
  { id: 'jekyll', label: 'Jekyll', category: 'framework', header: { name: 'x-generator', value: /jekyll/i }, html: /generator["']?\s*content=["']jekyll/i, authority: 'DECLARED', confidence: 0.75 },
  { id: 'wordpress-declared', label: 'WordPress (self-declared)', category: 'cms', html: /generator["']?\s*content=["']wordpress/i, authority: 'DECLARED', confidence: 0.75, caveat: 'The document declared this about itself. Only wp-content/wp-includes/wp-json artifacts are OBSERVED proof.' },
  { id: 'webflow-declared', label: 'Webflow (self-declared)', category: 'cms', html: /generator["']?\s*content=["']webflow/i, authority: 'DECLARED', confidence: 0.7 },
  { id: 'shopify', label: 'Shopify', category: 'commerce', html: /cdn\.shopify\.com|shopify\.theme|shopify-section|\/cart\/add\.js/, resource: /cdn\.shopify\.com/, authority: 'OBSERVED', confidence: 0.97 },
  { id: 'woocommerce', label: 'WooCommerce', category: 'commerce', html: /woocommerce|wp-content\/plugins\/woocommerce/, authority: 'OBSERVED', confidence: 0.93 },
  { id: 'webflow', label: 'Webflow', category: 'cms', html: /webflow\.com|w-nav|data-w-id/, authority: 'OBSERVED', confidence: 0.94 },
  { id: 'framer', label: 'Framer', category: 'cms', html: /framerusercontent\.com|data-framer-|framer\.com/, authority: 'OBSERVED', confidence: 0.94 },
  { id: 'wix', label: 'Wix', category: 'cms', html: /static\.parastorage\.com|wix\.com|warmupdata/, authority: 'OBSERVED', confidence: 0.94 },
  { id: 'squarespace', label: 'Squarespace', category: 'cms', html: /squarespace\.com|static1\.squarespace/, authority: 'OBSERVED', confidence: 0.94 },

  // ---------------- libraries ----------------
  { id: 'jquery', label: 'jQuery', category: 'library', html: /jquery(\.min)?\.js|jquery-[\d.]+/, resource: /jquery(\.min)?\.js/i, authority: 'OBSERVED', confidence: 0.93 },
  { id: 'alpine', label: 'Alpine.js', category: 'library', html: /x-data=|alpinejs|alpine\.min\.js/, authority: 'OBSERVED', confidence: 0.92 },
  { id: 'htmx', label: 'htmx', category: 'library', html: /hx-get=|hx-post=|htmx(\.min)?\.js/, authority: 'OBSERVED', confidence: 0.94 },
  { id: 'gsap', label: 'GSAP', category: 'library', html: /gsap(\.min)?\.js|cdnjs\.cloudflare\.com\/ajax\/libs\/gsap/, authority: 'OBSERVED', confidence: 0.9 },
  { id: 'threejs', label: 'Three.js', category: 'library', html: /three(\.min)?\.js|three\/build\/three\.module/, authority: 'OBSERVED', confidence: 0.88 },
  { id: 'lodash', label: 'Lodash', category: 'library', resource: /lodash(\.min)?\.js/i, authority: 'OBSERVED', confidence: 0.85 },
  { id: 'moment', label: 'Moment.js', category: 'library', resource: /moment(\.min)?\.js/i, authority: 'OBSERVED', confidence: 0.85 },
  { id: 'axios', label: 'Axios', category: 'library', html: /axios(\.min)?\.js/, authority: 'OBSERVED', confidence: 0.8 },
  { id: 'tanstack-query', label: 'TanStack Query', category: 'library', html: /react-query|tanstack\/query/, authority: 'INFERRED', confidence: 0.5 },
  { id: 'framer-motion', label: 'Framer Motion', category: 'library', html: /framer-motion/, resource: /framer-motion/, authority: 'OBSERVED', confidence: 0.8 },
  { id: 'typescript', label: 'TypeScript build', category: 'language', html: /sourceMappingurl=.*\.js\.map|\.d\.ts\b/, authority: 'INFERRED', confidence: 0.5, caveat: 'Source-map references suggest a compiled bundle; they do not prove TypeScript specifically.' },

  // ---------------- styling / UI ----------------
  { id: 'tailwind', label: 'Tailwind CSS', category: 'styling', html: /tailwindcss|class="[^"]*\b(?:flex|grid|sm:|md:|lg:|text-\w+-\d{3}|bg-\w+-\d{3})\b/, resource: /tailwind/i, authority: 'INFERRED', confidence: 0.7, caveat: 'Utility-class patterns are strong but not unique to Tailwind; a hand-written utility CSS would look identical.' },
  { id: 'bootstrap', label: 'Bootstrap', category: 'styling', html: /bootstrap(\.min)?\.(css|js|bundle)|class="[^"]*\b(?:container|row|col-(?:sm|md|lg)-\d+)\b/, resource: /bootstrap/i, authority: 'OBSERVED', confidence: 0.9 },
  { id: 'radix', label: 'Radix UI', category: 'ui_kit', html: /data-radix-|radix-ui/, resource: /radix/i, authority: 'OBSERVED', confidence: 0.9 },
  { id: 'shadcn', label: 'shadcn/ui', category: 'ui_kit', html: /data-slot=|--radius:|clsx.*tailwind-merge|class="[^"]*\bcn\(/, authority: 'INFERRED', confidence: 0.6, caveat: 'shadcn/ui is copied into a project, not linked, so it can only be inferred from its data-slot/radius conventions.' },
  { id: 'mui', label: 'MUI (Material UI)', category: 'ui_kit', html: /mui-|@mui\/material|makestyles/, authority: 'OBSERVED', confidence: 0.85 },
  { id: 'antd', label: 'Ant Design', category: 'ui_kit', html: /ant-(btn|layout|table|design)|antd/, authority: 'OBSERVED', confidence: 0.9 },
  { id: 'materialize', label: 'Materialize', category: 'ui_kit', resource: /materialize(\.min)?\.(css|js)/i, authority: 'OBSERVED', confidence: 0.88 },
  { id: 'fontawesome', label: 'Font Awesome', category: 'media', html: /font-awesome|fontawesome|fa-(solid|regular|brands)\b/, authority: 'OBSERVED', confidence: 0.9 },
  { id: 'lucide', label: 'Lucide icons', category: 'media', html: /lucide-(static|icons|react)|unpkg\.com\/lucide|data-lucide=/i, resource: /lucide/i, authority: 'OBSERVED', confidence: 0.85 },
  { id: 'googlefonts', label: 'Google Fonts', category: 'media', resource: /fonts\.(googleapis|gstatic)\.com/i, authority: 'OBSERVED', confidence: 0.95 },

  // ---------------- hosting / CDN / security ----------------
  { id: 'cloudflare', label: 'Cloudflare', category: 'hosting', header: { name: 'server', value: /^cloudflare/i }, authority: 'OBSERVED', confidence: 0.95 },
  { id: 'vercel', label: 'Vercel', category: 'hosting', header: { name: 'server', value: /^vercel/i }, authority: 'OBSERVED', confidence: 0.95 },
  { id: 'netlify', label: 'Netlify', category: 'hosting', header: { name: 'server', value: /^netlify/i }, authority: 'OBSERVED', confidence: 0.95 },
  { id: 'aws-s3', label: 'AWS S3 / CloudFront', category: 'hosting', header: { name: 'server', value: /amazons3|cloudfront/i }, authority: 'OBSERVED', confidence: 0.9 },
  { id: 'github-pages', label: 'GitHub Pages', category: 'hosting', header: { name: 'server', value: /^github\.com/i }, authority: 'OBSERVED', confidence: 0.9 },
  { id: 'nginx', label: 'nginx', category: 'hosting', header: { name: 'server', value: /nginx/i }, authority: 'OBSERVED', confidence: 0.85, caveat: 'Reports the edge server header, which a CDN or proxy may set on behalf of the origin.' },
  { id: 'apache', label: 'Apache', category: 'hosting', header: { name: 'server', value: /apache/i }, authority: 'OBSERVED', confidence: 0.85 },
  { id: 'caddy', label: 'Caddy', category: 'hosting', header: { name: 'server', value: /^caddy/i }, authority: 'OBSERVED', confidence: 0.9 },
  { id: 'hsts', label: 'HSTS enabled', category: 'security', header: { name: 'strict-transport-security', value: /max-age=/ }, authority: 'OBSERVED', confidence: 0.95 },
  { id: 'csp', label: 'Content-Security-Policy present', category: 'security', header: { name: 'content-security-policy' }, authority: 'OBSERVED', confidence: 0.95 },
  { id: 'no-csp', label: 'No Content-Security-Policy header', category: 'security', html: /$^/, authority: 'OBSERVED', confidence: 0.9, caveat: 'Absence in the response headers only. A CSP may still be delivered by a meta tag or an upstream proxy.' },

  // ---------------- analytics / marketing ----------------
  { id: 'ga4', label: 'Google Analytics 4', category: 'analytics', html: /googletagmanager\.com\/gtag\/js|gtag\(|ga-[a-z0-9]{6,}|google-analytics\.com\/analytics\.js/, resource: /googletagmanager\.com|google-analytics\.com/i, authority: 'OBSERVED', confidence: 0.95 },
  { id: 'gtm', label: 'Google Tag Manager', category: 'tag_manager', html: /googletagmanager\.com\/gtm\.js|gtm-[a-z0-9]{4,}/, authority: 'OBSERVED', confidence: 0.95, caveat: 'A GTM container can load any number of further vendors at runtime; only the container itself is observed here.' },
  { id: 'plausible', label: 'Plausible', category: 'analytics', html: /plausible\.io\/js\/|data-domain=["'][^"']+["'][^>]*plausible|plausible\.(io|js)/i, authority: 'OBSERVED', confidence: 0.9 },
  { id: 'mixpanel', label: 'Mixpanel', category: 'analytics', html: /cdn\.mixpanel\.com|mixpanel\.com\/track|mixpanel\.init|mixpanel[_-]?token/i, authority: 'OBSERVED', confidence: 0.88 },
  { id: 'amplitude', label: 'Amplitude', category: 'analytics', html: /cdn\.amplitude\.com|amplitude\.js|amplitude-api|amplitude[_-]?key/i, authority: 'OBSERVED', confidence: 0.88 },
  { id: 'segment', label: 'Segment', category: 'analytics', html: /cdn\.segment\.com|segment\.com\/analytics|analytics\.js\/v1\/|segment\.io/i, authority: 'INFERRED', confidence: 0.6 },
  { id: 'hotjar', label: 'Hotjar', category: 'analytics', html: /static\.hotjar\.com|script\.hotjar\.com|hj\(''|hjid:/i, authority: 'OBSERVED', confidence: 0.9 },
  { id: 'clarity', label: 'Microsoft Clarity', category: 'analytics', html: /clarity\.ms|window\.clarity|clarity[_-]?(config|token)|@clarity/i, authority: 'OBSERVED', confidence: 0.8 },
  { id: 'meta-pixel', label: 'Meta Pixel', category: 'ads', html: /connect\.facebook\.net.*fbevents\.js|fbq\(/, authority: 'OBSERVED', confidence: 0.95 },
  { id: 'google-ads', label: 'Google Ads', category: 'ads', html: /googleadservices\.com|aw-[0-9]{6,}|gtag.*ads/i, authority: 'OBSERVED', confidence: 0.9 },
  { id: 'tiktok-pixel', label: 'TikTok Pixel', category: 'ads', html: /analytics\.tiktok\.com|ttq\./i, authority: 'OBSERVED', confidence: 0.9 },

  // ---------------- chat / support / forms ----------------
  { id: 'intercom', label: 'Intercom', category: 'chat', html: /widget\.intercom\.io|intercomsettings/i, authority: 'OBSERVED', confidence: 0.94 },
  { id: 'crisp', label: 'Crisp', category: 'chat', html: /client\.crisp\.chat|\$crisp\b|crisp\.chat\/l\.js/i, authority: 'OBSERVED', confidence: 0.94 },
  { id: 'zendesk', label: 'Zendesk', category: 'chat', html: /zdassets\.com|zopim|static\.zdassets|zendesk\.(com|net)\/embeddable|zE\(''/i, authority: 'OBSERVED', confidence: 0.9 },
  { id: 'tawk', label: 'Tawk.to', category: 'chat', html: /embed\.tawk\.to|tawk\.to\/|Tawk_API/i, authority: 'OBSERVED', confidence: 0.94 },
  { id: 'tidio', label: 'Tidio', category: 'chat', html: /code\.tidio\.co|tidio\.co\/api|tidioChatApi/i, authority: 'OBSERVED', confidence: 0.94 },
  { id: 'hubspot', label: 'HubSpot', category: 'forms', html: /js\.hs-scripts\.com|hsforms|js\.hsforms\.net|hubspot\.(com|net)\/|_hsq\b/i, authority: 'OBSERVED', confidence: 0.92 },
  { id: 'typeform', label: 'Typeform', category: 'forms', html: /embed\.typeform\.com|form\.typeform\.com|typeform\.com\/to\/|data-tf-/i, authority: 'OBSERVED', confidence: 0.92 },
  { id: 'jotform', label: 'Jotform', category: 'forms', html: /form\.jotform\.com|jotform\.com\/form\/|jotformjs/i, authority: 'OBSERVED', confidence: 0.9 },

  // ---------------- payments / auth ----------------
  { id: 'stripe', label: 'Stripe', category: 'payments', html: /js\.stripe\.com|stripe\.js|checkout\.stripe/i, authority: 'OBSERVED', confidence: 0.95, caveat: 'Proves the client-side integration is loaded, not which payment methods are enabled or that a charge can be taken.' },
  { id: 'paypal', label: 'PayPal', category: 'payments', html: /paypal\.com\/sdk\/js|paypalobjects/i, authority: 'OBSERVED', confidence: 0.95 },
  { id: 'razorpay', label: 'Razorpay', category: 'payments', html: /checkout\.razorpay\.com|razorpay\.(com|js)|new Razorpay\(|rzp[_-]?(id|key)|data-order_id/i, authority: 'OBSERVED', confidence: 0.95 },
  { id: 'sslcommerz', label: 'SSLCommerz', category: 'payments', html: /sslcommerz\.com|sandbox\.sslcommerz|seamless\.epay|gwprocess/i, authority: 'OBSERVED', confidence: 0.9 },
  { id: 'bkash-hint', label: 'bKash / MFS reference', category: 'payments', html: /bkash|nagad|rocket\b/i, authority: 'INFERRED', confidence: 0.4, caveat: 'A word match in page text only. Mobile-financial-service support must be confirmed from the checkout flow, not from copy.' },
  { id: 'auth0', label: 'Auth0', category: 'auth', html: /\.auth0\.com|auth0-lock|auth0\.js|auth0-spa/i, authority: 'OBSERVED', confidence: 0.93 },
  { id: 'clerk', label: 'Clerk', category: 'auth', html: /clerk\./i, authority: 'OBSERVED', confidence: 0.9 },
  { id: 'firebase', label: 'Firebase', category: 'auth', html: /firebaseio\.com|firebasejs\/|firebasestorage/i, authority: 'OBSERVED', confidence: 0.92 },
  { id: 'supabase', label: 'Supabase', category: 'auth', html: /supabase\.(co|in)|@supabase\/|createClient\([^)]*supabase|supabase\.create/i, authority: 'OBSERVED', confidence: 0.9 },

  // ---------------- media / maps / social ----------------
  { id: 'youtube-embed', label: 'YouTube embed', category: 'media', html: /youtube\.com\/embed|youtu\.be\//i, authority: 'OBSERVED', confidence: 0.95 },
  { id: 'vimeo-embed', label: 'Vimeo embed', category: 'media', html: /player\.vimeo\.com/i, authority: 'OBSERVED', confidence: 0.95 },
  { id: 'cloudinary', label: 'Cloudinary', category: 'media', html: /res\.cloudinary\.com/i, authority: 'OBSERVED', confidence: 0.95 },
  { id: 'google-maps', label: 'Google Maps', category: 'maps', html: /maps\.googleapis\.com|maps\.google\.com\/maps\/api/i, authority: 'OBSERVED', confidence: 0.93 },
  { id: 'mapbox', label: 'Mapbox', category: 'maps', html: /api\.mapbox\.com|mapbox-gl/i, authority: 'OBSERVED', confidence: 0.93 },
  { id: 'openai-hint', label: 'OpenAI / LLM surface reference', category: 'feature', html: /openai\.com|api\.openai|chatgpt/i, authority: 'INFERRED', confidence: 0.4, caveat: 'A reference in markup or copy. It does not prove a model call, a key, or a provider — keys are never visible client-side and must not be sought.' },
  { id: 'pwa', label: 'PWA manifest', category: 'feature', html: /rel=["']manifest["']|manifest\.webmanifest|serviceworker/i, authority: 'OBSERVED', confidence: 0.85 },
  { id: 'service-worker', label: 'Service worker registration', category: 'feature', html: /navigator\.serviceworker|serviceworker\.register\(|sw\.js/i, authority: 'INFERRED', confidence: 0.6 },
  { id: 'websocket', label: 'WebSocket usage', category: 'feature', html: /new\s+websocket\(|wss?:\/\//i, authority: 'INFERRED', confidence: 0.6, caveat: 'A static match in bundle text. It does not establish that a socket is opened at runtime, nor to which endpoint.' },
  { id: 'i18n', label: 'Multi-language surface', category: 'feature', html: /hreflang=["']|i18n|locale\/|\/(en|bn|es|fr|de|ar|zh|ja|ko|hi|ur)(\/|["'])/i, authority: 'INFERRED', confidence: 0.55 },
  { id: 'rtl', label: 'RTL layout support', category: 'feature', html: /dir=["']rtl["']|rtl-/i, authority: 'OBSERVED', confidence: 0.85 },
  { id: 'bengali', label: 'Bengali (bn) content present', category: 'language', html: /[\u0980-\u09ff]{3,}/, authority: 'OBSERVED', confidence: 0.9 },
]

export type FingerprintInput = {
  /** The captured HTML, raw (it is lowercased internally for matching). */
  html: string
  /** Response headers as an array of `[name, value]` pairs. */
  headers: Array<[string, string]>
  /** Linked script/stylesheet/other subresource URLs. */
  resources: string[]
  /** Captured body text of subresources, concatenated and bounded. */
  bodyText?: string
}

/**
 * Runs the catalogue over a capture. Deterministic: signals are evaluated in
 * catalogue order and de-duplicated by id, keeping the strongest authority.
 */
export function fingerprint(input: FingerprintInput): Fingerprint[] {
  const html = input.html ?? ''
  const lower = html.toLowerCase()
  const resourceBlob = input.resources.join('\n')
  const bodyText = (input.bodyText ?? '').toLowerCase()
  const headerLines = (input.headers ?? []).map(([n, v]) => [n.toLowerCase(), v] as [string, string])
  const headerNames = new Set(headerLines.map(([n]) => n))

  const found = new Map<string, Fingerprint>()

  const record = (signal: Signal, matched: string, source: string) => {
    const existing = found.get(signal.id)
    const authority = clampAuthority(signal.authority, signal.authority)
    const version = signal.version ? (signal.version.exec(matched)?.[1] ?? null) : null
    const candidate: Fingerprint = {
      id: signal.id,
      label: signal.label,
      category: signal.category,
      signal: matched.slice(0, 200),
      source,
      authority,
      confidence: signal.confidence,
      ...(signal.caveat ? { caveat: signal.caveat } : {}),
      ...(version ? { version } : {}),
    }
    // Keep the strongest citation for a given technology.
    if (!existing || rank(candidate.authority) > rank(existing.authority)) found.set(signal.id, candidate)
  }

  // Locate the generator declarations so a DECLARED signal can cite the whole
  // claim rather than the fragment its regex happened to match. Citing
  // `generator" content="wordpress` proves nothing to a reviewer; citing
  // `meta[name=generator] content="WordPress 6.7"` can be checked in seconds.
  const generatorDeclarations: Array<{ start: number; end: number; citation: string; value: string }> = []
  for (const re of [
    /<meta\b[^>]*name\s*=\s*["']generator["'][^>]*content\s*=\s*["']([^"']{1,120})["'][^>]*>/gi,
    /<meta\b[^>]*content\s*=\s*["']([^"']{1,120})["'][^>]*name\s*=\s*["']generator["'][^>]*>/gi,
  ]) {
    for (const m of html.matchAll(re)) {
      generatorDeclarations.push({
        start: m.index ?? 0,
        end: (m.index ?? 0) + m[0].length,
        value: m[1].trim(),
        citation: `meta[name=generator] content="${m[1].trim()}"`,
      })
    }
  }
  const generatorHeader = headerLines.find(([name]) => name === 'x-generator')
  if (generatorHeader) {
    generatorDeclarations.push({ start: -1, end: -1, value: generatorHeader[1].trim(), citation: `x-generator: ${generatorHeader[1].trim()}` })
  }

  /**
   * If a DECLARED signal matched inside a generator declaration, cite the whole
   * declaration. Otherwise cite the matched fragment as-is.
   */
  const citeDeclared = (signal: Signal, match: RegExpMatchArray & { index?: number }, fallback: string): { citation: string; source: string } => {
    if (signal.authority !== 'DECLARED') return { citation: fallback, source: 'html' }
    const at = match.index ?? -1
    const enclosing = generatorDeclarations.find((d) => at >= d.start && at < d.end)
    if (enclosing) return { citation: enclosing.citation, source: 'html:meta[name=generator]' }
    const byValue = generatorDeclarations.find((d) => d.value && fallback.toLowerCase().includes(d.value.toLowerCase().slice(0, 24)))
    if (byValue) return { citation: byValue.citation, source: byValue.start === -1 ? 'header:x-generator' : 'html:meta[name=generator]' }
    if (signal.header?.name === 'x-generator' && generatorHeader) return { citation: `x-generator: ${generatorHeader[1].trim()}`, source: 'header:x-generator' }
    return { citation: fallback, source: 'html' }
  }

  for (const signal of SIGNALS) {
    // A "negative" signal (no-csp) is expressed as an impossible regex.
    if (signal.id === 'no-csp') {
      if (!headerNames.has('content-security-policy')) {
        record(signal, 'content-security-policy: (absent)', 'header:content-security-policy')
      }
      continue
    }
    if (signal.html) {
      const match = signal.html.exec(lower)
      if (match) {
        const cited = citeDeclared(signal, match, match[0].trim())
        record(signal, cited.citation, cited.source)
      }
    }
    if (signal.header) {
      const hit = headerLines.find(([name]) => name === signal.header!.name)
      if (hit && (!signal.header.value || signal.header.value.test(hit[1]))) {
        record(signal, `${hit[0]}: ${hit[1]}`.trim(), `header:${hit[0]}`)
      }
    }
    if (signal.resource) {
      const match = signal.resource.exec(resourceBlob)
      if (match) record(signal, match[0].trim(), 'resource')
    }
  }

  // Bundle body text is a weaker source: it proves a string shipped, not that
  // the feature runs. Anything found only there is INFERRED.
  if (bodyText) {
    for (const signal of SIGNALS) {
      if (!signal.html || found.has(signal.id)) continue
      const match = signal.html.exec(bodyText)
      if (match) {
        record(
          { ...signal, authority: 'INFERRED', confidence: Math.min(0.6, signal.confidence), caveat: `${signal.caveat ?? ''} Matched inside bundle text, which proves a string shipped, not that the feature executes.`.trim() },
          match[0].trim(),
          'bundle-body',
        )
      }
    }
  }

  return [...found.values()].sort((a, b) => rank(b.authority) - rank(a.authority) || b.confidence - a.confidence || a.id.localeCompare(b.id))
}

function rank(authority: EvidenceAuthority): number {
  return { OBSERVED: 3, DECLARED: 2, INFERRED: 1, UNKNOWN: 0 }[authority]
}

/** Grouped view for the teardown and the UI. */
export function groupFingerprints(list: Fingerprint[]): Record<string, Fingerprint[]> {
  const groups: Record<string, Fingerprint[]> = {}
  for (const item of list) {
    ;(groups[item.category] ??= []).push(item)
  }
  return groups
}

/** The catalogue size, reported so the teardown can state its own bounds. */
export const FINGERPRINT_CATALOGUE_SIZE = SIGNALS.length
