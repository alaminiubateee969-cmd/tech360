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
    key: 'domainHosting',
    label: 'Domain, registrar and hosting plan',
    question: 'Do you already control the domain, and where is DNS/hosting managed? If you have shared hosting, what provider and plan is it, and what runtime/database features are listed? Please share only provider/plan details or redacted screenshots—never passwords, OTPs or API keys. “Not sure yet” is fine.',
    example: 'e.g. thedreamerit.com is our domain at registrar X; shared plan Y at host Z; Node.js and MySQL support still to be checked; business email uses existing MX records',
    required: true,
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
    ['Domain, registrar and hosting plan', answers.domainHosting],
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

/** Extract likely public website domains from a customer message. */
export function extractDomainNames(text: string): string[] {
  return Array.from(new Set((text.match(/\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|co|dev|app|ai|bd|uk|us|info|biz)\b/gi) ?? []).map((domain) => domain.toLowerCase()))).slice(0, 5)
}

export function hasHostingPlanDetails(text: string, answeringHostingQuestion = false): boolean {
  if (answeringHostingQuestion && /^\s*(?:no|none|n\/a|not sure|don't know|do not know|not yet)\s*[.!]?\s*$/i.test(text)) return true
  return /shared\s*hosting|hosting\s*(?:plan|provider)|web\s*host|registrar|dns|nameserver|cPanel|Plesk|\b(?:VPS|Node(?:\.js)?|PHP|MySQL|MariaDB|Cloud Run|AWS|Azure|Vercel|Hostinger)\b|(?:domain|website|site).{0,60}\b(?:owned|own|registered|bought|purchased|available|no\s+domain)\b|\b(?:no domain|haven't bought|not purchased)\b|(?:domain|hosting|DNS|Node).{0,50}(?:not sure|don't know|do not know|not yet)|(?:not sure|don't know|do not know|not yet).{0,50}(?:domain|hosting|DNS|Node)/i.test(text)
}

export function extractDomainHostingHint(text: string): string | null {
  const domains = extractDomainNames(text)
  const hasPlanDetails = hasHostingPlanDetails(text)
  if (!domains.length && !hasPlanDetails) return null
  const named = domains.length ? `Domain(s) mentioned by customer: ${domains.join(', ')}. ` : ''
  return `${named}Customer-provided hosting/domain detail: ${text.slice(0, 700)}. Registration/availability, ownership, DNS control and host compatibility are not verified; confirm before recommending deployment. No secret credentials should be shared in chat.`.slice(0, 1000)
}

/** True when an answer is meaningful (not empty or a placeholder). */
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
  const bengali = /[\u0980-\u09FF]/.test(Object.values(answers).filter(Boolean).join(' '))
  const systemIdeas = bengali ? [
    'গ্রাহকদের জন্য একটি ওয়েবসাইট, CRM এবং enquiry/sales pipeline-এর সঙ্গে সংযুক্ত',
    ...(retail ? ['পণ্য তালিকা এবং বিক্রি, মজুত ও আসন্ন পণ্যের হিসাব'] : []),
    ...(answers.staffOperations ? ['কর্মীদের ভূমিকা, কাজের দায়িত্ব ও পরিচালনাগত রিপোর্ট'] : []),
    ...(answers.marketingAndLeads || answers.localSeoLocations ? ['যাচাইকৃত অবস্থানের জন্য পরিমাপযোগ্য মার্কেটিং ও local-search পরিকল্পনা'] : []),
  ] : [
    'a customer-facing website connected to a CRM and enquiry/sales pipeline',
    ...(retail ? ['a product catalogue and stock/sales view for sold, available and upcoming items'] : []),
    ...(answers.staffOperations ? ['staff roles, task ownership and operational reporting'] : []),
    ...(answers.marketingAndLeads || answers.localSeoLocations ? ['a measurable marketing and local-search plan for verified locations'] : []),
  ]
  const bengaliLabels: Partial<Record<DiscoveryFieldKey, string>> = {
    businessType: 'ব্যবসার ধরন', objective: 'ব্যবসার লক্ষ্য', intendedUsers: 'ব্যবহারকারী', pagesFeatures: 'প্রয়োজনীয় পেজ/ফিচার',
    productCatalog: 'পণ্য, সেবা ও ক্যাটালগের আকার', salesAndStock: 'বিক্রি ও মজুত ব্যবস্থাপনা', upcomingProducts: 'আসন্ন পণ্য ও উদ্বোধন',
    staffOperations: 'কর্মী ও দৈনন্দিন পরিচালনা', marketingAndLeads: 'মার্কেটিং ও গ্রাহক সংগ্রহ', localSeoLocations: 'Google Maps, local SEO ও সেবার এলাকা',
    existingWebsite: 'বর্তমান ওয়েবসাইট/রেফারেন্স', domainHosting: 'ডোমেইন, রেজিস্ট্রার ও হোস্টিং প্ল্যান', integrations: 'ইন্টিগ্রেশন',
    timeline: 'সময়সীমা', budget: 'বাজেট', contentAssets: 'কনটেন্ট/সম্পদ',
  }
  const lines: string[] = bengali ? [
    `${clientName}-এর প্রাথমিক সমাধান প্রস্তাব · Client ID ${clientId}`,
    'এটি আপনার মতামতের জন্য একটি প্রাথমিক, বাধ্যতামূলক নয় এমন ধারণা—চূড়ান্ত Scope of Work, মূল্য প্রস্তাব বা পেমেন্ট অনুরোধ নয়।',
    '',
    'আপনার দেওয়া তথ্যের ভিত্তিতে প্রস্তাবিত দিক:',
    ...systemIdeas.map((idea) => `• ${idea}`),
    '',
    'ঐচ্ছিক প্রাথমিক অফার: মানবীয় পর্যালোচনার পর যোগ্য ক্ষেত্রে লিখিত প্রস্তাবে ছাড় বা সীমিত প্রাথমিক local-SEO কাজ অন্তর্ভুক্ত হতে পারে। অনুমোদিত scope-এ স্পষ্টভাবে লেখা না থাকলে কোনো ছাড়, বিনামূল্যের কাজ, সার্চ র‍্যাঙ্কিং বা বিক্রির ফল প্রতিশ্রুত নয়।',
    '',
    'বাস্তবায়ন ও হোস্টিং পরিকল্পনা (চূড়ান্ত scope-এর আগে নিশ্চিত হবে):',
    '• ডোমেইনের নিয়ন্ত্রণ এবং হোস্টিং provider/plan-এর তথ্য যাচাই/নিশ্চিত করার আগে framework চূড়ান্ত বা deployment-এর প্রতিশ্রুতি দেওয়া হবে না। চ্যাটে লেখা domain name মালিকানা বা availability-এর প্রমাণ নয়।',
    '• নির্দিষ্ট hosting plan যাচাই না হওয়া পর্যন্ত framework বা deployment চূড়ান্ত নয়। কিছু shared plan-এ static site বা supported PHP চলতে পারে; server-side Node/Next.js, CRM/API ও AI worker-এর জন্য plan-ভিত্তিক সুবিধা দরকার। উপযুক্ত host, আলাদা managed service বা কমানো scope—এসব বিকল্প তুলনা করে পরিবর্তনের আগে আপনার অনুমতি নেওয়া হবে।',
    '• প্রাথমিক প্রস্তাবে এই শর্তসাপেক্ষ সুপারিশ থাকবে। চূড়ান্ত Scope of Work-এ প্রযোজ্য ক্ষেত্রে website, database, file ও AI/automation অংশ কোথায় চলবে, হোস্টের সুবিধা, চলতি খরচ, নিরাপত্তা/backup, DNS/SSL, পরীক্ষা ও rollback স্পষ্ট করা হবে।',
    '• ডোমেইন ও হোস্টিং অ্যাকাউন্টের মালিকানা আপনার থাকবে। চ্যাট/ইমেইলে password, OTP বা API key পাঠাবেন না; প্রয়োজনীয় access অনুমোদিত নিরাপদ মাধ্যমে ও সীমিত অনুমতিতে দেওয়া হবে।',
    '• TECH360-এর সম্পূর্ণ অভ্যন্তরীণ AI agent-ব্যবস্থা আপনার shared hosting-এ রাখা হবে না। কেবল সম্মত, বিচ্ছিন্ন project component/agent ব্যবহার হবে। shared plan নিরাপদে উপযুক্ত না হলে host বা DNS পরিবর্তনের আগে বিকল্প জানিয়ে আপনার অনুমতি নেওয়া হবে।',
    '',
    'পর্যালোচনার জন্য আবিষ্কৃত তথ্য:',
  ] : [
    `Preliminary solution proposal for ${clientName} · Client ID ${clientId}`,
    'This is a non-binding concept for your feedback, not the final Scope of Work, price quote or payment request.',
    '',
    'Suggested direction based on the information shared:',
    ...systemIdeas.map((idea) => `• ${idea}`),
    '',
    'Optional introductory offer: an eligible discount or limited basic local-SEO setup may be included in the written proposal after human review. No discount, free deliverable, search ranking or sales result is promised unless stated in the approved scope.',
    '',
    'Implementation and hosting plan (to confirm before final scope):',
    '• We will confirm domain control with you and check the hosting provider/plan evidence before fixing the framework or promising deployment; a name in chat is not proof of availability or ownership.',
    '• Until the exact plan is checked, no framework or deployment choice is final. Static sites or supported PHP may fit some shared plans; server-side Node/Next.js, a CRM/API and AI workers need plan-specific support. We will compare a compatible host, separate managed service or reduced scope, and get your approval before changes.',
    '• The preliminary proposal will state this conditional recommendation. The final Scope of Work will specify where applicable the website, database, files and AI/automation components run; supported host features; recurring provider costs; security/backups; DNS/SSL steps; acceptance tests and rollback.',
    '• You retain ownership of your domain and hosting accounts. Never send passwords, OTPs or API keys in chat/email; any necessary access uses an approved secure channel and least privilege.',
    '• We will not place TECH360’s whole internal AI workforce on a shared host. Only agreed, isolated project components/agents are used. If the shared plan cannot support the project safely, we will present options and get your approval before changing hosts or DNS.',
    '',
    'Discovery details for review:',
  ]
  for (const field of DISCOVERY_FIELDS) {
    const val = answers[field.key]
    if (val) lines.push(`• ${bengali ? bengaliLabels[field.key] ?? field.label : field.label}: ${val.trim()}`)
  }
  if (proposalFeedback) lines.push(bengali ? `• ইতোমধ্যে পাওয়া মতামত: ${proposalFeedback}` : `• Feedback already received: ${proposalFeedback}`)
  lines.push('')
  lines.push(bengali
    ? 'এই প্রস্তাবের দিকটি ঠিক থাকলে “অনুমোদিত” লিখুন, অথবা মতামত/পরিবর্তন জানান। আপনার মতামতের পর পর্যালোচনার জন্য বিস্তারিত Scope of Work তৈরি করা হবে। চূড়ান্ত scope আপনি অনুমোদন করার পরই কেবল পেমেন্ট নিয়ে আলোচনা হবে।'
    : 'Reply APPROVED if this proposal direction is right, or send your feedback/changes. After your feedback, we will prepare a detailed Scope of Work for your review. Payment is discussed only after you approve that final scope.')
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
  if (/অনুমোদিত\s+নই|অনুমোদন.{0,12}না|সম্মত\s+নই|ঠিক\s+নয়|ঠিক\s+না/.test(t)) return false
  if (/অনুমোদিত|অনুমোদন করছি|আমি সম্মত|সম্মতি দিচ্ছি|ঠিক আছে/.test(t)) return true
  return ['confirmed', 'confirm', 'yes', 'correct', 'looks good', 'approved', 'ok'].some((w) => t === w || t === `${w}.` || t.includes(` ${w} `) || t.startsWith(`${w} `))
}

export function isRevisionRequest(text: string): boolean {
  const t = text.trim().toLowerCase()
  return ['change', 'revise', 'edit', 'update', 'correction', 'not correct', 'add', 'remove', 'পরিবর্তন', 'সংশোধন', 'বদল', 'যোগ করুন', 'বাদ দিন', 'আপডেট'].some((w) => t.includes(w))
}
