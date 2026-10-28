// ============================================================
// TECH360 — One-Question-at-a-Time Discovery Engine
// Requirement C: Use existing AI agent engine and journey functions.
// For each customer turn: load client record, conversation history,
// known requirements, current lifecycle stage. Determine what is
// already known and missing. Answer actual question first. Ask at most
// one primary follow-up per message. Never ask again for info already
// supplied. Save answer and update CRM before advancing.
// ============================================================

import { db } from '@/lib/db'

export const DISCOVERY_FIELDS = [
  {
    key: 'businessType',
    label: 'Business type',
    question: 'What type of business or organization is this for?',
    example: 'e.g. eCommerce fashion store, education institute, restaurant, real estate, healthcare…',
    required: true,
  },
  {
    key: 'objective',
    label: 'Business objective',
    question: 'What is the main problem you want to solve or outcome you want to achieve?',
    example: 'e.g. increase online sales, manage student enrolments, automate bookings…',
    required: true,
  },
  {
    key: 'intendedUsers',
    label: 'Intended users',
    question: 'Who will use this system — customers, staff, admins, or all of them? Roughly how many users?',
    example: 'e.g. 5 staff + public customers, or 200 students…',
    required: true,
  },
  {
    key: 'pagesFeatures',
    label: 'Requested pages / features',
    question: 'Which pages or features are essential on day one?',
    example: 'e.g. homepage, product catalogue, checkout, booking calendar, admin dashboard…',
    required: true,
  },
  {
    key: 'productCatalog',
    label: 'Products, services and catalogue size',
    question: 'What products or services do you sell, and roughly how many products, models or SKUs should the system manage?',
    example: 'e.g. computer shop with 450 product models, or AC sales and servicing with 6 service categories; an estimate is fine',
    required: true,
  },
  {
    key: 'salesAndStock',
    label: 'Sales, stock and inventory workflow',
    question: 'How do you record sales and stock today, and what should the system show for units sold, current stock, low-stock items, suppliers and returns?',
    example: 'e.g. spreadsheet/POS; show daily sales, serial numbers, warranty, stock by branch and reorder alerts',
    required: true,
  },
  {
    key: 'upcomingProducts',
    label: 'Upcoming products and launches',
    question: 'Are any products, models, services or seasonal offers coming soon that should appear as upcoming or pre-order items?',
    example: 'List product/model and expected date, or say “none known yet”.',
    required: true,
  },
  {
    key: 'staffOperations',
    label: 'Employees and daily operations',
    question: 'How many employees and branches are involved, what roles do they have, and what work or approvals should management be able to track?',
    example: 'e.g. 8 staff across 2 branches: sales, stock, accounts and delivery; track tasks, attendance and sales targets',
    required: true,
  },
  {
    key: 'marketingAndLeads',
    label: 'Marketing and customer acquisition',
    question: 'How do customers find you today, which marketing channels do you use, and what kind of enquiries or sales do you want to increase?',
    example: 'e.g. Google Search/Maps, Facebook, referrals, walk-ins; more calls for AC installation or computer sales',
    required: true,
  },
  {
    key: 'localSeoLocations',
    label: 'Google Maps, local SEO and service areas',
    question: 'Which real shop locations or service areas should customers find you in Google Search and Maps? Share the business address/area and any Google Business Profile or website link.',
    example: 'e.g. shop in Elephant Road, serves Dhanmondi and Mirpur; share a Maps/profile URL if available. We will not invent map pins or promise rankings.',
    required: true,
  },
  {
    key: 'existingWebsite',
    label: 'Existing website / references',
    question: 'Do you have an existing website, Facebook page, or a reference site you like?',
    example: 'e.g. https://example.com or “no, starting from scratch”',
    required: false,
  },
  {
    key: 'integrations',
    label: 'Integrations',
    question: 'Do you need payment gateway, WhatsApp automation, SMS, or other integrations?',
    example: 'e.g. bKash / SSLCommerz, WhatsApp order alerts, inventory sync…',
    required: false,
  },
  {
    key: 'timeline',
    label: 'Timeline',
    question: 'When would you like to launch — is there a fixed date or event driving it?',
    example: 'e.g. within 6 weeks, before Ramadan, no rush…',
    required: true,
  },
  {
    key: 'budget',
    label: 'Budget',
    question: 'Do you have a budget range in mind for the initial delivery?',
    example: 'e.g. Under $500, $1,000–$5,000, $10,000+, or “to be discussed”',
    required: false,
  },
  {
    key: 'contentAssets',
    label: 'Content / assets',
    question: 'Will you provide logo, product photos, text content, domain and hosting — or should we help with those?',
    example: 'e.g. “I have logo and domain, need help with content”',
    required: false,
  },
] as const

