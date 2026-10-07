import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'
import { ensureAgentRegistry } from '../src/lib/agents/bootstrap'
import { COMPANY } from '../src/lib/constants'

const db = new PrismaClient()

const PROMPT_TEMPLATES: Array<{ code: string; name: string; category: string; template: string; variables: string[] }> = [
  { code: 'T-LEAD-INTAKE', name: 'Lead Intake Extraction', category: 'REVENUE', template: 'Extract structured lead data from first-contact message: {{message}}', variables: ['message'] },
  { code: 'T-BIZ-DETECT', name: 'Business Detection', category: 'REVENUE', template: 'Classify industry for {{businessName}} based on: {{signals}}', variables: ['businessName', 'signals'] },
  { code: 'T-PLAN-RECO', name: 'Plan Recommendation', category: 'REVENUE', template: 'Recommend Tech360 plan for {{businessType}} with intent {{intent}} and budget {{budget}}', variables: ['businessType', 'intent', 'budget'] },
  { code: 'T-SCOPE-QUESTIONS', name: 'Scope Discovery Questions', category: 'SCOPE', template: 'Generate discovery questions for {{businessType}} building {{plan}}', variables: ['businessType', 'plan'] },
  { code: 'T-SCOPE-REVIEW', name: 'Scope Gap Analysis', category: 'SCOPE', template: 'Review client scope {{scope}} against best practice for {{businessType}}', variables: ['scope', 'businessType'] },
  { code: 'T-FINAL-SOW', name: 'Final Scope of Work', category: 'SCOPE', template: 'Generate Final SOW with timeline and payment policy from scope {{scope}} and review {{review}}', variables: ['scope', 'review'] },
  { code: 'T-WELCOME-WA', name: 'WhatsApp Welcome', category: 'COMMS', template: 'Warm WhatsApp welcome for {{name}} with reference {{clientId}}', variables: ['name', 'clientId'] },
  { code: 'T-WELCOME-EMAIL', name: 'Email Welcome', category: 'COMMS', template: 'Professional welcome email for {{name}}, reference {{clientId}}', variables: ['name', 'clientId'] },
  { code: 'T-SCOPE-SEND', name: 'Final Scope Delivery', category: 'COMMS', template: 'Deliver final scope {{scopeText}} to {{name}} with approval instructions', variables: ['scopeText', 'name'] },
  { code: 'T-PAYMENT-REQ', name: 'Payment Request', category: 'FINANCE', template: 'Payment instructions for milestones {{milestones}} to {{name}}', variables: ['milestones', 'name'] },
  { code: 'T-PAYMENT-CONFIRM', name: 'Payment Confirmation', category: 'FINANCE', template: 'Confirm payment {{amount}} {{currency}} for {{name}}', variables: ['amount', 'currency', 'name'] },
  { code: 'T-PREVIEW-READY', name: 'Preview Ready', category: 'DELIVERY', template: 'Notify {{name}} preview {{link}} is ready for review before payment', variables: ['name', 'link'] },
  { code: 'T-DELIVERY-NOTIFY', name: 'Delivery Notification', category: 'DELIVERY', template: 'Notify {{name}} of project delivery with checklist {{checklist}}', variables: ['name', 'checklist'] },
  { code: 'T-HANDOVER', name: 'Source Handover', category: 'DELIVERY', template: 'Handover message to {{name}} with secure link {{link}} and password-change instruction', variables: ['name', 'link'] },
  { code: 'T-REVIEW-REQ', name: 'Review Request', category: 'GROWTH', template: 'Optional review request to {{name}} after delivery', variables: ['name'] },
  { code: 'T-REFERRAL-REQ', name: 'Referral Request', category: 'GROWTH', template: 'Optional referral request to {{name}}', variables: ['name'] },
  { code: 'T-CEO-DAILY', name: 'CEO Daily Report', category: 'EXECUTIVE', template: 'Executive daily report from pipeline {{pipeline}}, payments {{payments}}, delivery {{delivery}}', variables: ['pipeline', 'payments', 'delivery'] },
  { code: 'T-VIDEO-SCRIPT', name: 'Video Script', category: 'CONTENT', template: 'Cinematic script on {{topic}} for {{durationSec}}s, {{aspect}}, voice {{language}}', variables: ['topic', 'durationSec', 'aspect', 'language'] },
  { code: 'T-IMAGE-PROMPT', name: 'Image Prompt', category: 'CONTENT', template: 'Image prompt for {{scene}} in style {{style}}', variables: ['scene', 'style'] },
  { code: 'T-HOOK-AB', name: 'Hook A/B', category: 'CONTENT', template: 'Two alternative hooks for {{topic}} targeting {{audience}}', variables: ['topic', 'audience'] },
  { code: 'T-QA-PLAN', name: 'QA Test Plan', category: 'DELIVERY', template: 'Test plan for project {{project}} covering {{scope}}', variables: ['project', 'scope'] },
  { code: 'T-MEETING-OFFER', name: 'Meeting Offer', category: 'OPERATIONS', template: 'Offer meeting slots to {{name}} for {{reason}}', variables: ['name', 'reason'] },
  { code: 'T-ERROR-TRIAGE', name: 'Error Triage', category: 'GOVERNANCE', template: 'Triage error {{error}} in {{source}}, propose remediation', variables: ['error', 'source'] },
]

