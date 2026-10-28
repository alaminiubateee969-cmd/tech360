import { PUBLIC_CONTACT } from "@/lib/site-contact";
import { LEGAL_DOCS, type LegalDoc } from "@/data/legal-docs";
export { LEGAL_DOCS } from "@/data/legal-docs";

/**
 * Tech360 public website content.
 * Single source of truth for services, industries, case studies, technology,
 * delivery process, FAQs, careers, legal policies and company facts.
 *
 * All figures used in marketing are qualitative and honest — no fabricated
 * client counts, no invented metrics, no fake testimonials.
 */

export const COMPANY = {
  legalName: "TECH360 LLC",
  brand: "Tech360",
  domain: "bdtech360.com",
  missouriLLC: "LC014737249",
  address: "117 S Lexington St Ste 100, Harrisonville, MO 64701, USA",
  email: PUBLIC_CONTACT.email,
  founded: "2021",
  // Canonical About-page facts — single source reused in AboutView (do not hardcode elsewhere).
  bangladeshFoundedYear: "2021",
  usRegistrationYear: "2025",
  registrationJurisdiction: "Missouri, United States",
  serviceCoverage: "Worldwide",
  tagline: "Strategy. Software. Automation. Growth.",
  subline:
    "Enterprise-grade websites, platforms and automation for ambitious businesses — engineered by a US-registered team delivering worldwide.",
} as const;

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Home", href: "#/" },
  { label: "About", href: "#/about" },
  { label: "Services", href: "#/services" },
  { label: "Industries", href: "#/industries" },
  { label: "Work", href: "#/work" },
  { label: "Technologies", href: "#/technologies" },
  { label: "Design Kit", href: "#/design-kit" },
  { label: "Process", href: "#/process" },
  { label: "Blog", href: "#/blog" },
  { label: "Contact", href: "#/contact" },
];

/* ------------------------------------------------------------------ */
/* Services                                                            */
/* ------------------------------------------------------------------ */

export interface Service {
  slug: string;
  icon: string;
  title: string;
  tagline: string;
  problem: string;
  solution: string;
  features: string[];
  tech: string[];
  workflow: string[];
  example: string;
}

