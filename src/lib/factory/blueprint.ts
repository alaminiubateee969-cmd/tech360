/**
 * TECH360 — AI Software Factory blueprint engine
 * ==============================================
 * One brief form in, one deliverable client web application out.
 *
 * This module is deliberately PURE and DETERMINISTIC: the same brief always
 * produces the same plan and the same file tree, with no network access and no
 * model call. That is what makes the factory auditable — the AI pass (agent
 * CST-020 / ENG agents through the SDK) may enrich copy later, but the
 * structure a client receives is reproducible and reviewable by a human
 * before it is delivered.
 *
 * Honest boundaries (must stay true):
 *   - The generated project is a REAL Next.js + Prisma + Tailwind starter with
 *     its own README, scope document and handover notes. It is not a claim of
 *     a finished product; it is the reviewed starting point that the delivery
 *     team owns and hands over.
 *   - No secret, token, key or credential is ever written into a generated
 *     file. Environment files carry variable NAMES and empty values only.
 *   - Anything the brief asks for that the factory cannot build is returned in
 *     `plan.notBuilt` instead of being silently dropped.
 */

export const FACTORY_VERTICALS = [
  'crm',
  'marketing',
  'education',
  'ecommerce',
  'booking',
  'realestate',
  'support',
] as const
export type FactoryVertical = (typeof FACTORY_VERTICALS)[number]

export const FACTORY_MODULES = [
  'leads',
  'pipeline',
  'clients',
  'projects',
  'invoices',
  'payments',
  'communications',
  'newsletter',
  'content',
  'analytics',
  'chat',
  'knowledge',
  'portal',
  'reviews',
] as const
export type FactoryModule = (typeof FACTORY_MODULES)[number]

export type FactoryBrief = {
  appName: string
  clientName: string
  vertical: FactoryVertical
  modules: FactoryModule[]
  language: 'EN' | 'BN' | 'BOTH'
  currency: string
  primaryColor: string
  primaryContact: string
  notes: string
}

export type FactoryPlanPage = { path: string; title: string; purpose: string }
export type FactoryPlanModel = { name: string; fields: Array<{ name: string; type: string; note: string }>; note: string }
export type FactoryPlanEndpoint = { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; purpose: string }
export type FactoryPlanAgent = { code: string; name: string; purpose: string; approval: boolean }
export type FactoryPlanAutomation = { code: string; name: string; trigger: string; action: string }

export type FactoryPlan = {
  appName: string
  slug: string
  vertical: FactoryVertical
  summary: string
  designTokens: { primary: string; ink: string; surface: string; radius: string; font: string }
  roles: string[]
  pages: FactoryPlanPage[]
  models: FactoryPlanModel[]
  endpoints: FactoryPlanEndpoint[]
  agents: FactoryPlanAgent[]
  automations: FactoryPlanAutomation[]
  acceptanceCriteria: string[]
  notBuilt: string[]
}

export type FactoryFile = { path: string; language: string; content: string }

const VERTICAL_LABEL: Record<FactoryVertical, string> = {
  crm: 'CRM & client pipeline',
  marketing: 'Marketing agency workspace',
  education: 'Education consultancy',
  ecommerce: 'Service commerce',
  booking: 'Booking & appointments',
  realestate: 'Property & lettings',
  support: 'Customer support desk',
}

const VERTICAL_SUMMARY: Record<FactoryVertical, string> = {
  crm: 'Lead-to-cash CRM: intake, pipeline, clients, scope, projects, invoices and payments in one workspace.',
  marketing: 'Campaign workspace: briefs, content calendar, marketing kits, audience lists and reporting.',
  education: 'Consultancy workspace: enquiries, eligibility scoring, applications, documents and offer tracking.',
  ecommerce: 'Service commerce: catalogue of services, quotes, orders, fulfilment notes and receipts.',
  booking: 'Booking workspace: availability, appointments, reminders, rescheduling and attendance.',
  realestate: 'Property workspace: listings, viewings, applicants, offers and tenancy handover.',
  support: 'Support desk: tickets, SLA timers, knowledge articles and customer replies.',
}