export type DiscoveryField = (typeof DISCOVERY_FIELDS)[number]
export type DiscoveryFieldKey = (typeof DISCOVERY_FIELDS)[number]['key']
export type DiscoveryAnswers = Partial<Record<DiscoveryFieldKey, string>>

export type DiscoveryState = {
  answers: DiscoveryAnswers
  currentQuestion: DiscoveryFieldKey | null
  completed: boolean
  summarySent: boolean
  summaryConfirmed: boolean
  proposalFeedback: string | null
  updatedAt: string
}

const MEMORY_SCOPE = 'DISCOVERY'
function memoryKey(clientId: string): string {
  return `discovery:${clientId}`
}

export function emptyDiscoveryState(): DiscoveryState {
  return {
    answers: {},
    currentQuestion: null,
    completed: false,
    summarySent: false,
    summaryConfirmed: false,
    proposalFeedback: null,
    updatedAt: new Date().toISOString(),
  }
}

/** Load discovery state from AiMemory (reuse existing table, no new migration). */
export async function loadDiscoveryState(clientRowId: string): Promise<DiscoveryState> {
  try {
    const row = await db.aiMemory.findFirst({
      where: { scope: MEMORY_SCOPE, key: memoryKey(clientRowId) },
    })
    if (!row) return emptyDiscoveryState()
    const parsed = JSON.parse(row.content) as DiscoveryState
    const answers = parsed.answers ?? {}
    const next = nextQuestion(answers)
    return {
      answers,
      // Re-open discovery when new fields are added, including for older leads
      // that had a completed state under a previous question set.
      currentQuestion: next?.key ?? null,
      completed: next === null,
      summarySent: next === null ? Boolean(parsed.summarySent) : false,
      summaryConfirmed: next === null ? Boolean(parsed.summaryConfirmed) : false,
      proposalFeedback: typeof parsed.proposalFeedback === 'string' ? parsed.proposalFeedback.slice(0, 4000) : null,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    }
  } catch {
    return emptyDiscoveryState()
  }
}

export async function saveDiscoveryState(clientRowId: string, state: DiscoveryState): Promise<void> {
  const now = new Date().toISOString()
  const next = { ...state, updatedAt: now }
  const key = memoryKey(clientRowId)
  const existing = await db.aiMemory.findFirst({
    where: { scope: MEMORY_SCOPE, key },
  })
  if (existing) {
    await db.aiMemory.update({
      where: { id: existing.id },
      data: { content: JSON.stringify(next), updatedAt: new Date() },
    })
  } else {
    await db.aiMemory.create({
      data: {
        scope: MEMORY_SCOPE,
        key,
        content: JSON.stringify(next),
        clientId: clientRowId,
        importance: 6,
      },
    })
  }
  // Also sync known answers to Client/Lead for CRM visibility (existing fields)
  await syncDiscoveryToCrm(clientRowId, next.answers).catch(() => null)
}

async function syncDiscoveryToCrm(clientRowId: string, answers: DiscoveryAnswers): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (answers.businessType) patch.businessType = answers.businessType.slice(0, 80)
  const requirementEntries: Array<[string, string | undefined]> = [
    ['Business objective', answers.objective],
    ['Users and roles', answers.intendedUsers],
    ['Required pages/features', answers.pagesFeatures],
    ['Products/catalogue size', answers.productCatalog],
    ['Sales, stock and inventory', answers.salesAndStock],
    ['Upcoming products', answers.upcomingProducts],
    ['Employees and operations', answers.staffOperations],
    ['Marketing and lead sources', answers.marketingAndLeads],
    ['Google Maps/local SEO locations', answers.localSeoLocations],
    ['Existing website/references', answers.existingWebsite],
    ['Integrations', answers.integrations],
    ['Timeline', answers.timeline],
    ['Content/assets', answers.contentAssets],
  ]
  const req = requirementEntries
    .filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
    .map(([label, value]) => `${label}: ${value.trim()}`)
    .join('\n\n')
    .slice(0, 8000)
  if (req) {
    // Keep the full discovery, including store operations and local SEO, in the existing CRM requirements field.
    await db.lead.update({ where: { clientId: clientRowId }, data: { requirements: req } }).catch(() => null)
  }
  if (answers.budget) patch.notes = `Budget: ${answers.budget}`
  if (Object.keys(patch).length) {
    await db.client.update({ where: { id: clientRowId }, data: patch as never }).catch(() => null)
  }
}

