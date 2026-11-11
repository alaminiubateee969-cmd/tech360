/**
 * TECH360 — REA Studio: static document analysis
 * ===============================================
 * Reads a captured HTML document as TEXT. There is no DOM, no browser and no
 * JavaScript execution here, and the result says so.
 *
 * That constraint is the single most important limitation in this module and it
 * is reported, never papered over: for a server-rendered page the markup we see
 * is close to what a visitor sees, but for a client-rendered SPA the document
 * may be a near-empty shell and the real interface is built later in the
 * browser. `renderModel` classifies which case we are in, and `coverage`
 * reports how much of the document was actually examined.
 *
 * Upstream REA does this properly with a Chrome-family browser over CDP
 * (`inspect_web_page`: DOM, accessibility nodes, workers, console, network).
 * This deployment has no attached browser, so the accessibility tree, the
 * post-hydration DOM, runtime network calls and console output are recorded as
 * UNKNOWN with the authority that would be needed to resolve them. Inventing
 * them would violate both REA's evidence rule and this repo's.
 *
 * Bounded by design: every collection is capped, the input is truncated to a
 * maximum size, and truncation is reported rather than hidden.
 */

export type HtmlLink = { href: string; text: string; rel?: string; external: boolean; area: string }
export type HtmlHeading = { level: number; text: string }
export type HtmlForm = {
  action: string
  method: string
  fields: Array<{ name: string; type: string; required: boolean; label?: string }>
  hasHoneypot: boolean
}
export type HtmlScript = { src: string | null; inline: boolean; type?: string; module: boolean; bytes: number }
export type HtmlMeta = { name: string; content: string }

export type DocumentStructure = {
  title: string
  lang: string | null
  charset: string | null
  viewport: string | null
  description: string | null
  canonical: string | null
  robots: string | null
  generator: string | null
  ogTags: HtmlMeta[]
  themeColor: string | null
  favicon: string | null
  manifest: string | null
  headings: HtmlHeading[]
  headingOutline: string[]
  links: HtmlLink[]
  internalLinks: HtmlLink[]
  externalLinks: HtmlLink[]
  forms: HtmlForm[]
  scripts: HtmlScript[]
  inlineScriptCount: number
  externalScriptUrls: string[]
  stylesheets: string[]
  inlineStyleBytes: number
  images: Array<{ src: string; alt: string; lazy: boolean }>
  imagesMissingAlt: number
  navItems: string[]
  footerText: string
  sections: Array<{ id: string; tag: string; classes: string }>
  buttons: string[]
  wordCount: number
  textSample: string
  /** SSR | SSG | SPA_SHELL | HYDRIDATED | UNKNOWN, with the signals behind it. */
  renderModel: { model: string; signals: string[]; confidence: number }
  /** Structured data blocks (JSON-LD), parsed as untrusted data. */
  structuredData: Array<{ type: string; raw: string }>
  iframes: Array<{ src: string; title: string }>
  /** Accessibility observations that static markup CAN support. */
  a11y: {
    hasSkipLink: boolean
    landmarks: { header: number; nav: number; main: number; footer: number; aside: number }
    headingsInOrder: boolean
    headingGaps: number[]
    imagesMissingAlt: number
    inputsMissingLabel: number
    buttonsMissingText: number
    langDeclared: boolean
  }
}

const LIMITS = {
  maxDocumentBytes: 2 * 1024 * 1024,
  maxLinks: 400,
  maxHeadings: 200,
  maxScripts: 200,
  maxImages: 300,
  maxSections: 200,
  maxButtons: 200,
  maxForms: 40,
  maxTextSample: 1600,
} as const

export type AnalysisBounds = { truncated: boolean; truncatedBy: string[]; documentBytes: number }

export type DocumentAnalysis = { structure: DocumentStructure; bounds: AnalysisBounds }

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const m = re.exec(tag)
  if (!m) return null
  return (m[2] ?? m[3] ?? m[4] ?? '').trim()
}

function allTags(html: string, tag: string): string[] {
  const out: string[] = []
  const re = new RegExp(`<${tag}\\b[^>]*>`, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null && out.length < 5000) out.push(m[0])
  return out
}

function tagWithText(html: string, tag: string): Array<{ tag: string; text: string }> {
  const out: Array<{ tag: string; text: string }> = []
  const re = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null && out.length < 5000) {
    out.push({ tag: `<${tag}${m[1]}>`, text: stripTags(m[2]).replace(/\s+/g, ' ').trim() })
  }
  return out
}

