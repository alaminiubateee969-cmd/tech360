// ============================================================
// TECH360 — AI support assist for the operator inbox
// ============================================================
// Two layers, labelled honestly in every response:
//
// 1. TRIAGE (method: "RULES") — deterministic Bangla + English keyword rules
//    for language, intent, business type, priority and ticket category.
//    Always available; never presented as AI.
// 2. ASSIST (method: "AI") — summary and suggested replies generated through
//    the existing agent gateway (runAgent) with approved knowledge only
//    (searchKnowledgeRanked reads APPROVED/INDEXED documents). Output passes
//    the deterministic guardrail (screenAiReply). When no approved knowledge
//    matches, the intent is commercially sensitive, or the provider is not
//    configured, NO text is generated and the result says to escalate.
//
// Suggestions are drafts for a human. Nothing here sends a message.
// ============================================================

import { db } from '@/lib/db'
import { screenAiReply } from '@/lib/ai-reply-guard'
import { redactSensitiveCrmData } from '@/lib/sensitive-redaction'

export type Language = 'bn' | 'en' | 'mixed'
export type Intent =
  | 'HUMAN_REQUEST' | 'COMPLAINT' | 'REFUND' | 'PAYMENT' | 'PRICING' | 'DELIVERY_STATUS'
  | 'TECHNICAL_SUPPORT' | 'NEW_PROJECT' | 'GREETING' | 'GENERAL'

/** Intents the AI must never answer with facts: a human confirms these. */
export const SENSITIVE_INTENTS: ReadonlySet<Intent> = new Set(['COMPLAINT', 'REFUND', 'PAYMENT', 'PRICING', 'DELIVERY_STATUS', 'HUMAN_REQUEST'])

export function detectLanguage(text: string): Language {
  const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, '')
  if (!letters) return 'en'
  const bangla = (letters.match(/[\u0980-\u09FF]/g) ?? []).length
  const ratio = bangla / letters.length
  if (ratio > 0.6) return 'bn'
  if (ratio > 0.1) return 'mixed'
  return 'en'
}