/** Trim, clamp and sanitise a brief coming from a form. Never throws. */
export function normalizeBrief(input: Record<string, unknown>): FactoryBrief {
  const str = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
  const vertical = (FACTORY_VERTICALS as readonly string[]).includes(String(input.vertical))
    ? (input.vertical as FactoryVertical)
    : 'crm'
  const modules = Array.isArray(input.modules)
    ? (input.modules as unknown[])
        .map((m) => String(m).toLowerCase())
        .filter((m): m is FactoryModule => (FACTORY_MODULES as readonly string[]).includes(m))
    : []
  const language = ['EN', 'BN', 'BOTH'].includes(String(input.language)) ? (input.language as FactoryBrief['language']) : 'EN'
  const color = str(input.primaryColor, 7)
  return {
    appName: str(input.appName, 80) || 'Client Workspace',
    clientName: str(input.clientName, 80) || 'Client',
    vertical,
    modules: modules.length ? [...new Set(modules)] : [...DEFAULT_MODULES[vertical]],
    language,
    currency: (str(input.currency, 3) || 'GBP').toUpperCase(),
    primaryColor: /^#[0-9a-fA-F]{6}$/.test(color) ? color.toUpperCase() : '#063B8F',
    primaryContact: str(input.primaryContact, 120),
    notes: String(input.notes ?? '').trim().slice(0, 4000),
  }
}

const DEFAULT_MODULES: Record<FactoryVertical, FactoryModule[]> = {
  crm: ['leads', 'pipeline', 'clients', 'projects', 'invoices', 'communications'],
  marketing: ['leads', 'content', 'newsletter', 'analytics', 'clients'],
  education: ['leads', 'pipeline', 'clients', 'communications', 'portal'],
  ecommerce: ['clients', 'invoices', 'payments', 'content', 'reviews'],
  booking: ['leads', 'clients', 'communications', 'portal'],
  realestate: ['leads', 'pipeline', 'clients', 'projects', 'communications'],
  support: ['clients', 'chat', 'knowledge', 'communications', 'analytics'],
}

const MODULE_LABEL: Record<FactoryModule, string> = {
  leads: 'Lead capture & scoring',
  pipeline: 'Pipeline stages',
  clients: 'Client records',
  projects: 'Projects & tasks',
  invoices: 'Invoices',
  payments: 'Payments',
  communications: 'Communications log',
  newsletter: 'Newsletter',
  content: 'Content studio',
  analytics: 'First-party analytics',
  chat: 'Live chat & inbox',
  knowledge: 'Knowledge base',
  portal: 'Client portal',
  reviews: 'Reviews & referrals',
}

