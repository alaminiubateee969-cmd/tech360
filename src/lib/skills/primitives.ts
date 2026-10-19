// ============================================================
// TECH360 — executable skill primitives
// ============================================================
// Every skill in the registry is bound to one of these handlers. A
// handler is a REAL implementation: it performs the work and returns a
// value that satisfies the skill's declared output schema.
//
// The 20 primitives cover the operations the company's workflows
// actually need (classification, extraction, ranking, validation,
// rendering, lead scoring, document handling, Bangla/English keyword
// mapping, fingerprints). Each is deterministic, side-effect free and
// bounded, so a skill run never mutates customer data on its own —
// side effects go through the governed tool gateway.
// ============================================================

import { createHash } from 'crypto'
import { toE164 } from '@/lib/phone'

export type PrimitiveInput = Record<string, unknown>
export type PrimitiveOutput = Record<string, unknown>

export type PrimitiveContext = {
  /** The skill definition's specialisation. */
  configuration: Record<string, unknown>
  correlationId: string
}

export type PrimitiveHandler = (input: PrimitiveInput, ctx: PrimitiveContext) => PrimitiveOutput

// ------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is',
  'are', 'was', 'were', 'be', 'been', 'it', 'this', 'that', 'as', 'at', 'by',
  'from', 'we', 'our', 'you', 'your', 'their', 'how', 'what', 'when', 'why',
  'does', 'do', 'did', 'can', 'could', 'should', 'would', 'will', 'has', 'have',
])

/**
 * Tokenises English AND Bangla. Bangla is not whitespace-delimited in the
 * same way, so Bangla sequences are additionally split on the Bangla
 * danda (।) and common punctuation.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[।॥]/g, ' ')
    // \p{M} keeps combining marks attached to their base character, so
    // Bangla conjuncts such as "ভর্তি" (র + ্ + ত + ি) stay one token.
    .split(/[^\p{L}\p{M}\p{N}+#]+/u)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

function stringField(input: PrimitiveInput, key: string, fallback = ''): string {
  const value = input[key]
  return typeof value === 'string' ? value : fallback
}

function numberField(input: PrimitiveInput, key: string, fallback: number): number {
  const value = Number(input[key])
  return Number.isFinite(value) ? value : fallback
}

/** Deterministic confidence from a score, clamped to 0..1. */
function toConfidence(score: number, ceiling: number): number {
  if (ceiling <= 0) return 0
  return Math.max(0, Math.min(1, Math.round((score / ceiling) * 1000) / 1000))
}

// ------------------------------------------------------------
// 1. text.classify — assign a document/text to one of the declared labels
// ------------------------------------------------------------
export const classifyText: PrimitiveHandler = (input, ctx) => {
  const text = stringField(input, 'text')
  const labels = (ctx.configuration.labels as Array<{ label: string; keywords: string[] }>) ?? []
  const terms = tokenize(text)
  let best = { label: 'UNCLASSIFIED', score: 0 }
  const scores: Record<string, number> = {}
  for (const entry of labels) {
    let score = 0
    for (const keyword of entry.keywords) {
      const key = keyword.toLowerCase()
      if (terms.includes(key)) score += 3
      else if (text.toLowerCase().includes(key)) score += 1
    }
    scores[entry.label] = score
    if (score > best.score) best = { label: entry.label, score }
  }
  const ceiling = Math.max(1, ...Object.values(scores))
  return {
    label: best.label,
    confidence: toConfidence(best.score, ceiling),
    scores,
    matchedTerms: terms.filter((t) => labels.some((l) => l.keywords.map((k) => k.toLowerCase()).includes(t))),
  }
}

