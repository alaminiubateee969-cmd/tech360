/**
 * Premium work examples — technology showcases.
 *
 * HONESTY CONTRACT
 * ----------------
 * Every record in this file is a *system showcase*: a description of a
 * software system Tech360 can build, paired with a generated concept visual.
 * None of these records is a delivered client engagement, a verified case
 * study, a measured result, or a customer endorsement. The `notice` field is
 * rendered with every example so the public page can never imply otherwise.
 *
 * Copy rules used here:
 *  - No invented metrics (no "+240% sales", no "10x faster").
 *  - `capabilities` describes what the system is designed to do.
 *  - `outOfScope` names what the showcase deliberately does not claim, so the
 *    page stays auditable against the repository's honesty policy.
 *
 * The visuals are self-hosted under `public/images/work/` (no external CDN),
 * generated for this project, and carry descriptive alt text.
 */

export interface WorkExample {
  /** Stable slug used for anchors and deep links. */
  slug: string
  /** Public-facing system name. */
  name: string
  /** Short category label used by the filter chips. */
  category: WorkCategory
  /** One-line positioning statement. */
  tagline: string
  /** Longer description of the system and who it is for. */
  description: string
  /** Self-hosted concept visual. */
  image: string
  /** Descriptive alt text for the concept visual. */
  imageAlt: string
  /** Core modules the system is built from. */
  modules: string[]
  /** What the system is designed to do — capability language, never results. */
  capabilities: string[]
  /** Typical integration surface (all provider-dependent and configured per engagement). */
  integrations: string[]
  /** Indicative build phases, in weeks. Planning estimate only. */
  deliveryWeeks: string
  /** What this showcase explicitly does not assert. */
  outOfScope: string[]
}

export type WorkCategory =
  | 'Commerce'
  | 'Education'
  | 'Healthcare'
  | 'Real Estate'
  | 'Agency'
  | 'Automation'
  | 'CRM'
  | 'Portals'
  | 'Analytics'

/** Rendered alongside every example. Do not weaken without an audit. */
export const WORK_EXAMPLE_NOTICE =
  'Concept showcase: each visual is a generated representation of a system Tech360 builds. These are not delivered client projects, verified case studies, or measured outcomes.'

/** Filter chips; the first entry must always show every example. */
export const WORK_CATEGORIES: ReadonlyArray<'All' | WorkCategory> = [
  'All',
  'Commerce',
  'Education',
  'Healthcare',
  'Real Estate',
  'Agency',
  'Automation',
  'CRM',
  'Portals',
  'Analytics',
] as const