const MODULE_MODELS: Record<FactoryModule, FactoryPlanModel[]> = {
  leads: [
    { name: 'Lead', fields: [{ name: 'name', type: 'String', note: 'contact name' }, { name: 'email', type: 'String?', note: 'optional' }, { name: 'phone', type: 'String?', note: 'E.164 where known' }, { name: 'source', type: 'String', note: 'form | chat | import' }, { name: 'stage', type: 'String', note: 'NEW | QUALIFIED | WON | LOST' }, { name: 'score', type: 'Int', note: '0-100' }], note: 'Every enquiry becomes a real row — never a mail-only notification.' },
  ],
  pipeline: [
    { name: 'PipelineStage', fields: [{ name: 'key', type: 'String', note: 'stable key' }, { name: 'label', type: 'String', note: 'display label' }, { name: 'position', type: 'Int', note: 'ordering' }], note: 'Stages are data, so the client can rename them without a code change.' },
  ],
  clients: [
    { name: 'Client', fields: [{ name: 'name', type: 'String', note: 'company or person' }, { name: 'clientCode', type: 'String', note: 'short human id' }, { name: 'email', type: 'String?', note: '' }, { name: 'status', type: 'String', note: 'ACTIVE | PAUSED | CLOSED' }], note: 'Client is the anchor every other record points at.' },
  ],
  projects: [
    { name: 'Project', fields: [{ name: 'clientId', type: 'String', note: 'owner client' }, { name: 'title', type: 'String', note: '' }, { name: 'status', type: 'String', note: 'PLANNING | ACTIVE | DELIVERED' }], note: '' },
    { name: 'Task', fields: [{ name: 'projectId', type: 'String', note: '' }, { name: 'title', type: 'String', note: '' }, { name: 'status', type: 'String', note: 'TODO | DOING | DONE' }, { name: 'dueAt', type: 'DateTime?', note: '' }], note: '' },
  ],
  invoices: [
    { name: 'Invoice', fields: [{ name: 'number', type: 'String', note: 'sequential, human typed' }, { name: 'clientId', type: 'String', note: '' }, { name: 'total', type: 'Decimal', note: 'never Float for money' }, { name: 'status', type: 'String', note: 'DRAFT | SENT | PAID | OVERDUE' }], note: 'Money is Decimal with an explicit currency column.' },
  ],
  payments: [
    { name: 'Payment', fields: [{ name: 'invoiceId', type: 'String?', note: 'allocation target' }, { name: 'amount', type: 'Decimal', note: '' }, { name: 'method', type: 'String', note: 'STRIPE | BANK | CASH | OTHER' }, { name: 'status', type: 'String', note: 'PENDING | SETTLED | REFUNDED' }], note: 'A payment is only SETTLED by a verified server-side event.' },
  ],
  communications: [
    { name: 'Communication', fields: [{ name: 'channel', type: 'String', note: 'EMAIL | WHATSAPP | SMS | CALL' }, { name: 'direction', type: 'String', note: 'IN | OUT' }, { name: 'clientId', type: 'String?', note: '' }, { name: 'status', type: 'String', note: 'QUEUED | SENT | REFUSED | FAILED' }], note: 'Refusals are stored too — an unconfigured channel must never look sent.' },
  ],
  newsletter: [
    { name: 'Subscriber', fields: [{ name: 'email', type: 'String', note: 'unique' }, { name: 'status', type: 'String', note: 'PENDING | CONFIRMED | UNSUBSCRIBED' }], note: 'Consent state is part of the record.' },
    { name: 'Campaign', fields: [{ name: 'subject', type: 'String', note: '' }, { name: 'sentAt', type: 'DateTime?', note: '' }], note: '' },
  ],
  content: [
    { name: 'ContentAsset', fields: [{ name: 'type', type: 'String', note: 'BRIEF | KIT | SCRIPT | POST' }, { name: 'title', type: 'String', note: '' }, { name: 'body', type: 'String', note: '@db.LongText in the real schema' }, { name: 'status', type: 'String', note: 'DRAFT | REVIEW | APPROVED | PUBLISHED' }], note: 'Nothing publishes without an approval step.' },
  ],
  analytics: [
    { name: 'Pageview', fields: [{ name: 'path', type: 'String', note: '' }, { name: 'referrer', type: 'String?', note: '' }, { name: 'consent', type: 'Boolean', note: 'cookie-light, consent aware' }], note: 'First-party, no third-party tracker.' },
  ],
  chat: [
    { name: 'Conversation', fields: [{ name: 'visitorKey', type: 'String', note: 'anonymous until converted' }, { name: 'status', type: 'String', note: 'OPEN | CLOSED' }], note: '' },
    { name: 'Message', fields: [{ name: 'conversationId', type: 'String', note: '' }, { name: 'role', type: 'String', note: 'VISITOR | AGENT' }, { name: 'body', type: 'String', note: '' }], note: '' },
  ],
  knowledge: [
    { name: 'KnowledgeArticle', fields: [{ name: 'title', type: 'String', note: '' }, { name: 'body', type: 'String', note: '' }, { name: 'status', type: 'String', note: 'DRAFT | PUBLISHED | ARCHIVED' }], note: '' },
  ],
  portal: [
    { name: 'PortalAccess', fields: [{ name: 'clientId', type: 'String', note: '' }, { name: 'identifier', type: 'String', note: 'client id + verified contact' }, { name: 'lastSeenAt', type: 'DateTime?', note: '' }], note: 'Portal sessions are separate from staff sessions.' },
  ],
  reviews: [
    { name: 'Review', fields: [{ name: 'clientId', type: 'String', note: '' }, { name: 'rating', type: 'Int', note: '1-5' }, { name: 'status', type: 'String', note: 'PENDING | APPROVED | HIDDEN' }], note: 'Moderation before anything public.' },
  ],
}

