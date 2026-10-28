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
  summaryConfirmed: boolean
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
    summaryConfirmed: false,
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
    return {
      answers: parsed.answers ?? {},
      currentQuestion: parsed.currentQuestion ?? null,
      completed: Boolean(parsed.completed),
      summaryConfirmed: Boolean(parsed.summaryConfirmed),
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
  if (answers.objective || answers.pagesFeatures) {
    const req = [answers.objective, answers.pagesFeatures, answers.intendedUsers, answers.existingWebsite, answers.integrations]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 8000)
    if (req) {
      // Update Lead.requirements for CRM visibility
      await db.lead
        .update({ where: { clientId: clientRowId }, data: { requirements: req } })
        .catch(() => null)
    }
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
export function buildSummary(answers: DiscoveryAnswers, clientName: string, clientId: string): string {
  const lines: string[] = [
    `Thank you — here is a summary of your requirements under Client ID ${clientId}. Please confirm if this is correct or tell me what to change:`,
    '',
  ]
  for (const field of DISCOVERY_FIELDS) {
    const val = answers[field.key]
    if (val) {
      lines.push(`• ${field.label}: ${val.trim()}`)
    }
  }
  lines.push('')
  lines.push('Reply CONFIRMED if this is correct, or describe any changes you need.')
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
  return ['confirmed', 'confirm', 'yes', 'correct', 'looks good', 'approved', 'ok'].some((w) => t === w || t === `${w}.` || t.includes(` ${w} `) || t.startsWith(`${w} `))
}

export function isRevisionRequest(text: string): boolean {
  const t = text.trim().toLowerCase()
  return ['change', 'revise', 'edit', 'update', 'correction', 'not correct', 'add', 'remove'].some((w) => t.includes(w))
}