export const SERVICES: Service[] = [
  {
    slug: "premium-business-websites",
    icon: "Globe",
    title: "Premium Business Websites",
    tagline: "The first impression your business deserves.",
    problem:
      "Your website is the first meeting between your business and a buyer who is comparing you with three competitors in the same minute. Slow, dated or template-stamped sites quietly convert that meeting into a lost sale — and most businesses never find out.",
    solution:
      "We design and build bespoke business websites: engineered structure, fast loads, clear messaging architecture and conversion paths planned around what your customer actually needs to believe before they contact you.",
    features: [
      "Bespoke design system — no recycled templates",
      "Conversion-focused page architecture and copy structure",
      "Core Web Vitals performance engineering",
      "On-page SEO foundations, schema and metadata",
      "Mobile-first responsive build across all breakpoints",
      "CMS-managed content your team can update safely",
    ],
    tech: ["Next.js", "React", "TypeScript", "Tailwind CSS", "PostgreSQL", "cPanel / Google Cloud"],
    workflow: [
      "Discovery workshop — business goals, audience, competitors",
      "Sitemap, messaging outline and wireframes",
      "HTML Preview where included in the agreed process",
      "Design refinement, build, content integration",
      "Agreed QA, SEO work, launch and Client-owned credentials identified for handover",
    ],
    example:
      "Illustrative scenario: a professional services firm replacing a five-year-old template site with a structured 12-page website. Preview, schedule, and milestones would be agreed in that project’s SOW.",
  },
  {
    slug: "enterprise-websites",
    icon: "Building2",
    title: "Enterprise Websites",
    tagline: "Multi-team, multi-language, multi-market platforms.",
    problem:
      "Enterprise websites die from coordination, not code: six departments publishing into one CMS, inconsistent branding per region, staging accidents reaching production, and an audit trail nobody can read.",
    solution:
      "We deliver enterprise web platforms with role-based publishing, review workflows, environment separation (dev/staging/production), observability and release processes your internal teams can actually operate.",
    features: [
      "Role-based access control and publishing approval flows",
      "Multi-language and multi-region content architecture",
      "Staging and production environments with rollback",
      "Structured audit logs for every publish action",
      "Design-token governance for brand consistency",
      "Performance budgets and uptime monitoring",
    ],
    tech: ["Next.js", "TypeScript", "PostgreSQL", "Google Cloud Run", "Docker", "Cloud Logging"],
    workflow: [
      "Stakeholder mapping and governance model definition",
      "Information architecture and content model design",
      "Preview of key templates and workflows where included in the agreed process",
      "Iterative build with milestone acceptance per department",
      "Migration, training, launch and operational handover where included in the agreement",
    ],
    example:
      "A multi-unit organization consolidating separate department sites into one governed platform with a shared design system and per-department publishing rights.",
  },
  {
    slug: "ecommerce-platforms",
    icon: "ShoppingCart",
    title: "eCommerce Platforms",
    tagline: "Stores engineered for checkout, not just catalogue.",
    problem:
      "Most online stores lose money in the last 300 pixels: cluttered product pages, surprise shipping costs, guest-hostile checkout and abandoned carts that no one follows up with.",
    solution:
      "We build commerce platforms around the checkout moment — product page structure, payment localisation (cards, bKash, Nagad, SSLCommerz), abandoned-cart recovery, order states your team can actually track, and reporting that ties revenue to channels.",
    features: [
      "Conversion-structured product and category pages",
      "Local and international payment integrations",
      "Abandoned-cart and post-purchase automation",
      "Inventory, order and delivery status management",
      "Coupons, bundles and campaign pricing tools",
      "Sales, channel and product performance reporting",
    ],
    tech: ["Next.js", "Node.js", "PostgreSQL", "Stripe", "bKash / SSLCommerz", "Google Cloud"],
    workflow: [
      "Catalogue, pricing and logistics model analysis",
      "Customer journey and checkout flow design",
      "HTML preview of the storefront and key flows",
      "Build, payment integration and order pipeline",
      "Test orders, launch, team training and handover",
    ],
    example:
      "A Dhaka-based fashion retailer moving from social-media selling to a full store with automated order confirmations on WhatsApp and delivery-status tracking.",
  },
  {
    slug: "custom-crm-development",
    icon: "Users",
    title: "Custom CRM Development",
    tagline: "A customer record system shaped to your pipeline.",
    problem:
      "Off-the-shelf CRMs force your process into their fields — so the team keeps a shadow spreadsheet beside the tool, data quality collapses, and the CRM becomes an expense instead of an asset.",
    solution:
      "We build CRMs around your actual pipeline: every lead, message, approval, payment and file linked to one Client ID, with stages, permissions and reporting that mirror how your business truly sells.",
    features: [
      "Pipeline stages modelled on your real sales process",
      "Every communication, file and payment under one client ID",
      "Role-based access for sales, ops and management",
      "Automated follow-up and status-change triggers",
      "Quotation, scope and approval tracking",
      "Revenue, conversion and activity dashboards",
    ],
    tech: ["Next.js", "TypeScript", "PostgreSQL", "Prisma", "n8n", "Google Cloud Run"],
    workflow: [
      "Process mapping of your current sales and service flow",
      "Data model and permission design",
      "Preview of the CRM interface for approval",
      "Build, data migration from spreadsheets",
      "Team onboarding, go-live and support period",
    ],
    example:
      "A real-estate developer replacing agent-owned spreadsheets with a CRM where every enquiry, site visit, booking and installment lives on one client timeline.",
  },
  {
    slug: "whatsapp-ai-sales-crm",
    icon: "MessagesSquare",
    title: "WhatsApp-First AI Sales CRM",
    tagline: "A shared sales workspace for teams that sell through conversation.",
    problem:
      "When leads, WhatsApp conversations and follow-ups are split across personal phones and spreadsheets, teams lose context, duplicate work and miss handoffs.",
    solution:
      "We scope, configure and customize a dedicated WhatsApp-first sales CRM around your pipeline. DeskcommCRM is one open-source, self-hosted candidate—not TECH360’s internal CRM—and is used only if its current features, license notices, WhatsApp connection options, security and hosting fit are verified for your project. The exact deployment and ongoing costs are agreed in writing before work begins.",
    features: [
      "Shared team inbox with assignment and human handoff",
      "Configurable contact records, tags and sales pipelines",
      "AI-assisted lead qualification with defined escalation rules",
      "Event-triggered follow-ups and external integrations",
      "A separately scoped client deployment with access controls",
      "Documented setup, backups, training and handover plan",
    ],
    tech: ["DeskcommCRM (MIT)", "Docker", "Next.js", "Supabase / PostgreSQL", "WhatsApp Cloud API / WAHA"],
    workflow: [
      "Map the sales process, team roles, locations and messaging use cases",
      "Review the selected release, license, provider requirements and hosting evidence",
      "Agree the isolated architecture, recurring costs, data boundaries and written scope",
      "Prepare a preview or sandbox using non-production data for approval",
      "Configure, integrate and test opt-out, human handoff, delivery failures and backups",
      "Handover client-owned accounts, documentation, access and agreed support",
    ],
    example:
      "Illustrative scenario: a retailer uses a client-owned CRM instance for its sales pipeline and shared inbox; AI handles only approved routine qualification, with uncertain or sensitive cases routed to staff. This is not a verified customer deployment or guaranteed outcome.",
  },
  {
    slug: "client-portals",
    icon: "KeyRound",
    title: "Client Portals",
    tagline: "Where your customers serve themselves.",
    problem:
      "When every request arrives as a phone call or a chat message, your team becomes a human API — answering status questions, resending documents and re-typing the same replies all day.",
    solution:
      "We build secure client portals: document delivery, request tracking, invoices and approvals behind a single login — self-service for customers, structured workload for your team.",
    features: [
      "Secure per-client authentication and data isolation",
      "Document delivery with view and download tracking",
      "Request and ticket workflows with status history",
      "Invoice display and payment status visibility",
      "Approval actions with permanent records",
      "Branded interface in your design system",
    ],
    tech: ["Next.js", "TypeScript", "PostgreSQL", "Cloud Storage", "Google Cloud Run"],
    workflow: [
      "Mapping of client interaction types and documents",
      "Portal information architecture and security model",
      "HTML preview of the portal experience",
      "Build, integration with your internal systems",
      "Client communication plan, launch and handover",
    ],
    example:
      "An accounting firm delivering tax documents and approval requests through a portal, replacing email threads that previously buried deadlines.",
  },
  {
    slug: "business-dashboards",
    icon: "LayoutDashboard",
    title: "Business Dashboards",
    tagline: "Decisions made from one screen, not five exports.",
    problem:
      "Monday leadership meetings start with three people exporting spreadsheets, reconciling numbers that disagree, and arguing about definitions before any decision is even discussed.",
    solution:
      "We engineer dashboards on a defined data model: one agreed definition per metric, automated data pipelines, role-based views and mobile access — so the meeting starts at the decision, not the reconciliation.",
    features: [
      "Metric definitions agreed and locked in a data model",
      "Automated data collection pipelines with failure alerts",
      "Role-based views for leadership, sales and operations",
      "Drill-down from summary numbers to underlying records",
      "Trends, comparisons and target tracking",
      "Mobile-responsive design for on-the-move review",
    ],
    tech: ["Next.js", "TypeScript", "PostgreSQL", "Recharts", "Google Cloud Run", "n8n"],
    workflow: [
      "Metric inventory and definition workshop",
      "Data source audit and pipeline design",
      "Dashboard layout preview for approval",
      "Build pipelines, verify numbers against source",
      "Training, launch and scheduled reporting setup",
    ],
    example:
      "A logistics operator replacing a weekly spreadsheet ritual with a live dashboard showing fleet status, delivery SLAs and revenue per route.",
  },
  {
    slug: "whatsapp-automation",
    icon: "MessageCircle",
    title: "WhatsApp Automation",
    tagline: "The channel where your customers already live.",
    problem:
      "Your customers negotiate, order and confirm on WhatsApp — but the conversation lives in individual employees' phones, walks out when they resign, and answers only when someone happens to read it.",
    solution:
      "We put WhatsApp to work as a business channel: every message linked to a client record, automated replies for the predictable questions, escalation to humans for the rest, and follow-up sequences that never forget a lead.",
    features: [
      "Business-level WhatsApp with shared team visibility",
      "Automated first-response and frequently-asked replies",
      "Lead capture from first message into your CRM",
      "Order, booking and payment status updates",
      "Follow-up sequences with delivery tracking",
      "Full conversation history per client ID",
    ],
    tech: ["WhatsApp Cloud API", "Node.js", "n8n", "PostgreSQL", "Google Cloud Run"],
    workflow: [
      "Mapping of conversations your business repeats daily",
      "Message template and automation flow design",
      "Preview of automated flows and reply scripts",
      "Integration, webhook setup and number registration",
      "Team training, go-live and failure-monitoring setup",
    ],
    example:
      "A restaurant chain automating order confirmations, delivery updates and daily specials — with every conversation logged against the customer's record.",
  },
  {
    slug: "whatsapp-cloud-api-integration",
    icon: "MessagesSquare",
    title: "WhatsApp Cloud API Integration",
    tagline: "Official, compliant, production-grade.",
    problem:
      "Unofficial WhatsApp gateways get numbers banned, and banned numbers take your customer channel with them. Meanwhile marketing blasts outside approved templates violate Meta policy and put the account at risk.",
    solution:
      "We implement the official WhatsApp Cloud API end-to-end: Meta business verification, number registration, webhook infrastructure, template management, delivery-status tracking and honest failure logging — the compliant way.",
    features: [
      "Meta business verification and number registration",
      "Webhook infrastructure for inbound and status events",
      "Approved template management for each use case",
      "Delivery, read and failure status tracking",
      "Rate-limit and quality-signal monitoring",
      "Documentation your future developers can follow",
    ],
    tech: ["WhatsApp Cloud API", "Node.js", "Google Cloud Run", "Secret Manager", "PostgreSQL"],
    workflow: [
      "Use-case audit — transactional vs conversational needs",
      "Template drafts and technical architecture plan",
      "Preview of integration behaviour and logs",
      "Verification, registration and production deployment",
      "Monitoring setup, team training and documentation",
    ],
    example:
      "A service business moving from a personal-number workaround to an official Cloud API setup with order-status templates and delivery receipts.",
  },
  {
    slug: "email-automation",
    icon: "Mail",
    title: "Email Automation",
    tagline: "Deliverability, sequence and record — done properly.",
    problem:
      "Email automation usually means a marketing tool blasting newsletters from a domain that was never configured for sending — straight to spam, with open rates nobody trusts.",
    solution:
      "We build email automation with the infrastructure done properly: domain authentication (SPF, DKIM, DMARC), transactional and campaign separation, sequences triggered by real events in your system, and every message recorded against the client's history.",
    features: [
      "Domain authentication and deliverability setup",
      "Transactional email for orders, approvals, invoices",
      "Event-triggered sequences (lead, onboarding, renewal)",
      "Every send recorded against the client record",
      "Bounce and failure handling with retries",
      "Consent and unsubscribe management built in",
    ],
    tech: ["SMTP", "Node.js", "n8n", "PostgreSQL", "Secret Manager"],
    workflow: [
      "Send-domain audit and authentication setup",
      "Email flow mapping against customer journey",
      "Preview of templates and trigger logic",
      "Integration with your systems and CRM",
      "Deliverability verification, launch and monitoring",
    ],
    example:
      "An education business automating enquiry follow-up and admission-status emails, with every message logged on the student's record.",
  },
  {
    slug: "sms-automation",
    icon: "Smartphone",
    title: "SMS Automation",
    tagline: "The message that is read within minutes.",
    problem:
      "Critical updates — payment reminders, OTPs, delivery windows — get buried in inboxes. But SMS done through unknown gateways fails silently, and you never learn which customer was never reached.",
    solution:
      "We integrate reliable SMS gateways with status tracking: transactional alerts triggered by real system events, delivery confirmation per message, and failure retries logged against the client record.",
    features: [
      "Gateway integration with credentials in Secret Manager",
      "Event-triggered transactional messages",
      "Delivery status confirmation per message",
      "Failure logging and automatic retry logic",
      "Opt-out and consent compliance handling",
      "Multi-country routing where required",
    ],
    tech: ["SMS gateway", "Node.js", "n8n", "PostgreSQL", "Google Cloud Run"],
    workflow: [
      "Message use-case and frequency mapping",
      "Gateway selection and architecture design",
      "Preview of message templates and triggers",
      "Integration and delivery-status verification",
      "Monitoring setup and handover documentation",
    ],
    example:
      "A clinic automating appointment reminders and confirmation replies, reducing no-shows without any manual calling.",
  },
  {
    slug: "n8n-workflow-automation",
    icon: "Workflow",
    title: "n8n Workflow Automation",
    tagline: "Operations that run while you sleep.",
    problem:
      "Automation attempts usually die as fragile scripts on someone's laptop — no logs, no retries, and the author's departure becomes an outage. Or they live inside a SaaS tool that cannot reach your own systems.",
    solution:
      "We deploy n8n as a governed automation engine: each workflow versioned, every run logged, failures retried and escalated, credentials in a secret manager, and the whole system owned by you — not rented from a vendor's roadmap.",
    features: [
      "Self-hosted n8n — your instance, your data",
      "Versioned workflows with change history",
      "Execution logs for every run, success or failure",
      "Retry and escalation logic on critical paths",
      "Credentials stored in Secret Manager, never in code",
      "Workflow documentation your team inherits",
    ],
    tech: ["n8n", "Node.js", "PostgreSQL", "Google Cloud Run", "Secret Manager"],
    workflow: [
      "Process inventory and automation-candidate ranking",
      "Workflow architecture with failure-path design",
      "Preview of each workflow's logic and logs",
      "Build, connect systems, test with production-like data",
      "Monitoring, documentation and team handover",
    ],
    example:
      "An SME automating its quote-to-cash sequence: enquiry capture, quote generation, payment reminders and delivery updates — with a daily executive report.",
  },
  {
    slug: "ai-agent-systems",
    icon: "Bot",
    title: "AI Agent Systems",
    tagline: "AI that executes real work — logged and governed.",
    problem:
      "\"AI agents\" on most dashboards are theater: icons that simulate activity. Real automation requires agents that read and write your actual systems, keep records of every action, and stop for human approval when the action matters.",
    solution:
      "We build production agent systems: each agent with a defined job, tool permissions, execution history and approval gates for sensitive actions. Output is stored, auditable and reproducible — a governed automation system for your business.",
    features: [
      "Agents with defined roles, tools and permissions",
      "Every execution recorded — input, output, duration, errors",
      "Human approval gates for sensitive actions",
      "Memory and knowledge base per business domain",
      "Constitutional rules the agents cannot break",
      "Full audit trail queryable by client and date",
    ],
    tech: ["LLM APIs", "Node.js", "PostgreSQL", "n8n", "Google Cloud Run"],
    workflow: [
      "Candidate workload analysis — what should be automated",
      "Agent role, permission and governance design",
      "Preview of agent behaviour in a sandbox",
      "Build, integrate with your systems, supervised live-run",
      "Approval-gate tuning, documentation and handover",
    ],
    example:
      "A logistics company automating document intake and status updates across three internal systems, with staff approval before anything reaches a customer.",
  },
  {
    slug: "ai-business-automation",
    icon: "BrainCircuit",
    title: "AI Business Automation",
    tagline: "Applied AI where it pays back fastest.",
    problem:
      "Boards are sold \"AI transformation\" and receive a chatbot. The value is not in a conversation box — it is in the document processing, classification, drafting and monitoring work that consumes your team's week.",
    solution:
      "We identify the workloads where AI has a measurable payback — lead classification, document drafting, data extraction, monitoring, reporting — and implement them inside your real systems with logging, evaluation and fallback handling.",
    features: [
      "Workload audit ranked by cost, volume and risk",
      "Document processing and data extraction pipelines",
      "Classification and routing automation",
      "Drafting automation with human review gates",
      "Quality evaluation and drift monitoring",
      "Clear escalation path when confidence is low",
    ],
    tech: ["LLM APIs", "Python", "Node.js", "n8n", "PostgreSQL", "Google Cloud"],
    workflow: [
      "Automation-candidate audit across your operations",
      "Value and risk assessment per candidate",
      "Preview of the proposed automation behaviour",
      "Pilot implementation with measured results",
      "Scale-out, monitoring and team handover",
    ],
    example:
      "A professional-services firm automating intake classification and first-draft proposals, cutting preparation time while keeping human approval on every outbound document.",
  },
  {
    slug: "api-integrations",
    icon: "Plug",
    title: "API Integrations",
    tagline: "Systems that finally talk to each other.",
    problem:
      "Your business runs on six systems that never met: payments here, delivery there, accounts somewhere else — and a team re-typing the same data into each one, introducing errors at every hop.",
    solution:
      "We design and build the integration layer: event-driven flows, proper authentication and secret handling, retry logic, idempotency guards and a monitoring dashboard — so data moves reliably even when a vendor API misbehaves.",
    features: [
      "Event-driven integration architecture",
      "Secure credential handling via Secret Manager",
      "Retry, timeout and idempotency engineering",
      "Reconciliation reports for cross-system data",
      "Monitoring dashboard for every integration",
      "Documentation and failure playbook",
    ],
    tech: ["REST", "Webhooks", "Node.js", "PostgreSQL", "Google Cloud Run", "n8n"],
    workflow: [
      "System inventory and data-flow mapping",
      "Integration architecture with failure design",
      "Preview of flow logic and monitoring views",
      "Build, sandbox testing with each vendor API",
      "Production cutover, monitoring and handover",
    ],
    example:
      "An eCommerce operator connecting store orders, payment verification, courier booking and accounting entries into one monitored pipeline.",
  },
  {
    slug: "database-systems",
    icon: "Database",
    title: "Database Systems",
    tagline: "The foundation decisions you never redo cheaply.",
    problem:
      "Growth-stage businesses run on improvised schemas — a spreadsheet becomes a table, a column becomes three columns with inconsistent values, and one day reporting simply stops being possible.",
    solution:
      "We design relational systems properly: normalised models, constraints and integrity at the database layer, migration strategy from your current chaos, backup policy and query performance engineered for the volume you will have, not the volume you have today.",
    features: [
      "Normalised schema design with integrity constraints",
      "Migration planning from spreadsheets or legacy systems",
      "Automated backup and point-in-time recovery",
      "Query performance engineering and indexing",
      "Access control and audit policy at the data layer",
      "Documentation your future engineers can read",
    ],
    tech: ["PostgreSQL", "MySQL", "SQLite", "Prisma", "Cloud SQL", "Redis"],
    workflow: [
      "Current data landscape and pain-point audit",
      "Entity model and integrity rule design",
      "Preview of the schema and access model",
      "Migration, validation and reconciliation runs",
      "Performance verification, backup drills, handover",
    ],
    example:
      "A retailer consolidating four departmental spreadsheets into one governed database with referential integrity and daily verified backups.",
  },
  {
    slug: "cloud-deployment-google-cloud",
    icon: "CloudUpload",
    title: "Cloud Deployment (Google Cloud)",
    tagline: "Enterprise infrastructure without an ops team.",
    problem:
      "Serious applications need real infrastructure — auto-scaling, HTTPS, secrets, backups, monitoring — but hiring a platform team for one product is not economics. So systems end up on a single fragile server.",
    solution:
      "We deploy on Google Cloud with the managed-service stack: Cloud Run containers, Cloud SQL databases, Secret Manager for credentials, Cloud Storage for permanent files, Cloud Build for reproducible releases and Cloud Logging for observability — near-zero ops overhead, production-grade reliability.",
    features: [
      "Cloud Run deployment with auto-scaling",
      "Cloud SQL with automated backups and failover",
      "Secret Manager for every credential",
      "Cloud Storage for permanent files and evidence",
      "Cloud Build pipelines for reproducible releases",
      "Cloud Logging and alerting on failures",
    ],
    tech: ["Google Cloud Run", "Cloud SQL", "Secret Manager", "Cloud Storage", "Docker", "Cloud Build"],
    workflow: [
      "Application and traffic profile assessment",
      "Architecture design with cost projection",
      "Preview of the deployment architecture",
      "Infrastructure build, deployment and verification",
      "Monitoring, alerting and runbook handover",
    ],
    example:
      "A SaaS product moving from a single VPS to Cloud Run with staged releases, reducing deployment risk and eliminating midnight server emergencies.",
  },
  {
    slug: "cpanel-stackcp-deployment",
    icon: "Server",
    title: "cPanel / StackCP Deployment",
    tagline: "Production systems on hosting you already trust.",
    problem:
      "Not every project needs a cloud platform — but \"simple hosting\" still done badly means: credentials shared over chat, no staging environment, deployments over FTP, and an outage nobody can diagnose.",
    solution:
      "We deploy properly on cPanel and StackCP environments: isolated staging, version-controlled releases, permission hygiene, scheduled backups, and documentation so any competent administrator can take over tomorrow.",
    features: [
      "Staging and production separation on shared hosting",
      "Version-controlled, repeatable release process",
      "Permission and credential hygiene standards",
      "Scheduled off-site backups with restore verification",
      "Laravel/PHP application hardening",
      "Administrator documentation and runbook",
    ],
    tech: ["cPanel", "StackCP", "Laravel", "PHP", "MySQL", "Git"],
    workflow: [
      "Hosting environment and application audit",
      "Deployment process and backup design",
      "Preview of the release and rollback procedure",
      "Build, deploy to staging, verify, promote to production",
      "Backup-restore drill, documentation, handover",
    ],
    example:
      "A Laravel business application deployed on a StackCP environment with git-based releases and verified weekly off-site backups.",
  },
  {
    slug: "custom-software-development",
    icon: "Code2",
    title: "Custom Software Development",
    tagline: "When the process is the competitive advantage.",
    problem:
      "The way your business handles quotes, bookings, production or fulfilment is different from every competitor — so off-the-shelf software either fights your process or forces you to become generic.",
    solution:
      "We engineer custom software around the process that makes your business distinctive: requirements documented in a scoped specification, an HTML Preview where included in the agreed process, project-specific delivery terms, and handover as set out in the agreement.",
    features: [
      "Requirements engineering into a written specification",
      "Architecture designed for your scale and integration needs",
      "HTML Preview where included in the agreed process",
      "Milestone delivery with acceptance testing",
      "Agreed source code and Client-owned credentials identified in the SOW",
      "Post-delivery support and maintenance options",
    ],
    tech: ["Next.js", "Node.js", "Laravel", "Python", "PostgreSQL", "Google Cloud"],
    workflow: [
      "Process documentation and requirements workshops",
      "Scope of work with milestones and acceptance criteria",
      "Preview of the system's core workflow",
      "Iterative build with acceptance per milestone",
      "Delivery, handover, documentation and support setup",
    ],
    example:
      "A manufacturing firm commissioning a production-tracking system whose workflow is the exact reason customers choose them over larger competitors.",
  },
  {
    slug: "maintenance-support",
    icon: "Wrench",
    title: "Maintenance & Support",
    tagline: "Software is a living system, not a one-time file.",
    problem:
      "The launch is not the end: dependencies age, security patches arrive, hosting changes, and a system nobody maintains becomes the most expensive system you own — usually discovered during its failure.",
    solution:
      "We provide structured maintenance: monitoring with alerting, dependency and security updates, backup verification, incident response with defined turnaround, and a monthly report of everything done to your system.",
    features: [
      "Uptime and error monitoring with alerting",
      "Dependency and security patch management",
      "Backup monitoring with restore verification",
      "Incident response with defined turnaround times",
      "Small-change allowance for evolving needs",
      "Monthly maintenance report — plain, honest, detailed",
    ],
    tech: ["Google Cloud", "cPanel / StackCP", "Docker", "Cloud Logging", "PostgreSQL"],
    workflow: [
      "System audit and risk assessment",
      "Maintenance scope and response-tier agreement",
      "Monitoring and alerting setup",
      "Onboarding into our maintenance process",
      "Monthly reporting and quarterly review meetings",
    ],
    example:
      "An online store on a maintenance agreement receiving proactive patching and a monthly report — instead of discovering vulnerabilities after an incident.",
  },
  {
    slug: "digital-transformation-consulting",
    icon: "Compass",
    title: "Digital Transformation Consulting",
    tagline: "A map before you build the road.",
    problem:
      "Transformation budgets evaporate on tools nobody adopted and dashboards nobody opens — because the work started with software selection instead of process clarity.",
    solution:
      "We start where transformation should: mapping how work actually flows today, identifying where technology genuinely pays back, sequencing initiatives by return and risk, and delivering a roadmap your organisation can execute — with or without our build team.",
    features: [
      "Current-state process and systems mapping",
      "Opportunity assessment ranked by ROI and risk",
      "Technology recommendations with honest trade-offs",
      "Sequenced transformation roadmap",
      "Vendor-neutral evaluation of existing tools",
      "Executive briefing and team adoption planning",
    ],
    tech: ["Process mapping", "Architecture review", "ROI analysis", "Roadmapping"],
    workflow: [
      "Leadership interviews and current-state mapping",
      "Pain-point and opportunity analysis",
      "Findings preview with quantified recommendations",
      "Roadmap workshops with your team",
      "Roadmap delivery with execution options",
    ],
    example:
      "A family-owned business group receiving a twelve-month transformation roadmap that re-sequenced an already-planned ERP purchase behind higher-payback automation wins.",
  },
];