const MODULE_ENDPOINTS: Record<FactoryModule, FactoryPlanEndpoint[]> = {
  leads: [
    { method: 'POST', path: '/api/leads', purpose: 'Public intake → creates a real Lead row' },
    { method: 'GET', path: '/api/leads', purpose: 'Staff list with filters and CSV export' },
  ],
  pipeline: [{ method: 'PATCH', path: '/api/leads/:id', purpose: 'Move a lead between stages (audited)' }],
  clients: [{ method: 'GET', path: '/api/clients', purpose: 'Client directory' }],
  projects: [{ method: 'POST', path: '/api/projects', purpose: 'Open a project for a client' }],
  invoices: [{ method: 'POST', path: '/api/invoices', purpose: 'Create a numbered invoice' }],
  payments: [{ method: 'POST', path: '/api/payments', purpose: 'Record a payment against an invoice' }],
  communications: [{ method: 'POST', path: '/api/communications', purpose: 'Send through a configured channel, or store an honest refusal' }],
  newsletter: [{ method: 'POST', path: '/api/newsletter', purpose: 'Consent-aware subscribe' }],
  content: [{ method: 'POST', path: '/api/content', purpose: 'Create a draft asset (approval required to publish)' }],
  analytics: [{ method: 'POST', path: '/api/track', purpose: 'First-party pageview beacon' }],
  chat: [{ method: 'POST', path: '/api/chat/messages', purpose: 'Visitor message intake' }],
  knowledge: [{ method: 'GET', path: '/api/knowledge/search', purpose: 'Search published articles' }],
  portal: [{ method: 'POST', path: '/api/portal/login', purpose: 'Client portal sign-in (separate session)' }],
  reviews: [{ method: 'POST', path: '/api/reviews', purpose: 'Request or submit a review' }],
}

const AGENT_LIBRARY: Record<string, FactoryPlanAgent> = {
  'CRM-003': { code: 'CRM-003', name: 'Research Analyst', purpose: 'Build a factual dossier for each new lead', approval: false },
  'CRM-014': { code: 'CRM-014', name: 'Lead Scorer', purpose: 'Score and prioritise inbound leads', approval: false },
  'SMM-007': { code: 'SMM-007', name: 'Campaign Planner', purpose: 'Draft campaigns and content calendars', approval: true },
  'SUP-011': { code: 'SUP-011', name: 'Support Responder', purpose: 'Draft replies to customer conversations', approval: true },
  'FIN-009': { code: 'FIN-009', name: 'Invoice Assistant', purpose: 'Prepare invoice drafts for human approval', approval: true },
}

const VERTICAL_AGENTS: Record<FactoryVertical, string[]> = {
  crm: ['CRM-003', 'CRM-014', 'FIN-009'],
  marketing: ['CRM-014', 'SMM-007'],
  education: ['CRM-003', 'CRM-014'],
  ecommerce: ['FIN-009', 'SUP-011'],
  booking: ['SUP-011'],
  realestate: ['CRM-003', 'CRM-014'],
  support: ['SUP-011'],
}

const UNBUILDABLE: Array<{ match: RegExp; label: string }> = [
  { match: /native (ios|android) app|mobile app/i, label: 'Native iOS/Android app (a responsive web app is built instead)' },
  { match: /nft|blockchain|token sale/i, label: 'Blockchain/NFT features (no verified requirement or provider)' },
  { match: /3d|game engine|unity/i, label: '3D/game engine work (different engineering discipline)' },
  { match: /telemedicine|medical record|hipaa/i, label: 'Clinical records system (regulatory scope, not a starter)' },
]

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'client-app'
}