/** True when answer is meaningful (not empty, not placeholder). */
export function isAnswered(value: string | undefined): boolean {
  if (!value) return false
  const v = value.trim().toLowerCase()
  if (v.length < 2) return false
  // Allow "n/a", "none", "no" as valid answers for optional fields — but mark as answered
  return true
}

/** Determine what is still missing — only fields not yet answered. */
export function missingFields(answers: DiscoveryAnswers): DiscoveryField[] {
  return DISCOVERY_FIELDS.filter((f) => {
    const val = answers[f.key]
    if (isAnswered(val)) return false
    return true
  }) as DiscoveryField[]
}

/** Required fields still missing. */
export function missingRequiredFields(answers: DiscoveryAnswers): DiscoveryField[] {
  return missingFields(answers).filter((f) => f.required) as DiscoveryField[]
}

/** Pick the next single question to ask — null when discovery is complete. */
export function nextQuestion(answers: DiscoveryAnswers): DiscoveryField | null {
  const missing = missingFields(answers)
  if (missing.length === 0) return null
  // Prioritize required fields first, in defined order
  const requiredFirst = missing.filter((f) => f.required)
  return (requiredFirst[0] ?? missing[0]) ?? null
}

/** Build a concise summary for customer confirmation. */
export function buildSummary(answers: DiscoveryAnswers, clientName: string, clientId: string, proposalFeedback?: string | null): string {
  const type = (answers.businessType ?? '').toLowerCase()
  const retail = /shop|store|retail|computer|electronics|ecommerce|e-commerce|product|device|গ্যাজেট|দোকান/.test(type)
  const systemIdeas = [
    'a customer-facing website connected to a CRM and enquiry/sales pipeline',
    ...(retail ? ['a product catalogue and stock/sales view for sold, available and upcoming items'] : []),
    ...(answers.staffOperations ? ['staff roles, task ownership and operational reporting'] : []),
    ...(answers.marketingAndLeads || answers.localSeoLocations ? ['a measurable marketing and local-search plan for verified locations'] : []),
  ]
  const lines: string[] = [
    `Preliminary solution proposal for ${clientName} · Client ID ${clientId}`,
    'This is a non-binding concept for your feedback, not the final Scope of Work, price quote or payment request.',
    '',
    'Suggested direction based on the information shared:',
    ...systemIdeas.map((idea) => `• ${idea}`),
    '',
    'Optional introductory offer: an eligible discount or limited basic local-SEO setup may be included in the written proposal after human review. No discount, free deliverable, search ranking or sales result is promised unless stated in the approved scope.',
    '',
    'Discovery details for review:',
  ]
  for (const field of DISCOVERY_FIELDS) {
    const val = answers[field.key]
    if (val) lines.push(`• ${field.label}: ${val.trim()}`)
  }
  if (proposalFeedback) lines.push(`• Feedback already received: ${proposalFeedback}`)
  lines.push('')
  lines.push('Reply APPROVED if this proposal direction is right, or send your feedback/changes. After your feedback, we will prepare a detailed Scope of Work for your review. Payment is discussed only after you approve that final scope.')
  return lines.join('\n')
}

/** Heuristic: try to extract an answer for the current question from free-form text. */
export function isEmailLike(text: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text.trim())
}

export function extractEmail(text: string): string | null {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return match ? match[0].toLowerCase() : null
}

export function isConfirmation(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (/\b(?:not|don't|do not|haven't|have not|cannot|can't)\s+(?:yet\s+)?(?:approve|approved|confirm|confirmed)\b/.test(t)) return false
  return ['confirmed', 'confirm', 'yes', 'correct', 'looks good', 'approved', 'ok'].some((w) => t === w || t === `${w}.` || t.includes(` ${w} `) || t.startsWith(`${w} `))
}

export function isRevisionRequest(text: string): boolean {
  const t = text.trim().toLowerCase()
  return ['change', 'revise', 'edit', 'update', 'correction', 'not correct', 'add', 'remove'].some((w) => t.includes(w))
}