const INTENT_RULES: Array<{ intent: Intent; patterns: RegExp[] }> = [
  { intent: 'HUMAN_REQUEST', patterns: [/\b(human|real person|agent|representative|talk to (someone|a person)|call me)\b/i, /(মানুষ|এজেন্ট|প্রতিনিধি|কথা বলতে চাই|ফোন করুন)/] },
  { intent: 'COMPLAINT', patterns: [/\b(complain|complaint|unacceptable|angry|disappointed|terrible|worst|scam)\b/i, /(অভিযোগ|হতাশ|বাজে|প্রতারণা)/] },
  { intent: 'REFUND', patterns: [/\b(refund|money back|chargeback|cancel (my|the) (order|project))\b/i, /(রিফান্ড|টাকা ফেরত|ফেরত চাই)/] },
  { intent: 'PAYMENT', patterns: [/\b(paid|payment|invoice|receipt|transaction|bkash|nagad|rocket|bank transfer)\b/i, /(পেমেন্ট|পরিশোধ|বিকাশ|নগদ|রকেট|ইনভয়েস|রসিদ)/] },
  { intent: 'PRICING', patterns: [/\b(price|pricing|cost|quote|quotation|how much|budget|package|rate)\b/i, /(দাম|মূল্য|খরচ|কত টাকা|প্যাকেজ|কোটেশন)/] },
  { intent: 'DELIVERY_STATUS', patterns: [/\b(deliver(y|ed)?|deadline|when will|status of|progress|eta|timeline)\b/i, /(ডেলিভারি|কবে|কতদিন|অগ্রগতি|সময়সীমা)/] },
  { intent: 'TECHNICAL_SUPPORT', patterns: [/\b(error|bug|not working|broken|down|crash|login issue|can'?t (log ?in|access))\b/i, /(সমস্যা|কাজ করছে না|এরর|ঢুকতে পারছি না|বন্ধ হয়ে)/] },
  { intent: 'NEW_PROJECT', patterns: [/\b(website|web site|app|software|ecommerce|e-commerce|online store|crm|erp|build|develop|design)\b/i, /(ওয়েবসাইট|অ্যাপ|সফটওয়্যার|ই-কমার্স|তৈরি করতে|ডিজাইন)/] },
  { intent: 'GREETING', patterns: [/^\s*(hi|hello|hey|good (morning|afternoon|evening)|salam|assalamu ?alaikum)\b/i, /^\s*(হ্যালো|আসসালামু|সালাম|শুভ)/] },
]

export function classifyIntent(text: string): Intent {
  for (const rule of INTENT_RULES) if (rule.patterns.some((p) => p.test(text))) return rule.intent
  return 'GENERAL'
}

const BUSINESS_RULES: Array<{ type: string; patterns: RegExp[] }> = [
  { type: 'eCommerce', patterns: [/\b(e-?commerce|online store|online shop|retail|shop)\b/i, /(অনলাইন শপ|দোকান|ই-কমার্স)/] },
  { type: 'Education', patterns: [/\b(school|college|training|course|student|coaching)\b/i, /(স্কুল|কলেজ|কোচিং|প্রশিক্ষণ|শিক্ষার্থী)/] },
  { type: 'Restaurants & Food', patterns: [/\b(restaurant|cafe|food|hotel|catering)\b/i, /(রেস্টুরেন্ট|খাবার|হোটেল)/] },
  { type: 'Healthcare', patterns: [/\b(clinic|hospital|doctor|pharmacy|diagnostic)\b/i, /(ক্লিনিক|হাসপাতাল|ডাক্তার|ফার্মেসি)/] },
  { type: 'Real Estate', patterns: [/\b(real estate|property|construction|developer)\b/i, /(রিয়েল এস্টেট|প্রপার্টি|নির্মাণ)/] },
  { type: 'Manufacturing', patterns: [/\b(factory|garment|manufactur\w*|textile)\b/i, /(ফ্যাক্টরি|গার্মেন্ট|কারখানা)/] },
]

export function inferBusinessType(text: string): string | null {
  for (const r of BUSINESS_RULES) if (r.patterns.some((p) => p.test(text))) return r.type
  return null
}

const URGENT = [/\b(urgent|asap|immediately|emergency|site is down|website is down)\b/i, /(জরুরি|এখনই|তাড়াতাড়ি)/]

export function derivePriority(intent: Intent, text: string): 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' {
  if (URGENT.some((p) => p.test(text))) return 'URGENT'
  if (intent === 'COMPLAINT' || intent === 'REFUND' || intent === 'PAYMENT' || intent === 'HUMAN_REQUEST') return 'HIGH'
  if (intent === 'GREETING') return 'LOW'
  return 'NORMAL'
}

export function ticketCategory(intent: Intent): 'GENERAL' | 'BILLING' | 'TECHNICAL' | 'COMPLAINT' | 'SALES' {
  switch (intent) {
    case 'REFUND': case 'PAYMENT': return 'BILLING'
    case 'TECHNICAL_SUPPORT': return 'TECHNICAL'
    case 'COMPLAINT': return 'COMPLAINT'
    case 'PRICING': case 'NEW_PROJECT': return 'SALES'
    default: return 'GENERAL'
  }
}

const PRIORITY_RANK = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 } as const

export type Triage = {
  method: 'RULES'
  language: Language
  intent: Intent
  businessType: string | null
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  ticketCategory: ReturnType<typeof ticketCategory>
  escalationRecommended: boolean
  escalationReason: string | null
}

export function triageText(text: string): Triage {
  const intent = classifyIntent(text)
  const sensitive = SENSITIVE_INTENTS.has(intent)
  return {
    method: 'RULES',
    language: detectLanguage(text),
    intent,
    businessType: inferBusinessType(text),
    priority: derivePriority(intent, text),
    ticketCategory: ticketCategory(intent),
    escalationRecommended: sensitive,
    escalationReason: sensitive ? `${intent.replace('_', ' ').toLowerCase()} needs a human — AI may not confirm prices, payments, refunds, delivery dates or completed work` : null,
  }
}

/** Triage the latest visitor messages and persist the result. Priority only ever increases. */
export async function triageConversation(conversationId: string) {
  const conv = await db.chatConversation.findUnique({ where: { id: conversationId } })
  if (!conv) return null
  const recent = await db.chatMessage.findMany({ where: { conversationId, sender: 'VISITOR' }, orderBy: { createdAt: 'desc' }, take: 5, select: { body: true } })
  const text = recent.map((m) => m.body).reverse().join('\n')
  if (!text) return null
  const t = triageText(text)
  const latest = triageText(recent[0]?.body ?? '')
  const priority = PRIORITY_RANK[latest.priority] > PRIORITY_RANK[conv.priority as keyof typeof PRIORITY_RANK] ? latest.priority : conv.priority
  await db.chatConversation.update({
    where: { id: conversationId },
    data: { aiLanguage: t.language, aiIntent: latest.intent, aiBusinessType: t.businessType ?? conv.aiBusinessType, aiTriagedAt: new Date(), priority },
  })
  return { ...t, intent: latest.intent, priority: priority as Triage['priority'], escalationRecommended: latest.escalationRecommended, escalationReason: latest.escalationReason }
}

// ------------------------------------------------------------
// AI layer (summary + suggestions)
// ------------------------------------------------------------
export type AssistResult =
  | { method: 'AI'; status: 'OK'; suggestions: string[]; summary: string | null; knowledge: Array<{ id: string; title: string }>; withheld: number; agentCode: string }
  | { method: 'AI'; status: 'ESCALATE' | 'NOT_CONFIGURED' | 'FAILED'; reason: string; knowledge: Array<{ id: string; title: string }> }

const AGENT_CODES = ['COM-010', 'BIZ-004', 'SCP-006']

async function runGateway(prompt: string, clientRowId: string | null): Promise<{ ok: true; output: string; agentCode: string } | { ok: false; error: string }> {
  const { runAgent } = await import('@/lib/agents/engine')
  let lastError = 'AI agent did not return output'
  for (const code of AGENT_CODES) {
    const r = await runAgent(code, { input: prompt.slice(0, 20000), workflow: 'INBOX_ASSIST', clientId: clientRowId ?? undefined, actingForClientId: clientRowId })
    if (r.ok && r.output) return { ok: true, output: r.output, agentCode: code }
    lastError = r.error ?? lastError
    if (!/not found|PAUSED|RETIRED/i.test(lastError)) break
  }
  return { ok: false, error: lastError }
}

/** Split a numbered/bulleted model answer into individual suggestions. */
export function parseSuggestions(output: string): string[] {
  const lines = output.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const items: string[] = []
  for (const line of lines) {
    const m = /^(?:\d+[.)]|[-*•])\s+(.*)$/.exec(line)
    if (m) items.push(m[1].trim())
    else if (items.length) items[items.length - 1] += ` ${line}`
  }
  return (items.length ? items : [output.trim()]).map((s) => s.slice(0, 800)).filter(Boolean).slice(0, 3)
}