// ------------------------------------------------------------
// 2. text.summarize — extractive summary
// ------------------------------------------------------------
export const summarizeText: PrimitiveHandler = (input, ctx) => {
  const text = stringField(input, 'text')
  const maxSentences = Math.max(1, Math.min(10, numberField(input, 'maxSentences', 3)))
  const sentences = text
    .split(/(?<=[.!?।])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (sentences.length === 0) return { summary: '', sentenceCount: 0, coverage: 0 }
  const frequency = new Map<string, number>()
  for (const term of tokenize(text)) frequency.set(term, (frequency.get(term) ?? 0) + 1)
  const scored = sentences.map((sentence, index) => {
    const terms = tokenize(sentence)
    const score = terms.reduce((sum, t) => sum + (frequency.get(t) ?? 0), 0) / Math.max(1, terms.length)
    return { sentence, index, score }
  })
  const picked = [...scored]
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maxSentences)
    .sort((a, b) => a.index - b.index)
  const summary = picked.map((p) => p.sentence).join(' ')
  const coveredTerms = new Set(picked.flatMap((p) => tokenize(p.sentence)))
  const allTerms = new Set(tokenize(text))
  return {
    summary,
    sentenceCount: picked.length,
    coverage: allTerms.size === 0 ? 0 : Math.round((coveredTerms.size / allTerms.size) * 1000) / 1000,
  }
}

// ------------------------------------------------------------
// 3. entity.extract — emails, phones, dates, money, references
// ------------------------------------------------------------
export const extractEntities: PrimitiveHandler = (input) => {
  const text = stringField(input, 'text')
  const emails = [...new Set(text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [])]
  const phones = [
    ...new Set((text.match(/\+?\d[\d\s().-]{6,}\d/g) ?? []).map((p) => toE164(p)).filter((v): v is string => Boolean(v))),
  ]
  const dates = [...new Set(text.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g) ?? [])]
  const amounts = [...new Set(text.match(/(?:[A-Z]{3}\$|\$|৳|USD|BDT)\s?\d[\d,]*(?:\.\d+)?/gi) ?? [])]
  const references = [...new Set(text.match(/\b[A-Z]{2,5}-\d{3,8}\b/g) ?? [])]
  return { emails, phones, dates, amounts, references }
}

// ------------------------------------------------------------
// 4. keyword.map — English/Bangla keyword mapping
// ------------------------------------------------------------
export const mapKeywords: PrimitiveHandler = (input, ctx) => {
  const text = stringField(input, 'text')
  const glossary = (ctx.configuration.glossary as Record<string, string>) ?? {}
  const source = text.toLowerCase()
  const matches: Array<{ term: string; translation: string }> = []
  for (const [term, translation] of Object.entries(glossary)) {
    if (source.includes(term.toLowerCase())) matches.push({ term, translation })
  }
  return {
    matches,
    translated: matches.map((m) => m.translation).join(' '),
    matchCount: matches.length,
  }
}

// ------------------------------------------------------------
// 5. json.validate — validate a payload against the skill's schema
// ------------------------------------------------------------
export const validateJson: PrimitiveHandler = (input, ctx) => {
  const payload = input.payload
  const schema = (ctx.configuration.schema as { required?: string[]; properties?: Record<string, { type?: string }> }) ?? {}
  const errors: string[] = []
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    errors.push('payload must be a JSON object')
  } else {
    const record = payload as Record<string, unknown>
    for (const key of schema.required ?? []) {
      if (!(key in record)) errors.push(`missing required property "${key}"`)
    }
    for (const [key, definition] of Object.entries(schema.properties ?? {})) {
      if (!(key in record)) continue
      const value = record[key]
      if (definition.type === 'string' && typeof value !== 'string') errors.push(`"${key}" must be a string`)
      if (definition.type === 'number' && typeof value !== 'number') errors.push(`"${key}" must be a number`)
      if (definition.type === 'boolean' && typeof value !== 'boolean') errors.push(`"${key}" must be a boolean`)
      if (definition.type === 'array' && !Array.isArray(value)) errors.push(`"${key}" must be an array`)
    }
  }
  return { valid: errors.length === 0, errors }
}

// ------------------------------------------------------------
// 6. template.render — render a declared template
// ------------------------------------------------------------
export const renderTemplate: PrimitiveHandler = (input, ctx) => {
  const template = stringField(input, 'template', (ctx.configuration.template as string) ?? '')
  const variables = (input.variables as Record<string, unknown>) ?? {}
  const missing: string[] = []
  const rendered = template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key]
    if (value === undefined || value === null) {
      missing.push(key)
      return ''
    }
    return String(value)
  })
  return { rendered, missing, complete: missing.length === 0 }
}