const N8N_WORKFLOWS: Array<{ code: string; name: string; category: string; trigger: string; description: string }> = [
  { code: 'W01_LEAD_INTAKE', name: '01 Lead Intake', category: 'CRM', trigger: 'WEBHOOK', description: 'First message (any channel) → validate → create Client ID → CRM lead → welcome message' },
  { code: 'W02_WHATSAPP_IN', name: '02 WhatsApp Incoming', category: 'COMMUNICATION', trigger: 'WEBHOOK', description: 'WhatsApp Cloud webhook → save message → link to Client ID → route intent' },
  { code: 'W03_EMAIL_IN', name: '03 Email Incoming', category: 'COMMUNICATION', trigger: 'WEBHOOK', description: 'Inbound email → parse → attach to Client ID' },
  { code: 'W04_SOCIAL_INBOX', name: '04 Social Inbox', category: 'COMMUNICATION', trigger: 'WEBHOOK', description: 'Facebook/Instagram/LinkedIn/X messages → CRM communications' },
  { code: 'W05_BUSINESS_DETECTION', name: '05 Business Detection', category: 'AI', trigger: 'SIGNAL', description: 'AI classifies business type after intake' },
  { code: 'W06_PLAN_RECOMMENDATION', name: '06 Plan Recommendation', category: 'AI', trigger: 'SIGNAL', description: 'AI recommends the best Tech360 plan' },
  { code: 'W07_SCOPE_COLLECTION', name: '07 Scope Collection', category: 'AI', trigger: 'SIGNAL', description: 'AI sends discovery questions to the client' },
  { code: 'W08_SCOPE_REVIEW', name: '08 Scope Review', category: 'AI', trigger: 'SIGNAL', description: 'AI analyzes submitted scope, finds gaps, drafts SOW' },
  { code: 'W09_FINAL_SCOPE', name: '09 Final Scope', category: 'CRM', trigger: 'SIGNAL', description: 'Admin approval → Final SOW version lock' },
  { code: 'W10_ADMIN_APPROVAL', name: '10 Admin Approval', category: 'GOVERNANCE', trigger: 'SIGNAL', description: 'Sensitive action queue → Super Admin decision → execute/reject' },
  { code: 'W11_CLIENT_APPROVAL', name: '11 Client Approval', category: 'CRM', trigger: 'SIGNAL', description: 'Client approves or requests revision of final scope' },
  { code: 'W12_MEETING', name: '12 Meeting', category: 'OPERATIONS', trigger: 'SIGNAL', description: 'Meeting offered ONLY when client requests clarification' },
  { code: 'W13_HTML_PREVIEW', name: '13 HTML Preview', category: 'DELIVERY', trigger: 'SIGNAL', description: 'Generate HTML preview + track viewed/approved/revised' },
  { code: 'W14_PAYMENT', name: '14 Payment', category: 'FINANCE', trigger: 'SIGNAL', description: 'Payment instructions + recording + verification' },
  { code: 'W15_PROJECT_START', name: '15 Project Start', category: 'CRM', trigger: 'SIGNAL', description: 'Verified payment → project ACTIVE' },
  { code: 'W16_PROJECT_TASKS', name: '16 Project Tasks', category: 'CRM', trigger: 'SIGNAL', description: 'AI task breakdown for the new project' },
  { code: 'W17_PROJECT_UPDATES', name: '17 Project Updates', category: 'COMMUNICATION', trigger: 'SIGNAL', description: 'Progress updates to client at milestones' },
  { code: 'W18_FINAL_PAYMENT', name: '18 Final Payment', category: 'FINANCE', trigger: 'SIGNAL', description: 'Final payment request + verification gate' },
  { code: 'W19_DELIVERY', name: '19 Delivery', category: 'DELIVERY', trigger: 'SIGNAL', description: 'Delivery checklist + client confirmation' },
  { code: 'W20_SOURCE_HANDOVER', name: '20 Source Code Handover', category: 'DELIVERY', trigger: 'SIGNAL', description: 'Full payment gate → approval → secure package release' },
  { code: 'W21_PASSWORD_CHANGE', name: '21 Password Change', category: 'SECURITY', trigger: 'SIGNAL', description: 'Request + confirm client password change after handover' },
  { code: 'W22_REVIEW_REQUEST', name: '22 Review Request', category: 'GROWTH', trigger: 'SIGNAL', description: 'Optional review request after confirmation' },
  { code: 'W23_REFERRAL_REQUEST', name: '23 Referral Request', category: 'GROWTH', trigger: 'SIGNAL', description: 'Optional referral request' },
  { code: 'W24_DAILY_CEO_REPORT', name: '24 Daily CEO Report', category: 'EXECUTIVE', trigger: 'SCHEDULE', description: 'Daily executive report from live CRM data' },
  { code: 'W25_ERROR_MONITORING', name: '25 Error Monitoring', category: 'GOVERNANCE', trigger: 'SCHEDULE', description: 'Scan failed automations/messages → retry/escalate' },
  { code: 'W26_LEAD_ENRICHMENT', name: '26 Lead Enrichment', category: 'GROWTH', trigger: 'WEBHOOK', description: 'Free enrichment: validate → public website signals → score → create lead only if contactable' },
]