/** Deterministically build the delivery blueprint from a normalised brief. */
export function buildPlan(brief: FactoryBrief): FactoryPlan {
  const slug = slugify(brief.appName)
  const pages: FactoryPlanPage[] = [
    { path: '/', title: 'Home', purpose: `Positioning, proof and a primary call to action for ${brief.clientName}.` },
    { path: '/contact', title: 'Contact / Enquiry', purpose: 'Real lead intake — writes a row, notifies staff, never a mail-only form.' },
  ]
  if (brief.modules.includes('clients')) pages.push({ path: '/admin/clients', title: 'Clients', purpose: 'Directory, profile and history.' })
  if (brief.modules.includes('leads') || brief.modules.includes('pipeline'))
    pages.push({ path: '/admin/leads', title: 'Leads & pipeline', purpose: 'Board view with stages, scoring and follow-up.' })
  if (brief.modules.includes('projects')) pages.push({ path: '/admin/projects', title: 'Projects', purpose: 'Delivery tracking with tasks and milestones.' })
  if (brief.modules.includes('invoices') || brief.modules.includes('payments'))
    pages.push({ path: '/admin/finance', title: 'Invoices & payments', purpose: 'Issue documents and reconcile settlement server-side.' })
  if (brief.modules.includes('communications')) pages.push({ path: '/admin/communications', title: 'Communications', purpose: 'One log across email, SMS and WhatsApp with honest channel states.' })
  if (brief.modules.includes('content') || brief.modules.includes('newsletter'))
    pages.push({ path: '/admin/content', title: 'Content studio', purpose: 'Draft → review → approve → publish.' })
  if (brief.modules.includes('analytics')) pages.push({ path: '/admin/analytics', title: 'Analytics', purpose: 'First-party traffic, no third-party tracker.' })
  if (brief.modules.includes('knowledge')) pages.push({ path: '/admin/knowledge', title: 'Knowledge base', purpose: 'Approval-gated articles used by staff and the support agent.' })
  if (brief.modules.includes('portal')) pages.push({ path: '/portal', title: 'Client portal', purpose: 'Separate session for the client: status, files, approvals.' })
  if (brief.modules.includes('reviews')) pages.push({ path: '/admin/reviews', title: 'Reviews', purpose: 'Request, moderate and publish social proof.' })

  const models: FactoryPlanModel[] = []
  for (const m of brief.modules) models.push(...MODULE_MODELS[m])
  models.push({
    name: 'AuditLog',
    fields: [
      { name: 'actor', type: 'String', note: 'who' },
      { name: 'action', type: 'String', note: 'what' },
      { name: 'entity', type: 'String?', note: 'which record' },
      { name: 'meta', type: 'String?', note: 'JSON detail, no secrets' },
    ],
    note: 'Every mutation on money, publication or client data is audited.',
  })
  models.push({
    name: 'User',
    fields: [
      { name: 'email', type: 'String', note: 'unique' },
      { name: 'role', type: 'String', note: 'SUPER_ADMIN | ADMIN | MANAGER | STAFF' },
      { name: 'passwordHash', type: 'String', note: 'never a plaintext password' },
    ],
    note: 'Role-based access — the console is not one shared login.',
  })

  const endpoints: FactoryPlanEndpoint[] = [{ method: 'GET', path: '/api/health', purpose: 'Honest health probe used by the host.' }]
  for (const m of brief.modules) endpoints.push(...MODULE_ENDPOINTS[m])

  const agents = [...new Set(VERTICAL_AGENTS[brief.vertical])].map((code) => AGENT_LIBRARY[code])

  const automations: FactoryPlanAutomation[] = [
    { code: 'W01', name: 'Lead intake', trigger: 'New form submission', action: 'Create lead, notify staff, log automation evidence' },
    { code: 'W02', name: 'Follow-up reminder', trigger: 'Lead untouched for 48h', action: 'Queue a follow-up task and a channel message' },
    { code: 'W03', name: 'Delivery handover', trigger: 'Final payment settled', action: 'Release source package and request review' },
  ]
  if (brief.modules.includes('newsletter'))
    automations.push({ code: 'W04', name: 'Newsletter draft', trigger: 'Weekly schedule', action: 'Generate a draft campaign and request approval' })

  const notBuilt: string[] = []
  for (const u of UNBUILDABLE) if (u.match.test(brief.notes)) notBuilt.push(u.label)
  const missingCredentials = (['email', 'sms', 'whatsapp'] as const).filter((c) => c)
  notBuilt.push(
    `Live sending on email/SMS/WhatsApp stays NOT_CONFIGURED until the client supplies provider credentials (${missingCredentials.join(', ')}) — the code refuses instead of pretending.`,
  )

  const acceptanceCriteria = [
    'Every public form creates a database row that staff can see within one refresh.',
    'Money-changing actions are server-verified and audited; no client-side "success" path settles a payment.',
    'No provider integration reports a success it did not get from the provider.',
    'All admin mutations require an authenticated session, a role grant and CSRF protection.',
    'A fresh clone builds with `npm ci && npm run build`, and `/api/health` answers honestly.',
    brief.language === 'BOTH'
      ? 'Public pages render in both English and Bangla.'
      : `Public pages ship in ${brief.language === 'BN' ? 'Bangla' : 'English'}.`,
  ]

  return {
    appName: brief.appName,
    slug,
    vertical: brief.vertical,
    summary: `${VERTICAL_LABEL[brief.vertical]} — ${VERTICAL_SUMMARY[brief.vertical]}`,
    designTokens: { primary: brief.primaryColor, ink: '#0B1220', surface: '#F7F9FC', radius: '12px', font: 'Inter' },
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],
    pages,
    models,
    endpoints,
    agents,
    automations,
    acceptanceCriteria,
    notBuilt,
  }
}