// ------------------------------------------------------------
// 7. lead.qualify — score a lead against declared criteria
// ------------------------------------------------------------
export const qualifyLead: PrimitiveHandler = (input, ctx) => {
  const criteria = (ctx.configuration.criteria as Array<{ field: string; weight: number; equals?: string; contains?: string }>) ?? []
  const total = criteria.reduce((sum, c) => sum + c.weight, 0) || 1
  let score = 0
  const reasons: string[] = []
  for (const criterion of criteria) {
    const value = input[criterion.field]
    const text = value === undefined || value === null ? '' : String(value).toLowerCase()
    let matched = false
    if (criterion.equals !== undefined) matched = text === criterion.equals.toLowerCase()
    else if (criterion.contains !== undefined) matched = text.includes(criterion.contains.toLowerCase())
    if (matched) {
      score += criterion.weight
      reasons.push(`${criterion.field} matched`)
    }
  }
  const normalized = Math.max(0, Math.min(1, score / total))
  const threshold = numberField(ctx.configuration as PrimitiveInput, 'qualifyThreshold', 0.5)
  return {
    score: Math.round(normalized * 1000) / 1000,
    qualified: normalized >= threshold,
    threshold,
    reasons,
  }
}

// ------------------------------------------------------------
// 8. document.classify — classify a file by type and content
// ------------------------------------------------------------
export const classifyDocument: PrimitiveHandler = (input, ctx) => {
  const filename = stringField(input, 'filename')
  const mimeType = stringField(input, 'mimeType')
  const text = stringField(input, 'text')
  const extension = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : ''
  const rules = (ctx.configuration.rules as Array<{ type: string; extensions?: string[]; mimeTypes?: string[]; keywords?: string[] }>) ?? []
  const lower = text.toLowerCase()
  const scored = rules.map((rule) => {
    let score = 0
    if (rule.extensions?.includes(extension)) score += 3
    if (rule.mimeTypes?.includes(mimeType)) score += 2
    for (const keyword of rule.keywords ?? []) {
      if (lower.includes(keyword.toLowerCase())) score += 1
    }
    return { type: rule.type, score }
  })
  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  const hasSignal = best && best.score > 0
  return {
    documentType: hasSignal ? best.type : 'UNKNOWN',
    confidence: hasSignal ? toConfidence(best.score, 6) : 0,
    extension,
    mimeType,
    candidates: scored.slice(0, 5),
  }
}

// ------------------------------------------------------------
// 9. keyword.rank — rank candidate passages against a query
// ------------------------------------------------------------
export const rankByKeyword: PrimitiveHandler = (input, ctx) => {
  const query = stringField(input, 'query')
  const candidates = Array.isArray(input.candidates) ? (input.candidates as Array<Record<string, unknown>>) : []
  const queryTerms = tokenize(query)
  const titleBoost = numberField(ctx.configuration as PrimitiveInput, 'titleBoost', 3)
  const ranked = candidates
    .map((candidate, index) => {
      const title = String(candidate.title ?? '').toLowerCase()
      const body = String(candidate.text ?? candidate.excerpt ?? candidate.content ?? '').toLowerCase()
      let score = 0
      for (const term of queryTerms) {
        if (title.includes(term)) score += titleBoost
        if (body.includes(term)) score += 1
      }
      return { index, id: String(candidate.id ?? index), score }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
  return { ranked, matchCount: ranked.length }
}

// ------------------------------------------------------------
// 10. checklist.evaluate — evaluate a declared checklist
// ------------------------------------------------------------
export const evaluateChecklist: PrimitiveHandler = (input, ctx) => {
  const checklist = (ctx.configuration.checklist as Array<{ id: string; label: string; keywords?: string[] }>) ?? []
  const text = stringField(input, 'text')
  const lower = text.toLowerCase()
  const results = checklist.map((item) => {
    const hit = (item.keywords ?? []).some((k) => lower.includes(k.toLowerCase()))
    return { id: item.id, label: item.label, satisfied: hit }
  })
  const satisfied = results.filter((r) => r.satisfied).length
  return {
    results,
    satisfied,
    total: results.length,
    complete: results.length > 0 && satisfied === results.length,
    completionRatio: results.length === 0 ? 0 : Math.round((satisfied / results.length) * 1000) / 1000,
  }
}

// ------------------------------------------------------------
// 11. answer.extract — pull the answer span out of supplied evidence
// ------------------------------------------------------------
export const extractAnswer: PrimitiveHandler = (input, ctx) => {
  const question = stringField(input, 'question')
  const evidence = Array.isArray(input.evidence) ? (input.evidence as string[]) : []
  const questionTerms = new Set(tokenize(question))
  let best = { text: '', score: 0, index: -1 }
  evidence.forEach((chunk, index) => {
    const terms = tokenize(chunk)
    const overlap = terms.filter((t) => questionTerms.has(t)).length
    const score = terms.length === 0 ? 0 : overlap / questionTerms.size
    if (score > best.score) best = { text: chunk, score, index }
  })
  const threshold = numberField(ctx.configuration as PrimitiveInput, 'answerThreshold', 0.1)
  const answered = best.score >= threshold
  return {
    // The answer key is OMITTED when the evidence is insufficient, so a
    // caller can never mistake "no answer" for "empty answer".
    ...(answered ? { answer: best.text } : {}),
    confidence: Math.round(best.score * 1000) / 1000,
    grounded: answered,
    evidenceIndex: best.index,
    insufficientEvidence: !answered,
  }
}

// ------------------------------------------------------------
// 12. url.normalize — validate and normalise URLs
// ------------------------------------------------------------
export const normalizeUrl: PrimitiveHandler = (input) => {
  const raw = stringField(input, 'url')
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, reason: 'only http and https URLs are accepted' }
    }
    parsed.hash = ''
    const normalized = parsed.toString().replace(/\/$/, '')
    return { valid: true, normalized, host: parsed.hostname }
  } catch {
    return { valid: false, reason: 'not a valid absolute URL' }
  }
}

