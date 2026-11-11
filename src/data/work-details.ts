/**
 * Project detail specifications.
 *
 * HONESTY CONTRACT
 * ----------------
 * These are *system specifications* for showcase projects, not delivered
 * engagements. Every page renders `PROJECT_DETAIL_NOTICE` and the
 * `CONCEPT` maturity badge. Sections describe what the system is designed to
 * do and how it would be built — never measured results, client names, or
 * claims that a demo or deployment exists.
 *
 * A detail entry must never state a metric outcome. Acceptance-style wording
 * ("is designed to", "records", "blocks") is required; result wording
 * ("increased", "reduced by N%") is not permitted. `tests/work-details.test.ts`
 * enforces this.
 */

import { WORK_EXAMPLES } from "./work-examples";

export const PROJECT_DETAIL_NOTICE =
  "Concept specification: this page documents a system TECH360 can build. It is not a delivered client project, a verified case study, a working demonstration or a measured outcome.";

/** Phrases that would turn a specification into an unverifiable claim. */
export const FORBIDDEN_CLAIM_PATTERNS: readonly RegExp[] = [
  /\b(increased|decreased|boosted|reduced)\b[^.]*\b\d+\s?%/i,
  /\b\d+\s?%\s+(more|fewer|faster|higher|lower)\b/i,
  /\bcase study\b/i,
  /\bverified results?\b/i,
  /\bguarantee[ds]?\b/i,
  /\b(award[- ]winning|market[- ]leading)\b/i,
];

export interface ProjectJourneyStep {
  title: string;
  description: string;
}

export interface ProjectDetail {
  /** Must match a `WORK_EXAMPLES[].slug`. */
  slug: string;
  /** Who the system is for. */
  users: string[];
  /** Problems the system is designed to remove. */
  problem: string[];
  /** Objectives, stated as design intent rather than achieved outcomes. */
  objectives: string[];
  /** Supported platforms for the intended build. */
  platforms: { name: string; detail: string }[];
  /** End-to-end journey through the system. */
  journey: ProjectJourneyStep[];
  /** Roles and the access boundary each role is designed to hold. */
  roles: { role: string; access: string }[];
  /** Core data entities and how they relate. */
  dataEntities: { entity: string; relation: string }[];
  /** API surface the build would expose. */
  apiSurface: { endpoint: string; purpose: string }[];
  /** Integration points, all provider-dependent. */
  integrations: string[];
  /** AI and automation opportunities with their human gate. */
  ai: { opportunity: string; gate: string }[];
  security: string[];
  quality: string[];
  deployment: string[];
  maintenance: string[];
  advanced: string[];
  /** Related industry blueprint slug, when one exists. */
  industrySlug?: string;
  /** Related service slugs from the published service catalogue. */
  relatedServices: string[];
}