export const WORK_EXAMPLES: WorkExample[] = [
  {
    slug: 'ecommerce-storefront',
    name: 'eCommerce Storefront',
    category: 'Commerce',
    tagline: 'A conversion-focused storefront with local payments and order operations.',
    description:
      'A storefront system for retailers selling through social inboxes today: catalogue, variants, cart, checkout, order status, and an operations view for the team handling fulfilment.',
    image: '/images/work/01-ecommerce-storefront.jpg',
    imageAlt:
      'Concept visual of an eCommerce storefront interface with a product grid, product detail card and checkout summary on a dark navy background.',
    modules: [
      'Catalogue and variant manager',
      'Cart, checkout and order lifecycle',
      'Payment and delivery-status webhooks',
      'Discount and coupon rules',
      'Order operations dashboard',
      'Customer account area',
    ],
    capabilities: [
      'Sell a physical or digital catalogue with structured variants and stock handling',
      'Record every order against a CRM client profile with a Client ID',
      'Route payment and fulfilment events into one operational queue',
      'Expose order status to customers without manual inbox replies',
    ],
    integrations: ['Payment gateway adapter', 'SMS / WhatsApp order updates', 'Courier or fulfilment API', 'Email receipts'],
    deliveryWeeks: '6–10 weeks',
    outOfScope: [
      'No sales, conversion or revenue uplift is claimed.',
      'Payment providers must be configured and tested per engagement.',
    ],
  },
  {
    slug: 'education-crm',
    name: 'Education CRM',
    category: 'Education',
    tagline: 'Admissions enquiries, counselling batches and follow-up in one pipeline.',
    description:
      'An admissions CRM for coaching centres, institutes and training providers: capture enquiries from every channel, assign counsellors, track follow-up, and report on the funnel.',
    image: '/images/work/02-education-crm.jpg',
    imageAlt:
      'Concept visual of an education admissions CRM showing an enquiry pipeline board and admission funnel chart on a dark navy background.',
    modules: [
      'Multi-channel enquiry capture',
      'Counsellor assignment and queue',
      'Follow-up scheduling and reminders',
      'Batch and seat allocation',
      'Guardian and student communication log',
      'Funnel and source reporting',
    ],
    capabilities: [
      'Issue one Client ID per enquiry regardless of entry channel',
      'Route new enquiries to a named counsellor with a due date',
      'Keep the full message history on the student record',
      'Report on source, stage and response timing from first-party data',
    ],
    integrations: ['Website enquiry form', 'WhatsApp / SMS', 'Email', 'Google Sheets or CSV export'],
    deliveryWeeks: '5–8 weeks',
    outOfScope: [
      'No enrolment or response-time improvement is claimed.',
      'Messaging providers must be configured and accepted before go-live.',
    ],
  },
  {
    slug: 'school-erp',
    name: 'School ERP',
    category: 'Education',
    tagline: 'Attendance, timetable, fees and parent communication for a full institution.',
    description:
      'An institutional ERP covering the academic calendar, attendance, timetable, fee ledger, staff records and parent notifications, with role-separated access for office, teachers and management.',
    image: '/images/work/03-school-erp.jpg',
    imageAlt:
      'Concept visual of a school ERP with an attendance heatmap, timetable grid and fee collection meter on a dark navy background.',
    modules: [
      'Academic year, class and section setup',
      'Attendance capture and register',
      'Timetable builder',
      'Fee ledger, invoices and receipts',
      'Staff and payroll records',
      'Parent notification centre',
    ],
    capabilities: [
      'Maintain one institutional record for students, guardians and staff',
      'Issue fee invoices with receipts and outstanding balances',
      'Notify guardians on configured events (absence, dues, results)',
      'Give management a read-only reporting view',
    ],
    integrations: ['SMS gateway', 'Email', 'Local payment methods', 'CSV export for accounts'],
    deliveryWeeks: '10–16 weeks',
    outOfScope: [
      'Government reporting formats must be confirmed with the institution.',
      'No accreditation or compliance certification is implied.',
    ],
  },
  {
    slug: 'clinic-system',
    name: 'Clinic System',
    category: 'Healthcare',
    tagline: 'Appointments, patient records and reminders with a controlled access model.',
    description:
      'A clinic operations system for single and multi-physician practices: appointment scheduling, patient records, prescriptions, lab-result attachments and reminder workflows.',
    image: '/images/work/04-clinic-system.jpg',
    imageAlt:
      'Concept visual of a clinic management system with an appointment timeline, patient record card and lab result chart on a dark navy background.',
    modules: [
      'Doctor and room scheduling',
      'Appointment booking and queue',
      'Patient record and visit history',
      'Prescription and lab attachment vault',
      'Reminder and no-show workflow',
      'Role-separated access and audit log',
    ],
    capabilities: [
      'Schedule appointments per doctor, room and slot length',
      'Keep visit history and documents on one patient timeline',
      'Send configured appointment reminders',
      'Record every record access in an audit log',
    ],
    integrations: ['SMS / WhatsApp reminders', 'Email', 'Secure file storage', 'Payment collection'],
    deliveryWeeks: '8–14 weeks',
    outOfScope: [
      'Clinical decision support is not provided.',
      'Health-data handling requires the practice to confirm its own regulatory obligations and hosting region.',
    ],
  },
  {
    slug: 'real-estate-crm',
    name: 'Real Estate CRM',
    category: 'Real Estate',
    tagline: 'Buyer timelines, site visits, bookings and instalments on one record.',
    description:
      'A property sales CRM: enquiry capture per project, agent assignment, site-visit scheduling, booking and instalment tracking, plus management reporting.',
    image: '/images/work/05-real-estate-crm.jpg',
    imageAlt:
      'Concept visual of a real estate CRM with a property listing grid, deal pipeline and client timeline on a dark navy background.',
    modules: [
      'Project and unit inventory',
      'Lead capture and agent assignment',
      'Site-visit scheduling',
      'Booking and instalment ledger',
      'Document vault for agreements',
      'Agent performance reporting',
    ],
    capabilities: [
      'Tie every buyer interaction to one client timeline',
      'Track unit availability without spreadsheet reconciliation',
      'Schedule visits and log outcomes',
      'Reconcile instalments against issued invoices',
    ],
    integrations: ['Website property forms', 'WhatsApp follow-up', 'Email', 'Accounting export'],
    deliveryWeeks: '7–12 weeks',
    outOfScope: [
      'No sales-performance or spreadsheet-reduction result is claimed.',
      'Listing data feeds depend on the portal or partner API available.',
    ],
  },
  {
    slug: 'agency-portal',
    name: 'Agency Portal',
    category: 'Agency',
    tagline: 'White-label client space for projects, approvals, assets and billing.',
    description:
      'A client-facing agency portal: project status, deliverable approvals, asset library, meeting booking and billing summary — branded per agency.',
    image: '/images/work/06-agency-portal.jpg',
    imageAlt:
      'Concept visual of an agency client portal with a project kanban board, brand asset tiles and an approval checklist on a dark navy background.',
    modules: [
      'Brand theming per agency',
      'Project board and milestone tracker',
      'Deliverable review and approval gate',
      'Asset library with version history',
      'Meeting booking',
      'Invoice and receipt view',
    ],
    capabilities: [
      'Give each client an authenticated space for their own project only',
      'Gate delivery behind recorded approvals',
      'Keep asset versions and approval evidence in one place',
      'Expose invoices and receipts without emailing files',
    ],
    integrations: ['SMTP', 'Calendar provider', 'File storage', 'Payment links'],
    deliveryWeeks: '6–10 weeks',
    outOfScope: [
      'No client-retention or billing outcome is claimed.',
      'White-label domain and branding require separate configuration per agency.',
    ],
  },
  {
    slug: 'ai-automation',
    name: 'AI Automation',
    category: 'Automation',
    tagline: 'Agent-assisted workflows with human approval before anything external.',
    description:
      'An automation layer that connects the CRM, messaging and back-office tools: AI agents draft, classify and route work, while approval gates hold anything commercial, legal or financial.',
    image: '/images/work/07-ai-automation.jpg',
    imageAlt:
      'Concept visual of an AI automation orchestrator with a node-based workflow graph and agent status tiles on a dark navy background.',
    modules: [
      'Workflow designer and run monitor',
      'Agent queue with leases and retries',
      'Approval gate policy',
      'Knowledge base and memory store',
      'Structured agent logging',
      'Cost and usage tracking',
    ],
    capabilities: [
      'Automate repeatable steps with an auditable execution record',
      'Require admin approval before quotes, invoices or handover messages send',
      'Retry safely with idempotent jobs instead of duplicate sends',
      'Report failures instead of silently dropping work',
    ],
    integrations: ['LLM provider (free-tier or self-hosted)', 'n8n-compatible webhooks', 'SMTP', 'WhatsApp Cloud API'],
    deliveryWeeks: '8–14 weeks',
    outOfScope: [
      'No autonomous action outside approved policy is claimed.',
      'Live inference requires a configured provider key; unavailable providers fail closed.',
    ],
  },
  {
    slug: 'whatsapp-sales-funnel',
    name: 'WhatsApp Sales Funnel',
    category: 'Automation',
    tagline: 'First message to qualified lead, logged in the CRM at every step.',
    description:
      'A WhatsApp-first sales funnel built on the Meta Cloud API: templated first replies, guided qualification questions, stage tracking, human handover and full message history.',
    image: '/images/work/08-whatsapp-sales-funnel.jpg',
    imageAlt:
      'Concept visual of a WhatsApp sales funnel with a chat thread, funnel chart and lead stage list on a dark navy background.',
    modules: [
      'Template management and approval tracking',
      'Inbound webhook with replay protection',
      'Qualification question flow',
      'Stage and Client ID automation',
      'Human handover queue',
      'Conversation history and export',
    ],
    capabilities: [
      'Reply inside the customer WhatsApp thread without manual copy-paste',
      'Capture every inbound and outbound message against the client record',
      'Reject replayed or forged webhooks',
      'Hand the conversation to a named agent with full context',
    ],
    integrations: ['Meta WhatsApp Cloud API', 'CRM', 'SMS fallback', 'Email transcript'],
    deliveryWeeks: '4–8 weeks',
    outOfScope: [
      'Message delivery depends on an approved Meta business account and verified templates.',
      'No response-rate or conversion increase is claimed.',
    ],
  },
  {
    slug: 'social-automation',
    name: 'Social Automation',
    category: 'Automation',
    tagline: 'Plan, schedule and measure social content from one calendar.',
    description:
      'A social operations console: content calendar, per-platform scheduling, asset library, approval step, and engagement capture where the platform API allows it.',
    image: '/images/work/09-social-automation.jpg',
    imageAlt:
      'Concept visual of a social media scheduling console with a content calendar and engagement graph on a dark navy background.',
    modules: [
      'Content calendar and queue',
      'Per-platform post variants',
      'Approval before publish',
      'Asset library',
      'Engagement capture',
      'Reporting by channel',
    ],
    capabilities: [
      'Schedule content per platform with an approval step',
      'Keep one asset library with usage history',
      'Record engagement data where the platform API exposes it',
      'Report on cadence and channel mix from first-party records',
    ],
    integrations: ['Meta Graph API', 'LinkedIn API', 'X API', 'Webhook feed source'],
    deliveryWeeks: '5–9 weeks',
    outOfScope: [
      'Each platform requires its own app review and token lifecycle.',
      'No reach or engagement growth is claimed.',
    ],
  },
  {
    slug: 'lead-management',
    name: 'Lead Management',
    category: 'CRM',
    tagline: 'Source tracking, scoring, assignment and follow-up discipline.',
    description:
      'A lead management module for any sales team: capture with source attribution, duplicate-safe Client IDs, scoring, assignment, follow-up scheduling and pipeline reporting.',
    image: '/images/work/10-lead-management.jpg',
    imageAlt:
      'Concept visual of a lead management board with a kanban pipeline, source attribution chart and follow-up reminder card on a dark navy background.',
    modules: [
      'Multi-source capture (form, chat, call, social)',
      'UTM, referrer and device attribution',
      'Scoring and routing rules',
      'Follow-up scheduling',
      'Duplicate and identity review queue',
      'Pipeline and source reporting',
    ],
    capabilities: [
      'Attribute every lead to a source, campaign and landing path',
      'Issue a non-duplicating Client ID under concurrent submissions',
      'Schedule the next follow-up with an owner and due date',
      'Flag identity collisions for human review instead of merging blindly',
    ],
    integrations: ['Website forms', 'Chat widget', 'SMS / WhatsApp', 'Email'],
    deliveryWeeks: '4–7 weeks',
    outOfScope: [
      'Attribution is first-party only; no ad-platform revenue reconciliation is implied.',
      'Scoring models are configured per business, not pre-trained on client data.',
    ],
  },
  {
    slug: 'client-portal',
    name: 'Client Portal',
    category: 'Portals',
    tagline: 'Secure self-service for scope, preview, invoices and handover.',
    description:
      'An authenticated client area covering the delivery journey: scope review and approval, preview links, invoice and receipt access, support threads and final handover confirmation.',
    image: '/images/work/11-client-portal.jpg',
    imageAlt:
      'Concept visual of a secure client portal with a project progress ring, invoice list and document vault on a dark navy background.',
    modules: [
      'One-time-code sign-in',
      'Scope review and recorded approval',
      'Preview link with expiry',
      'Invoice, receipt and payment status',
      'Document vault',
      'Handover and password-change confirmation',
    ],
    capabilities: [
      'Give the client read access to only their own records',
      'Record scope and preview approvals with timestamps',
      'Expose invoices and receipts without email attachments',
      'Capture handover acknowledgement in writing',
    ],
    integrations: ['SMTP for codes and notices', 'File storage', 'Payment provider', 'CRM'],
    deliveryWeeks: '5–8 weeks',
    outOfScope: [
      'Portal authentication is separate from internal staff roles.',
      'Payment status reflects recorded transactions, not a guarantee of settlement.',
    ],
  },
  {
    slug: 'custom-dashboard',
    name: 'Custom Dashboard',
    category: 'Analytics',
    tagline: 'One reconciled view of pipeline, delivery and revenue.',
    description:
      'A business intelligence dashboard built on the operational database: KPI tiles, cohort and funnel charts, scheduled summaries, and drill-down into the underlying records.',
    image: '/images/work/12-custom-dashboard.jpg',
    imageAlt:
      'Concept visual of a custom business intelligence dashboard with revenue charts, KPI tiles and a live activity feed on a dark navy background.',
    modules: [
      'KPI tile engine',
      'Time-series and funnel charts',
      'Scheduled email summaries',
      'Drill-down to source records',
      'Access-scoped reporting',
      'Export (CSV / PDF)',
    ],
    capabilities: [
      'Report on the same records the team operates, not a stale export',
      'Scope every chart to the viewer’s role',
      'Schedule a summary to leadership on a fixed cadence',
      'Drill from a number to the rows behind it',
    ],
    integrations: ['Operational database', 'SMTP summaries', 'CSV / PDF export', 'Optional BI tool'],
    deliveryWeeks: '4–8 weeks',
    outOfScope: [
      'No forecast accuracy is claimed.',
      'Historical reporting depends on the data history available at go-live.',
    ],
  },
]

/** Look up a single example by slug. */
export function getWorkExample(slug: string): WorkExample | undefined {
  return WORK_EXAMPLES.find((example) => example.slug === slug)
}

/** Filter examples by category, where `'All'` returns everything. */
export function filterWorkExamples(category: 'All' | WorkCategory | string): WorkExample[] {
  if (!category || category === 'All') return WORK_EXAMPLES
  return WORK_EXAMPLES.filter((example) => example.category === category)
}