export function stripTags(input: string): string {
  return input
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function metaContent(html: string, key: string, isProperty = false): string | null {
  const attrName = isProperty ? 'property' : 'name'
  const re = new RegExp(`<meta\\b[^>]*${attrName}\\s*=\\s*["']${key}["'][^>]*>`, 'i')
  const tag = re.exec(html)?.[0]
  if (!tag) {
    // Some documents put content before name/property.
    const re2 = new RegExp(`<meta\\b[^>]*content\\s*=\\s*["'][^"']*["'][^>]*${attrName}\\s*=\\s*["']${key}["'][^>]*>`, 'i')
    const tag2 = re2.exec(html)?.[0]
    return tag2 ? attr(tag2, 'content') : null
  }
  return attr(tag, 'content')
}

/**
 * Classifies how the page reaches the visitor. This decides how much of the
 * teardown is meaningful, so the signals are returned with the answer.
 */
function classifyRenderModel(
  html: string,
  structure: Pick<DocumentStructure, 'wordCount' | 'externalScriptUrls' | 'sections' | 'headings' | 'forms'>,
): DocumentStructure['renderModel'] {
  const signals: string[] = []
  let score = { ssr: 0, spa: 0 }

  // What distinguishes a client-rendered shell is ABSENT content, not short
  // content. A login page, a pricing page or a terse landing page can be fully
  // server-rendered and still contain very few words, so a low word count is
  // only evidence of a shell when the document also lacks real structure.
  // Treating brevity alone as a shell made the teardown tell an operator that a
  // perfectly ordinary server-rendered page "contains almost none of the
  // interface a visitor sees" — which is exactly the kind of over-claim the
  // evidence contract exists to prevent.
  const substantive = structure.sections.length >= 2 || structure.headings.length >= 2 || structure.forms.length >= 1

  if (/__next_data__/i.test(html)) { signals.push('__NEXT_DATA__ present (Next.js payload embedded in the document)'); score.ssr += 2 }
  if (/<div id="(?:__nuxt|app|root)">\s*<\/div>/i.test(html)) { signals.push('Empty mount node (#app/#root/__nuxt) with no server-rendered children'); score.spa += 3 }
  if (structure.wordCount < 120) {
    if (substantive) {
      signals.push(`Only ${structure.wordCount} words of visible text, but the document does carry server-rendered structure (${structure.sections.length} section(s), ${structure.headings.length} heading(s), ${structure.forms.length} form(s)) — terse, not empty`)
    } else {
      signals.push(`Only ${structure.wordCount} words of visible text and no server-rendered structure to show for it`); score.spa += 2
    }
  } else if (structure.wordCount > 400) { signals.push(`${structure.wordCount} words of visible text present in the initial document`); score.ssr += 2 }
  // Two content sections is already substantive markup in the document; the
  // previous threshold of four needed a long marketing page before server
  // rendering counted at all.
  if (structure.sections.length >= 2) { signals.push(`${structure.sections.length} server-rendered content sections`); score.ssr += 1 }
  if (/<noscript\b/i.test(html)) { signals.push('<noscript> fallback present'); score.spa += 1 }
  if (structure.externalScriptUrls.some((u) => /\/_next\/static\/chunks\/|\/_nuxt\/|\/assets\/index-.*\.js/i.test(u))) {
    signals.push('Hydration bundle referenced (/_next/static/chunks, /_nuxt, /assets/index-*.js)')
    score.ssr += 1
    score.spa += 1
  }
  if (/data-server-rendered|<!--\s*ssr\s*-->/i.test(html)) { signals.push('Explicit server-render marker'); score.ssr += 2 }

  const total = score.ssr + score.spa
  if (total === 0) return { model: 'UNKNOWN', signals: ['No render-model signal found in the document.'], confidence: 0 }

  if (score.spa > score.ssr * 2 && score.spa >= 3) {
    return { model: 'SPA_SHELL', signals, confidence: Number((score.spa / total).toFixed(2)) }
  }
  if (score.ssr >= score.spa && score.ssr >= 2) {
    return { model: 'HYDRIDATED', signals, confidence: Number((score.ssr / total).toFixed(2)) }
  }
  return { model: 'UNKNOWN', signals, confidence: Number((Math.max(score.ssr, score.spa) / total).toFixed(2)) }
}

export function analyzeDocument(rawHtml: string, baseUrl?: string | null): DocumentAnalysis {
  const truncatedBy: string[] = []
  const documentBytes = Buffer.byteLength(rawHtml ?? '', 'utf8')
  let html = rawHtml ?? ''
  if (html.length > LIMITS.maxDocumentBytes) {
    html = html.slice(0, LIMITS.maxDocumentBytes)
    truncatedBy.push(`document truncated to ${LIMITS.maxDocumentBytes} bytes`)
  }

  const base = baseUrl ? safeBase(baseUrl) : null

  // ---------------- head ----------------
  const title = (/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)
  const lang = attr(/<html\b[^>]*>/i.exec(html)?.[0] ?? '', 'lang')
  const charset = attr(allTags(html, 'meta').find((t) => /charset=/i.test(t)) ?? '', 'charset')
    ?? (/<meta\b[^>]*charset\s*=\s*["']?([\w-]+)/i.exec(html)?.[1] ?? null)
  const viewport = metaContent(html, 'viewport')
  const description = metaContent(html, 'description')
  const robots = metaContent(html, 'robots')
  const generator = metaContent(html, 'generator')
  const themeColor = metaContent(html, 'theme-color')
  const canonical = attr(allTags(html, 'link').find((t) => /rel\s*=\s*["']canonical["']/i.test(t)) ?? '', 'href')
  const favicon = attr(allTags(html, 'link').find((t) => /rel\s*=\s*["'](icon|shortcut icon|apple-touch-icon)["']/i.test(t)) ?? '', 'href')
  const manifest = attr(allTags(html, 'link').find((t) => /rel\s*=\s*["']manifest["']/i.test(t)) ?? '', 'href')

  const ogTags: HtmlMeta[] = []
  for (const tag of allTags(html, 'meta')) {
    const property = attr(tag, 'property')
    if (property && /^og:|^twitter:/i.test(property)) {
      const content = attr(tag, 'content') ?? ''
      if (ogTags.length < 60) ogTags.push({ name: property, content: content.slice(0, 400) })
    }
  }

  // ---------------- headings ----------------
  const headings: HtmlHeading[] = []
  for (const level of [1, 2, 3, 4, 5, 6]) {
    for (const item of tagWithText(html, `h${level}`)) {
      if (headings.length >= LIMITS.maxHeadings) { truncatedBy.push(`headings capped at ${LIMITS.maxHeadings}`); break }
      if (item.text) headings.push({ level, text: item.text.slice(0, 200) })
    }
  }
  // Restore document order: tagWithText runs per level, so re-sort by position.
  headings.sort((a, b) => positionOf(html, `h${a.level}`, a.text) - positionOf(html, `h${b.level}`, b.text))
  const headingOutline = headings.map((h) => `${'#'.repeat(h.level)} ${h.text}`)
  const headingGaps: number[] = []
  for (let i = 1; i < headings.length; i += 1) {
    if (headings[i].level - headings[i - 1].level > 1) headingGaps.push(headings[i].level)
  }

  // ---------------- links ----------------
  const links: HtmlLink[] = []
  for (const item of tagWithText(html, 'a')) {
    if (links.length >= LIMITS.maxLinks) { truncatedBy.push(`links capped at ${LIMITS.maxLinks}`); break }
    const href = attr(item.tag, 'href')
    if (!href) continue
    if (/^(javascript:|mailto:|tel:|#)/i.test(href)) continue
    const rel = attr(item.tag, 'rel') ?? undefined
    const external = isExternal(href, base)
    const area = areaOf(html, item.tag)
    links.push({ href: href.slice(0, 500), text: item.text.slice(0, 120), ...(rel ? { rel } : {}), external, area })
  }
  const internalLinks = links.filter((l) => !l.external)
  const externalLinks = links.filter((l) => l.external)

  // ---------------- scripts / styles ----------------
  const scripts: HtmlScript[] = []
  const externalScriptUrls: string[] = []
  let inlineScriptCount = 0
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let sm: RegExpExecArray | null
  while ((sm = scriptRe.exec(html)) !== null) {
    if (scripts.length >= LIMITS.maxScripts) { truncatedBy.push(`scripts capped at ${LIMITS.maxScripts}`); break }
    const attrs = sm[1]
    const body = sm[2] ?? ''
    const src = attr(attrs, 'src')
    const isModule = /type\s*=\s*["']module["']/i.test(attrs)
    const type = attr(attrs, 'type') ?? undefined
    if (src) {
      externalScriptUrls.push(src)
      scripts.push({ src, inline: false, ...(type ? { type } : {}), module: isModule, bytes: 0 })
    } else {
      inlineScriptCount += 1
      scripts.push({ src: null, inline: true, ...(type ? { type } : {}), module: isModule, bytes: body.length })
    }
  }

  const stylesheets: string[] = []
  for (const tag of allTags(html, 'link')) {
    if (/rel\s*=\s*["']stylesheet["']/i.test(tag)) {
      const href = attr(tag, 'href')
      if (href && stylesheets.length < 100) stylesheets.push(href)
    }
  }
  let inlineStyleBytes = 0
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
  while ((styleRe.exec(html)) !== null) inlineStyleBytes += (RegExp.lastMatch.match(/>([\s\S]*?)</)?.[1] ?? '').length

  // ---------------- images ----------------
  const images: DocumentStructure['images'] = []
  let imagesMissingAlt = 0
  for (const tag of allTags(html, 'img')) {
    const src = attr(tag, 'src') ?? attr(tag, 'data-src') ?? ''
    if (!src) continue
    const altValue = attr(tag, 'alt')
    if (altValue === null) imagesMissingAlt += 1
    if (images.length < LIMITS.maxImages) {
      images.push({ src: src.slice(0, 400), alt: (altValue ?? '').slice(0, 160), lazy: /loading\s*=\s*["']lazy["']/i.test(tag) })
    } else if (!truncatedBy.includes(`images capped at ${LIMITS.maxImages}`)) {
      truncatedBy.push(`images capped at ${LIMITS.maxImages}`)
    }
  }

  // ---------------- forms ----------------
  const forms: HtmlForm[] = []
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi
  let fm: RegExpExecArray | null
  while ((fm = formRe.exec(html)) !== null) {
    if (forms.length >= LIMITS.maxForms) { truncatedBy.push(`forms capped at ${LIMITS.maxForms}`); break }
    const fields: HtmlForm['fields'] = []
    const fieldRe = /<(input|textarea|select)\b([^>]*)>/gi
    let im: RegExpExecArray | null
    let hasHoneypot = false
    while ((im = fieldRe.exec(fm[2])) !== null) {
      const a = im[2]
      const type = (attr(a, 'type') ?? (im[1].toLowerCase() === 'textarea' ? 'textarea' : 'text')).toLowerCase()
      const name = attr(a, 'name') ?? attr(a, 'id') ?? ''
      if (/^(hidden)$/.test(type) && /(honeypot|hp_|website_url|company\b|fax\b)/i.test(name)) hasHoneypot = true
      if (fields.length < 60) {
        fields.push({
          name: name.slice(0, 80),
          type,
          required: /required\b/i.test(a) || /aria-required\s*=\s*["']true["']/i.test(a),
          ...(attr(a, 'placeholder') ? { label: attr(a, 'placeholder')!.slice(0, 80) } : {}),
        })
      }
    }
    forms.push({
      action: (attr(fm[1], 'action') ?? '').slice(0, 300),
      method: (attr(fm[1], 'method') ?? 'GET').toUpperCase(),
      fields,
      hasHoneypot,
    })
  }

  // ---------------- sections / nav / footer ----------------
  const sections: DocumentStructure['sections'] = []
  for (const tag of allTags(html, 'section')) {
    if (sections.length >= LIMITS.maxSections) { truncatedBy.push(`sections capped at ${LIMITS.maxSections}`); break }
    sections.push({
      id: (attr(tag, 'id') ?? '').slice(0, 80),
      tag: 'section',
      classes: (attr(tag, 'class') ?? '').slice(0, 200),
    })
  }

  const navItems: string[] = []
  const navBlock = /<nav\b[^>]*>([\s\S]*?)<\/nav>/i.exec(html)?.[1] ?? ''
  for (const item of tagWithText(navBlock || html, 'a')) {
    if (navItems.length >= 40) break
    if (item.text && item.text.length < 60 && !navItems.includes(item.text)) navItems.push(item.text)
  }

  const footerText = stripTags(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i.exec(html)?.[1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 800)

  const buttons: string[] = []
  for (const item of tagWithText(html, 'button')) {
    if (buttons.length >= LIMITS.maxButtons) { truncatedBy.push(`buttons capped at ${LIMITS.maxButtons}`); break }
    const text = item.text || (attr(item.tag, 'aria-label') ?? '')
    if (text) buttons.push(text.slice(0, 80))
  }

  // ---------------- text ----------------
  const visibleText = stripTags(html).replace(/\s+/g, ' ').trim()
  const wordCount = visibleText ? visibleText.split(' ').filter(Boolean).length : 0
  const textSample = visibleText.slice(0, LIMITS.maxTextSample)

  // ---------------- structured data / iframes ----------------
  const structuredData: DocumentStructure['structuredData'] = []
  const ldRe = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let lm: RegExpExecArray | null
  while ((lm = ldRe.exec(html)) !== null && structuredData.length < 20) {
    const raw = (lm[1] ?? '').trim()
    let type = 'unknown'
    try {
      const parsed = JSON.parse(raw) as unknown
      const first = Array.isArray(parsed) ? parsed[0] : parsed
      if (first && typeof first === 'object' && '@type' in first) type = String((first as { '@type': unknown })['@type'])
    } catch { type = 'unparseable' }
    structuredData.push({ type, raw: raw.slice(0, 1200) })
  }

  const iframes: DocumentStructure['iframes'] = []
  for (const tag of allTags(html, 'iframe')) {
    if (iframes.length >= 20) break
    iframes.push({ src: (attr(tag, 'src') ?? '').slice(0, 400), title: (attr(tag, 'title') ?? '').slice(0, 120) })
  }

  // ---------------- a11y (static-only subset) ----------------
  const landmarks = {
    header: allTags(html, 'header').length,
    nav: allTags(html, 'nav').length,
    main: allTags(html, 'main').length,
    footer: allTags(html, 'footer').length,
    aside: allTags(html, 'aside').length,
  }
  const inputsMissingLabel = forms.reduce((total, form) => {
    return total + form.fields.filter((f) => !f.label && f.type !== 'hidden' && f.type !== 'submit').length
  }, 0)
  const buttonsMissingText = Math.max(0, allTags(html, 'button').length - buttons.length)

  const partial: Pick<DocumentStructure, 'wordCount' | 'externalScriptUrls' | 'sections' | 'headings' | 'forms'> = {
    wordCount, externalScriptUrls, sections, headings, forms,
  }
  const renderModel = classifyRenderModel(html, partial)

  const structure: DocumentStructure = {
    title, lang, charset, viewport, description, canonical, robots, generator, ogTags, themeColor, favicon, manifest,
    headings, headingOutline, links, internalLinks, externalLinks, forms, scripts, inlineScriptCount, externalScriptUrls,
    stylesheets, inlineStyleBytes, images, imagesMissingAlt, navItems, footerText, sections, buttons, wordCount, textSample,
    renderModel, structuredData, iframes,
    a11y: {
      hasSkipLink: /#(?:main|content|skip)/i.test(html) && /class="[^"]*skip/i.test(html),
      landmarks,
      headingsInOrder: headingGaps.length === 0,
      headingGaps,
      imagesMissingAlt,
      inputsMissingLabel,
      buttonsMissingText,
      langDeclared: Boolean(lang),
    },
  }

  return { structure, bounds: { truncated: truncatedBy.length > 0, truncatedBy, documentBytes } }
}

function positionOf(html: string, tag: string, text: string): number {
  if (!text) return 0
  const idx = html.toLowerCase().indexOf(text.toLowerCase().slice(0, 40))
  return idx === -1 ? 0 : idx
}

function safeBase(baseUrl: string): URL | null {
  try { return new URL(baseUrl) } catch { return null }
}

function isExternal(href: string, base: URL | null): boolean {
  if (!base) return /^(https?:)?\/\//i.test(href)
  try {
    const resolved = new URL(href, base)
    return resolved.hostname.toLowerCase() !== base.hostname.toLowerCase()
  } catch {
    return false
  }
}

/** Which landmark a link sits in, best-effort by document position. */
function areaOf(html: string, anchorTag: string): string {
  const idx = html.indexOf(anchorTag)
  if (idx === -1) return 'body'
  const before = html.slice(0, idx).toLowerCase()
  const lastNav = before.lastIndexOf('<nav')
  const lastHeader = before.lastIndexOf('<header')
  const lastFooter = before.lastIndexOf('<footer')
  const lastMain = before.lastIndexOf('<main')
  const best = Math.max(lastNav, lastHeader, lastFooter, lastMain)
  if (best === -1) return 'body'
  if (best === lastNav) return 'nav'
  if (best === lastHeader) return 'header'
  if (best === lastFooter) return 'footer'
  return 'main'
}