export async function suggestReplies(conversationId: string, tenantId: string): Promise<AssistResult> {
  const conv = await db.chatConversation.findUnique({ where: { id: conversationId } })
  if (!conv || conv.tenantId !== tenantId) return { method: 'AI', status: 'FAILED', reason: 'Conversation not found', knowledge: [] }
  const messages = await db.chatMessage.findMany({
    where: { conversationId, internal: false },
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: { sender: true, body: true, aiGenerated: true },
  })
  const lastVisitor = messages.find((m) => m.sender === 'VISITOR')
  if (!lastVisitor) return { method: 'AI', status: 'ESCALATE', reason: 'There is no visitor message to answer yet.', knowledge: [] }
  const triage = triageText(lastVisitor.body)
  if (triage.escalationRecommended) {
    return { method: 'AI', status: 'ESCALATE', reason: triage.escalationReason ?? 'Sensitive request — a human must answer.', knowledge: [] }
  }

  const { getAgentProviderStatus } = await import('@/lib/agents/provider-selection')
  const provider = getAgentProviderStatus()
  if (!provider.configured) return { method: 'AI', status: 'NOT_CONFIGURED', reason: `AI provider not configured: ${provider.detail}`, knowledge: [] }

  const { searchKnowledgeRanked } = await import('@/lib/knowledge-search')
  const search = await searchKnowledgeRanked(lastVisitor.body.slice(0, 500), 4).catch(() => ({ results: [] as Array<{ id: string; title: string; excerpt: string }> }))
  const knowledge = search.results.slice(0, 4)
  const refs = knowledge.map((k) => ({ id: k.id, title: k.title }))
  if (knowledge.length === 0) {
    return { method: 'AI', status: 'ESCALATE', reason: 'No approved knowledge matches this question, so no answer was drafted. A human should reply.', knowledge: [] }
  }

  const transcript = [...messages].reverse().map((m) => `${m.sender === 'VISITOR' ? 'Customer' : m.aiGenerated ? 'TECH360 AI' : 'TECH360'}: ${redactSensitiveCrmData(m.body.slice(0, 600)).text}`).join('\n')
  const replyLanguage = triage.language === 'bn' ? 'Bangla' : triage.language === 'mixed' ? 'the same mix of Bangla and English the customer used' : 'English'
  const prompt = `You draft reply suggestions for a TECH360 support agent. A human reviews and sends them; you do not send anything.
Rules (mandatory):
- Use ONLY the approved knowledge below. If it does not answer the question, write exactly: ESCALATE.
- Never state or estimate prices, discounts, payment confirmations, refunds, delivery dates, or that work is completed.
- Do not invent facts, people, policies or links. Be concise and polite.
- Reply in ${replyLanguage}.
Approved knowledge:
${knowledge.map((k, i) => `[${i + 1}] ${k.title}: ${k.excerpt}`).join('\n')}

Conversation:
${transcript}

Return a one-sentence summary line starting with "SUMMARY:" and then up to 3 numbered alternative replies.`

  const r = await runGateway(prompt, conv.clientId)
  if (!r.ok) return { method: 'AI', status: 'FAILED', reason: r.error, knowledge: refs }
  if (/^\s*ESCALATE\s*$/m.test(r.output) && !/^\s*\d+[.)]/m.test(r.output)) {
    return { method: 'AI', status: 'ESCALATE', reason: 'The approved knowledge does not answer this question. A human should reply.', knowledge: refs }
  }
  const summaryMatch = /SUMMARY:\s*(.+)/i.exec(r.output)
  const body = r.output.replace(/SUMMARY:.*(\n|$)/i, '')
  const raw = parseSuggestions(body).filter((s) => s.toUpperCase() !== 'ESCALATE')
  const safe = raw.filter((s) => screenAiReply(s).ok)
  if (safe.length === 0) {
    return { method: 'AI', status: 'ESCALATE', reason: raw.length ? 'Every drafted reply was withheld by the safety guardrail. A human should reply.' : 'No usable suggestion was produced.', knowledge: refs }
  }
  const summary = summaryMatch ? summaryMatch[1].trim().slice(0, 500) : null
  if (summary) await db.chatConversation.update({ where: { id: conversationId }, data: { aiSummary: summary } }).catch(() => null)
  return { method: 'AI', status: 'OK', suggestions: safe, summary, knowledge: refs, withheld: raw.length - safe.length, agentCode: r.agentCode }
}