const BLOG_POSTS = [
  {
    slug: 'why-html-preview-before-payment-changes-software-outsourcing',
    title: 'Why "HTML Preview Before Payment" Changes Software Outsourcing',
    excerpt: 'Most clients have been burned by paying upfront and receiving something different. We inverted the risk: you approve a working preview before money moves.',
    category: 'Company',
    content: `# Why "HTML Preview Before Payment" Changes Software Outsourcing\n\nThe software industry has a trust problem. Clients pay 50% upfront, wait months, and receive something that looks nothing like the proposal. Vendors, on the other side, fear scope creep and non-payment. Both parties lose.\n\nAt Tech360 we structured our delivery model around one principle: **HTML Preview Before Payment.** Before we ask for a single dollar, you receive a working, clickable preview of what your project will become — generated from your approved scope of work.\n\n## How it works\n\n1. We analyze your business and requirements.\n2. You approve a Final Scope of Work — every deliverable, timeline and payment milestone in writing.\n3. We build and send you an HTML preview of the solution.\n4. You approve it (or request revisions — free at this stage).\n5. Only then does payment begin.\n\nAnd the second gate: **Source Code After Full Payment.** Your final source package is released only after payment completion is verified. Both rules protect both sides and remove ambiguity from delivery.\n\n## What this means for your business\n\n- You can evaluate quality with your own eyes before committing budget.\n- The scope document and preview are permanent references — no "I thought it would include..." disputes.\n- Revisions happen before financial commitment, when they are cheapest.\n\nTrust is not a marketing claim. It is a workflow design decision.`,
  },
  {
    slug: 'whatsapp-cloud-api-for-bangladeshi-businesses',
    title: 'WhatsApp Cloud API for Bangladeshi Businesses: A Practical Guide',
    excerpt: 'WhatsApp is where your customers already are. Here is what the official Cloud API makes possible for order management, support and automation.',
    category: 'Engineering',
    content: `# WhatsApp Cloud API for Bangladeshi Businesses\n\nIn Bangladesh, WhatsApp is not a channel — it is THE channel. Businesses run entire sales flows through it: product photos, price negotiation, delivery confirmation, payment screenshots.\n\nThe official **WhatsApp Cloud API** turns this informal workflow into an auditable system.\n\n## What becomes possible\n\n- **Every conversation linked to a Client ID** — history lives in your CRM, not in one employee's phone.\n- **Template messages** for order updates, payment reminders and delivery confirmations.\n- **Automated intake** — a first message can automatically create a lead, classify the business and trigger follow-up.\n- **Delivery receipts and read status** — you know the message reached the customer.\n\n## Practical architecture\n\nA production setup needs: a Meta business verification, a phone number registered to the Cloud API, a webhook endpoint for inbound messages, and a CRM that stores every message against the client record. Our automation stack (n8n + Tech360 CRM) does exactly this — including failure logging, because a message that silently failed is worse than no message.\n\n## Common mistakes\n\n1. Using unofficial gateways — they get numbers banned.\n2. Sending promotions outside approved templates — against Meta policy.\n3. No delivery-status tracking — you never learn which messages failed.\n\nStart with transactional use cases (order updates, support). They have the highest approval rates and clearest ROI.`,
  },
  {
    slug: 'ai-agents-that-actually-execute',
    title: 'AI Agents That Actually Execute (Not Just Chat)',
    excerpt: 'A dashboard that shows "agents" without database-backed execution is theater. Here is how real agent execution is built, logged and governed.',
    category: 'AI Systems',
    content: `# AI Agents That Actually Execute\n\nThe term "AI agent" has drifted into decoration: icons on a dashboard that simulate activity. A real agent has a job, tools, permissions, a persistent record of every execution, and an approval gate when the action is sensitive.\n\n## The anatomy of a real agent\n\n1. **Identity and purpose** — a unique code, a department, a single clear responsibility.\n2. **A system prompt** — its operating instructions, including rules it cannot break.\n3. **Tools and permissions** — what it may read, what it may write, what it may never touch.\n4. **Execution records** — every run stored: input, output, duration, tokens, errors.\n5. **Governance** — actions that send money, source code or legal communication require human approval before execution.\n\n## Why logging is the difference\n\nWhen an agent drafts a scope of work, the draft, the review notes and the approval are stored against the client's ID. If a client asks "why did the timeline change?" the answer is a query, not a memory.\n\n## The constitutional layer\n\nOur agents operate under non-negotiable rules: never claim an action that did not happen, never release source code before payment verification, never expose client data, always escalate uncertainty to a human. An AI workforce you cannot audit is a liability, not an asset.`,
  },
  {
    slug: 'n8n-workflow-automation-for-sme-growth',
    title: 'n8n Workflow Automation for SME Growth',
    excerpt: 'Manual follow-up is where small businesses lose revenue. A look at the automation backbone we deploy: triggers, CRM writes, retries and reporting.',
    category: 'Automation',
    content: `# n8n Workflow Automation for SME Growth\n\nEvery hour spent copying leads into spreadsheets, sending the same WhatsApp follow-up, or chasing invoice status is an hour not spent on the business.\n\n## The automation backbone\n\nWe deploy n8n as the automation engine: every workflow has a trigger, validation, processing, a database write, success and failure paths, retry logic and logging. If a WhatsApp message fails, the failure is recorded and retried — not silently dropped.\n\n## Example: lead follow-up without human latency\n\nA new inquiry at 2 AM triggers: lead creation → Client ID assignment → business classification → plan recommendation → discovery questions sent via WhatsApp and email. By the time your team wakes up, the conversation is already moving.\n\n## What to automate first\n\n1. Lead intake and first-response (highest revenue impact).\n2. Payment reminders tied to invoice status.\n3. Delivery status updates.\n4. Daily executive reports.\n\nAutomation is not about replacing people — it is about guaranteeing that nothing falls through the cracks.`,
  },
  {
    slug: 'client-id-discipline-in-crm-design',
    title: 'Client ID Discipline: The Small Habit That Saves Enterprises',
    excerpt: 'Every message, file, payment and approval permanently linked to one Client ID. Why this single design decision eliminates most CRM chaos.',
    category: 'CRM',
    content: `# Client ID Discipline in CRM Design\n\nAsk a growing company "show me everything that happened with this client" and watch tabs open: email, WhatsApp, spreadsheets, a drive folder, someone's memory.\n\n## One ID, one truth\n\nIn our CRM, every record — communication, payment, approval, file, meeting, delivery, audit entry — carries the client's ID (TECH-YYYY-NNNNNN). The ID is generated at first contact and never changes.\n\n## What this unlocks\n\n- **Complete history** in one query: messages, scope versions, payments, evidence.\n- **No orphaned records** — a payment without a client is a data bug, not a mystery.\n- **Auditability** — when a dispute arises, the timeline answers it.\n- **Handover-proof operations** — staff changes don't lose context.\n\nIt sounds trivial. It is the difference between a CRM and a contact list.`,
  },
  {
    slug: 'google-cloud-run-architecture-for-small-teams',
    title: 'Google Cloud Run Architecture for Small Teams',
    excerpt: 'Enterprise-grade deployment without an ops team: Cloud Run, Cloud SQL, Secret Manager and why container filesystems are not for permanent data.',
    category: 'Cloud',
    content: `# Google Cloud Run Architecture for Small Teams\n\nYou do not need a platform team to run production-grade infrastructure. Google Cloud Run gives you auto-scaling containers, HTTPS and health checks with near-zero ops.\n\n## The stack we deploy\n\n- **Cloud Run** — the application, listening on PORT, autoscaled.\n- **Cloud SQL** — managed relational database with automated backups.\n- **Secret Manager** — every credential (SMTP, WhatsApp tokens, API keys) stored encrypted, never in code.\n- **Cloud Storage** — permanent files and evidence.\n- **Cloud Build + Artifact Registry** — reproducible builds.\n- **Cloud Scheduler** — cron for reports and monitoring.\n- **Cloud Logging** — centralized observability.\n\n## One rule people learn the hard way\n\nCloud Run container filesystems are **disposable**. Instance restarts wipe local files. Anything permanent — uploads, evidence, packages — belongs in Cloud Storage. Design for statelessness from day one.\n\nThe result: a system where deployment is a command, secrets are rotated without redeploys, and 3 AM failures page someone with actual diagnostic context.`,
  },
]