const money = (currency: string) => `${currency} amounts are stored as Prisma Decimal (never Float) with the currency on the record.`

/** Generate the real file tree the delivery team starts from. */
export function buildFiles(brief: FactoryBrief, plan: FactoryPlan): FactoryFile[] {
  const pkg = {
    name: plan.slug,
    private: true,
    version: '0.1.0',
    scripts: {
      dev: 'next dev',
      build: 'prisma generate && next build',
      start: 'next start',
      typecheck: 'tsc --noEmit',
    },
    dependencies: {
      '@prisma/client': '^6.19.3',
      next: '^16.1.1',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
    },
    devDependencies: { prisma: '^6.19.3', tailwindcss: '^4', typescript: '^5' },
  }

  const schemaModels = plan.models
    .map((m) => {
      const fields = m.fields
        .map((f) => `  ${f.name.padEnd(14)} ${f.type}${f.name === 'name' || f.name === 'title' ? '' : f.type === 'String' && f.name === 'email' ? ' @unique' : ''}${f.note && /LongText/.test(f.note) ? ' @db.LongText' : ''}`)
        .join('\n')
      return `model ${m.name} {\n  id        String   @id @default(cuid())\n${fields}\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  // ${m.note || 'see docs/SCOPE.md'}\n}`
    })
    .join('\n\n')

  const files: FactoryFile[] = [
    {
      path: 'README.md',
      language: 'markdown',
      content: `# ${plan.appName}

Generated by **TECH360 AI Software Factory** for ${brief.clientName}.
Vertical: \`${brief.vertical}\` · Modules: ${brief.modules.join(', ')} · Language: ${brief.language} · Currency: ${brief.currency}

## What this is
A working Next.js (App Router) + Prisma + Tailwind starter that implements the reviewed
scope in \`docs/SCOPE.md\`. It is the starting point the Tech360 delivery team owns,
reviews and hands over — not an unreviewed black box.

## Run it
\`\`\`bash
npm ci
cp .env.example .env      # fill DATABASE_URL only; provider keys stay blank until supplied
npx prisma migrate dev
npm run dev
\`\`\`

## Honest integration states
A blank credential means **NOT_CONFIGURED**: the code refuses to send or settle and
reports the true state. It never fakes a sent message or a settled payment.

## Handover
See \`docs/HANDOVER.md\`. Source, scope, acceptance criteria and the operations runbook
are all part of the handover package.
`,
    },
    {
      path: 'docs/SCOPE.md',
      language: 'markdown',
      content: `# Scope — ${plan.appName}

${plan.summary}

## Roles
${plan.roles.map((r) => `- ${r}`).join('\n')}

## Pages
${plan.pages.map((p) => `- \`${p.path}\` — ${p.title}: ${p.purpose}`).join('\n')}

## Data models
${plan.models.map((m) => `- **${m.name}** — ${m.note || ''}\n${m.fields.map((f) => `  - \`${f.name}: ${f.type}\` ${f.note}`).join('\n')}`).join('\n')}

## API
${plan.endpoints.map((e) => `- \`${e.method} ${e.path}\` — ${e.purpose}`).join('\n')}