/* ------------------------------------------------------------------ */
/* Industries                                                          */
/* ------------------------------------------------------------------ */

export interface Industry {
  slug: string;
  title: string;
  imageKey: string;
  description: string;
  problems: string[];
  solution: string;
  exampleSystem: string;
  recommended: string[];
}

export const INDUSTRIES: Industry[] = [
  {
    slug: "ecommerce",
    title: "eCommerce",
    imageKey: "ecommerce",
    description:
      "Online selling where the product page, the checkout and the follow-up message are one continuous system.",
    problems: [
      "Carts abandoned at checkout with no recovery mechanism",
      "Order updates handled manually, one message at a time",
      "Inventory and sales data scattered across tools",
      "No visibility on which products and channels actually earn",
    ],
    solution:
      "A commerce platform with a conversion-engineered storefront, local payment integration, automated order communication and reporting that connects revenue to decisions.",
    exampleSystem:
      "A Dhaka-based fashion retailer replaces social-media selling with a full store: automated order confirmations on WhatsApp, delivery-status tracking and a weekly sales report leadership actually reads.",
    recommended: ["ecommerce-platforms", "whatsapp-automation", "business-dashboards", "api-integrations"],
  },
  {
    slug: "education",
    title: "Education",
    imageKey: "education",
    description:
      "Institutions where enquiry handling, admission and communication with guardians decide both reputation and revenue.",
    problems: [
      "Enquiries answered late or lost across staff phones",
      "Admission status communicated through repeated calls",
      "Guardian communication dependent on individual teachers",
      "No single record of a student's full journey",
    ],
    solution:
      "An enquiry-to-admission pipeline with automated follow-up, guardian communication templates and a single record per student from first contact to certificate.",
    exampleSystem:
      "A coaching centre automates enquiry follow-up, batch-allocation notices and monthly guardian progress updates — each message logged against the student's record.",
    recommended: ["custom-crm-development", "whatsapp-automation", "email-automation", "client-portals"],
  },
  {
    slug: "schools-training",
    title: "Schools & Training",
    imageKey: "education",
    description:
      "Schools, training centres and coaching programmes that need administration to stop eating teaching time.",
    problems: [
      "Routine administration consuming staff hours daily",
      "Fee reminders and event notices sent manually",
      "Attendance and progress data trapped in registers",
      "Parents unable to get answers without calling the office",
    ],
    solution:
      "Administrative automation for the repetitive 80% — fee cycles, notices, attendance summaries — plus a guardian-facing portal for the answers parents actually want.",
    exampleSystem:
      "A training institute automates fee reminders, course-start notices and certificate delivery, freeing administrative staff for the work that needs judgement.",
    recommended: ["whatsapp-automation", "client-portals", "sms-automation", "maintenance-support"],
  },
  {
    slug: "healthcare",
    title: "Healthcare",
    imageKey: "healthcare",
    description:
      "Clinics and health businesses where appointment handling, records and reminders directly affect patient outcomes.",
    problems: [
      "Appointment booking dependent on phone availability",
      "No-shows because reminders are sent irregularly",
      "Patient history scattered across paper and memory",
      "Follow-up and recall cycles that never happen",
    ],
    solution:
      "Appointment systems with automated reminders, structured patient records with proper access control, and recall workflows that run without staff intervention.",
    exampleSystem:
      "A multi-physician clinic introduces online booking with automated SMS reminders and confirmation replies — the front desk stops making reminder calls entirely.",
    recommended: ["client-portals", "sms-automation", "database-systems", "maintenance-support"],
  },
  {
    slug: "hospitals-clinics",
    title: "Hospitals & Clinics",
    imageKey: "healthcare",
    description:
      "Larger healthcare operations coordinating departments, schedules and sensitive records under real governance requirements.",
    problems: [
      "Departmental scheduling conflicts resolved by phone tag",
      "Records access without audit trails",
      "Referrals and reports communicated through informal channels",
      "Leadership blind on utilisation and patient flow",
    ],
    solution:
      "Departmental coordination platforms with role-based access, audit-logged record handling, structured referral flows and utilisation dashboards for administration.",
    exampleSystem:
      "A diagnostics chain connects sample collection, report readiness and delivery notification into one tracked flow — with an audit log for every record access.",
    recommended: ["enterprise-websites", "client-portals", "business-dashboards", "database-systems"],
  },
  {
    slug: "real-estate",
    title: "Real Estate",
    imageKey: "realestate",
    description:
      "Developers and agencies where a lead answered in five minutes is worth five answered tomorrow.",
    problems: [
      "Enquiries scattered across agents' personal chats",
      "Site-visit scheduling handled by memory and luck",
      "No consolidated view of pipeline and agent performance",
      "Buyers receiving inconsistent, ad-hoc updates",
    ],
    solution:
      "A lead-to-booking CRM with instant automated response, site-visit scheduling, installment tracking and consistent buyer communication tied to one record.",
    exampleSystem:
      "A property developer consolidates agent spreadsheets into one CRM: every enquiry, visit, booking and installment visible on a single client timeline.",
    recommended: ["custom-crm-development", "whatsapp-automation", "business-dashboards", "api-integrations"],
  },
  {
    slug: "restaurants-food",
    title: "Restaurants & Food",
    imageKey: "restaurant",
    description:
      "Food businesses where orders, delivery windows and repeat customers are the entire economics.",
    problems: [
      "Orders arriving through four channels with no record",
      "Peak-hour communication failing exactly when volume peaks",
      "No structured data on repeat customers and their orders",
      "Delivery status communicated by guesswork",
    ],
    solution:
      "Order channels consolidated into one system: automated confirmations, delivery-status updates, repeat-customer recognition and daily sales visibility.",
    exampleSystem:
      "A restaurant chain routes orders from chat and phone into one pipeline — automated confirmations, live status updates and a closing report each night.",
    recommended: ["whatsapp-automation", "business-dashboards", "ecommerce-platforms", "api-integrations"],
  },
  {
    slug: "agencies",
    title: "Agencies",
    imageKey: "agency",
    description:
      "Creative and service agencies whose own operations decide how much capacity they can actually sell.",
    problems: [
      "Client communication living in individual inboxes",
      "Project status reconstructed for every update call",
      "Approvals collected informally, disputed later",
      "Onboarding a new client is a bespoke ritual each time",
    ],
    solution:
      "Agency operations rebuilt: client portals for status and approvals, templated onboarding pipelines, and communication history attached to each client record.",
    exampleSystem:
      "A digital agency replaces status-call preparation with a client portal — clients see progress, approve deliverables and every approval is a permanent record.",
    recommended: ["client-portals", "custom-crm-development", "n8n-workflow-automation", "business-dashboards"],
  },
  {
    slug: "professional-services",
    title: "Professional Services",
    imageKey: "professional",
    description:
      "Law, accounting, consulting and advisory firms selling expertise where confidentiality and reliability are the product.",
    problems: [
      "Client documents exchanged through personal email",
      "Engagement status tracked across private spreadsheets",
      "Deadlines managed by individual discipline",
      "Client work product with no audit trail",
    ],
    solution:
      "Secure client portals for document exchange and approvals, engagement pipelines with deadline automation, and audit-grade records of every client interaction.",
    exampleSystem:
      "An accounting practice delivers tax documents and approval requests through a secure portal — replacing the email threads that previously buried deadlines.",
    recommended: ["client-portals", "email-automation", "database-systems", "cloud-deployment-google-cloud"],
  },
  {
    slug: "marketing-agencies",
    title: "Marketing Agencies",
    imageKey: "marketing",
    description:
      "Marketing teams whose value depends on producing, approving and publishing at volume without chaos.",
    problems: [
      "Content production tracked across chats and boards",
      "Client approval rounds lost in forwarded messages",
      "Publishing and reporting done manually each cycle",
      "Creative assets scattered across drives and phones",
    ],
    solution:
      "Content operations systems: structured production pipelines, approval workflows with records, automated publishing and reporting that assembles itself.",
    exampleSystem:
      "A social-first agency runs client content through an approval pipeline — every draft, note and sign-off permanently attached to the campaign record.",
    recommended: ["n8n-workflow-automation", "client-portals", "ai-business-automation", "business-dashboards"],
  },
  {
    slug: "local-businesses",
    title: "Local Businesses",
    imageKey: "localbusiness",
    description:
      "Neighbourhood businesses winning or losing on response speed, reviews and repeat visits.",
    problems: [
      "Enquiries after hours answered the next afternoon",
      "No record of who enquired and never converted",
      "Reviews and reputation handled reactively",
      "Repeat customers unrecognised and unrewarded",
    ],
    solution:
      "A web presence with automated enquiry capture and response, a simple customer record system, and repeat-customer communication that runs itself.",
    exampleSystem:
      "A salon automates booking confirmations, no-show reminders and a re-booking message six weeks after each visit — regulars return without anyone remembering to call.",
    recommended: ["premium-business-websites", "whatsapp-automation", "sms-automation", "maintenance-support"],
  },
  {
    slug: "international-smes",
    title: "International SMEs",
    imageKey: "sme",
    description:
      "Small and mid-sized companies operating across borders, time zones and currencies.",
    problems: [
      "Leads from different countries handled inconsistently",
      "Communication timing governed by staff working hours",
      "Multi-currency pricing managed in spreadsheets",
      "Operations freeze when a key person is away",
    ],
    solution:
      "Automation covering the timezone gap: instant multi-channel enquiry response, structured CRM across markets, and reporting that keeps leadership in control from any country.",
    exampleSystem:
      "An exporter automates enquiry response and quotation follow-up across three continents — a buyer in Vancouver and a buyer in Dhaka get the same five-minute answer.",
    recommended: ["custom-crm-development", "n8n-workflow-automation", "email-automation", "premium-business-websites"],
  },
  {
    slug: "finance",
    title: "Finance",
    imageKey: "finance",
    description:
      "Financial service providers whose systems must be auditable, controlled and honest by design.",
    problems: [
      "Client records without audit trails",
      "Payment and ledger status reconciled manually",
      "Approval processes that leave no record",
      "Compliance reporting assembled under deadline pressure",
    ],
    solution:
      "Systems with audit-grade logging: immutable transaction records, verification gates on payment status, documented approval workflows and reporting generated from live data.",
    exampleSystem:
      "A microfinance operator records every disbursement and collection with verification gates and a daily reconciliation report generated from live data — not a spreadsheet ritual.",
    recommended: ["database-systems", "api-integrations", "business-dashboards", "cloud-deployment-google-cloud"],
  },
  {
    slug: "retail",
    title: "Retail",
    imageKey: "retail",
    description:
      "Physical retail that needs the online storefront, the stock room and the customer to be one system.",
    problems: [
      "Online and in-store stock disagreeing twice a week",
      "Promotions run in store but not online, or vice versa",
      "No customer record connecting both channels",
      "Supplier reordering done from memory",
    ],
    solution:
      "Unified retail systems: single stock truth across channels, promotion sync, customer records spanning online and counter purchase, and reorder automation.",
    exampleSystem:
      "A multi-outlet retailer unifies online and counter sales on one stock ledger — promotions appear everywhere at once and reorders trigger on thresholds, not memory.",
    recommended: ["ecommerce-platforms", "database-systems", "api-integrations", "business-dashboards"],
  },
  {
    slug: "logistics",
    title: "Logistics",
    imageKey: "logistics",
    description:
      "Movement businesses where every shipment is a data object that customers want to watch live.",
    problems: [
      "Shipment status known only by calling the dispatcher",
      "Route and vehicle planning on paper and instinct",
      "Customers requesting updates that staff retype all day",
      "Proof of delivery scattered across chat photos",
    ],
    solution:
      "Shipment tracking with customer-visible status, dispatch planning views, automated status notifications and structured proof-of-delivery records.",
    exampleSystem:
      "A courier company gives customers live tracking links and automated status messages — the dispatch team stops answering the same question forty times a day.",
    recommended: ["business-dashboards", "api-integrations", "client-portals", "sms-automation"],
  },
  {
    slug: "travel-hospitality",
    title: "Travel & Hospitality",
    imageKey: "travel",
    description:
      "Travel and stay businesses selling experiences that must be booked, confirmed and remembered perfectly.",
    problems: [
      "Bookings and amendments handled through chat threads",
      "Voucher and itinerary delivery done manually",
      "Seasonal demand answered too slowly to capture",
      "Past travellers never contacted for repeat business",
    ],
    solution:
      "Booking pipelines with automated confirmations, document delivery, seasonal enquiry response and post-trip follow-up that converts past guests into the next season.",
    exampleSystem:
      "A tour operator automates booking confirmation, itinerary delivery and a post-trip follow-up message — repeat bookings stop depending on one manager's memory.",
    recommended: ["custom-crm-development", "whatsapp-automation", "email-automation", "premium-business-websites"],
  },
  {
    slug: "construction",
    title: "Construction",
    imageKey: "construction",
    description:
      "Builders and contractors where tenders, site progress and certificates move together or stall together.",
    problems: [
      "Tender submissions assembled under deadline panic",
      "Site progress reported through ad-hoc photos",
      "Client certificates and payment stages tracked informally",
      "Document versions conflicting between office and site",
    ],
    solution:
      "Project pipelines for tenders and milestones, structured progress reporting from site, and certificate-approval workflows that keep payment stages moving.",
    exampleSystem:
      "A contractor ties each payment application to a documented progress report and approval record — certification delays that used to take weeks close in days.",
    recommended: ["custom-crm-development", "client-portals", "cloud-deployment-google-cloud", "maintenance-support"],
  },
  {
    slug: "manufacturing",
    title: "Manufacturing",
    imageKey: "manufacturing",
    description:
      "Production businesses whose edge is the process itself — which generic software refuses to accommodate.",
    problems: [
      "Production tracking on whiteboards and end-of-day entry",
      "Order-to-production handoffs losing detail",
      "Machine downtime invisible until a deadline slips",
      "Quality records assembled after the fact",
    ],
    solution:
      "Production-tracking systems built to your actual workflow: order-to-production handoff, live status views, downtime capture and quality records created as work happens.",
    exampleSystem:
      "A furniture manufacturer tracks every order through cutting, assembly and finishing — with quality checklists completed on the floor, not reconstructed in the office.",
    recommended: ["custom-software-development", "business-dashboards", "database-systems", "api-integrations"],
  },
  {
    slug: "legal-services",
    title: "Legal Services",
    imageKey: "legal",
    description:
      "Legal practices where confidentiality, deadlines and document discipline are non-negotiable.",
    problems: [
      "Client documents exchanged through personal email",
      "Deadline management dependent on individual memory",
      "Matter status invisible to partners in real time",
      "Intake screening consuming senior time",
    ],
    solution:
      "Secure client intake and document exchange, matter-tracking with deadline automation, and access-controlled records with audit logs for every view.",
    exampleSystem:
      "A law practice moves client intake to a structured portal and deadline reminders to an automated calendar — confidentiality holds and nothing is missed silently.",
    recommended: ["client-portals", "database-systems", "cloud-deployment-google-cloud", "email-automation"],
  },
  {
    slug: "technology-companies",
    title: "Technology Companies",
    imageKey: "tech",
    description:
      "Product companies that need a public face as serious as their engineering.",
    problems: [
      "A world-class product behind a weak public website",
      "Customer onboarding done through back-and-forth email",
      "Status and changelog communication that customers trust",
      "Internal tooling built fast but unmaintainable",
    ],
    solution:
      "Marketing-grade websites with engineering-grade underpinnings, customer onboarding portals, and the automation layer that keeps customer communication honest and logged.",
    exampleSystem:
      "A SaaS startup pairs a product-grade public site with an onboarding portal — activation stops depending on a founder's evenings.",
    recommended: ["premium-business-websites", "client-portals", "n8n-workflow-automation", "cloud-deployment-google-cloud"],
  },
];