// ------------------------------------------------------------
// 13. phone.normalize — normalise a phone number
// ------------------------------------------------------------
export const normalizePhoneSkill: PrimitiveHandler = (input) => {
  const raw = stringField(input, 'phone') || stringField(input, 'number')
  const normalized = toE164(raw)
  return {
    // Optional fields are OMITTED rather than set to null so the declared
    // output schema stays exact.
    ...(normalized ? { normalized } : {}),
    valid: Boolean(normalized),
    ...(normalized ? { countryHint: normalized.slice(0, 3) } : {}),
  }
}

// ------------------------------------------------------------
// 14. slug.make — build a URL slug
// ------------------------------------------------------------
export const makeSlug: PrimitiveHandler = (input) => {
  const raw = stringField(input, 'text') || stringField(input, 'title')
  const slug = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, numberField(input, 'maxLength', 80))
  return { slug, length: slug.length }
}

// ------------------------------------------------------------
// 15. text.readability — simple readability metrics
// ------------------------------------------------------------
export const measureReadability: PrimitiveHandler = (input) => {
  const text = stringField(input, 'text')
  const sentences = text.split(/[.!?।\n]+/).filter((s) => s.trim().length > 0)
  const words = tokenize(text)
  const avgWordsPerSentence = sentences.length === 0 ? 0 : words.length / sentences.length
  const longWords = words.filter((w) => w.length > 6).length
  const complexity = words.length === 0 ? 0 : longWords / words.length
  const score = Math.max(0, Math.min(1, 1 - avgWordsPerSentence / 40 - complexity))
  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 100) / 100,
    complexity: Math.round(complexity * 1000) / 1000,
    readabilityScore: Math.round(score * 1000) / 1000,
    level: score > 0.75 ? 'EASY' : score > 0.5 ? 'MODERATE' : score > 0.3 ? 'DIFFICULT' : 'VERY_DIFFICULT',
  }
}

// ------------------------------------------------------------
// 16. record.dedupe_key — build a stable deduplication key
// ------------------------------------------------------------
export const buildDedupeKey: PrimitiveHandler = (input, ctx) => {
  const fields = (ctx.configuration.fields as string[]) ?? ['id']
  const parts = fields.map((field) => String(input[field] ?? '').trim().toLowerCase())
  const digest = createHash('sha256').update(parts.join('|')).digest('hex')
  return { key: digest.slice(0, 32), fields, emptyFields: fields.filter((f, i) => parts[i] === '') }
}