const DETAILS: ProjectDetail[] = [
  {
    slug: "ecommerce-storefront",
    users: ["Shoppers on mobile and desktop", "Order operations staff", "Catalogue managers"],
    problem: [
      "Orders arrive in inbox conversations and are re-typed into a spreadsheet.",
      "Payment confirmation and delivery status are tracked by hand.",
      "Product content is duplicated across channels and drifts out of date.",
    ],
    objectives: [
      "Hold one catalogue with variants, stock and pricing as the source of truth.",
      "Make every order traceable from cart to delivery against a customer record.",
      "Record payment and fulfilment events automatically instead of transcribing them.",
    ],
    platforms: [
      { name: "Responsive web storefront", detail: "Server-rendered pages, accessible checkout, no forced account creation." },
      { name: "Operations console", detail: "Order queue, stock view and fulfilment actions for staff." },
      { name: "Customer account", detail: "Order history and status for signed-in customers." },
    ],
    journey: [
      { title: "Discover", description: "Shopper browses a filtered catalogue and reads a product page with variants and stock state." },
      { title: "Checkout", description: "Cart, delivery option and payment are captured with validation and an explicit confirmation step." },
      { title: "Operate", description: "The order lands in the operations queue with payment status and a fulfilment checklist." },
      { title: "Fulfil and inform", description: "Dispatch records a tracking reference; status changes notify the customer." },
    ],
    roles: [
      { role: "Customer", access: "Own orders and profile only." },
      { role: "Operations staff", access: "Order queue and fulfilment actions; no pricing edits." },
      { role: "Catalogue manager", access: "Products, variants, stock and discounts; no payment data." },
    ],
    dataEntities: [
      { entity: "Product", relation: "Has many variants; belongs to one category." },
      { entity: "Order", relation: "Belongs to one customer; has many order lines and payments." },
      { entity: "Payment", relation: "Belongs to one order; carries provider reference and status." },
      { entity: "Fulfilment", relation: "Belongs to one order; carries carrier reference and event history." },
    ],
    apiSurface: [
      { endpoint: "POST /api/orders", purpose: "Create an order with validated lines, priced server-side." },
      { endpoint: "POST /api/webhooks/payment", purpose: "Receive provider payment events with signature verification." },
      { endpoint: "GET /api/orders/:id", purpose: "Order status for the owning customer or staff role." },
    ],
    integrations: ["Payment gateway adapter", "Courier or fulfilment API", "Email or SMS notifications", "Accounting export"],
    ai: [
      { opportunity: "Draft product descriptions from structured attributes.", gate: "Catalogue manager approves every published description." },
      { opportunity: "Suggest replies to delivery-status enquiries.", gate: "Support staff send; the agent cannot message customers directly." },
    ],
    security: [
      "Prices are always computed server-side; client input is never trusted.",
      "Payment webhooks require signature verification and idempotency keys.",
      "Customer order access is scoped to the authenticated identity.",
    ],
    quality: [
      "Checkout tested for validation, tax-free totals and provider failure paths.",
      "Webhook replay tested for idempotency.",
      "Keyboard and screen-reader pass on catalogue, cart and checkout.",
    ],
    deployment: ["Containerised Next.js application", "Managed database with daily backups", "Environment secrets held outside the repository"],
    maintenance: ["Catalogue and order data grow without schema change", "Provider adapters are isolated so a gateway can be swapped", "Structured logs for order and webhook failures"],
    advanced: ["Multi-warehouse stock allocation", "Subscription and repeat-order flows", "Returns and exchange workflow"],
    industrySlug: "ecommerce",
    relatedServices: ["premium-business-websites", "ecommerce-platforms", "ai-business-automation"],
  },
  {
    slug: "education-crm",
    users: ["Admissions counsellors", "Institution management", "Prospective students and guardians"],
    problem: [
      "Enquiries arrive from several channels and none share a queue.",
      "Follow-up depends on individual memory rather than an assigned owner.",
      "Management cannot see source, stage or response time from first-party data.",
    ],
    objectives: [
      "Give every enquiry one identity regardless of entry channel.",
      "Assign each enquiry a named counsellor and a due date.",
      "Report funnel stage and response timing from recorded events.",
    ],
    platforms: [
      { name: "Counsellor workspace", detail: "Queue, record view and follow-up scheduling." },
      { name: "Management reporting", detail: "Read-only funnel and source breakdown." },
      { name: "Public enquiry form", detail: "Accessible capture form with consent and validation." },
    ],
    journey: [
      { title: "Capture", description: "An enquiry arrives from the website, phone note or messaging channel and is normalised into one record." },
      { title: "Assign", description: "Routing rules give the enquiry a counsellor and a first-response due date." },
      { title: "Follow up", description: "The counsellor logs each contact attempt; reminders fire on the agreed cadence." },
      { title: "Convert or close", description: "The enquiry moves to enrolled or closed with a recorded reason." },
    ],
    roles: [
      { role: "Counsellor", access: "Own assigned enquiries and their communication log." },
      { role: "Admissions lead", access: "All enquiries, routing rules and reassignment." },
      { role: "Management", access: "Aggregate reporting; no personal contact editing." },
    ],
    dataEntities: [
      { entity: "Enquiry", relation: "Has many contact attempts; belongs to one counsellor." },
      { entity: "Person", relation: "One student or guardian; may have many enquiries." },
      { entity: "Batch", relation: "Has capacity; enrolments reference it." },
      { entity: "ContactAttempt", relation: "Belongs to one enquiry; records channel, time and outcome." },
    ],
    apiSurface: [
      { endpoint: "POST /api/enquiries", purpose: "Capture a normalised enquiry with consent metadata." },
      { endpoint: "PATCH /api/enquiries/:id/stage", purpose: "Move stage with an audited actor and reason." },
      { endpoint: "GET /api/reports/funnel", purpose: "Stage and source counts for permitted roles." },
    ],
    integrations: ["Website form", "Email", "Messaging provider", "CSV export"],
    ai: [
      { opportunity: "Classify enquiry intent and language to route it to the right counsellor.", gate: "Admissions lead reviews routing rules; misroutes are reassignable." },
      { opportunity: "Draft a first reply from approved templates.", gate: "Counsellor sends every message; drafts are never auto-sent." },
    ],
    security: [
      "Guardian and student contact data is visible only to assigned roles.",
      "Every stage change records actor, timestamp and reason.",
      "Exports are limited to permitted roles and logged.",
    ],
    quality: [
      "Routing rules covered by table-driven tests.",
      "Duplicate-enquiry merging tested against identity collisions.",
      "Form validated for missing, malformed and duplicate submissions.",
    ],
    deployment: ["Containerised application", "Managed relational database", "Nightly backup with restore drill"],
    maintenance: ["Routing rules are configuration, not code", "Reporting queries are indexed for growing enquiry volume", "Retention policy per institution"],
    advanced: ["Guardian portal for application status", "Automated document checklist", "Multi-campus reporting"],
    industrySlug: "education",
    relatedServices: ["custom-crm-development", "ai-business-automation", "premium-business-websites"],
  },
  {
    slug: "school-erp",
    users: ["School office", "Teachers", "Management", "Guardians"],
    problem: [
      "Attendance, timetabling and fees sit in separate spreadsheets owned by different staff.",
      "Fee balances are calculated manually and chased informally.",
      "Guardians have no reliable channel for absence or dues notices.",
    ],
    objectives: [
      "Maintain one institutional record for students, guardians and staff.",
      "Issue fee invoices with receipts and an accurate outstanding balance.",
      "Notify guardians on configured events without manual transcription.",
    ],
    platforms: [
      { name: "Office console", detail: "Admissions, records, fees and reporting." },
      { name: "Teacher workspace", detail: "Attendance and marks for assigned classes only." },
      { name: "Guardian portal", detail: "Attendance, dues and notices for own children." },
    ],
    journey: [
      { title: "Enrol", description: "A student record is created with class, section and guardian links." },
      { title: "Attend", description: "Teachers mark attendance; absences trigger the configured notice." },
      { title: "Bill", description: "The office issues a fee invoice; payment records a receipt and updates the balance." },
      { title: "Report", description: "Management reads attendance, collection and outstanding summaries." },
    ],
    roles: [
      { role: "Teacher", access: "Assigned classes only; attendance and marks." },
      { role: "Office staff", access: "Student records, fees and receipts." },
      { role: "Guardian", access: "Own children's attendance, dues and notices." },
      { role: "Management", access: "Aggregate reporting and configuration." },
    ],
    dataEntities: [
      { entity: "Student", relation: "Belongs to a class and section; has guardians." },
      { entity: "AttendanceRecord", relation: "Belongs to one student and one date." },
      { entity: "FeeInvoice", relation: "Belongs to one student; has payments and a balance." },
      { entity: "Notice", relation: "Targets a guardian or cohort; records delivery state." },
    ],
    apiSurface: [
      { endpoint: "POST /api/attendance", purpose: "Record attendance for a class and date." },
      { endpoint: "POST /api/fees/invoices", purpose: "Issue an invoice with a computed schedule." },
      { endpoint: "GET /api/guardian/summary", purpose: "Own-children attendance and dues." },
    ],
    integrations: ["SMS gateway", "Email", "Local payment methods", "Accounting export"],
    ai: [
      { opportunity: "Summarise a term's attendance pattern for a class.", gate: "Teacher or office reviews before anything is sent to a guardian." },
      { opportunity: "Draft fee reminders in the institution's tone.", gate: "Office approves the batch before dispatch." },
    ],
    security: [
      "Guardians can only read their own children's records.",
      "Fee changes require an authorised role and are audited.",
      "Staff access is scoped by class assignment.",
    ],
    quality: [
      "Attendance rules tested including holidays and half-days.",
      "Fee arithmetic tested against schedule variants.",
      "Role matrix tested for cross-family access attempts.",
    ],
    deployment: ["Containerised deployment", "Managed database with point-in-time recovery", "Scheduled report export"],
    maintenance: ["Academic-year rollover is a supported operation", "Fee schedules are versioned", "Enrolment growth handled by indexed queries"],
    advanced: ["Timetable generator", "Result publishing with moderation", "Transport and hostel modules"],
    industrySlug: "schools-training",
    relatedServices: ["database-systems", "custom-crm-development", "client-portals"],
  },
  {
    slug: "clinic-system",
    users: ["Front desk", "Physicians", "Nursing staff", "Patients"],
    problem: [
      "Appointment reminders depend on calling patients between other duties.",
      "Visit history and documents are split across paper and shared folders.",
      "Record access is not consistently logged, so an audit is manual.",
    ],
    objectives: [
      "Schedule appointments per doctor, room and slot length.",
      "Keep visit history and documents on one patient timeline.",
      "Log every record access and configured reminder.",
    ],
    platforms: [
      { name: "Front-desk console", detail: "Scheduling, check-in and queue." },
      { name: "Clinician workspace", detail: "Patient timeline, consultation notes and attachments." },
      { name: "Patient channel", detail: "Booking and reminder confirmations." },
    ],
    journey: [
      { title: "Book", description: "A patient or the desk books a slot against a doctor and room." },
      { title: "Check in", description: "Arrival moves the appointment into the queue with a timestamp." },
      { title: "Consult", description: "The clinician records notes and attaches documents to the timeline." },
      { title: "Follow up", description: "Configured reminders and follow-up appointments are created." },
    ],
    roles: [
      { role: "Front desk", access: "Scheduling and demographics; no clinical notes." },
      { role: "Physician", access: "Own patients' clinical records." },
      { role: "Nursing", access: "Assigned patients; vitals and tasks." },
      { role: "Administrator", access: "Configuration and audit views." },
    ],
    dataEntities: [
      { entity: "Patient", relation: "Has many appointments and one timeline." },
      { entity: "Appointment", relation: "Belongs to a patient, doctor and room." },
      { entity: "VisitNote", relation: "Belongs to one appointment; authored by one clinician." },
      { entity: "AccessLog", relation: "Records actor, patient and timestamp for each read." },
    ],
    apiSurface: [
      { endpoint: "POST /api/appointments", purpose: "Book a slot with conflict detection." },
      { endpoint: "GET /api/patients/:id/timeline", purpose: "Permission-checked timeline read, logged." },
      { endpoint: "POST /api/reminders", purpose: "Queue a reminder through the configured provider." },
    ],
    integrations: ["SMS or messaging reminders", "Email", "Secure file storage", "Payment collection"],
    ai: [
      { opportunity: "Draft a visit summary from the clinician's own notes.", gate: "Clinician reviews and signs; nothing enters the record unreviewed." },
      { opportunity: "Predict no-show risk to prioritise confirmation calls.", gate: "Front desk decides who is called; no automatic cancellation." },
    ],
    security: [
      "Health data access is role-scoped and logged per read.",
      "Documents are served through authorised endpoints, never public URLs.",
      "Session and device policy is configurable per practice.",
    ],
    quality: [
      "Scheduling conflict detection tested across time zones and edge slots.",
      "Access-control tests for every role and record type.",
      "Restore drill for clinical documents.",
    ],
    deployment: ["Regional hosting chosen with the practice", "Encrypted database and object storage", "Backup with tested restore"],
    maintenance: ["Retention configuration per record type", "Provider adapters for reminders isolated", "Schema versioned for clinical extensions"],
    advanced: ["Lab result ingestion", "Multi-branch scheduling", "Patient portal with self-service rescheduling"],
    industrySlug: "healthcare",
    relatedServices: ["custom-software-development", "custom-crm-development", "maintenance-support"],
  },
  {
    slug: "real-estate-crm",
    users: ["Sales agents", "Site teams", "Finance staff", "Buyers"],
    problem: [
      "Buyer interest, site visits and instalments are tracked in different places.",
      "Booking confirmations depend on a single agent's availability.",
      "Instalment status is reconciled manually against bank records.",
    ],
    objectives: [
      "Keep one buyer record covering interest, visits, booking and instalments.",
      "Record each site visit and its outcome against the property.",
      "Track instalment schedules with verified payment references.",
    ],
    platforms: [
      { name: "Agent workspace", detail: "Pipeline, buyer timeline and follow-ups." },
      { name: "Finance view", detail: "Instalment schedules and verification queue." },
      { name: "Buyer portal", detail: "Own booking, schedule and receipts." },
    ],
    journey: [
      { title: "Enquire", description: "Interest is captured against a specific unit and source." },
      { title: "Visit", description: "A site visit is scheduled and its outcome recorded." },
      { title: "Book", description: "A booking creates a payment schedule and reserves the unit." },
      { title: "Collect", description: "Instalment payments are verified and receipts issued." },
    ],
    roles: [
      { role: "Agent", access: "Own leads, visits and bookings." },
      { role: "Finance", access: "Schedules, verification and receipts." },
      { role: "Buyer", access: "Own unit, schedule and receipts." },
    ],
    dataEntities: [
      { entity: "Property", relation: "Has many units; a unit has one current booking." },
      { entity: "Buyer", relation: "Has many interactions and one active booking." },
      { entity: "SiteVisit", relation: "Belongs to a buyer and a property." },
      { entity: "Instalment", relation: "Belongs to a booking; carries verification state." },
    ],
    apiSurface: [
      { endpoint: "POST /api/bookings", purpose: "Reserve a unit and generate a schedule." },
      { endpoint: "POST /api/instalments/:id/verify", purpose: "Record verified payment with a reference." },
      { endpoint: "GET /api/buyer/schedule", purpose: "Own schedule and receipt list." },
    ],
    integrations: ["Payment verification feed", "SMS or messaging", "Document storage", "Accounting export"],
    ai: [
      { opportunity: "Rank enquiries by stated budget and timeline fit.", gate: "Agent decides contact order; rankings are advisory." },
      { opportunity: "Draft instalment reminders.", gate: "Finance approves the batch before sending." },
    ],
    security: [
      "Buyers see only their own unit and schedule.",
      "Payment verification requires a finance role and an evidence reference.",
      "Unit reservations are transactional to prevent double booking.",
    ],
    quality: [
      "Concurrency test for unit reservation.",
      "Schedule arithmetic tested against partial payments.",
      "Cross-buyer access tests.",
    ],
    deployment: ["Containerised application", "Managed database", "Scheduled reconciliation reports"],
    maintenance: ["Project and unit structures are configuration", "Verification queue scales independently", "Audit export for finance"],
    advanced: ["Document e-signature", "Construction-milestone linking", "Agent commission calculation"],
    industrySlug: "real-estate",
    relatedServices: ["custom-crm-development", "client-portals", "ai-business-automation"],
  },
  {
    slug: "agency-portal",
    users: ["Agency account managers", "Client stakeholders", "Finance"],
    problem: [
      "Approvals happen in email threads nobody can search.",
      "Deliverables and assets are scattered across drives.",
      "Invoices and their status are discussed separately from the work.",
    ],
    objectives: [
      "Give each client a scoped space containing their projects and approvals.",
      "Record approvals against a named client identity.",
      "Expose invoices and their status without emailing documents.",
    ],
    platforms: [
      { name: "Client portal", detail: "White-labelled space per client." },
      { name: "Agency console", detail: "Projects, approvals queue and billing." },
      { name: "Mobile view", detail: "Read-and-approve experience for stakeholders." },
    ],
    journey: [
      { title: "Invite", description: "A client user is invited and scoped to one organisation." },
      { title: "Review", description: "The client reads a deliverable and leaves feedback." },
      { title: "Approve", description: "Approval is recorded with identity, timestamp and the exact version." },
      { title: "Bill", description: "Approved work links to an invoice the client can view and settle." },
    ],
    roles: [
      { role: "Client viewer", access: "Own organisation's projects and documents." },
      { role: "Client approver", access: "Approval actions for own organisation." },
      { role: "Account manager", access: "Assigned client organisations." },
      { role: "Finance", access: "Invoices and payment status." },
    ],
    dataEntities: [
      { entity: "Organisation", relation: "Has many users and projects." },
      { entity: "Project", relation: "Belongs to one organisation." },
      { entity: "Approval", relation: "References one document version and one user." },
      { entity: "Invoice", relation: "Belongs to a project; carries payment state." },
    ],
    apiSurface: [
      { endpoint: "POST /api/approvals", purpose: "Record an approval tied to a document version." },
      { endpoint: "GET /api/client/projects", purpose: "Projects scoped to the caller's organisation." },
      { endpoint: "GET /api/invoices/:id", purpose: "Signed document access for permitted roles." },
    ],
    integrations: ["Object storage", "Email invitations", "Payment collection", "E-signature"],
    ai: [
      { opportunity: "Summarise feedback threads into a change list.", gate: "Account manager confirms the list before it becomes tasks." },
      { opportunity: "Draft project status updates from logged activity.", gate: "Account manager edits and sends." },
    ],
    security: [
      "Tenant isolation is enforced server-side on every request.",
      "Invitations expire and are single-use.",
      "Document downloads are authorised and logged.",
    ],
    quality: [
      "Cross-tenant access tests for every endpoint.",
      "Invitation replay and expiry tests.",
      "Approval version-binding tests.",
    ],
    deployment: ["Containerised application", "Object storage with signed URLs", "Audit log retained per policy"],
    maintenance: ["Branding is configuration", "Storage lifecycle rules", "Approval records are immutable"],
    advanced: ["Per-client custom domains", "SSO for enterprise clients", "Statement of work e-signature"],
    industrySlug: "agencies",
    relatedServices: ["client-portals", "custom-crm-development", "premium-business-websites"],
  },
  {
    slug: "ai-automation",
    users: ["Operations teams", "Approvers", "Platform administrators"],
    problem: [
      "Repetitive triage work consumes staff time and is done inconsistently.",
      "Automations that touch customers have no approval trail.",
      "Model output is trusted without a recorded human decision.",
    ],
    objectives: [
      "Route work items to a governed agent with a bounded toolset.",
      "Require a named human approval before any external action.",
      "Record every agent run, tool call and decision for audit.",
    ],
    platforms: [
      { name: "Operator console", detail: "Run queue, approvals and cost view." },
      { name: "Workflow service", detail: "Deterministic steps around model calls." },
      { name: "Audit viewer", detail: "Run history with inputs, outputs and approvals." },
    ],
    journey: [
      { title: "Intake", description: "A work item is created with its data class and required approvals." },
      { title: "Propose", description: "The agent produces a structured proposal with cited inputs." },
      { title: "Approve", description: "A human approves, edits or rejects; the decision is recorded." },
      { title: "Act", description: "Only an approved action executes, with a rollback note." },
    ],
    roles: [
      { role: "Operator", access: "Run queue and proposals." },
      { role: "Approver", access: "Decide proposals within a value threshold." },
      { role: "Administrator", access: "Agent configuration and budgets." },
    ],
    dataEntities: [
      { entity: "AgentDefinition", relation: "Declares tools, autonomy level and owner." },
      { entity: "Run", relation: "Belongs to one agent; records inputs and outputs." },
      { entity: "ToolCall", relation: "Belongs to one run; records request and result." },
      { entity: "Decision", relation: "Belongs to one run; records approver and outcome." },
    ],
    apiSurface: [
      { endpoint: "POST /api/runs", purpose: "Create a run with an explicit data class." },
      { endpoint: "POST /api/runs/:id/decision", purpose: "Record a human decision with reason." },
      { endpoint: "GET /api/runs/:id/audit", purpose: "Full run history for permitted roles." },
    ],
    integrations: ["Model provider gateway", "Internal APIs as scoped tools", "Notification channels", "Cost telemetry"],
    ai: [
      { opportunity: "Triage and classify inbound work items.", gate: "Operator confirms classification before routing takes effect." },
      { opportunity: "Draft structured replies for review.", gate: "Approver sends; the agent cannot send externally." },
    ],
    security: [
      "Agents receive least-privilege tools per definition.",
      "Prompt and completion content is redacted before logging.",
      "Budgets and rate limits are enforced per agent.",
    ],
    quality: [
      "Deterministic workflow tests with a stubbed model.",
      "Approval-gate tests proving an unapproved action cannot execute.",
      "Prompt-injection regression cases.",
    ],
    deployment: ["Queue-backed worker deployment", "Secrets in a managed secret store", "Cost and error dashboards"],
    maintenance: ["Model versions are pinned and upgradeable", "Run retention policy", "Rollback runbook per action type"],
    advanced: ["Multi-agent hand-off with explicit state", "Evaluation harness for prompt changes", "Per-tenant budgets"],
    relatedServices: ["ai-agent-systems", "ai-business-automation", "custom-software-development"],
  },
  {
    slug: "whatsapp-sales-funnel",
    users: ["Sales agents", "Sales managers", "Inbound enquirers"],
    problem: [
      "First messages are answered inconsistently and outside working hours.",
      "Conversations live on individual phones, so the business cannot see pipeline.",
      "Nobody can say which source produced a qualified lead.",
    ],
    objectives: [
      "Capture every first message into one pipeline with a source.",
      "Qualify with a short structured exchange, not free-form sales chat.",
      "Give managers visibility of response time and stage per lead.",
    ],
    platforms: [
      { name: "Agent inbox", detail: "Assigned conversations with templates and next actions." },
      { name: "Manager view", detail: "Pipeline, response time and source reporting." },
      { name: "Automated first response", detail: "Template-based acknowledgement, clearly disclosed." },
    ],
    journey: [
      { title: "Message", description: "An enquiry arrives and is attached to a lead with its source." },
      { title: "Qualify", description: "Structured questions collect intent, budget range and timeline." },
      { title: "Assign", description: "A qualified lead is assigned to an agent with a due date." },
      { title: "Advance", description: "Stages change with a recorded reason until won or lost." },
    ],
    roles: [
      { role: "Agent", access: "Assigned conversations only." },
      { role: "Manager", access: "All conversations, routing and reporting." },
      { role: "Administrator", access: "Provider configuration and templates." },
    ],
    dataEntities: [
      { entity: "Lead", relation: "Has many messages; carries source and stage." },
      { entity: "Conversation", relation: "Belongs to one lead and one channel identity." },
      { entity: "Message", relation: "Belongs to one conversation; records direction and template." },
      { entity: "StageChange", relation: "Belongs to one lead; records actor and reason." },
    ],
    apiSurface: [
      { endpoint: "POST /api/webhooks/whatsapp", purpose: "Verified inbound message ingestion." },
      { endpoint: "POST /api/messages", purpose: "Send an approved template or session message." },
      { endpoint: "GET /api/leads/pipeline", purpose: "Scoped pipeline read for sales roles." },
    ],
    integrations: ["WhatsApp Business platform", "CRM records", "Email", "Analytics export"],
    ai: [
      { opportunity: "Suggest a reply from approved snippets.", gate: "Agent sends every message; suggestions are drafts." },
      { opportunity: "Score lead intent from the conversation.", gate: "Manager reviews scoring rules; score never contacts the lead." },
    ],
    security: [
      "Webhook payloads are signature-verified before processing.",
      "Conversation data is visible only to assigned roles.",
      "Opt-out and consent state is honoured across channels.",
    ],
    quality: [
      "Webhook verification and replay tests.",
      "Template approval-state tests.",
      "Opt-out propagation tests.",
    ],
    deployment: ["Containerised web service", "Queue for outbound sends", "Opt-out and consent store"],
    maintenance: ["Templates are configuration", "Provider adapter isolated", "Message retention per policy"],
    advanced: ["Multilingual qualification flows", "Round-robin assignment with capacity", "Click-to-call logging"],
    industrySlug: "professional-services",
    relatedServices: ["whatsapp-ai-sales-crm", "custom-crm-development", "ai-business-automation"],
  },
  {
    slug: "social-automation",
    users: ["Content planners", "Designers", "Approvers", "Analysts"],
    problem: [
      "Content is planned in one tool, approved in another and published manually.",
      "Asset versions and captions drift apart before publishing.",
      "Performance is reviewed in screenshots rather than first-party data.",
    ],
    objectives: [
      "Plan content on one calendar with owners and states.",
      "Require approval of caption and asset as one unit.",
      "Publish through the platform API and record the result.",
    ],
    platforms: [
      { name: "Planner calendar", detail: "Month and week views with channel slots." },
      { name: "Review queue", detail: "Caption and asset versioned together." },
      { name: "Reporting view", detail: "Scheduled versus published versus failed." },
    ],
    journey: [
      { title: "Plan", description: "A slot is created with owner, channel and objective." },
      { title: "Create", description: "Caption and asset versions are attached to the slot." },
      { title: "Approve", description: "An approver signs off the exact version pair." },
      { title: "Publish", description: "The approved pair is published and the provider reference stored." },
    ],
    roles: [
      { role: "Planner", access: "Calendar and slots." },
      { role: "Designer", access: "Assets for assigned slots." },
      { role: "Approver", access: "Approve or reject exact versions." },
      { role: "Analyst", access: "Read-only performance data." },
    ],
    dataEntities: [
      { entity: "Slot", relation: "Belongs to a calendar and channel." },
      { entity: "AssetVersion", relation: "Belongs to one slot." },
      { entity: "Approval", relation: "Binds one asset version and one caption version." },
      { entity: "Publication", relation: "Belongs to one slot; records provider id and state." },
    ],
    apiSurface: [
      { endpoint: "POST /api/slots", purpose: "Create or move a scheduled slot." },
      { endpoint: "POST /api/approvals", purpose: "Approve an exact captioned asset version." },
      { endpoint: "POST /api/publish", purpose: "Publish only an approved version pair." },
    ],
    integrations: ["Social platform APIs", "Object storage", "Notification channels", "Analytics warehouse"],
    ai: [
      { opportunity: "Draft caption variants for a planned asset.", gate: "Approver selects and approves one variant." },
      { opportunity: "Flag copy that may breach a platform policy.", gate: "Advisory only; approver decides." },
    ],
    security: [
      "Platform tokens are stored encrypted and never exposed to the client.",
      "Publishing requires an approved version binding.",
      "Per-channel permissions limit who can publish.",
    ],
    quality: [
      "Approval-binding tests (caption change invalidates approval).",
      "Provider failure and retry tests.",
      "Token rotation drill.",
    ],
    deployment: ["Scheduled worker plus web app", "Encrypted secret store", "Retry queue with dead-letter handling"],
    maintenance: ["Channel adapters versioned separately", "Asset retention policy", "Rate-limit aware publishing"],
    advanced: ["Multi-brand calendars", "Comment moderation queue", "Creative performance comparison"],
    relatedServices: ["n8n-workflow-automation", "ai-business-automation", "business-dashboards"],
  },
  {
    slug: "lead-management",
    users: ["Sales agents", "Sales managers", "Marketing"],
    problem: [
      "Lead source is guessed rather than captured at entry.",
      "Assignment is manual and slow, so first contact is delayed.",
      "Follow-up discipline depends on an individual's habit.",
    ],
    objectives: [
      "Capture source and consent at the point of entry.",
      "Assign deterministically by rule, geography or capacity.",
      "Enforce a follow-up cadence with recorded attempts.",
    ],
    platforms: [
      { name: "Pipeline board", detail: "Stage view with owner and next action." },
      { name: "Lead record", detail: "Source, score, history and consent state." },
      { name: "Manager dashboard", detail: "Response time, stage age and source mix." },
    ],
    journey: [
      { title: "Capture", description: "A lead enters with source, consent and contact details." },
      { title: "Score", description: "Rules or a model produce an advisory score." },
      { title: "Assign", description: "Routing assigns an owner with a first-contact deadline." },
      { title: "Work", description: "Attempts and stage changes are logged until won or lost." },
    ],
    roles: [
      { role: "Agent", access: "Own leads and their history." },
      { role: "Manager", access: "Allocation, reassignment and reporting." },
      { role: "Marketing", access: "Source performance; no contact details editing." },
    ],
    dataEntities: [
      { entity: "Lead", relation: "Has many attempts; belongs to one owner." },
      { entity: "Source", relation: "Classifies origin and consent basis." },
      { entity: "Score", relation: "Belongs to a lead; carries model or rule version." },
      { entity: "Attempt", relation: "Belongs to a lead; records channel and outcome." },
    ],
    apiSurface: [
      { endpoint: "POST /api/leads", purpose: "Capture with source and consent metadata." },
      { endpoint: "POST /api/leads/:id/assign", purpose: "Deterministic assignment with audit." },
      { endpoint: "GET /api/reports/sources", purpose: "Source performance for permitted roles." },
    ],
    integrations: ["Website forms", "Advertising platform exports", "Email", "CRM"],
    ai: [
      { opportunity: "Score leads from historical conversion patterns.", gate: "Manager can override any score; assignment rules stay deterministic." },
      { opportunity: "Draft first-contact messages.", gate: "Agent sends; drafts never auto-dispatch." },
    ],
    security: [
      "Consent basis is stored with every lead and honoured on contact.",
      "Bulk export is restricted and logged.",
      "Model scores are explainable and versioned.",
    ],
    quality: [
      "Assignment rule tests including capacity limits.",
      "Consent enforcement tests.",
      "Score-version traceability tests.",
    ],
    deployment: ["Containerised web app", "Managed database", "Daily export job"],
    maintenance: ["Routing rules in configuration", "Score model versioned", "Retention per jurisdiction"],
    advanced: ["Round-robin with fairness weighting", "Duplicate detection across sources", "Territory rules"],
    industrySlug: "professional-services",
    relatedServices: ["custom-crm-development", "ai-business-automation", "business-dashboards"],
  },
  {
    slug: "client-portal",
    users: ["Clients", "Project managers", "Finance"],
    problem: [
      "Clients ask for status by email, which staff answer manually.",
      "Scope changes are agreed verbally and later disputed.",
      "Invoices and handover files are scattered across threads.",
    ],
    objectives: [
      "Expose scope, milestones and approvals in one authenticated place.",
      "Record scope changes and approvals against versions.",
      "Release final source and documents only after verified payment.",
    ],
    platforms: [
      { name: "Client portal", detail: "Milestones, previews, invoices and handover." },
      { name: "Staff console", detail: "Publish milestone states and artefacts." },
      { name: "Notification layer", detail: "Email and in-app notices on state change." },
    ],
    journey: [
      { title: "Sign in", description: "The client authenticates and sees only their own project." },
      { title: "Review", description: "A preview is shared with explicit, limited scope." },
      { title: "Approve", description: "Approval is recorded against the exact version reviewed." },
      { title: "Receive", description: "Handover artefacts unlock after verified payment." },
    ],
    roles: [
      { role: "Client", access: "Own project, invoices and approved files." },
      { role: "Project manager", access: "Publish milestones and previews." },
      { role: "Finance", access: "Verify payments and release handover." },
    ],
    dataEntities: [
      { entity: "Project", relation: "Has milestones, approvals and artefacts." },
      { entity: "Approval", relation: "Binds a version and a client identity." },
      { entity: "Invoice", relation: "Belongs to a project; carries verification state." },
      { entity: "HandoverArtefact", relation: "Locked until payment verification." },
    ],
    apiSurface: [
      { endpoint: "GET /api/portal/projects", purpose: "Projects scoped to the signed-in client." },
      { endpoint: "POST /api/portal/approvals", purpose: "Record client approval for a version." },
      { endpoint: "GET /api/portal/handover/:id", purpose: "Authorised artefact download after release." },
    ],
    integrations: ["Authentication provider", "Object storage", "Email", "Payment verification"],
    ai: [
      { opportunity: "Summarise project activity into a weekly client update.", gate: "Project manager edits and sends." },
      { opportunity: "Detect ambiguous scope wording in a change request.", gate: "Project manager decides whether to raise a change order." },
    ],
    security: [
      "Project access is scoped by client identity on the server.",
      "Handover artefacts are gated by verified payment state.",
      "Every download is logged with actor and timestamp.",
    ],
    quality: [
      "Cross-client access tests.",
      "Payment-gate bypass tests.",
      "Session expiry and re-authentication tests.",
    ],
    deployment: ["Containerised app behind TLS", "Object storage with signed URLs", "Audit log with retention"],
    maintenance: ["Document retention policy", "Payment provider adapter isolated", "Portal branding configurable"],
    advanced: ["Multi-stakeholder client accounts", "Change-order workflow", "Milestone e-signature"],
    industrySlug: "technology-companies",
    relatedServices: ["client-portals", "custom-software-development", "api-integrations"],
  },
  {
    slug: "custom-dashboard",
    users: ["Executives", "Department leads", "Analysts"],
    problem: [
      "Pipeline, delivery and revenue are reported from three different spreadsheets.",
      "Definitions of the same metric differ between reports.",
      "Nobody can trace a dashboard number back to its source rows.",
    ],
    objectives: [
      "Define each metric once with an owner and a formula.",
      "Refresh from source systems on a schedule with recorded lineage.",
      "Drill from a summary figure to the underlying records.",
    ],
    platforms: [
      { name: "Executive view", detail: "Summary metrics with trend and variance." },
      { name: "Analyst workspace", detail: "Definitions, lineage and drill-through." },
      { name: "Scheduled export", detail: "Consistent snapshots for offline reporting." },
    ],
    journey: [
      { title: "Define", description: "A metric is registered with formula, owner and grain." },
      { title: "Ingest", description: "Source data lands on schedule with row counts recorded." },
      { title: "Compute", description: "Metrics are computed and compared to the prior snapshot." },
      { title: "Explore", description: "A reader drills from the figure to contributing rows." },
    ],
    roles: [
      { role: "Executive", access: "Summary metrics for permitted departments." },
      { role: "Analyst", access: "Definitions, lineage and drill-through." },
      { role: "Data steward", access: "Metric definitions and refresh schedules." },
    ],
    dataEntities: [
      { entity: "MetricDefinition", relation: "Owned by one steward; has many snapshots." },
      { entity: "SourceSync", relation: "Records load time, rows and failures." },
      { entity: "Snapshot", relation: "Belongs to a metric; stores computed value and grain." },
      { entity: "Lineage", relation: "Links a metric to its source tables." },
    ],
    apiSurface: [
      { endpoint: "GET /api/metrics", purpose: "Metric values for the caller's scope." },
      { endpoint: "GET /api/metrics/:key/lineage", purpose: "Definition, formula and sources." },
      { endpoint: "POST /api/sync", purpose: "Trigger a load with recorded outcome." },
    ],
    integrations: ["Source databases", "Spreadsheet import", "Warehouse", "BI export"],
    ai: [
      { opportunity: "Explain a variance in plain language from recorded drivers.", gate: "Analyst confirms the explanation before it is published." },
      { opportunity: "Draft a metric definition from a described calculation.", gate: "Steward approves the definition and formula." },
    ],
    security: [
      "Row-level scoping limits each role to permitted departments.",
      "Refresh credentials are read-only and rotated.",
      "Snapshot history is immutable for audit.",
    ],
    quality: [
      "Metric formula tests with fixed fixtures.",
      "Idempotent refresh tests.",
      "Row-level access tests per role.",
    ],
    deployment: ["Scheduled loader plus web app", "Read replicas for heavy queries", "Backup of snapshots and definitions"],
    maintenance: ["Schema-change monitoring for sources", "Failed-load alerting", "Metric deprecation process"],
    advanced: ["Forecasting with confidence intervals", "Metric change history", "Embedded customer-facing reporting"],
    industrySlug: "technology-companies",
    relatedServices: ["business-dashboards", "custom-software-development", "ai-business-automation"],
  },
];

const bySlug = new Map(DETAILS.map((detail) => [detail.slug, detail]));

/** All project details, in showcase order. */
export const PROJECT_DETAILS: ProjectDetail[] = DETAILS;

/** Look up a project detail by showcase slug. */
export function getProjectDetail(slug: string): ProjectDetail | undefined {
  return bySlug.get(slug);
}

/** True when a slug maps to a published showcase project. */
export function isProjectSlug(slug: string): boolean {
  return bySlug.has(slug) && WORK_EXAMPLES.some((example) => example.slug === slug);
}

/** Closest related showcases, excluding the current one. */
export function relatedProjects(slug: string, limit = 3): string[] {
  return WORK_EXAMPLES.filter((example) => example.slug !== slug)
    .slice(0, limit)
    .map((example) => example.slug);
}