/* ------------------------------------------------------------------ */
/* Illustrative project scenarios — not audited customer case studies   */
/* ------------------------------------------------------------------ */

export interface CaseStudy {
  slug: string;
  industry: string;
  title: string;
  challenge: string;
  approach: string;
  outcome: string;
  stack: string[];
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "fashion-retail-store-launch",
    industry: "eCommerce",
    title: "Illustrative storefront for social-commerce operations",
    challenge:
      "Illustrative scenario: A fashion retailer handles orders through inbox conversations, payment screenshots, and manual delivery updates. Growing volume makes status tracking and follow-up difficult.",
    approach:
      "Possible approach: a storefront with local payment integration, order confirmations, delivery-status updates, and a closing report — each provider integration would need to be configured and tested for the engagement.",
    outcome:
      "Intended outcome, not a measured result: a single place to review orders and customer updates. Conversion, time savings, and revenue changes would need to be measured against an agreed baseline.",
    stack: ["Next.js", "PostgreSQL", "WhatsApp Cloud API", "bKash", "n8n", "Google Cloud Run"],
  },
  {
    slug: "clinic-appointment-automation",
    industry: "Healthcare",
    title: "Appointment reminders organized in one workflow",
    challenge:
      "Illustrative scenario: A multi-physician clinic relies on front-desk staff to call patients about appointments; reminder work competes with other duties during busy periods.",
    approach:
      "Possible approach: online booking with configured SMS reminders and confirmations, a daily schedule view, and follow-up workflows, subject to provider and privacy requirements.",
    outcome:
      "Intended outcome, not a measured result: a more consistent reminder process and a clear schedule. Any change in attendance or staff time requires measured pilot data.",
    stack: ["Next.js", "PostgreSQL", "SMS gateway", "Node.js", "Google Cloud Run"],
  },
  {
    slug: "school-enquiry-pipeline",
    industry: "Education",
    title: "A structured admissions-enquiry workflow",
    challenge:
      "Illustrative scenario: A coaching centre receives enquiries outside staff hours and has no shared queue to prioritize replies.",
    approach:
      "Possible approach: an enquiry CRM, first-response automation, guided follow-up, batch allocation, and guardian updates, with messages logged against a record.",
    outcome:
      "Intended outcome, not a measured result: enquiries are visible in one workflow and response timing can be measured; no response-time or enrolment increase is claimed.",
    stack: ["Next.js", "PostgreSQL", "WhatsApp Cloud API", "n8n", "Prisma"],
  },
  {
    slug: "developer-sales-crm",
    industry: "Real Estate",
    title: "A unified client timeline for property sales",
    challenge:
      "Illustrative scenario: A property sales team keeps buyer context in separate agent spreadsheets and chats, making handovers and management visibility difficult.",
    approach:
      "Possible approach: tie each enquiry, site visit, booking, and installment to a client timeline, with follow-up scheduling and reporting.",
    outcome:
      "Intended outcome, not a measured result: a common view of pipeline activity and next steps. No spreadsheet-reduction or sales-performance result is asserted.",
    stack: ["Next.js", "TypeScript", "PostgreSQL", "Prisma", "Google Cloud Run"],
  },
  {
    slug: "restaurant-order-pipeline",
    industry: "Restaurants & Food",
    title: "Order intake across channels in one workflow",
    challenge:
      "Illustrative scenario: A restaurant accepts orders through chat, phone, marketplaces, and walk-ins, with staff coordinating status across separate tools.",
    approach:
      "Possible approach: route order events into one operational queue with confirmations, preparation and delivery status, and branch reports.",
    outcome:
      "Intended outcome, not a measured result: staff can review order status across channels. Error rates, speed, and branch performance must be measured during delivery.",
    stack: ["Node.js", "PostgreSQL", "WhatsApp Cloud API", "n8n", "Google Cloud Run"],
  },
  {
    slug: "logistics-live-tracking",
    industry: "Logistics",
    title: "Shipment status shared through a tracking link",
    challenge:
      "Illustrative scenario: A courier team receives repeated parcel-status questions while shipment information is spread across dispatch tools.",
    approach:
      "Possible approach: shipment records, customer-visible tracking links, milestone notifications, and a dispatch planning view.",
    outcome:
      "Intended outcome, not a measured result: customers can view configured shipment updates. No call-volume reduction or dispatch-time claim is made.",
    stack: ["Next.js", "PostgreSQL", "SMS gateway", "Node.js", "Cloud Storage"],
  },
  {
    slug: "agency-client-portal",
    industry: "Agencies",
    title: "Approval history in a client portal",
    challenge:
      "Illustrative scenario: An agency collects approval feedback through forwarded chats and email, making versions and decisions difficult to audit.",
    approach:
      "Possible approach: a client portal for deliverable review, explicit approvals, revision history, and scheduled status summaries.",
    outcome:
      "Intended outcome, not a measured result: approvals and revisions have a shared record. No meeting-time or dispute reduction is claimed.",
    stack: ["Next.js", "TypeScript", "PostgreSQL", "Cloud Storage", "Google Cloud Run"],
  },
  {
    slug: "firm-intake-automation",
    industry: "Professional Services",
    title: "Document intake and deadline tracking for a practice",
    challenge:
      "Illustrative scenario: A professional practice receives client documents through personal email and tracks deadlines in separate files.",
    approach:
      "Possible approach: a secure client portal for document delivery and approvals, deadline reminders, and a shared engagement pipeline.",
    outcome:
      "Intended outcome, not a measured result: document receipt and upcoming deadlines are visible in one workflow. Security, confidentiality, and adoption require validation in the specific deployment.",
    stack: ["Next.js", "PostgreSQL", "SMTP", "Node.js", "Secret Manager"],
  },
];