// ------------------------------------------------------------
// 17. schedule.parse — read a date hint out of free text
// ------------------------------------------------------------
export const parseSchedule: PrimitiveHandler = (input) => {
  const text = stringField(input, 'text')
  const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(text)
  const clock = /\b(\d{1,2}):(\d{2})\b/.exec(text)
  const inDays = /\bin\s+(\d+)\s+day(s)?\b/i.exec(text)
  const tomorrow = /\btomorrow\b/i.test(text)
  const today = /\btoday\b/i.test(text)
  const now = new Date(input.now ? Number(input.now) : Date.now())
  let scheduledFor: string | null = null
  let basis: string | null = null
  if (iso) {
    scheduledFor = iso[1]
    basis = 'EXPLICIT_ISO_DATE'
  } else if (inDays) {
    const date = new Date(now.getTime() + Number(inDays[1]) * 86_400_000)
    scheduledFor = date.toISOString().slice(0, 10)
    basis = 'RELATIVE_DAYS'
  } else if (tomorrow) {
    scheduledFor = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10)
    basis = 'RELATIVE_TOMORROW'
  } else if (today) {
    scheduledFor = now.toISOString().slice(0, 10)
    basis = 'RELATIVE_TODAY'
  }
  return {
    ...(scheduledFor ? { scheduledFor } : {}),
    ...(clock ? { time: `${clock[1].padStart(2, '0')}:${clock[2]}` } : {}),
    ...(basis ? { basis } : {}),
    resolved: Boolean(scheduledFor),
  }
}

// ------------------------------------------------------------
// 18. number.format — format money and numbers
// ------------------------------------------------------------
export const formatNumber: PrimitiveHandler = (input, ctx) => {
  const amount = numberField(input, 'amount', 0)
  const currency = stringField(input, 'currency', (ctx.configuration.currency as string) ?? 'USD')
  const locale = stringField(input, 'locale', (ctx.configuration.locale as string) ?? 'en-US')
  let formatted: string
  try {
    formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: numberField(ctx.configuration as PrimitiveInput, 'decimals', 2),
    }).format(amount)
  } catch {
    formatted = `${currency} ${amount.toFixed(2)}`
  }
  return { formatted, amount, currency, numeric: Number.isFinite(amount) }
}

// ------------------------------------------------------------
// 19. hash.fingerprint — content fingerprint for change detection
// ------------------------------------------------------------
export const fingerprintContent: PrimitiveHandler = (input) => {
  const text = stringField(input, 'text')
  const digest = createHash('sha256').update(text).digest('hex')
  return { checksum: digest, length: text.length, short: digest.slice(0, 12) }
}

// ------------------------------------------------------------
// 20. text.metrics — counts for content QA
// ------------------------------------------------------------
export const textMetrics: PrimitiveHandler = (input) => {
  const text = stringField(input, 'text')
  const words = tokenize(text)
  return {
    characters: text.length,
    words: words.length,
    uniqueWords: new Set(words).size,
    lines: text.split('\n').length,
    hasBangla: /[\u0980-\u09FF]/.test(text),
    hasArabic: /[\u0600-\u06FF]/.test(text),
  }
}

// ------------------------------------------------------------
// The handler registry
// ------------------------------------------------------------
export const SKILL_HANDLERS: Record<string, PrimitiveHandler> = {
  'text.classify': classifyText,
  'text.summarize': summarizeText,
  'entity.extract': extractEntities,
  'keyword.map': mapKeywords,
  'json.validate': validateJson,
  'template.render': renderTemplate,
  'lead.qualify': qualifyLead,
  'document.classify': classifyDocument,
  'keyword.rank': rankByKeyword,
  'checklist.evaluate': evaluateChecklist,
  'answer.extract': extractAnswer,
  'url.normalize': normalizeUrl,
  'phone.normalize': normalizePhoneSkill,
  'slug.make': makeSlug,
  'text.readability': measureReadability,
  'record.dedupe_key': buildDedupeKey,
  'schedule.parse': parseSchedule,
  'number.format': formatNumber,
  'hash.fingerprint': fingerprintContent,
  'text.metrics': textMetrics,
}

export const SKILL_HANDLER_KEYS = Object.keys(SKILL_HANDLERS)

export function hasSkillHandler(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(SKILL_HANDLERS, key)
}
