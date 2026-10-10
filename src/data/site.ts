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
  ein: "98-1940053",
  address: "117 S Lexington St Ste 100, Harrisonville, MO 64701, USA",
  email: "info@bdtech360.com",
  founded: "2021",
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
      "HTML preview for your approval before payment begins",
      "Design refinement, build, content integration",
      "QA, SEO pass, launch and handover of credentials",
    ],
    example:
      "A professional services firm replacing a five-year-old template site with a structured 12-page website, launched with a preview-approved design and a 40/30/30 milestone plan.",
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
      "Preview of key templates and workflows before payment",
      "Iterative build with milestone acceptance per department",
      "Migration, training, launch and operational handover",
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
      "We build production agent systems: each agent with a defined job, tool permissions, execution history and approval gates for sensitive actions. Output is stored, auditable and reproducible — an AI workforce you can govern.",
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
      "A company automating first-response drafting and scope-question generation for inbound enquiries, with human approval before anything reaches a client.",
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
      "We engineer custom software around the process that makes your business distinctive: requirements engineered into a scoped specification, preview before payment, milestone delivery and a full source-code handover when the project completes.",
    features: [
      "Requirements engineering into a written specification",
      "Architecture designed for your scale and integration needs",
      "HTML preview before payment begins",
      "Milestone delivery with acceptance testing",
      "Full source code and credential handover",
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
/* Case studies (representative engagement patterns — anonymised)      */
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
    title: "From social-media selling to a governed storefront",
    challenge:
      "A fashion retailer was selling entirely through inbox conversations — orders on chat, payments by screenshot, delivery updates by memory. Volume growth had stopped because the process could not scale past the founder's attention.",
    approach:
      "A conversion-engineered storefront with local payment integration, automated WhatsApp order confirmations and delivery-status updates, and a closing sales report generated each night.",
    outcome:
      "Order communication became automatic and consistent; checkout abandonment improved after the redesign; the founder reclaimed the hours previously spent confirming orders manually.",
    stack: ["Next.js", "PostgreSQL", "WhatsApp Cloud API", "bKash", "n8n", "Google Cloud Run"],
  },
  {
    slug: "clinic-appointment-automation",
    industry: "Healthcare",
    title: "A front desk that stopped making reminder calls",
    challenge:
      "A multi-physician clinic depended on front-desk staff calling patients for reminders. No-shows were routine during busy hours precisely because reminder calls were the first thing dropped under pressure.",
    approach:
      "Online booking with automated SMS reminders and confirmation replies, plus a structured daily schedule view for the front desk and recall workflows for follow-up visits.",
    outcome:
      "Manual reminder calls ended entirely; no-shows fell noticeably after reminders became systematic; staff time shifted from dialling to patient care.",
    stack: ["Next.js", "PostgreSQL", "SMS gateway", "Node.js", "Google Cloud Run"],
  },
  {
    slug: "school-enquiry-pipeline",
    industry: "Education",
    title: "Admission enquiries answered before competitors wake up",
    challenge:
      "A coaching centre received enquiries at all hours but replied only when staff saw them. Parents shortlisting multiple centres moved on before the reply arrived.",
    approach:
      "An enquiry-to-admission CRM with instant automated first-response, guided follow-up questions, batch-allocation notices and guardian progress updates — every message logged against the student's record.",
    outcome:
      "Response latency dropped from hours to minutes; admission-season workload stayed manageable; no enquiry was lost to an unread inbox.",
    stack: ["Next.js", "PostgreSQL", "WhatsApp Cloud API", "n8n", "Prisma"],
  },
  {
    slug: "developer-sales-crm",
    industry: "Real Estate",
    title: "One client timeline replacing eleven spreadsheets",
    challenge:
      "A property developer ran sales through agents' personal spreadsheets and chats. Management could not answer \"where is this buyer?\" without a meeting, and handovers between agents lost context.",
    approach:
      "A custom CRM tying every enquiry, site visit, booking and installment to a single client timeline — with automated follow-up scheduling and agent performance reporting.",
    outcome:
      "Pipeline visibility became instant; follow-ups stopped depending on individual memory; leadership reviewed the live pipeline instead of compiled spreadsheets.",
    stack: ["Next.js", "TypeScript", "PostgreSQL", "Prisma", "Google Cloud Run"],
  },
  {
    slug: "restaurant-order-pipeline",
    industry: "Restaurants & Food",
    title: "Four order channels converging into one pipeline",
    challenge:
      "A restaurant chain took orders from chat, phone, marketplace apps and walk-ins — each into a different place. Peak-hour errors were routine and no consolidated sales picture existed.",
    approach:
      "All channels routed into a single order pipeline with automated confirmations, live preparation and delivery status, and a nightly closing report per branch.",
    outcome:
      "Peak-hour order handling became consistent across branches; delivery-status questions from customers fell away; branch comparison became a daily fact rather than a month-end estimate.",
    stack: ["Node.js", "PostgreSQL", "WhatsApp Cloud API", "n8n", "Google Cloud Run"],
  },
  {
    slug: "logistics-live-tracking",
    industry: "Logistics",
    title: "Forty status calls a day replaced by a tracking link",
    challenge:
      "A courier company's dispatchers spent most of the day answering \"where is my parcel?\" — the same question, re-answered per customer, with status known only inside the dispatcher's head.",
    approach:
      "Shipment objects with live status, customer-visible tracking links, automated milestone notifications and a dispatch planning dashboard for route load.",
    outcome:
      "Status calls collapsed; customers checked tracking links instead of calling; dispatchers returned to exception handling rather than repetition.",
    stack: ["Next.js", "PostgreSQL", "SMS gateway", "Node.js", "Cloud Storage"],
  },
  {
    slug: "agency-client-portal",
    industry: "Agencies",
    title: "Approvals that used to live in forwarded messages",
    challenge:
      "A digital agency collected client approvals through chats and email. Rounds were disputed, versions conflicted, and preparing each status update consumed senior hours.",
    approach:
      "A branded client portal with structured review workflows — deliverables uploaded, reviewed and approved with a permanent record, plus automated weekly status digests.",
    outcome:
      "Approval disputes ended (the record answered them); status meetings shortened from an hour to fifteen minutes; onboarding new clients became a repeatable process.",
    stack: ["Next.js", "TypeScript", "PostgreSQL", "Cloud Storage", "Google Cloud Run"],
  },
  {
    slug: "firm-intake-automation",
    industry: "Professional Services",
    title: "An accounting practice that stopped burying deadlines",
    challenge:
      "An accounting firm exchanged client documents through personal email and tracked engagements in a private spreadsheet. Deadlines surfaced only through individual discipline.",
    approach:
      "A secure client portal for document delivery and approvals, automated deadline reminders, and an engagement pipeline visible to the whole practice.",
    outcome:
      "Document exchange became trackable and confidential; deadline reminders ran on schedule regardless of workload; partners reviewed live engagement status instead of chasing updates.",
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
    duration: "1–3 days",
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
    duration: "2–4 days",
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
    title: "HTML preview before any payment moves",
    duration: "2–5 days",
    description:
      "We build and send you a working, clickable HTML preview of the solution generated from your approved scope. You evaluate quality with your own eyes — and can request revisions at this stage at no cost — before any money is committed.",
    details: [
      "Working preview generated from the approved scope",
      "Review with your team and stakeholders",
      "Revision requests at this stage are free",
      "Written approval (or revision) recorded on file",
    ],
    gate: {
      label: "Approval gate",
      text: "Payment begins only after your preview approval. The preview and the scope document are permanent references for the whole engagement.",
    },
  },
  {
    step: "04",
    name: "Payment",
    title: "Milestone payments, verified and receipted",
    duration: "Per milestone",
    description:
      "Payment follows the structure in your scope — commonly 40% advance, 30% at the midpoint milestone, 30% at delivery. Every payment is recorded, verified and receipted. Project status changes only after verification — never on a screenshot.",
    details: [
      "Milestone structure as written in the approved scope",
      "Payment instructions with reference to your Client ID",
      "Verification before any project status change",
      "Receipt and record for every transaction",
    ],
    gate: {
      label: "Verification gate",
      text: "The project activates only after the first payment is verified. Final delivery and source-code release gate on full payment completion.",
    },
  },
  {
    step: "05",
    name: "Build",
    title: "Iterative build with milestone acceptance",
    duration: "Per scope timeline",
    description:
      "Development proceeds against the approved scope in milestones — each accepted in writing before the next begins. Progress updates reach you automatically at milestone boundaries, not when someone remembers to write.",
    details: [
      "Milestone-based development against the scope",
      "Automated progress updates at each milestone",
      "Two revision rounds within scope included",
      "Testing against the QA checklist before each acceptance",
    ],
  },
  {
    step: "06",
    name: "Deliver",
    title: "Delivery with a checklist, not a hope",
    duration: "2–4 days",
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
      text: "Source code release happens only after full payment is verified — per the Source Code Handover Policy. Both sides are protected by the same rule.",
    },
  },
  {
    step: "07",
    name: "Handover & Support",
    title: "Source code, credentials and a system you own",
    duration: "1–2 days + support",
    description:
      "After full payment, the complete source package and every credential are handed over securely. You change passwords, confirm in writing, and receive documentation any competent developer can follow. Ongoing support is available — and optional.",
    details: [
      "Full source code and documentation package",
      "Secure credential handover",
      "Password change confirmed by you in writing",
      "Optional maintenance and support agreement",
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
    q: "Do I really get an HTML preview before paying anything?",
    a: "Yes. After your written scope approval, we build a working, clickable HTML preview of your solution and send it to you. You approve it or request revisions — revisions at the preview stage are free — and payment begins only after your approval. This is written into our Delivery Policy, not just promised in a chat.",
  },
  {
    q: "When do I receive the source code?",
    a: "The complete source code, documentation and all credentials are handed over after final payment is verified. The release is gated by our Source Code Handover Policy, which protects both sides: you cannot lose the code you paid for, and we cannot deliver code that was not paid for. After handover you confirm password changes in writing, and the system is fully yours.",
  },
  {
    q: "How do payments work? Do I pay everything upfront?",
    a: "No upfront lump payment. Payment follows the milestone structure written in your approved scope — commonly 40% advance, 30% at a midpoint milestone and 30% at delivery. Every payment is recorded and receipted, and project status changes only after verification — never on a payment screenshot. Details are in our Payment Policy.",
  },
  {
    q: "What if I want changes after the scope is approved?",
    a: "Scope changes are normal — we just handle them honestly. A change that fits within the approved scope is absorbed. A change that adds new work gets a new written quote and timeline which you approve before the work begins. Silent scope creep — us quietly doing more, or quietly doing less — is what the Client Approval Policy exists to prevent.",
  },
  {
    q: "How many revisions do I get?",
    a: "Two revision rounds within the approved scope are included in every engagement, as written in our Delivery Policy. Revision rounds at the preview stage — before any payment — are free. Revision requests that expand the scope become new quoted work, agreed in writing beforehand.",
  },
  {
    q: "How long does a project take?",
    a: "It follows from the scope, and it is written down before you commit. A focused business website typically runs two to four weeks; a platform or CRM build runs six to twelve weeks depending on integrations. The timeline in your Final Scope of Work is the reference we are accountable to — and it is only promised after discovery, never during a sales pitch.",
  },
  {
    q: "What support do I get after delivery?",
    a: "Delivery includes documentation, credential handover and a post-launch check-in. Beyond that, maintenance and support is available as a structured agreement: monitoring, security patches, backup verification, incident response with defined turnaround and a monthly report. It is optional — the system is fully yours either way.",
  },
  {
    q: "How do you protect my business data and confidentiality?",
    a: "Client data is stored under access control with audit logging, credentials live in encrypted secret management rather than code, and project records are tied to your Client ID with role-based access. Confidential information is never reused or shared, and our Privacy Policy governs what we collect and why. For sensitive engagements, an NDA precedes disclosure.",
  },
  {
    q: "Where do you work? Can you handle clients outside the US?",
    a: "TECH360 LLC is a Missouri-registered company (LC014737249) with an engineering team spanning the USA and Bangladesh. We deliver worldwide — the preview-first, milestone-based process is designed precisely so geography never becomes a trust problem. Current clients and representative patterns are available on request under NDA.",
  },
  {
    q: "How do we start working together?",
    a: "Send one message — through the contact form or a chat with our AI assistant. You receive a Client ID for all future communication, we run discovery on your business, and you get a written scope and then an HTML preview before any payment decision. Starting costs you nothing but the message.",
  },
  {
    q: "What technologies do you build with?",
    a: "We work in a deliberate, boring-in-the-good-way stack: Next.js and TypeScript on the frontend; Node.js, Laravel and Python on the backend; PostgreSQL and MySQL for data; Google Cloud Run, Cloud SQL and Secret Manager for infrastructure; n8n plus the official WhatsApp Cloud API for automation. The full breakdown with reasoning is on our Technologies page.",
  },
  {
    q: "Where will my project be hosted — and who controls it?",
    a: "Your choice, made with our guidance during scoping. Google Cloud suits platforms that need scaling and observability; cPanel or StackCP hosting suits many business sites and Laravel applications. In every case the accounts and billing belong to you, credentials are handed over at completion, and we never hold your system hostage — it is your asset from day one.",
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
      "Design interfaces that convert for client businesses and hold up under enterprise-level scrutiny. Your work is the HTML preview clients approve before payment — the design carries our delivery promise.",
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

export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalDoc {
  slug: string;
  title: string;
  summary: string;
  updated: string;
  sections: LegalSection[];
}

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "terms",
    title: "Terms & Conditions",
    summary:
      "The general terms governing use of this website and the framework under which TECH360 LLC provides services.",
    updated: "January 2026",
    sections: [
      {
        heading: "1. Agreement to these terms",
        body: [
          "These Terms & Conditions (\"Terms\") govern your access to and use of the website bdtech360.com (the \"Site\") operated by TECH360 LLC, a limited liability company registered in Missouri, USA (registration LC014737249, EIN 98-1940053), with its registered address at 117 S Lexington St Ste 100, Harrisonville, MO 64701, USA (\"Tech360\", \"we\", \"us\").",
          "By accessing the Site, submitting a project enquiry, or engaging our services, you agree to these Terms. If you do not agree, you must not use the Site or submit information through it.",
          "These Terms apply together with any written agreement, scope of work, or proposal signed between you and TECH360 LLC for a specific engagement. Where a signed agreement and these Terms conflict, the signed agreement prevails for that engagement.",
        ],
      },
      {
        heading: "2. Our services and how engagements are formed",
        body: [
          "Tech360 provides software design, development, automation and related consulting services, including websites, eCommerce platforms, CRM systems, portals, dashboards, and workflow automation. Descriptions of services on the Site are informational and do not constitute a binding offer.",
          "No engagement exists until both parties have agreed in writing to a Final Scope of Work. Content submitted through the contact form, WhatsApp, or email constitutes an enquiry — not a contract.",
          "Each engagement is governed by: (a) the signed Final Scope of Work; (b) these Terms; (c) our Delivery, Payment, Client Approval, Refund and Source Code Handover Policies; and (d) any written variation agreed by both parties.",
        ],
      },
      {
        heading: "3. Client responsibilities",
        body: [
          "You agree to provide accurate business information, timely feedback on previews and deliverables, and written approvals where our policies require them. Delivery timelines are calculated from the date written approvals and required materials are received.",
          "You confirm you own or are authorised to provide all content, data, trademarks and third-party materials supplied to us for use in a project. You remain responsible for the legality of materials you supply.",
          "Delays caused by pending client input may extend timelines proportionately. We will communicate any such extension in writing.",
        ],
      },
      {
        heading: "4. Intellectual property",
        body: [
          "Upon full payment of an engagement, ownership of the custom source code, design assets and documentation created specifically for your project is transferred to you in accordance with our Source Code Handover Policy.",
          "Tech360 retains ownership of: pre-existing tools, internal frameworks, templates and know-how used to produce your deliverable; and the right to present the engagement as representative work, subject to any confidentiality restriction you have agreed with us in writing.",
          "Third-party components delivered as part of your project (open-source libraries, licensed fonts, third-party services) remain subject to their own licences.",
        ],
      },
      {
        heading: "5. Website content and accuracy",
        body: [
          "We work to keep the Site accurate and current, but content is provided for general information only and may change without notice. Case material presented on the Site is anonymised and representative; references are available on request under NDA.",
          "The Site may include links to third-party services (for example, WhatsApp). We are not responsible for third-party content or availability.",
        ],
      },
      {
        heading: "6. Limitation of liability",
        body: [
          "To the maximum extent permitted by law, TECH360 LLC's total liability arising from or related to an engagement is limited to the total fees actually paid by you for that engagement.",
          "We are not liable for indirect or consequential losses, including lost profits, lost data not covered by agreed backup procedures, or business interruption, except where such limitation is prohibited by law.",
          "Nothing in these Terms excludes liability that cannot lawfully be excluded.",
        ],
      },
      {
        heading: "7. Governing terms and contact",
        body: [
          "These Terms are governed by the laws applicable to contracts formed in the State of Missouri, USA, without regard to conflict-of-law principles. Disputes will first be addressed through good-faith negotiation; unresolved disputes shall be brought in the courts of competent jurisdiction for Cass County, Missouri.",
          "Questions about these Terms: info@bdtech360.com or 117 S Lexington St Ste 100, Harrisonville, MO 64701, USA — or start a chat with our AI assistant from any page.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    summary:
      "What information we collect through this website, why we collect it, how long we keep it, and the choices you have.",
    updated: "January 2026",
    sections: [
      {
        heading: "1. Who we are",
        body: [
          "TECH360 LLC (\"Tech360\", \"we\", \"us\") is a Missouri-registered LLC (LC014737249, EIN 98-1940053), registered address 117 S Lexington St Ste 100, Harrisonville, MO 64701, USA. We operate bdtech360.com and provide software design, development and automation services.",
          "This policy explains how we handle personal information collected through the Site and during client engagements. It applies as written unless a signed agreement states otherwise, in which case the agreement prevails.",
        ],
      },
      {
        heading: "2. Information we collect",
        body: [
          "Information you give us voluntarily: name, business name, business type, email address, WhatsApp number, country, project details and preferences submitted through the contact form; and any information you send us by email or WhatsApp.",
          "Technical information: pages visited, referring page and basic request metadata, collected to operate and secure the Site. Where analytics are enabled, they run under consent controls.",
          "Client engagement records: communications, approvals, payments and delivery records created during a project. These are tied to your client reference ID (TECH-YYYY-NNNNNN) for accuracy and accountability.",
        ],
      },
      {
        heading: "3. Why we process it (purposes and bases)",
        body: [
          "To respond to enquiries and prepare proposals (legitimate interest in prospective business; your consent when you submit the form).",
          "To perform engagements: scope records, approvals, payments, delivery and handover (performance of a contract).",
          "To operate and secure the Site: rate limiting, abuse prevention, error diagnosis (legitimate interest).",
          "To comply with legal, accounting and tax obligations where applicable.",
          "We do not sell personal information. We do not use your project data to train third-party AI services.",
        ],
      },
      {
        heading: "4. Sharing and processors",
        body: [
          "We share information only with service providers necessary to operate our business: hosting (Google Cloud), messaging infrastructure (WhatsApp/Meta, SMTP providers), payment processing (as applicable to your engagement) and professional advisers under confidentiality.",
          "Each provider receives only the information required for its function. Engagement data may be processed in the USA and Bangladesh under our internal access controls and confidentiality rules.",
          "We may disclose information where required by law or to protect our legal rights.",
        ],
      },
      {
        heading: "5. Retention",
        body: [
          "Enquiry information that does not become an engagement is retained for a limited period and then deleted.",
          "Client engagement records (scopes, approvals, payments, delivery evidence) are retained for the period required by accounting, tax and legal obligations, and to honour warranty and handover commitments.",
          "You may request deletion of your enquiry data at any time via info@bdtech360.com, subject to legal retention obligations.",
        ],
      },
      {
        heading: "6. Security",
        body: [
          "Access to personal and client data is role-restricted and logged. Credentials and secrets are stored in encrypted secret management, not in source code. Backups are verified. Communication about sensitive matters is conducted through your preferred verified channel.",
          "No system is perfectly secure; if a breach affecting your information occurs, we will notify affected parties and regulators as required by law.",
        ],
      },
      {
        heading: "7. Your choices and contact",
        body: [
          "You may request access, correction, export or deletion of your personal information, or withdraw consent for optional processing, by writing to info@bdtech360.com. We respond within a reasonable period and may verify identity before acting.",
          "Privacy questions: info@bdtech360.com. Postal: TECH360 LLC, 117 S Lexington St Ste 100, Harrisonville, MO 64701, USA.",
        ],
      },
    ],
  },
  {
    slug: "refund",
    title: "Refund Policy",
    summary:
      "When refunds apply, when advance payments are non-refundable, and how refund windows are defined before work begins.",
    updated: "January 2026",
    sections: [
      {
        heading: "1. Principles",
        body: [
          "Our pricing model is built to prevent the situation refunds exist to fix: you approve a written scope, see an HTML preview of the solution, and only then begin paying. Because risk is structured out of the process before money moves, refund scenarios are rare and clearly defined.",
          "This policy applies as written, supplemented by the payment terms of your signed scope of work, which prevails where it differs.",
        ],
      },
      {
        heading: "2. Before any payment — the free window",
        body: [
          "Everything before your first payment is free and revocable: enquiry, discovery, written scope, and the HTML preview with its revision round. You may walk away at any point in this window with no obligation.",
          "No deposit, booking fee or commitment is required to reach the preview stage.",
        ],
      },
      {
        heading: "3. The advance payment",
        body: [
          "Once you approve the preview and make the advance payment, that payment covers committed work: the team, schedule and resources allocated to your engagement from that moment. For this reason, the advance is non-refundable after scope and preview approval, except as provided in sections 4 and 5.",
          "If you cancel after scope approval but before work has commenced and no resources have been scheduled, we will refund the advance in full. \"Work commenced\" includes team allocation, environment setup, and design or development activity against your scope.",
          "The refund window: a cancellation is treated as pre-commencement only if we have not started any billed activity — you will be able to see from our records whether this applies, and we will tell you honestly which case you are in.",
        ],
      },
      {
        heading: "4. Milestone payments in progress",
        body: [
          "Mid-engagement milestone payments cover work accepted at the previous milestone. Once a milestone is accepted in writing, its payment is not refundable, because it compensates work already delivered and approved.",
          "If we terminate an engagement for reasons within our control (for example, we cannot deliver the scope), all payments covering undelivered work are refunded in full within 14 business days, and all work product produced to date is released to you.",
        ],
      },
      {
        heading: "5. Failure to deliver",
        body: [
          "If we fail to deliver the approved scope materially and cannot remedy the failure within a reasonable agreed period, you are entitled to a refund of payments attributable to the undelivered portion, determined against the milestone structure of your scope.",
          "Remedies operate in order: correction, replacement, then refund. We will not hide behind technicalities where the honest answer is that the work was not delivered.",
        ],
      },
      {
        heading: "6. How to request and processing time",
        body: [
          "Refund requests are made in writing to info@bdtech360.com with your client reference ID (TECH-YYYY-NNNNNN) and the reason for the request. We acknowledge within two business days and issue a written decision with reasoning within five.",
          "Approved refunds are returned through the original payment method within 14 business days of the decision. Currency conversion differences, where the original payment crossed currencies, are not recoverable by us and are excluded from refund amounts.",
        ],
      },
    ],
  },
  {
    slug: "delivery",
    title: "Delivery Policy",
    summary:
      "How engagements are delivered: preview before payment, timeline gates, revision rounds and acceptance procedures.",
    updated: "January 2026",
    sections: [
      {
        heading: "1. The delivery model",
        body: [
          "Every engagement follows the same sequence: written scope — HTML preview — preview approval — payment — milestone build — delivery — handover. The order is deliberate: quality is demonstrated before payment, and payment discipline protects the final handover.",
          "This policy defines what \"delivery\" means, when it has occurred, and how revisions work. Your signed scope of work may add engagement-specific gates, and prevails where it differs.",
        ],
      },
      {
        heading: "2. HTML preview before payment",
        body: [
          "Before the first payment request, we deliver a working HTML preview of the core solution generated from your approved scope. The preview is clickable, reflects the agreed structure, and is sent with a review period stated in writing.",
          "You may approve the preview or request revisions. Revisions requested at preview stage — while the work is within the approved scope — are included at no cost. The preview becomes a permanent reference for the engagement: what is delivered at completion must match what was previewed, as amended by agreed scope changes.",
          "Payment begins only after your written preview approval. This is the first gate of the delivery model.",
        ],
      },
      {
        heading: "3. Timeline gates",
        body: [
          "Timeline commitments are stated in the Final Scope of Work and begin from the later of: scope approval, or receipt of required client materials and access. Each milestone carries its own acceptance date.",
          "The following events are timeline gates that pause or extend the schedule and are communicated in writing: pending client feedback beyond the stated review period; pending client materials, content or credentials; approved scope changes; and third-party dependencies outside our control (for example, payment gateway or API approvals).",
          "We commit to informing you of any gate event within one business day of it arising — not at the deadline.",
        ],
      },
      {
        heading: "4. Revision policy",
        body: [
          "Included with every engagement: two revision rounds within the approved scope. A revision round is a consolidated set of change requests submitted together. Piecemeal requests received separately are grouped into the current round.",
          "Preview-stage revisions (before payment) are free and do not count against the two rounds.",
          "Requests outside the approved scope are not revisions — they are scope changes handled under the Client Approval Policy with a new written quote and timeline before work begins.",
        ],
      },
      {
        heading: "5. Acceptance and what \"delivered\" means",
        body: [
          "Delivery occurs when the solution is deployed or handed over in the manner the scope defines (for example: live on your hosting, or package handover), passes the agreed quality checklist, and you have confirmed delivery in writing.",
          "If you do not respond to a delivery notice within the review period stated in the scope (default: five business days), the delivery is considered accepted unless defects are reported. This prevents indefinite open states, and we will remind you before the period closes.",
          "Defects reported at delivery are fixed at no cost where they reflect non-conformity with the approved scope. This obligation is the warranty for the engagement and continues for 30 days after delivery acceptance.",
        ],
      },
    ],
  },
  {
    slug: "payment",
    title: "Payment Policy",
    summary:
      "Milestone structure, currencies, methods, verification before status changes, and receipts.",
    updated: "January 2026",
    sections: [
      {
        heading: "1. Payment structure",
        body: [
          "Payments follow the milestone structure written in your approved Final Scope of Work. The default structure is: 40% advance (after preview approval), 30% at the defined midpoint milestone, and 30% at delivery. Engagements may vary this structure in writing.",
          "No payment of any kind is requested before your preview approval. There are no booking fees, hidden charges or \"administration costs\" outside the scope.",
        ],
      },
      {
        heading: "2. Currency and pricing",
        body: [
          "Quoted amounts state their currency explicitly — typically USD for international engagements. Where a local-currency quotation is agreed, the currency is stated in the scope and the amount is fixed in that currency.",
          "Price changes never apply retroactively to an approved scope. Any change to pricing requires a new written quotation and your approval.",
        ],
      },
      {
        heading: "3. Accepted methods",
        body: [
          "Bank transfer (details provided with your payment request, referenced to your client ID), card payments via the processing provider named in your payment request where applicable, and local mobile-financial-service methods (such as bKash or Nagad) where agreed for Bangladesh-based engagements.",
          "Each payment request states: the amount, currency, milestone reference, and the client ID to include in the transfer reference. Payments without a reference take longer to verify — we will help you fix the reference if a transfer is already sent.",
        ],
      },
      {
        heading: "4. Verification before status change",
        body: [
          "Project status changes only after a payment is verified — meaning the funds are confirmed as received, not merely claimed. Screenshots and message confirmations are appreciated for speed but do not by themselves change project status.",
          "Verification is completed within one business day of funds appearing in our account. When a payment is pending verification, the engagement continues normally; verification affects status records, not work goodwill.",
          "If funds do not arrive or a discrepancy exists, we raise it with you immediately and resolve it before proceeding — no silent holds.",
        ],
      },
      {
        heading: "5. Receipts, records and taxes",
        body: [
          "Every verified payment is receipted in the client record, tied to your client ID, and a receipt copy is provided to you in writing. Milestone and payment history for your engagement is available to you at any time on request.",
          "Quoted amounts are exclusive of taxes unless stated. Tax treatment (including any withholding applicable to cross-border payments) follows the laws of the relevant jurisdiction; we provide necessary documentation (W-8/W-9 equivalents or local certificates) on request.",
        ],
      },
      {
        heading: "6. Late, partial and failed payments",
        body: [
          "If a milestone payment is delayed, work pauses at the next milestone boundary rather than degrading silently — you keep everything already delivered and accepted, and the timeline is extended by the delay. We communicate a pause before it happens, in writing.",
          "Partially received amounts are applied to the engagement once cleared and documented; the remaining balance is stated with an updated receipt. Returned or reversed transfers are raised with you the day we learn of them, with the bank evidence attached, and resolved case by case in writing.",
          "Persistent non-payment after delivery does not result in hidden penalties — it simply gates source-code handover and support under the Source Code Handover Policy, and where necessary the engagement is escalated through ordinary, lawful channels.",
        ],
      },
    ],
  },
  {
    slug: "client-approval",
    title: "Client Approval Policy",
    summary:
      "Written approval gates, what approval commits, and how scope changes are handled without silent drift.",
    updated: "January 2026",
    sections: [
      {
        heading: "1. Why approvals are written",
        body: [
          "Every consequential step in an engagement is approved in writing: the Final Scope of Work, the HTML preview, each milestone acceptance, delivery, and the handover confirmation. Written approvals protect both parties — the record answers any later question about what was agreed and when.",
          "Written means: an explicit reply (email, WhatsApp message, portal action) that states approval. Silence is not approval; where a review period closes without response, the Delivery Policy's acceptance rules apply instead.",
        ],
      },
      {
        heading: "2. The approval gates",
        body: [
          "Gate one — Scope approval: the Final Scope of Work (deliverables, timeline, milestones, payment terms) is approved in writing. Work, previews and payment requests all begin after this gate.",
          "Gate two — Preview approval: the HTML preview is approved or revised in writing. Payment begins only after approval.",
          "Gate three — Milestone acceptance: each milestone is accepted in writing before the next proceeds. Acceptance confirms the milestone conforms to the approved scope.",
          "Gate four — Delivery confirmation: you confirm in writing that the delivered solution passes the agreed checklist.",
          "Gate five — Handover confirmation: after full payment and handover, you confirm that passwords have been changed and access is complete.",
        ],
      },
      {
        heading: "3. What approval commits",
        body: [
          "Approving a scope, preview or milestone confirms that the item conforms to the agreed requirements and authorises the next phase — including the payment milestone attached to it, per the Payment Policy.",
          "Approval is not a waiver of defects. Non-conformity with the approved scope discovered later is remedied under the Delivery Policy warranty even after acceptance.",
        ],
      },
      {
        heading: "4. Scope changes",
        body: [
          "A scope change is any addition, removal or material alteration to the agreed deliverables or requirements. Scope changes are normal — mishandled scope changes are not.",
          "Every scope change follows the same path: request documented — impact assessment (cost, timeline, technical) — written quotation — your written approval — scope document amended and re-versioned. Work on a change never begins before its approval.",
          "We do not absorb changes silently into \"goodwill\", and we do not let clients' changes proceed informally. The amendment quote states exactly what changes and what it costs, so your budget never drifts without your signature.",
        ],
      },
      {
        heading: "5. Disagreements",
        body: [
          "If a disagreement arises about whether delivered work conforms to the scope, the comparison is objective: the approved scope document, the approved preview, and the delivery checklist. We provide the full record to you on request.",
          "Where genuine ambiguity exists in the written scope, we resolve it toward the interpretation that a reasonable client would have understood at approval time — and we amend the scope text so it never recurs.",
        ],
      },
    ],
  },
  {
    slug: "source-code-handover",
    title: "Source Code Handover Policy",
    summary:
      "When and how the full source code, credentials and documentation are transferred to you — and the final payment gate.",
    updated: "January 2026",
    sections: [
      {
        heading: "1. The principle",
        body: [
          "You own what you pay for. The complete source code, build assets and documentation for your engagement are handed over to you after final payment is verified. Before that gate, work-in-progress is available for your review at preview and milestone stages — you are never asked to pay for a black box.",
          "This policy exists to protect both parties: clients cannot lose code they have fully paid for, and no code is released before the engagement's payment terms are complete.",
        ],
      },
      {
        heading: "2. What is handed over",
        body: [
          "The handover package contains: the full source repository (application code, configuration templates, database schema and migrations); build and deployment documentation written so any competent developer can rebuild and deploy the system; environment variable inventory with credential names (values supplied separately); third-party dependency list with versions and licences; and the handover record itself.",
          "For engagements on our managed hosting, the handover additionally includes: infrastructure configuration description, backup snapshot, and the steps (or our assistance) to migrate to your own hosting if you choose.",
        ],
      },
      {
        heading: "3. Credentials handover",
        body: [
          "Account credentials for systems we created or managed on your behalf — hosting accounts, databases, service dashboards, API keys — are delivered through a secure channel, never plaintext email.",
          "Where the account belongs to a third-party provider (domain registrar, payment gateway, cloud platform), we assist you in taking or confirming ownership of that account directly with the provider.",
          "All credentials are transferred with their current state documented: what each credential accesses, its scope and its rotation guidance.",
        ],
      },
      {
        heading: "4. Password change confirmation",
        body: [
          "Within a reasonable period after receiving credentials (we suggest 72 hours), you change every handed-over password. You then confirm in writing that the changes are complete — this is the handover's final acknowledgement.",
          "Why we ask: it is the only point at which access control becomes fully and provably yours. Until you have rotated the credentials, shared access technically persists; after rotation, the system is exclusively under your control, and our support access going forward exists only if you grant it explicitly.",
        ],
      },
      {
        heading: "5. After handover",
        body: [
          "Ownership of the custom code transfers to you on handover. We retain the right to present the engagement as representative work (anonymised) unless you have agreed otherwise in writing.",
          "Maintenance and support after handover is optional and available under a separate agreement; the handover itself is complete, final and independent of any future support relationship. Your documentation stands on its own — that is the standard we hold it to.",
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Stats (honest, qualitative — no fabricated counters)                */
/* ------------------------------------------------------------------ */

export const STATS: { value: string; label: string; note: string }[] = [
  {
    value: "US LLC",
    label: "EIN registered",
    note: "TECH360 LLC · Missouri LC014737249 · EIN 98-1940053 — on-record operations, verifiable.",
  },
  {
    value: "110",
    label: "internal departments",
    note: "A structured delivery organisation — 110 departments are defined in the platform's department registry and seeded into its database; every engagement runs through accountable departments, not one inbox.",
  },
  {
    value: "20",
    label: "automated workflow stages",
    note: "From first message to handover, every stage is tracked, logged and auditable end-to-end.",
  },
  {
    value: "50s → 60 min",
    label: "cinematic video pipeline",
    note: "In-house production capability — from storyboard to finished film in a single working session.",
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

export const CONTACT_METHODS: string[] = ["WhatsApp", "Email", "Phone"];

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
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
  "HTML Preview Before Payment",
  "Source Code After Full Payment",
  "100% On-Record Delivery",
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