/* ------------------------------------------------------------------ */
/* Technology stack                                                    */
/* ------------------------------------------------------------------ */

export interface TechGroup {
  name: string;
  icon: string;
  blurb: string;
  items: string[];
}

export const TECHNOLOGY_GROUPS: TechGroup[] = [
  {
    name: "Frontend",
    icon: "LayoutDashboard",
    blurb: "Interfaces that stay fast, accessible and maintainable as they grow.",
    items: ["Next.js", "React", "TypeScript", "Tailwind CSS", "shadcn/ui", "Framer Motion", "Vite", "Recharts"],
  },
  {
    name: "Backend",
    icon: "Server",
    blurb: "APIs and services engineered for correctness before features.",
    items: ["Node.js", "Bun", "Laravel / PHP", "Python", "REST APIs", "Webhooks", "Prisma ORM", "JWT & session auth"],
  },
  {
    name: "Data",
    icon: "Database",
    blurb: "Schemas designed once, correctly — with integrity at the data layer.",
    items: ["PostgreSQL", "MySQL", "SQLite", "Cloud SQL", "Redis", "Backups & PITR", "Query engineering", "Data modelling"],
  },
  {
    name: "Cloud & Infrastructure",
    icon: "Cloud",
    blurb: "Production-grade deployment without hiring a platform team.",
    items: ["Google Cloud Run", "Cloud Storage", "Secret Manager", "Cloud Build", "Cloud Scheduler", "Cloud Logging", "Docker", "cPanel", "StackCP"],
  },
  {
    name: "Automation & AI",
    icon: "Workflow",
    blurb: "Governed automation: logged, retried, auditable and honest.",
    items: ["n8n", "WhatsApp Cloud API", "LLM APIs", "AI agent frameworks", "Event queues", "Cron & schedulers", "Retry & idempotency", "Execution logging"],
  },
  {
    name: "Integrations",
    icon: "Plug",
    blurb: "Payment, communication and platform connections done properly.",
    items: ["Stripe", "PayPal", "bKash", "Nagad", "SSLCommerz", "Meta APIs", "Google Workspace", "SMTP", "SMS gateways"],
  },
];