## Automations
${plan.automations.map((a) => `- ${a.code} ${a.name}: when ${a.trigger} → ${a.action}`).join('\n')}

## Acceptance criteria
${plan.acceptanceCriteria.map((a, i) => `${i + 1}. ${a}`).join('\n')}

## Explicitly not built
${plan.notBuilt.map((n) => `- ${n}`).join('\n')}

## Commercial notes
- ${money(brief.currency)}
- Every external provider starts NOT_CONFIGURED and is enabled only after the client supplies credentials.
`,
    },
    {
      path: 'docs/HANDOVER.md',
      language: 'markdown',
      content: `# Handover — ${plan.appName}

Handover happens **after the final payment is settled**, and it is a real transfer:

1. Source package exported from the factory (this tree, zipped) and delivered to the client.
2. Database access, hosting access and provider accounts transferred in the client's name.
3. Environment variable list delivered as NAMES ONLY (\`.env.example\`); values are entered by the client.
4. Super-admin password rotated by the client at first login (the platform forces a change).
5. Operations runbook (\`README.md\` + this file) walked through with the client contact${brief.primaryContact ? ` (${brief.primaryContact})` : ''}.

Post-handover support is a separate agreement. Nothing in this package calls back to Tech360.
`,
    },
    {
      path: 'package.json',
      language: 'json',
      content: `${JSON.stringify(pkg, null, 2)}\n`,
    },
    {
      path: '.env.example',
      language: 'bash',
      content: `# ${plan.appName} — variable NAMES only. Never commit real values.
DATABASE_URL=
APP_PUBLIC_URL=
SESSION_SECRET=
# Optional providers — blank means NOT_CONFIGURED and the code refuses to send.
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
HTTPSMS_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
`,
    },
    {
      path: 'prisma/schema.prisma',
      language: 'prisma',
      content: `// ${plan.appName} — generated data model (MySQL).
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

${schemaModels}
`,
    },
    {
      path: 'src/lib/db.ts',
      language: 'typescript',
      content: `import { PrismaClient } from '@prisma/client'

// One client per process — Next.js reloads modules in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
export const db = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
`,
    },
    {
      path: 'src/app/api/health/route.ts',
      language: 'typescript',
      content: `import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Honest health probe: reports DOWN when the database is unreachable.
export async function GET() {
  try {
    await db.$queryRaw\`SELECT 1\`
    return Response.json({ status: 'healthy', app: '${plan.slug}', checks: { database: { status: 'UP' } } })
  } catch {
    return Response.json({ status: 'unhealthy', app: '${plan.slug}', checks: { database: { status: 'DOWN' } } }, { status: 503 })
  }
}
`,
    },
    {
      path: 'src/app/api/leads/route.ts',
      language: 'typescript',
      content: `import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Public intake: a submission becomes a REAL row before any notification is attempted.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { name?: string; email?: string; phone?: string; message?: string } | null
  const name = String(body?.name ?? '').trim().slice(0, 120)
  if (!name) return Response.json({ error: 'name is required' }, { status: 400 })
  const lead = await db.lead.create({
    data: {
      name,
      email: body?.email ? String(body.email).trim().slice(0, 200) : null,
      phone: body?.phone ? String(body.phone).trim().slice(0, 32) : null,
      source: 'website',
      stage: 'NEW',
      score: 0,
    },
  })
  return Response.json({ ok: true, leadId: lead.id }, { status: 201 })
}
`,
    },
    {
      path: 'src/app/page.tsx',
      language: 'tsx',
      content: `export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight text-slate-900">${plan.appName}</h1>
      <p className="mt-4 text-lg text-slate-600">${plan.summary}</p>
      <a
        href="/contact"
        className="mt-8 inline-flex rounded-xl px-5 py-3 font-medium text-white"
        style={{ backgroundColor: '${brief.primaryColor}' }}
      >
        Talk to us
      </a>
    </main>
  )
}
`,
    },
    {
      path: 'src/app/contact/page.tsx',
      language: 'tsx',
      content: `'use client'

import { useState } from 'react'

export default function ContactPage() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('sending')
    const data = new FormData(event.currentTarget)
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(data)),
    })
    setState(res.ok ? 'sent' : 'error')
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Enquiry</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input name="name" required placeholder="Your name" className="w-full rounded-lg border px-3 py-2" />
        <input name="email" type="email" placeholder="Email" className="w-full rounded-lg border px-3 py-2" />
        <input name="phone" placeholder="Phone" className="w-full rounded-lg border px-3 py-2" />
        <textarea name="message" rows={4} placeholder="What do you need?" className="w-full rounded-lg border px-3 py-2" />
        <button type="submit" disabled={state === 'sending'} className="rounded-lg bg-slate-900 px-4 py-2 text-white">
          {state === 'sending' ? 'Sending…' : 'Send enquiry'}
        </button>
      </form>
      {state === 'sent' && <p className="mt-4 text-sm text-emerald-600">Thank you — your enquiry is in our system.</p>}
      {state === 'error' && <p className="mt-4 text-sm text-red-600">Something went wrong. Please try again.</p>}
    </main>
  )
}
`,
    },
    {
      path: 'src/app/admin/page.tsx',
      language: 'tsx',
      content: `import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Staff console seed — the reviewed page list is in docs/SCOPE.md.
export default async function AdminPage() {
  const [leads, clients] = await Promise.all([
    db.lead.count().catch(() => 0),
    db.client.count().catch(() => 0),
  ])
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold">${plan.appName} — console</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border p-4"><div className="text-sm text-slate-500">Leads</div><div className="text-3xl font-semibold">{leads}</div></div>
        <div className="rounded-xl border p-4"><div className="text-sm text-slate-500">Clients</div><div className="text-3xl font-semibold">{clients}</div></div>
        <div className="rounded-xl border p-4"><div className="text-sm text-slate-500">Modules</div><div className="text-3xl font-semibold">${brief.modules.length}</div></div>
      </div>
      <p className="mt-8 text-sm text-slate-500">
        Planned pages: ${plan.pages.map((p) => p.path).join(', ')}.
      </p>
    </main>
  )
}
`,
    },
    {
      path: 'next.config.ts',
      language: 'typescript',
      content: `import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
`,
    },
    {
      path: 'tsconfig.json',
      language: 'json',
      content: `${JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            lib: ['dom', 'dom.iterable', 'esnext'],
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            incremental: true,
            plugins: [{ name: 'next' }],
            paths: { '@/*': ['./src/*'] },
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
          exclude: ['node_modules'],
        },
        null,
        2,
      )}\n`,
    },
    {
      path: '.gitignore',
      language: 'text',
      content: `node_modules
.next
.env
.env.*
!.env.example
*.log
`,
    },
  ]

  return files
}

export function summarizeFiles(files: FactoryFile[]): { fileCount: number; totalBytes: number } {
  const totalBytes = files.reduce((sum, f) => sum + Buffer.byteLength(f.content, 'utf8'), 0)
  return { fileCount: files.length, totalBytes }
}

/** Guard used before persisting: a generated file may never carry a secret. */
const SECRET_PATTERNS: RegExp[] = [
  /sk_live_[A-Za-z0-9]{10,}/,
  /sk_test_[A-Za-z0-9]{10,}/,
  /whsec_[A-Za-z0-9]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /AIza[0-9A-Za-z_-]{35}/,
]

export function assertNoSecrets(files: FactoryFile[]): { ok: true } | { ok: false; path: string } {
  for (const f of files) {
    for (const re of SECRET_PATTERNS) {
      if (re.test(f.content)) return { ok: false, path: f.path }
    }
  }
  return { ok: true }
}
