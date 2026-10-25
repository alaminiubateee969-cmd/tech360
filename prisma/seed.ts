<<<<<<< HEAD
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

  // 3b) The AI-EOS workforce prompts.
  //
  // The live prompt library is 70,400 slots and is MATERIALISED on
  // demand by the retriever, not stored. What is persisted here is a
  // representative, real binding for every department and every role
  // archetype, with the retrieval metadata the retriever scores on.
  // The panel shows the live library index next to these rows.
  const { buildPromptsForBinding } = await import('../src/lib/prompts/library')
  const { ROLE_ARCHETYPES } = await import('../src/lib/agents/catalogue')
  const { DEPARTMENTS } = await import('../src/lib/agents/registry')
  const STORED_STAGES = ['TASK_EXECUTION'] as const
  let promptCount = 0
  for (const department of DEPARTMENTS) {
    for (const role of ROLE_ARCHETYPES) {
      const records = buildPromptsForBinding({
        departmentCode: department.code,
        roleSlug: role.slug,
        roleTitle: role.title,
      })
      for (const record of records) {
        if (!STORED_STAGES.includes(record.stage as (typeof STORED_STAGES)[number])) continue
        if (record.language !== 'en') continue
        await db.promptTemplate.upsert({
          where: { code: record.code },
          update: {},
          create: {
            code: record.code,
            name: record.name,
            category: department.category,
            agentCode: null,
            template: record.template,
            variables: JSON.stringify(record.variables),
            stage: record.stage,
            priority: record.priority,
            quality: record.quality,
            language: record.language,
            version: record.version,
            role: role.slug,
            departmentCode: department.code,
            status: 'ACTIVE',
          },
        })
        promptCount += 1
      }
    }
  }
  console.log(`  ✓ ${promptCount} workforce prompt bindings`)

  // 3c) The structural knowledge graph.
  //
  // The organisation, the procedures and the tools are true by
  // construction, so their edges are asserted with confidence 1 and
  // marked verified. Nothing is fabricated: the graph is derived from
  // the live registries.
  const { buildStructuralGraph, graphStats } = await import('../src/lib/knowledge/graph')
  const graph = await buildStructuralGraph({ assertedBy: 'prisma/seed.ts' })
  const graphState = await graphStats()
  console.log(`  ✓ knowledge graph: ${graph.entities} entities, ${graph.relations} relations (${graphState.entities} total)`)

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
  // The communication pipeline policy is upserted, so an existing
  // installation receives the current wording on the next seed.
  const pipelineMemories: Array<{ scope: string; key: string; content: string; importance: number }> = [
    {
      scope: 'WORKFLOW',
      key: 'communication-pipeline',
      content: 'Communication pipeline (11 stages): 1 first message received (save Client ID + message) → 2 business type received (detect industry, recommend plan, ask the eight scope questions, send WhatsApp + email) → 3 scope details received (save scope, draft SOW, ADMIN REVIEW REQUIRED before the final scope is sent) → 4 final scope approved (send final SOW + HTML-preview policy + payment policy, ask the client to review, offer a meeting link) → 5A meeting needed (send meeting link, save request, create task) / 5B scope approved (save approval, send confirmation, prepare HTML preview) → 6 preview sent (send preview link, ask Approved / Need revision / Need meeting) → 7A revision (save revision, notify admin, create task) / 7B preview approved (save approval, payment instruction only after admin approval) → 8 payment received (save payment, notify admin and team, unlock delivery) → 9 delivery ready (send notice; source code NOT released unless payment confirmed; admin approval required for the file links) → 10 delivery completed (save delivery, ask password-change confirmation, ask the client to confirm) → 11 client confirms (close project, request review, request optional recommendation).',
      importance: 10,
    },
    {
      scope: 'POLICIES',
      key: 'communication-policy',
      content: 'Communication policy. AI CAN AUTO SEND: first reply, business-type request, recommended plan, scope questions, meeting link, HTML-preview notification, revision acknowledgement, payment-received acknowledgement, review request. AI MUST WAIT FOR ADMIN APPROVAL BEFORE SENDING: final Scope of Work, payment instruction with amount, invoice, legal/refund response, source-code handover, final delivery file links, dispute response. AI MUST ALWAYS SAVE: incoming message, outgoing message, email body, WhatsApp body, SMS body, client ID, status change, timestamp, admin approval, payment proof, delivery proof. FINAL RULES: no source code before payment confirmation; no final legal message without admin approval; no payment-specific message without admin approval; no sensitive files in public AI content; HTML Preview Before Payment; Source Code After Full Payment. The AI agent must NEVER mention a phone number in website-facing content. Client IDs use the format TECH-2026-000001.',
      importance: 10,
    },
  ]
  for (const m of pipelineMemories) {
    const existing = await db.aiMemory.findFirst({ where: { scope: m.scope, key: m.key } })
    if (existing) {
      await db.aiMemory.update({ where: { id: existing.id }, data: { content: m.content, importance: m.importance } })
    } else {
      await db.aiMemory.create({ data: m })
    }
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
=======
// Tech360 Platform — Seed data
// Run: bunx tsx prisma/seed.ts

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9 + (n % 8), (n * 7) % 60, 0, 0);
  return d;
}