/* ------------------------------------------------------------------ */
/* Delivery process                                                    */
/* ------------------------------------------------------------------ */

export interface ProcessPhase {
  step: string;
  name: string;
  title: string;
  duration: string;
  description: string;
  details: string[];
  gate?: { label: string; text: string };
}

export const PROCESS: ProcessPhase[] = [
  {
    step: "01",
    name: "Discover",
    title: "Understanding your business before proposing anything",
    duration: "As agreed",
    description:
      "We study your business, your customers and the outcomes you need. This phase produces a shared understanding — and an honest recommendation, including telling you when you do not need us.",
    details: [
      "Business goals and audience mapping",
      "Current systems and workflow audit",
      "Competitive and channel review",
      "Opportunity and constraint assessment",
    ],
  },
  {
    step: "02",
    name: "Scope",
    title: "A written scope that removes ambiguity permanently",
    duration: "As agreed",
    description:
      "Every deliverable, timeline, milestone and payment term is written into a Final Scope of Work. You review it, request revisions, and approve it in writing. From this moment, \"I thought it would include…\" stops being a possible conversation.",
    details: [
      "Structured discovery questions and gap analysis",
      "Deliverables, timeline and milestone definition",
      "Payment structure per our Payment Policy",
      "Written client approval of the final scope",
    ],
    gate: {
      label: "Approval gate",
      text: "Scope changes after approval are possible — but they trigger a new quote and timeline, never silent drift. This is written into the Client Approval Policy.",
    },
  },
  {
    step: "03",
    name: "Preview",
    title: "HTML preview where included",
    duration: "As agreed",
    description:
      "Where included in the agreed process, we provide an HTML Preview for review against the approved scope before the applicable project payment. Backend features and production integrations may be incomplete unless the SOW says otherwise.",
    details: [
      "Preview supplied where included in the agreed process",
      "Review against the agreed scope and preview content",
      "Revision allowance follows the approved SOW",
      "Written approval or revision request recorded",
    ],
    gate: {
      label: "Approval gate",
      text: "Where required by the agreed process, approval of the relevant preview precedes the applicable payment request. The approved SOW determines project-specific payment terms.",
    },
  },
  {
    step: "04",
    name: "Payment",
    title: "Milestone payments, verified and receipted",
    duration: "Per agreed schedule",
    description:
      "Payment follows the schedule in the approved quotation, invoice, and SOW. TECH360 verifies payment status using available transaction records and provider or financial-institution confirmation; a screenshot or pending transfer alone is not conclusive proof of cleared funds.",
    details: [
      "Milestone structure as written in the approved scope",
      "Payment instructions with reference to your Client ID",
      "Verification before any project status change",
      "Receipt and record for every transaction",
    ],
    gate: {
      label: "Verification gate",
      text: "Project commencement and any payment trigger follow the approved SOW. Final source-code handover generally follows verification that required outstanding payments have cleared.",
    },
  },
  {
    step: "05",
    name: "Build",
    title: "Iterative build with milestone acceptance",
    duration: "As agreed in the SOW",
    description:
      "Development proceeds against the approved scope in milestones — each accepted in writing before the next begins. Progress updates reach you automatically at milestone boundaries, not when someone remembers to write.",
    details: [
      "Milestone-based development against the scope",
      "Automated progress updates at each milestone",
      "Revisions as defined in the approved scope",
      "Testing against the QA checklist before each acceptance",
    ],
  },
  {
    step: "06",
    name: "Deliver",
    title: "Delivery with a checklist, not a hope",
    duration: "As agreed",
    description:
      "Delivery is a structured event: the system goes live against the quality checklist, you confirm delivery in writing, and any final payment milestone is settled with the same verification discipline as the first.",
    details: [
      "Live deployment on your hosting or ours",
      "Quality checklist verified together",
      "Written delivery confirmation on record",
      "Final payment milestone settled and verified",
    ],
    gate: {
      label: "Payment gate",
      text: "Unless otherwise agreed in writing, final source-code handover follows verification that all required project payments have cleared.",
    },
  },
  {
    step: "07",
    name: "Handover & Support",
    title: "Agreed source code, documentation and handover",
    duration: "As agreed",
    description:
      "After required outstanding payments are verified and cleared, TECH360 hands over agreed source code, documentation, and Client-owned credentials specifically identified in the approved SOW. Internal secrets and other Clients’ information are excluded. Support is only as agreed.",
    details: [
      "Agreed source package and documentation",
      "Client-owned credentials identified in the SOW, where applicable",
      "Secure transfer and handover record",
      "Support only where included in the agreement",
    ],
  },
];