async function main() {
  // Explicit bootstrap only; production startup/build never invokes this seed.
  // Keep every upsert's update empty so a rerun can create missing defaults
  // without overwriting operator-managed rows. tests/seed-safety.mjs guards it.
  console.log('Seeding Tech360 platform...')

  // 1) Super Admin + staff roles
  //
  // The bootstrap password must never come from a literal in this file: this
  // repository is on GitHub, so a committed default is a publicly known
  // Super Admin credential the moment the seed runs anywhere reachable.
  // In production ADMIN_PASSWORD is mandatory; the dev fallback is used only
  // outside production and the account is always flagged mustChangePassword.
  const isProduction = process.env.NODE_ENV === 'production'
  const suppliedAdminEmail = process.env.ADMIN_EMAIL?.trim()
  const adminEmail = (suppliedAdminEmail || (isProduction ? '' : 'admin@bdtech360.com')).toLowerCase()
  const suppliedPassword = process.env.ADMIN_PASSWORD

  if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    console.error('REFUSING TO SEED: ADMIN_EMAIL must be a valid email address.')
    process.exit(1)
  }
  if (isProduction && !suppliedPassword) {
    console.error('REFUSING TO SEED: ADMIN_PASSWORD is not set.')
    console.error('Set a strong ADMIN_PASSWORD in the Hostinger environment before seeding production.')
    console.error('It is never read from a file and never committed.')
    process.exit(1)
  }
  if (isProduction && suppliedPassword && suppliedPassword.length < 12) {
    console.error('REFUSING TO SEED: ADMIN_PASSWORD is shorter than 12 characters.')
    process.exit(1)
  }
  const adminPassword = suppliedPassword ?? 'dev-only-change-me'
  await db.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Tech360 Super Admin',
      role: 'SUPER_ADMIN',
      title: 'Super Administrator',
      passwordHash: hashPassword(adminPassword),
      mustChangePassword: true,
    },
  })
  console.log(`  ✓ Super Admin: ${adminEmail} (password from ADMIN_PASSWORD${isProduction ? '' : ' or dev fallback'}; must change on first login)`)

  // 2) Canonical AI workforce registry (idempotent and shared with admin bootstrap).
  const registry = await ensureAgentRegistry(db)
  console.log(`  ✓ ${registry.departments} departments`)
  console.log(`  ✓ ${registry.agents} AI agents`)

  // 3) Prompt templates
  for (const t of PROMPT_TEMPLATES) {
    await db.promptTemplate.upsert({
      where: { code: t.code },
      update: {},
      create: { code: t.code, name: t.name, category: t.category, template: t.template, variables: JSON.stringify(t.variables) },
    })
  }
  console.log(`  ✓ ${PROMPT_TEMPLATES.length} prompt templates`)

  // 5) n8n workflow registry
  for (const w of N8N_WORKFLOWS) {
    await db.n8nWorkflow.upsert({
      where: { code: w.code },
      update: {},
      create: { code: w.code, name: w.name, category: w.category, trigger: w.trigger, description: w.description, definition: '{}' },
    })
  }
  console.log(`  ✓ ${N8N_WORKFLOWS.length} n8n workflows registered`)

  // 6) Company memory
  const memories: Array<{ scope: string; key: string; content: string; importance: number }> = [
    { scope: 'COMPANY', key: 'identity', content: `${COMPANY.legalName} (brand: Tech360), Missouri LLC ${COMPANY.missouriLLC}, EIN ${COMPANY.ein}. Address: ${COMPANY.address}. Domain ${COMPANY.domain}. Primary email ${COMPANY.email}. Contact channel: AI assistant chat at ${COMPANY.url}.`, importance: 10 },
    { scope: 'BRAND', key: 'voice', content: 'Professional, warm, confident, business-first. Never mention AI generation to clients. Sign messages "Team Tech360". No emojis in formal email.', importance: 9 },
    { scope: 'SERVICES', key: 'portfolio', content: 'Business/Enterprise Websites, eCommerce, Custom CRM, Client Portals, Dashboards, WhatsApp Automation, Email/SMS Automation, n8n Automation, AI Agent Systems, API Integrations, Database Systems, Cloud Deployment (Google Cloud, cPanel/StackCP), Maintenance & Support, Digital Transformation.', importance: 9 },
    { scope: 'PRICING', key: 'policy', content: 'Payment policy: advance / milestone / final split per scope (commonly 40/30/30). HTML Preview Before Payment. Source Code After Full Payment. Scope changes after approval may require additional cost/time.', importance: 10 },
    { scope: 'POLICIES', key: 'core', content: 'Terms, Privacy, Refund, Delivery, Payment, Client Approval and Source Code Handover policies are published on the website. Refunds follow the approved agreement; advance covers committed work and is generally non-refundable after scope approval per policy.', importance: 9 },
    { scope: 'WORKFLOW', key: 'journey', content: 'Journey: first message → Client ID → business detection → plan → scope questions → scope review → draft SOW → admin approval → final SOW via WhatsApp+Email → client approval (or revision / meeting-if-requested) → HTML preview → preview approval → payment request → verified payment → project active + tasks → development → testing → client review → final payment → handover package → admin approval → release → password change confirmation → delivery confirmation → optional review/referral → close.', importance: 10 },
  ]
  for (const m of memories) {
    const existing = await db.aiMemory.findFirst({ where: { scope: m.scope, key: m.key } })
    if (!existing) await db.aiMemory.create({ data: m })
  }
  console.log(`  ✓ company memory`)

  // 7) Blog posts
  for (const p of BLOG_POSTS) {
    await db.blogPost.upsert({
      where: { slug: p.slug },
      update: {},
      create: { slug: p.slug, title: p.title, excerpt: p.excerpt, content: p.content, category: p.category, author: 'Tech360 Team', status: 'PUBLISHED' },
    })
  }
  console.log(`  ✓ ${BLOG_POSTS.length} blog posts`)

  // 8) Settings
  const settings: Array<{ key: string; value: string }> = [
    { key: 'site.metaPixelId', value: JSON.stringify('957513230517009') },
    { key: 'site.gtmId', value: JSON.stringify('GTM-TM87LDXK') },
    { key: 'company.name', value: JSON.stringify(COMPANY.legalName) },
    { key: 'company.brand', value: JSON.stringify(COMPANY.brand) },
    { key: 'automation.engine', value: JSON.stringify('https://automation.bdtech360.com') },
    { key: 'governance.autoApproveRiskBelow', value: JSON.stringify('LOW') },
  ]
  for (const s of settings) {
    await db.setting.upsert({ where: { key: s.key }, update: {}, create: s })
  }
  console.log('  ✓ settings')

  console.log('Seed complete.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