async function main() {
  console.log("🌱 Seeding Tech360 platform...");

  // ---------- USERS ----------
  const admin = await db.user.upsert({
    where: { email: "admin@bdtech360.com" },
    update: {},
    create: {
      email: "admin@bdtech360.com",
      name: "Tariq Aziz",
      role: "SUPER_ADMIN",
      password: await bcrypt.hash("admin123", 10),
    },
  });

  const staffUsers = await Promise.all(
    [
      { name: "Sumaiya Akter", email: "sumaiya@bdtech360.com", role: "MANAGER" as const },
      { name: "Rakib Hossain", email: "rakib@bdtech360.com", role: "AGENT" as const },
      { name: "Nusrat Jahan", email: "nusrat@bdtech360.com", role: "STAFF" as const },
      { name: "Arif Mahmud", email: "arif@bdtech360.com", role: "AGENT" as const },
      { name: "Farhana Islam", email: "farhana@bdtech360.com", role: "STAFF" as const },
    ].map((u) =>
      db.user.upsert({
        where: { email: u.email },
        update: {},
        create: { ...u, password: await bcrypt.hash("staff123", 10) },
      })
    )
  );

  const allUsers = [admin, ...staffUsers];

  // ---------- STAFF ----------
  const departments = ["Engineering", "Sales", "Marketing", "Operations", "Design"];
  await Promise.all(
    allUsers.map((u, i) =>
      db.staff.upsert({
        where: { userId: u.id },
        update: {},
        create: {
          userId: u.id,
          role: u.role,
          permissions: ["leads:read", "leads:write", "projects:read", "approvals:review"].join("|"),
          department: pick(departments, i),
          hourlyRate: 25 + i * 7,
        },
      })
    )
  );

  // ---------- AGENTS ----------
  const agentDefs: Array<{ name: string; role: string; desc: string; skill: string; status: "ONLINE" | "BUSY" | "OFFLINE"; last: string }> = [
    { name: "CEO Strategist", role: "Executive", desc: "Translates business goals into quarterly OKRs and orchestrates the entire agent fleet.", skill: "skills/private/executive-ceo-control/strategy-agent/SKILL.md", status: "ONLINE", last: "Drafted Q3 expansion plan" },
    { name: "CRM Manager", role: "Operations", desc: "Maintains lead lifecycle, scores opportunities, and triggers follow-ups.", skill: "skills/private/crm-and-automation/manager-agent/SKILL.md", status: "ONLINE", last: "Re-scored 14 stale leads" },
    { name: "WhatsApp Agent", role: "Communications", desc: "Routes inbound WhatsApp messages, drafts replies, escalates hot leads.", skill: "skills/private/messaging/whatsapp-agent/SKILL.md", status: "BUSY", last: "Answered 23 inbound chats" },
    { name: "Scope Builder", role: "Delivery", desc: "Generates project scopes from intake briefs with milestones and budgets.", skill: "skills/private/delivery/scope-builder-agent/SKILL.md", status: "BUSY", last: "Built scope for Apex Realty" },
    { name: "Legal Reviewer", role: "Compliance", desc: "Reviews contracts and scopes for risky clauses and regulatory exposure.", skill: "skills/private/legal/legal-reviewer-agent/SKILL.md", status: "ONLINE", last: "Cleared 4 SOWs" },
    { name: "Evidence Tracker", role: "Delivery", desc: "Captures delivery proof — screenshots, links, signatures — for every milestone.", skill: "skills/private/delivery/evidence-tracker-agent/SKILL.md", status: "ONLINE", last: "Logged 11 deliverables" },
    { name: "Payment Verifier", role: "Finance", desc: "Reconciles inbound payments against invoices and flags mismatches.", skill: "skills/private/finance/payment-verifier-agent/SKILL.md", status: "ONLINE", last: "Verified $14,800 in receipts" },
    { name: "Meeting Scheduler", role: "Operations", desc: "Books client meetings, sends invites, manages reschedules.", skill: "skills/private/calendar/meeting-scheduler-agent/SKILL.md", status: "OFFLINE", last: "Scheduled 6 calls yesterday" },
    { name: "Content Writer", role: "Marketing", desc: "Drafts blogs, emails, and ad copy in the brand voice.", skill: "skills/private/content/content-writer-agent/SKILL.md", status: "ONLINE", last: "Wrote 3 blog drafts" },
    { name: "Social Media Manager", role: "Marketing", desc: "Plans and queues posts across Facebook, Instagram, LinkedIn, X.", skill: "skills/private/social/social-media-manager-agent/SKILL.md", status: "BUSY", last: "Queued 18 posts" },
    { name: "Brand Designer", role: "Design", desc: "Produces logos, decks, and visual systems from brand briefs.", skill: "skills/private/design/brand-designer-agent/SKILL.md", status: "ONLINE", last: "Designed Meridian logo" },
    { name: "Video Producer", role: "Media", desc: "Edits short-form videos, adds captions, exports for each platform.", skill: "skills/private/media/video-producer-agent/SKILL.md", status: "OFFLINE", last: "Cut 4 reels for Apex" },
    { name: "Knowledge Curator", role: "Operations", desc: "Indexes deliverables into the knowledge base with tags.", skill: "skills/private/knowledge/knowledge-curator-agent/SKILL.md", status: "ONLINE", last: "Indexed 7 articles" },
    { name: "Memory Keeper", role: "Operations", desc: "Maintains long-term client memory and context across engagements.", skill: "skills/private/memory/memory-keeper-agent/SKILL.md", status: "ONLINE", last: "Synced memory for 9 clients" },
    { name: "Email Composer", role: "Communications", desc: "Drafts and sends templated client emails with personalization.", skill: "skills/private/messaging/email-composer-agent/SKILL.md", status: "BUSY", last: "Sent 31 follow-ups" },
    { name: "SEO Optimizer", role: "Marketing", desc: "Audits on-page SEO, generates meta tags, suggests content gaps.", skill: "skills/private/marketing/seo-optimizer-agent/SKILL.md", status: "ONLINE", last: "Audited 12 pages" },
    { name: "Error Monitor", role: "Engineering", desc: "Watches logs, surfaces regressions, opens tickets.", skill: "skills/private/engineering/error-monitor-agent/SKILL.md", status: "ONLINE", last: "Triage: 2 P2 incidents" },
    { name: "Approval Gatekeeper", role: "Operations", desc: "Routes approvals to the right stakeholder and enforces SLAs.", skill: "skills/private/approvals/approval-gatekeeper-agent/SKILL.md", status: "ONLINE", last: "Escalated 1 overdue SOW" },
    { name: "Analytics Insights", role: "Operations", desc: "Turns raw events into weekly insights and anomaly alerts.", skill: "skills/private/analytics/analytics-insights-agent/SKILL.md", status: "BUSY", last: "Weekly report published" },
    { name: "Client Success", role: "Operations", desc: "Tracks NPS, churn risk, and renewal expansion opportunities.", skill: "skills/private/success/client-success-agent/SKILL.md", status: "ONLINE", last: "Flagged 1 churn risk" },
  ];

  await db.agent.deleteMany({});
  const agents = await Promise.all(
    agentDefs.map((a, i) =>
      db.agent.create({
        data: {
          name: a.name,
          role: a.role,
          description: a.desc,
          status: a.status,
          skillPath: a.skill,
          lastAction: a.last,
          config: JSON.stringify({ model: "gpt-4o", temperature: 0.4, version: `1.${i}` }),
        },
      })
    )
  );

  // ---------- LEADS ----------
  const leadSeeds: Array<{ name: string; email: string; phone: string; company: string; source: "WEBSITE" | "WHATSAPP" | "SOCIAL" | "REFERRAL" | "DIRECT"; status: "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST"; score: number; message: string }> = [
    { name: "Imran Khan", email: "imran@apexrealty.com", phone: "+8801711002001", company: "Apex Realty", source: "WEBSITE", status: "WON", score: 92, message: "Need a CRM + WhatsApp automation for our sales team of 12." },
    { name: "Sara Mitchell", email: "sara@brightpath.io", phone: "+14155550102", company: "BrightPath", source: "REFERRAL", status: "QUALIFIED", score: 88, message: "Looking to rebuild our marketing site + SEO program." },
    { name: "Tanvir Ahmed", email: "tanvir@dhakaeats.com", phone: "+8801811002003", company: "Dhaka Eats", source: "WHATSAPP", status: "CONTACTED", score: 71, message: "Need a food delivery mobile app, MVP in 8 weeks." },
    { name: "Priya Sharma", email: "priya@vidyacore.in", phone: "+919811002004", company: "VidyaCore", source: "SOCIAL", status: "QUALIFIED", score: 84, message: "LMS for 3,000 students, integrated with our SIS." },
    { name: "Marcus Lee", email: "marcus@finsecure.co", phone: "+12125550105", company: "FinSecure", source: "DIRECT", status: "NEW", score: 65, message: "Interested in cybersecurity audit + SOC2 prep." },
    { name: "Aisha Rahman", email: "aisha@noorhealth.com", phone: "+8801911002006", company: "Noor Health", source: "WEBSITE", status: "CONTACTED", score: 77, message: "Patient portal + telemedicine integration." },
    { name: "David Chen", email: "david@manufactron.io", phone: "+12135550107", company: "Manufactron", source: "REFERRAL", status: "QUALIFIED", score: 81, message: "IoT dashboard for factory floor monitoring." },
    { name: "Lena Petrova", email: "lena@studiomira.com", phone: "+74995550108", company: "Studio Mira", source: "SOCIAL", status: "WON", score: 90, message: "Brand system + Webflow site, fast turnaround." },
    { name: "Omar Faruque", email: "omar@legacylaw.com", phone: "+8801611002009", company: "Legacy Law", source: "DIRECT", status: "NEW", score: 58, message: "Need case management software, compliance-heavy." },
    { name: "Helena Ortiz", email: "helena@casapaz.com", phone: "+52115550110", company: "Casa Paz", source: "WEBSITE", status: "LOST", score: 42, message: "Hotel booking engine, but budget too low." },
    { name: "Rohan Mehta", email: "rohan@skylineinfra.in", phone: "+91985550111", company: "Skyline Infra", source: "REFERRAL", status: "QUALIFIED", score: 86, message: "Real-estate CRM + lead scoring automation." },
    { name: "Yuki Tanaka", email: "yuki@aoyamaretail.jp", phone: "+81355550112", company: "Aoyama Retail", source: "SOCIAL", status: "CONTACTED", score: 73, message: "E-commerce replatform to headless commerce." },
    { name: "Bilal Hossain", email: "bilal@chittagongfintech.com", phone: "+8801511002013", company: "Ctg Fintech", source: "WHATSAPP", status: "NEW", score: 69, message: "Mobile wallet + agent network dashboard." },
    { name: "Claire Dubois", email: "claire@lumierehotels.com", phone: "+33155550114", company: "Lumiere Hotels", source: "DIRECT", status: "WON", score: 89, message: "Guest experience app + concierge AI." },
    { name: "Fahim Reza", email: "fahim@urbanlogistics.com", phone: "+8801311002015", company: "Urban Logistics", source: "WEBSITE", status: "LOST", score: 38, message: "Fleet tracking, went with in-house build." },
  ];

  await db.lead.deleteMany({});
  const leads = await Promise.all(
    leadSeeds.map((l, i) =>
      db.lead.create({
        data: {
          ...l,
          assignedTo: i % 2 === 0 ? staffUsers[1].id : staffUsers[3].id,
          createdAt: daysAgo(i + 1),
        },
      })
    )
  );

  // ---------- PROJECTS ----------
  const projectSeeds: Array<{ name: string; clientId: string; scope: string; status: "PLANNING" | "IN_PROGRESS" | "REVIEW" | "DELIVERED"; budget: number }> = [
    { name: "Apex Realty CRM Build", clientId: leads[0].id, scope: "Custom CRM with WhatsApp Business API integration and lead scoring engine.", status: "IN_PROGRESS", budget: 48000 },
    { name: "BrightPath Marketing Site", clientId: leads[1].id, scope: "Headless Next.js marketing site + SEO program + content studio.", status: "REVIEW", budget: 22000 },
    { name: "Dhaka Eats Mobile App", clientId: leads[2].id, scope: "React Native food delivery MVP with real-time order tracking.", status: "PLANNING", budget: 36000 },
    { name: "VidyaCore LMS", clientId: leads[3].id, scope: "SCORM-compliant LMS with SIS integration and analytics.", status: "IN_PROGRESS", budget: 64000 },
    { name: "Studio Mira Brand", clientId: leads[7].id, scope: "Brand identity system + Webflow site + design tokens.", status: "DELIVERED", budget: 18000 },
    { name: "Lumiere Guest App", clientId: leads[13].id, scope: "Guest experience app with AI concierge and multilingual support.", status: "PLANNING", budget: 52000 },
    { name: "Skyline Real-Estate CRM", clientId: leads[10].id, scope: "Real-estate CRM with lead scoring + WhatsApp automation.", status: "IN_PROGRESS", budget: 41000 },
    { name: "Ctg Fintech Wallet", clientId: leads[12].id, scope: "Mobile wallet dashboard with agent network management.", status: "REVIEW", budget: 39000 },
  ];

  await db.project.deleteMany({});
  const projects = await Promise.all(
    projectSeeds.map((p, i) =>
      db.project.create({
        data: {
          ...p,
          startDate: daysAgo(20 - i * 2),
          endDate: daysAgo(-(20 + i * 3)),
          createdAt: daysAgo(20 - i * 2),
        },
      })
    )
  );

  // Link won leads to projects
  await db.lead.update({ where: { id: leads[0].id }, data: { projectId: projects[0].id } });
  await db.lead.update({ where: { id: leads[7].id }, data: { projectId: projects[4].id } });
  await db.lead.update({ where: { id: leads[13].id }, data: { projectId: projects[5].id } });
  await db.lead.update({ where: { id: leads[1].id }, data: { projectId: projects[1].id } });
  await db.lead.update({ where: { id: leads[3].id }, data: { projectId: projects[3].id } });
  await db.lead.update({ where: { id: leads[2].id }, data: { projectId: projects[2].id } });
  await db.lead.update({ where: { id: leads[10].id }, data: { projectId: projects[6].id } });
  await db.lead.update({ where: { id: leads[12].id }, data: { projectId: projects[7].id } });

  // ---------- COMMUNICATIONS ----------
  const commSeeds: Array<{ channel: "EMAIL" | "WHATSAPP" | "CALL" | "MEETING" | "SOCIAL"; direction: "INBOUND" | "OUTBOUND"; subject: string; body: string; leadIdx: number; projectIdx?: number }> = [
    { channel: "EMAIL", direction: "INBOUND", subject: "Initial inquiry", body: "Hi, saw your site — interested in your CRM offering.", leadIdx: 0, projectIdx: 0 },
    { channel: "WHATSAPP", direction: "OUTBOUND", subject: "Follow-up", body: "Hi Imran, sending the proposal as discussed. 📄", leadIdx: 0, projectIdx: 0 },
    { channel: "CALL", direction: "OUTBOUND", subject: "Discovery call", body: "45-min discovery call. Budget confirmed at $48k.", leadIdx: 0, projectIdx: 0 },
    { channel: "EMAIL", direction: "OUTBOUND", subject: "Proposal sent", body: "Sent SOW with phased milestones.", leadIdx: 1, projectIdx: 1 },
    { channel: "WHATSAPP", direction: "INBOUND", subject: "Quick question", body: "Can we add a chatbot to the LMS?", leadIdx: 3, projectIdx: 3 },
    { channel: "MEETING", direction: "OUTBOUND", subject: "Kickoff", body: "Project kickoff — agenda: scope, timeline, payments.", leadIdx: 0, projectIdx: 0 },
    { channel: "SOCIAL", direction: "INBOUND", subject: "DM on LinkedIn", body: "Loved your case study — can we chat?", leadIdx: 7, projectIdx: 4 },
    { channel: "EMAIL", direction: "INBOUND", subject: "Re: Timeline", body: "Sounds great. Let's lock in the 8-week plan.", leadIdx: 2, projectIdx: 2 },
    { channel: "CALL", direction: "INBOUND", subject: "Support call", body: "Question about WhatsApp API setup.", leadIdx: 12, projectIdx: 7 },
    { channel: "WHATSAPP", direction: "OUTBOUND", subject: "Reminder", body: "Friendly reminder: kickoff tomorrow at 10am.", leadIdx: 13, projectIdx: 5 },
    { channel: "EMAIL", direction: "OUTBOUND", subject: "Delivery handover", body: "All deliverables uploaded to your portal.", leadIdx: 7, projectIdx: 4 },
    { channel: "SOCIAL", direction: "OUTBOUND", subject: "Thank-you note", body: "Thanks for the kind words on LinkedIn! 🙌", leadIdx: 7, projectIdx: 4 },
  ];

  await db.communication.deleteMany({});
  await Promise.all(
    commSeeds.map((c, i) =>
      db.communication.create({
        data: {
          channel: c.channel,
          direction: c.direction,
          subject: c.subject,
          body: c.body,
          leadId: leads[c.leadIdx].id,
          projectId: c.projectIdx !== undefined ? projects[c.projectIdx].id : null,
          createdAt: daysAgo(18 - i),
        },
      })
    )
  );

  // ---------- SCOPES ----------
  const scopeSeeds: Array<{ title: string; deliverables: string[]; timeline: string; budget: number; status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED"; projectIdx: number }> = [
    { title: "Apex CRM — Phase 1", deliverables: ["Lead schema + migration", "Pipeline board", "WhatsApp Business API integration", "Lead scoring engine"], timeline: "6 weeks", budget: 24000, status: "APPROVED", projectIdx: 0 },
    { title: "BrightPath Marketing Site", deliverables: ["Information architecture", "Headless Next.js build", "SEO audit + program", "Content studio setup"], timeline: "5 weeks", budget: 22000, status: "PENDING_APPROVAL", projectIdx: 1 },
    { title: "Dhaka Eats MVP", deliverables: ["Order flow", "Restaurant dashboard", "Driver app", "Admin panel"], timeline: "8 weeks", budget: 36000, status: "DRAFT", projectIdx: 2 },
    { title: "VidyaCore LMS — Core", deliverables: ["Course builder", "SCORM player", "SIS integration", "Analytics"], timeline: "10 weeks", budget: 64000, status: "APPROVED", projectIdx: 3 },
    { title: "Studio Mira Brand", deliverables: ["Logo system", "Design tokens", "Webflow site", "Brand guidelines"], timeline: "4 weeks", budget: 18000, status: "APPROVED", projectIdx: 4 },
  ];

  await db.scope.deleteMany({});
  await Promise.all(
    scopeSeeds.map(async (s, i) => {
      const status = s.status;
      const approved = status === "APPROVED";
      return db.scope.create({
        data: {
          title: s.title,
          deliverables: JSON.stringify(s.deliverables),
          timeline: s.timeline,
          budget: s.budget,
          status,
          projectId: projects[s.projectIdx].id,
          approvedBy: approved ? admin.id : null,
          approvedAt: approved ? daysAgo(10 - i) : null,
          createdAt: daysAgo(15 - i * 2),
        },
      });
    })
  );

  // ---------- PAYMENTS ----------
  const paymentSeeds: Array<{ amount: number; status: "PENDING" | "PAID" | "FAILED" | "REFUNDED"; method: "CARD" | "BANK" | "PAYPAL" | "CRYPTO"; projectIdx: number }> = [
    { amount: 12000, status: "PAID", method: "BANK", projectIdx: 0 },
    { amount: 12000, status: "PENDING", method: "CARD", projectIdx: 0 },
    { amount: 11000, status: "PAID", method: "PAYPAL", projectIdx: 1 },
    { amount: 11000, status: "PENDING", method: "BANK", projectIdx: 1 },
    { amount: 18000, status: "PAID", method: "BANK", projectIdx: 4 },
    { amount: 32000, status: "PAID", method: "BANK", projectIdx: 3 },
    { amount: 32000, status: "PENDING", method: "CARD", projectIdx: 3 },
    { amount: 20500, status: "PAID", method: "PAYPAL", projectIdx: 6 },
    { amount: 20500, status: "FAILED", method: "CARD", projectIdx: 6 },
    { amount: 9000, status: "REFUNDED", method: "CARD", projectIdx: 4 },
  ];

  await db.payment.deleteMany({});
  await Promise.all(
    paymentSeeds.map((p, i) => {
      const paid = p.status === "PAID";
      return db.payment.create({
        data: {
          amount: p.amount,
          currency: "USD",
          status: p.status,
          method: p.method,
          transactionId: paid ? `TXN-${1000 + i}` : null,
          verifiedBy: paid ? admin.id : null,
          verifiedAt: paid ? daysAgo(8 - i) : null,
          projectId: projects[p.projectIdx].id,
          createdAt: daysAgo(9 - i),
        },
      });
    })
  );

  // ---------- APPROVALS ----------
  const approvalSeeds: Array<{ type: "SCOPE" | "PAYMENT" | "CONTENT" | "OTHER"; entityId: string; status: "PENDING" | "APPROVED" | "REJECTED"; notes?: string }> = [
    { type: "SCOPE", entityId: "scope-brightpath", status: "PENDING", notes: "BrightPath marketing scope pending client sign-off." },
    { type: "PAYMENT", entityId: "payment-apex-2", status: "PENDING", notes: "Apex Phase 1 second installment." },
    { type: "PAYMENT", entityId: "payment-vidya-2", status: "PENDING", notes: "VidyaCore Phase 2 invoice." },
    { type: "CONTENT", entityId: "content-apex-blog", status: "PENDING", notes: "Apex Realty blog post ready to publish." },
    { type: "SCOPE", entityId: "scope-dhaka-eats", status: "PENDING", notes: "Dhaka Eats MVP scope awaiting review." },
    { type: "CONTENT", entityId: "content-studio-reel", status: "PENDING", notes: "Studio Mira launch reel for IG." },
  ];

  await db.approval.deleteMany({});
  await Promise.all(
    approvalSeeds.map((a, i) =>
      db.approval.create({
        data: {
          type: a.type,
          entityId: a.entityId,
          requestedBy: staffUsers[1].id,
          status: a.status,
          notes: a.notes ?? null,
          createdAt: daysAgo(5 - i),
        },
      })
    )
  );

  // ---------- FILES ----------
  const fileSeeds: Array<{ name: string; category: "CONTRACT" | "DESIGN" | "DELIVERABLE" | "INVOICE" | "OTHER"; sizeKb: number; projectIdx?: number }> = [
    { name: "apex-msa-2026.pdf", category: "CONTRACT", sizeKb: 412, projectIdx: 0 },
    { name: "apex-crm-mockups-v3.fig", category: "DESIGN", sizeKb: 8420, projectIdx: 0 },
    { name: "brightpath-sow.pdf", category: "CONTRACT", sizeKb: 318, projectIdx: 1 },
    { name: "studio-mira-brand-tokens.zip", category: "DELIVERABLE", sizeKb: 12400, projectIdx: 4 },
    { name: "vidya-scorm-package.zip", category: "DELIVERABLE", sizeKb: 38200, projectIdx: 3 },
    { name: "invoice-apex-001.pdf", category: "INVOICE", sizeKb: 96, projectIdx: 0 },
    { name: "invoice-vidya-001.pdf", category: "INVOICE", sizeKb: 102, projectIdx: 3 },
    { name: "skyline-arch-diagram.png", category: "OTHER", sizeKb: 1840, projectIdx: 6 },
  ];

  await db.fileItem.deleteMany({});
  await Promise.all(
    fileSeeds.map((f, i) =>
      db.fileItem.create({
        data: {
          name: f.name,
          category: f.category,
          sizeKb: f.sizeKb,
          projectId: f.projectIdx !== undefined ? projects[f.projectIdx].id : null,
          uploadedBy: admin.id,
          createdAt: daysAgo(7 - i),
        },
      })
    )
  );

  // ---------- KNOWLEDGE ARTICLES ----------
  const kbSeeds: Array<{ title: string; category: string; content: string; tags: string[] }> = [
    { title: "Onboarding a new client in 5 steps", category: "Operations", content: "Step 1: Send welcome email...\nStep 2: Create project record...\nStep 3: Schedule kickoff...", tags: ["onboarding", "client", "process"] },
    { title: "WhatsApp Business API setup checklist", category: "Integrations", content: "Verify business, register number, create template, obtain access token...", tags: ["whatsapp", "api", "setup"] },
    { title: "Writing a high-converting scope of work", category: "Delivery", content: "Lead with outcomes. Quantify deliverables. Tie each milestone to a payment.", tags: ["scope", "delivery", "sales"] },
    { title: "Brand voice guidelines", category: "Marketing", content: "Confident but not boastful. Concrete examples over abstract claims.", tags: ["brand", "voice", "copy"] },
    { title: "Incident response playbook", category: "Engineering", content: "Triage in <5 min. Page on-call. Open incident channel. Communicate every 15 min.", tags: ["incident", "on-call", "engineering"] },
    { title: "Lead scoring model v2", category: "Sales", content: "Score = firmographics (30) + behavior (40) + intent (30). Hot = 80+.", tags: ["leads", "scoring", "crm"] },
    { title: "SEO technical audit checklist", category: "Marketing", content: "Core Web Vitals, structured data, internal linking, indexability, sitemap.", tags: ["seo", "audit"] },
    { title: "Knowledge base indexing workflow", category: "Operations", content: "Tag, summarize, link related, publish, surface in agent prompts.", tags: ["knowledge", "agents"] },
    { title: "Payment reconciliation procedure", category: "Finance", content: "Match transaction IDs, flag mismatches >$10, reconcile weekly.", tags: ["payments", "finance"] },
    { title: "Client success health-score formula", category: "Operations", content: "Adoption 40% + sentiment 30% + support load 20% + commercial 10%.", tags: ["success", "nps"] },
  ];

  await db.knowledgeArticle.deleteMany({});
  await Promise.all(
    kbSeeds.map((k, i) =>
      db.knowledgeArticle.create({
        data: {
          title: k.title,
          slug: k.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
          category: k.category,
          content: k.content,
          tags: k.tags.join("|"),
          views: 20 + i * 11,
          createdAt: daysAgo(20 - i),
        },
      })
    )
  );

  // ---------- AUDIT LOGS ----------
  const auditActions = [
    { action: "login", entity: "session", id: "self" },
    { action: "lead.created", entity: "lead", id: leads[0].id },
    { action: "lead.status_changed", entity: "lead", id: leads[3].id },
    { action: "project.created", entity: "project", id: projects[0].id },
    { action: "scope.submitted", entity: "scope", id: "scope-brightpath" },
    { action: "payment.verified", entity: "payment", id: "payment-apex-1" },
    { action: "approval.rejected", entity: "approval", id: "approval-x-9" },
    { action: "agent.invoked", entity: "agent", id: agents[0].id },
    { action: "agent.invoked", entity: "agent", id: agents[2].id },
    { action: "settings.updated", entity: "settings", id: "whatsapp" },
    { action: "user.invited", entity: "user", id: staffUsers[2].id },
    { action: "file.uploaded", entity: "file", id: "file-apex-msa" },
    { action: "workflow.toggled", entity: "workflow", id: "wf-whatsapp-router" },
    { action: "workflow.run", entity: "workflow", id: "wf-lead-ingestion" },
    { action: "kb.published", entity: "kb", id: "kb-onboarding" },
    { action: "lead.assigned", entity: "lead", id: leads[5].id },
    { action: "scope.approved", entity: "scope", id: "scope-apex" },
    { action: "agent.config_changed", entity: "agent", id: agents[8].id },
    { action: "payment.refunded", entity: "payment", id: "payment-studio-r" },
    { action: "conversation.assigned", entity: "conversation", id: "conv-1" },
  ];

  await db.auditLog.deleteMany({});
  await Promise.all(
    auditActions.map((a, i) =>
      db.auditLog.create({
        data: {
          userId: pick(allUsers, i).id,
          action: a.action,
          entityType: a.entity,
          entityId: a.id,
          metadata: JSON.stringify({ ip: "10.0.0.12", ua: "Tech360-Web/1.0" }),
          createdAt: daysAgo(20 - i),
        },
      })
    )
  );

  // ---------- WORKFLOWS ----------
  const workflowSeeds: Array<{ name: string; description: string; triggerType: string; triggerConfig: Record<string, unknown>; nodes: Record<string, unknown>[]; edges: Record<string, unknown>[]; active: boolean }> = [
    {
      name: "Lead Ingestion",
      description: "Captures inbound leads from website, WhatsApp, and social; scores and routes them.",
      triggerType: "webhook",
      triggerConfig: { sources: ["website", "whatsapp", "social"] },
      nodes: [
        { id: "n1", type: "trigger", label: "Inbound lead" },
        { id: "n2", type: "agent", label: "CRM Manager — score & enrich" },
        { id: "n3", type: "condition", label: "Score >= 80?" },
        { id: "n4", type: "action", label: "Assign to senior rep + WhatsApp alert" },
        { id: "n5", type: "action", label: "Add to nurture sequence" },
      ],
      edges: [
        { from: "n1", to: "n2" },
        { from: "n2", to: "n3" },
        { from: "n3", to: "n4", label: "yes" },
        { from: "n3", to: "n5", label: "no" },
      ],
      active: true,
    },
    {
      name: "WhatsApp Router",
      description: "Routes inbound WhatsApp messages to the right agent based on intent.",
      triggerType: "whatsapp.inbound",
      triggerConfig: { phoneNumber: "+8801327100297" },
      nodes: [
        { id: "n1", type: "trigger", label: "WhatsApp inbound" },
        { id: "n2", type: "agent", label: "WhatsApp Agent — intent classification" },
        { id: "n3", type: "condition", label: "Sales intent?" },
        { id: "n4", type: "agent", label: "CRM Manager — create lead" },
        { id: "n5", type: "agent", label: "Client Success — route to client" },
      ],
      edges: [
        { from: "n1", to: "n2" },
        { from: "n2", to: "n3" },
        { from: "n3", to: "n4", label: "yes" },
        { from: "n3", to: "n5", label: "no" },
      ],
      active: true,
    },
    {
      name: "Scope Approval",
      description: "Drafts scope, routes for legal + client approval, archives on sign-off.",
      triggerType: "manual",
      triggerConfig: { roles: ["MANAGER", "SUPER_ADMIN"] },
      nodes: [
        { id: "n1", type: "trigger", label: "Manager submits scope" },
        { id: "n2", type: "agent", label: "Scope Builder — draft + estimate" },
        { id: "n3", type: "agent", label: "Legal Reviewer — risk pass" },
        { id: "n4", type: "approval", label: "Client approval gate" },
        { id: "n5", type: "action", label: "Archive + notify finance" },
      ],
      edges: [
        { from: "n1", to: "n2" },
        { from: "n2", to: "n3" },
        { from: "n3", to: "n4" },
        { from: "n4", to: "n5", label: "approved" },
      ],
      active: true,
    },
    {
      name: "Content Publishing",
      description: "Routes drafted content through brand review and schedules across channels.",
      triggerType: "schedule",
      triggerConfig: { cron: "0 9 * * MON" },
      nodes: [
        { id: "n1", type: "trigger", label: "Weekly content batch" },
        { id: "n2", type: "agent", label: "Content Writer — draft batch" },
        { id: "n3", type: "agent", label: "Brand Designer — visuals" },
        { id: "n4", type: "approval", label: "Brand review" },
        { id: "n5", type: "agent", label: "Social Media Manager — schedule" },
      ],
      edges: [
        { from: "n1", to: "n2" },
        { from: "n2", to: "n3" },
        { from: "n3", to: "n4" },
        { from: "n4", to: "n5", label: "approved" },
      ],
      active: false,
    },
  ];

  await db.workflow.deleteMany({});
  const workflows = await Promise.all(
    workflowSeeds.map((w, i) =>
      db.workflow.create({
        data: {
          name: w.name,
          description: w.description,
          triggerType: w.triggerType,
          triggerConfig: JSON.stringify(w.triggerConfig),
          nodes: JSON.stringify(w.nodes),
          edges: JSON.stringify(w.edges),
          active: w.active,
          lastRunAt: i < 2 ? daysAgo(i + 1) : null,
          createdAt: daysAgo(20 - i),
        },
      })
    )
  );

  // ---------- CONVERSATIONS + MESSAGES ----------
  const convSeeds: Array<{ channel: "WHATSAPP" | "FACEBOOK" | "INSTAGRAM" | "LINKEDIN" | "X"; name: string; handle: string; messages: Array<{ dir: "INBOUND" | "OUTBOUND"; body: string; daysAgo: number }> }> = [
    {
      channel: "WHATSAPP",
      name: "Imran Khan",
      handle: "+8801711002001",
      messages: [
        { dir: "INBOUND", body: "Hi, is the CRM proposal ready?", daysAgo: 3 },
        { dir: "OUTBOUND", body: "Hi Imran — sending it over in 10 min 📄", daysAgo: 3 },
        { dir: "INBOUND", body: "Perfect, thanks!", daysAgo: 3 },
        { dir: "INBOUND", body: "Quick Q: can we add a chatbot?", daysAgo: 2 },
        { dir: "OUTBOUND", body: "Yes — we can add a GPT-4o chatbot for $4k extra.", daysAgo: 2 },
        { dir: "INBOUND", body: "Sounds great, let's do it.", daysAgo: 2 },
        { dir: "INBOUND", body: "When can we start?", daysAgo: 1 },
        { dir: "OUTBOUND", body: "Kickoff tomorrow 10am — invite sent 📅", daysAgo: 1 },
      ],
    },
    {
      channel: "WHATSAPP",
      name: "Tanvir Ahmed",
      handle: "+8801811002003",
      messages: [
        { dir: "INBOUND", body: "Hello, do you build food delivery apps?", daysAgo: 2 },
        { dir: "OUTBOUND", body: "Yes! We have an MVP package — 8 weeks, $36k.", daysAgo: 2 },
        { dir: "INBOUND", body: "Can you share a portfolio?", daysAgo: 2 },
        { dir: "OUTBOUND", body: "Sure — sending 3 case studies now 📚", daysAgo: 2 },
        { dir: "INBOUND", body: "Looks great. Let's chat this week.", daysAgo: 1 },
        { dir: "OUTBOUND", body: "Booked you for Thursday 2pm — confirm?", daysAgo: 1 },
      ],
    },
    {
      channel: "FACEBOOK",
      name: "Helena Ortiz",
      handle: "@helena.ortiz",
      messages: [
        { dir: "INBOUND", body: "Saw your post about hotel apps — interested!", daysAgo: 4 },
        { dir: "OUTBOUND", body: "Hi Helena! We'd love to help Lumiere. Free consult this week?", daysAgo: 4 },
        { dir: "INBOUND", body: "Yes please. Friday morning?", daysAgo: 3 },
        { dir: "OUTBOUND", body: "Friday 9am your time — booked ✅", daysAgo: 3 },
        { dir: "INBOUND", body: "See you then!", daysAgo: 3 },
      ],
    },
    {
      channel: "INSTAGRAM",
      name: "Lena Petrova",
      handle: "@studio.mira",
      messages: [
        { dir: "INBOUND", body: "Your brand work is gorgeous 💛", daysAgo: 5 },
        { dir: "OUTBOUND", body: "Thank you Lena! We'd love to design for Studio Mira.", daysAgo: 5 },
        { dir: "INBOUND", body: "Send me a proposal?", daysAgo: 4 },
        { dir: "OUTBOUND", body: "Sent — full brand system + Webflow, $18k 📨", daysAgo: 4 },
        { dir: "INBOUND", body: "Approved. Starting Monday?", daysAgo: 3 },
        { dir: "OUTBOUND", body: "Locked in. Onboarding email incoming 🚀", daysAgo: 3 },
      ],
    },
    {
      channel: "LINKEDIN",
      name: "Sara Mitchell",
      handle: "linkedin.com/in/saramitchell",
      messages: [
        { dir: "INBOUND", body: "Great case study on Apex. We have a similar need.", daysAgo: 6 },
        { dir: "OUTBOUND", body: "Thanks Sara! Happy to share our playbook for BrightPath.", daysAgo: 6 },
        { dir: "INBOUND", body: "Can we book a discovery call?", daysAgo: 5 },
        { dir: "OUTBOUND", body: "Sure — Tuesday 11am PT works?", daysAgo: 5 },
        { dir: "INBOUND", body: "Confirmed.", daysAgo: 5 },
        { dir: "OUTBOUND", body: "Sending agenda now 📋", daysAgo: 5 },
        { dir: "INBOUND", body: "Got it, thanks!", daysAgo: 4 },
      ],
    },
    {
      channel: "X",
      name: "Marcus Lee",
      handle: "@marcusfinsec",
      messages: [
        { dir: "INBOUND", body: "Anyone you recommend for SOC2 prep?", daysAgo: 7 },
        { dir: "OUTBOUND", body: "We do SOC2 readiness + audit prep. Quick call?", daysAgo: 7 },
        { dir: "INBOUND", body: "Sure — DMing my email.", daysAgo: 7 },
        { dir: "OUTBOUND", body: "Got it — reaching out today 📧", daysAgo: 6 },
      ],
    },
  ];

  await db.message.deleteMany({});
  await db.conversation.deleteMany({});
  await Promise.all(
    convSeeds.map((c, i) =>
      db.conversation.create({
        data: {
          channel: c.channel,
          contactName: c.name,
          contactHandle: c.handle,
          lastMessageAt: daysAgo(c.messages[c.messages.length - 1].daysAgo),
          unreadCount: i === 0 ? 2 : i === 1 ? 1 : 0,
          createdAt: daysAgo(c.messages[0].daysAgo),
          messages: {
            create: c.messages.map((m) => ({
              channel: c.channel,
              direction: m.dir,
              from: m.dir === "INBOUND" ? c.handle : "+8801327100297",
              to: m.dir === "INBOUND" ? "+8801327100297" : c.handle,
              body: m.body,
              status: "READ" as const,
              createdAt: daysAgo(m.daysAgo),
            })),
          },
        },
      })
    )
  );

  // ---------- WEBHOOKS ----------
  const webhookSeeds: Array<{ name: string; endpoint: string; channel: string; lastFired?: boolean }> = [
    { name: "Website lead webhook", endpoint: "/api/webhooks/lead", channel: "WEBSITE", lastFired: true },
    { name: "WhatsApp inbound", endpoint: "/api/webhooks/whatsapp", channel: "WHATSAPP", lastFired: true },
    { name: "Stripe payment", endpoint: "/api/webhooks/stripe", channel: "PAYMENT", lastFired: true },
    { name: "Facebook mentions", endpoint: "/api/webhooks/facebook", channel: "FACEBOOK", lastFired: false },
    { name: "Instagram DMs", endpoint: "/api/webhooks/instagram", channel: "INSTAGRAM", lastFired: false },
  ];

  await db.webhook.deleteMany({});
  await Promise.all(
    webhookSeeds.map((w, i) =>
      db.webhook.create({
        data: {
          name: w.name,
          endpoint: w.endpoint,
          channel: w.channel,
          secret: `whsec_${Math.random().toString(36).slice(2, 12)}`,
          lastFiredAt: w.lastFired ? daysAgo(i) : null,
          createdAt: daysAgo(15 - i),
        },
      })
    )
  );

  // ---------- SETTINGS ----------
  const settingsSeeds: Array<{ key: string; value: string; category: string }> = [
    { key: "general.company_name", value: "Tech360", category: "general" },
    { key: "general.support_email", value: "info@bdtech360.com", category: "general" },
    { key: "general.support_phone", value: "+880 1327-100297", category: "general" },
    { key: "general.domain", value: "bdtech360.com", category: "general" },
    { key: "whatsapp.phone_number", value: "+8801327100297", category: "whatsapp" },
    { key: "whatsapp.api_token", value: "wabiz_token_••••••", category: "whatsapp" },
    { key: "whatsapp.business_id", value: "1029384756", category: "whatsapp" },
    { key: "whatsapp.auto_reply", value: "true", category: "whatsapp" },
    { key: "smtp.host", value: "smtp.bdtech360.com", category: "smtp" },
    { key: "smtp.port", value: "587", category: "smtp" },
    { key: "smtp.username", value: "postmaster@bdtech360.com", category: "smtp" },
    { key: "smtp.from_email", value: "noreply@bdtech360.com", category: "smtp" },
    { key: "ai.model", value: "gpt-4o", category: "ai" },
    { key: "ai.temperature", value: "0.4", category: "ai" },
    { key: "ai.max_tokens", value: "2048", category: "ai" },
    { key: "ai.skills_root", value: "skills/private", category: "ai" },
  ];

  await db.setting.deleteMany({});
  await Promise.all(
    settingsSeeds.map((s) => db.setting.upsert({ where: { key: s.key }, update: { value: s.value }, create: s }))
  );

  // ---------- AGENT RUNS ----------
  await db.agentRun.deleteMany({});
  const runInputs = [
    "Summarize today's lead activity",
    "Reply to Imran's WhatsApp message",
    "Build a scope for Dhaka Eats MVP",
    "Audit the BrightPath homepage for SEO",
    "Draft a quarterly strategy memo",
  ];
  await Promise.all(
    agents.slice(0, 8).map((a, i) =>
      db.agentRun.create({
        data: {
          agentId: a.id,
          userId: admin.id,
          input: pick(runInputs, i),
          output: `[${a.name}] ${pick(runInputs, i)} — completed in ${400 + i * 80}ms. Summary attached.`,
          status: "SUCCESS",
          durationMs: 400 + i * 80,
          createdAt: daysAgo(i),
        },
      })
    )
  );

  console.log("✅ Seed complete.");
  console.log(`   Users:       ${allUsers.length}`);
  console.log(`   Agents:      ${agents.length}`);
  console.log(`   Leads:       ${leads.length}`);
  console.log(`   Projects:    ${projects.length}`);
  console.log(`   Workflows:   ${workflows.length}`);
  console.log(`   Login:       admin@bdtech360.com / admin123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
>>>>>>> upload/tech360-production-final