/* ------------------------------------------------------------------ */
/* FAQs                                                                */
/* ------------------------------------------------------------------ */

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  {
    q: "Will I receive an HTML Preview before payment?",
    a: "An HTML Preview is supplied before the applicable project payment where it is included in the agreed process. The approved SOW identifies the preview and review process. Approval concerns the visual design and visible elements shown, not automatically every backend feature or production integration.",
  },
  {
    q: "When do I receive the source code?",
    a: "Unless otherwise agreed in writing, final source-code handover takes place after all required project payments have been received and cleared. The agreed package and Client-owned credentials are defined by the SOW; TECH360 internal secrets, shared infrastructure credentials, and other Clients’ information are excluded.",
  },
  {
    q: "How do payments work? Do I pay everything upfront?",
    a: "Your approved quotation, invoice, and SOW determine the payment method and schedule. Projects may use a single payment or agreed stages; no universal percentage applies. Pending transfers or screenshots alone do not establish cleared payment. See the Payment Policy.",
  },
  {
    q: "What if I want changes after the scope is approved?",
    a: "Scope changes are normal — we just handle them honestly. A change that fits within the approved scope is absorbed. A change that adds new work gets a new written quote and timeline which you approve before the work begins. Silent scope creep — us quietly doing more, or quietly doing less — is what the Client Approval Policy exists to prevent.",
  },
  {
    q: "How many revisions do I get?",
    a: "Any included revision rounds and review limits are stated in the approved SOW. Requests that change approved requirements may require a written change request, additional fees, or schedule adjustment.",
  },
  {
    q: "How long does a project take?",
    a: "It follows from the scope, and it is written down before you commit. A focused business website typically runs two to four weeks; a platform or CRM build runs six to twelve weeks depending on integrations. The timeline in your Final Scope of Work is the reference we are accountable to — and it is only promised after discovery, never during a sales pitch.",
  },
  {
    q: "What support do I get after delivery?",
    a: "Documentation, training, defect correction, maintenance, and support are included only where stated in the approved SOW or a separate written agreement. The agreement describes any service level, duration, and fees.",
  },
  {
    q: "How do you protect my business data and confidentiality?",
    a: "Our Privacy Policy describes the information we collect and the safeguards we aim to use. Do not submit passwords, API keys, payment credentials, or highly sensitive information through the public form or ordinary chat. Contact us to discuss an appropriate secure transfer method and any confidentiality terms before sharing sensitive material.",
  },
  {
    q: "Where do you work? Can you handle clients outside the US?",
    a: "TECH360 LLC serves clients internationally. The Work page contains illustrative scenarios, not verified client engagements; any public client reference requires that client’s prior written permission and may not be available.",
  },
  {
    q: "How do we start working together?",
    a: "Send an enquiry through the contact form, webchat, or email. TECH360 can review your requirements, provide a written proposal and SOW, and supply an HTML Preview where included in the agreed process. Project-specific approvals, payment, delivery, and support terms are confirmed in writing.",
  },
  {
    q: "What technologies do you build with?",
    a: "We work in a deliberate, boring-in-the-good-way stack: Next.js and TypeScript on the frontend; Node.js, Laravel and Python on the backend; PostgreSQL and MySQL for data; Google Cloud Run, Cloud SQL and Secret Manager for infrastructure; n8n plus the official WhatsApp Cloud API for automation. The full breakdown with reasoning is on our Technologies page.",
  },
  {
    q: "Where will my project be hosted — and who controls it?",
    a: "Hosting, account ownership, deployment, and access arrangements are identified in the approved SOW. Client-owned credentials specifically identified for handover may be transferred securely when available; provider accounts and licences remain subject to their terms.",
  },
];

/* ------------------------------------------------------------------ */
/* Careers                                                             */
/* ------------------------------------------------------------------ */

export interface Role {
  slug: string;
  title: string;
  location: string;
  type: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
}

export const ROLES: Role[] = [
  {
    slug: "senior-fullstack-engineer",
    title: "Senior Full-Stack Engineer",
    location: "Remote / Dhaka",
    type: "Full-time",
    summary:
      "Own complete product builds — from schema design to deployed interface — for client platforms across eCommerce, CRM and portals. You will work directly against written scopes and be accountable to milestone acceptance, not ticket counts.",
    responsibilities: [
      "Design and build full-stack features against approved scopes",
      "Own data models, API design and interface implementation",
      "Write acceptance-quality code with tests before milestone review",
      "Participate in scope reviews and honest effort estimation",
      "Contribute to internal engineering standards and documentation",
    ],
    requirements: [
      "4+ years with TypeScript, React/Next.js and Node.js",
      "Strong relational database design (PostgreSQL or MySQL)",
      "Production deployment experience (Google Cloud, Docker or cPanel)",
      "Habit of writing documentation other engineers can follow",
      "Comfortable being measured on delivered acceptance criteria",
    ],
  },
  {
    slug: "backend-engineer-laravel",
    title: "Backend Engineer (Laravel / PHP)",
    location: "Remote / Dhaka",
    type: "Full-time",
    summary:
      "Build and maintain server-side systems for business applications and integrations — payment flows, order pipelines and APIs — with the reliability discipline our delivery policy promises clients.",
    responsibilities: [
      "Develop Laravel applications and integration services",
      "Implement payment, notification and third-party API flows",
      "Engineer retry, idempotency and failure-handling paths",
      "Maintain deployment pipelines on cPanel/StackCP environments",
      "Support quality assurance before milestone acceptance",
    ],
    requirements: [
      "3+ years professional Laravel/PHP development",
      "MySQL schema design and query optimisation experience",
      "Hands-on work with at least one payment gateway integration",
      "Understanding of secure credential and secret handling",
      "Evidence of production systems you can walk us through",
    ],
  },
  {
    slug: "automation-engineer",
    title: "Automation Engineer (n8n / WhatsApp Cloud API)",
    location: "Remote / Harrisonville, MO / Dhaka",
    type: "Full-time",
    summary:
      "Design and operate the automation backbone: n8n workflows, WhatsApp Cloud API integrations, notification pipelines and the monitoring that keeps all of it honest.",
    responsibilities: [
      "Build and version n8n workflows with failure-path design",
      "Implement official WhatsApp Cloud API integrations end-to-end",
      "Set up delivery-status tracking, retries and escalation logic",
      "Operate monitoring dashboards and respond to automation failures",
      "Document every workflow for client handover",
    ],
    requirements: [
      "2+ years building production automation (n8n, Zapier or custom)",
      "Direct experience with WhatsApp Cloud API or comparable Meta APIs",
      "Solid Node.js and webhook fundamentals",
      "Obsession with logging and failure visibility",
      "Ability to explain automation behaviour to non-engineers",
    ],
  },
  {
    slug: "ui-ux-designer",
    title: "UI/UX Designer",
    location: "Remote",
    type: "Full-time",
    summary:
      "Design interfaces for client businesses and enterprise use. Where an HTML Preview is included, clients review the agreed visual elements against the approved scope.",
    responsibilities: [
      "Design conversion-focused websites and platform interfaces",
      "Produce design systems, component libraries and prototypes",
      "Collaborate with engineering on implementation feasibility",
      "Own the visual quality of preview-stage deliverables",
      "Contribute layout and messaging ideas for representative case material",
    ],
    requirements: [
      "3+ years designing digital products and marketing sites",
      "Portfolio demonstrating conversion thinking, not just aesthetics",
      "Fluency with a modern design tool and component-based design",
      "Comfort designing within a fixed brand system and data reality",
      "Willingness to defend design decisions with business reasoning",
    ],
  },
  {
    slug: "business-development-executive",
    title: "Business Development Executive",
    location: "Remote / Harrisonville, MO",
    type: "Full-time",
    summary:
      "Grow our client base across the USA, Bangladesh and beyond — with a process that closes on trust mechanics (preview-first, milestone payments) rather than discount pressure.",
    responsibilities: [
      "Manage inbound enquiries from first message to scope approval",
      "Qualify opportunities honestly — including declining bad fits",
      "Coordinate discovery workshops with the engineering team",
      "Maintain CRM discipline — every interaction on the client record",
      "Represent company policies accurately in all communication",
    ],
    requirements: [
      "2+ years in B2B software or digital services sales",
      "Comfortable selling a consultative, policy-governed process",
      "Excellent written communication in English",
      "CRM discipline and structured follow-up habits",
      "Reputation for accurate representation — no overpromising",
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Legal documents                                                     */
/* ------------------------------------------------------------------ */

/* Stats (source/catalogue counts only; live operation is not asserted) */
/* ------------------------------------------------------------------ */

export const STATS: { value: string; label: string; note: string }[] = [
  {
    value: "US LLC",
    label: "Company information",
    note: "TECH360 LLC provides the services described on this website; project terms are confirmed in writing.",
  },
  {
    value: "110",
    label: "department definitions",
    note: "The source registry defines 110 department records. This is a catalogue count, not a claim that 110 teams are deployed or staffed.",
  },
  {
    value: "20",
    label: "pipeline-stage definitions",
    note: "Twenty pipeline stages are defined in source. Live usage, automation coverage, and end-to-end audit completeness have not been verified.",
  },
  {
    value: "26",
    label: "n8n workflow files",
    note: "Twenty-six workflow JSON files are tracked in the repository; deployment and successful live execution have not been verified.",
  },
];

/* ------------------------------------------------------------------ */
/* Contact form options                                                */
/* ------------------------------------------------------------------ */

export const BUSINESS_TYPES: string[] = [
  "eCommerce",
  "Education",
  "Schools & Training",
  "Healthcare",
  "Hospitals & Clinics",
  "Real Estate",
  "Restaurants & Food",
  "Agencies",
  "Professional Services",
  "Marketing Agencies",
  "Local Business",
  "International SME",
  "Finance",
  "Retail",
  "Logistics",
  "Travel & Hospitality",
  "Construction",
  "Manufacturing",
  "Legal Services",
  "Technology Company",
  "Other",
];

export const COUNTRIES: string[] = [
  "Bangladesh",
  "USA",
  "UK",
  "Canada",
  "Australia",
  "UAE",
  "Saudi Arabia",
  "Singapore",
  "Malaysia",
  "India",
  "Pakistan",
  "Other",
];

export const PROJECT_TYPES: string[] = [
  "Business Website",
  "Enterprise Website",
  "eCommerce Platform",
  "Custom CRM",
  "WhatsApp-First AI Sales CRM",
  "Client Portal",
  "Business Dashboard",
  "WhatsApp Automation",
  "Email/SMS Automation",
  "n8n Workflow Automation",
  "AI Agent System",
  "API Integration",
  "Database System",
  "Cloud Deployment",
  "Maintenance & Support",
  "Digital Transformation",
  "Other",
];

export const BUDGET_RANGES: string[] = [
  "Under $500",
  "$500-$1,000",
  "$1,000-$5,000",
  "$5,000-$10,000",
  "$10,000-$25,000",
  "$25,000-$50,000",
  "$50,000+",
  "To be discussed",
];

// How a VISITOR prefers to be contacted about their own enquiry. This is a
// customer preference recorded on the CRM record — it does not publish a
// TECH360 WhatsApp number (owner decision 2026-10-24 removed the public
// WhatsApp channel; see src/lib/site-contact.ts).
export const CONTACT_METHODS: string[] = ["Email", "Phone", "WhatsApp"];

/* ------------------------------------------------------------------ */
export function getService(slug: string): Service | undefined {
  return SERVICES.find((s) => s.slug === slug);
}

export function getIndustry(slug: string): Industry | undefined {
  return INDUSTRIES.find((i) => i.slug === slug);
}

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}

export const TRUST_POINTS: string[] = [
  "US-Registered LLC",
  "HTML Preview where included",
  "Source Code after verified payment",
  "Approvals and delivery documented",
];

/* ------------------------------------------------------------------ */
/* Aggregate site model                                                */
/* ------------------------------------------------------------------ */

/**
 * Single aggregate export for consumers that want the whole site model
 * (e.g. the hash router in app/page.tsx). Individual named exports remain
 * the primary API — this is a convenience alias over the same data.
 */
export const SITE = {
  company: COMPANY,
  navLinks: NAV_LINKS,
  services: SERVICES,
  industries: INDUSTRIES,
  caseStudies: CASE_STUDIES,
  technologies: TECHNOLOGY_GROUPS,
  process: PROCESS,
  faqs: FAQS,
  roles: ROLES,
  legal: LEGAL_DOCS,
  stats: STATS,
  trustPoints: TRUST_POINTS,
} as const;
