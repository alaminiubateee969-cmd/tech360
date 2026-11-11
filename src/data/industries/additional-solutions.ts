/**
 * Additional industry-specific solution specifications.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Eleven industries carried only seven solution specifications, below the
 * eight-solution minimum in `MIN_SOLUTIONS_PER_INDUSTRY`. The eight
 * `applications` entries on each industry page are platform-level app planes
 * (web shell, mobile shell, API layer, auth, workflow engine, file service,
 * reporting, AI host) shared across every sector — they are not sector
 * solutions and are deliberately not counted toward the minimum.
 *
 * Each specification below is specific to its industry's own workflows, roles
 * and data, and is attached to that industry's existing workflow IDs. Nothing
 * here describes an implemented product: every entry is a specification and is
 * reported as `SPECIFIED` by the maturity model in `./maturity.ts`.
 */

import type { ModuleSpec } from "./types";

const ADDITIONAL_SOLUTIONS: Readonly<Record<string, ModuleSpec[]>> = {
  "real-estate": [
    {
      id: "RRE-MOD-08",
      name: "Transaction Compliance & Document Vault",
      domain: "transactions",
      summary: "Disclosure packs, e-signature evidence, and retention per transaction.",
      problem:
        "Disclosure documents, signatures, and statutory retention dates live in inboxes and shared drives, so a transaction can close without a complete, auditable file.",
      capabilities: [
        "Per-transaction document checklist with required disclosures",
        "Versioned uploads with e-signature status tracking",
        "Retention schedule and legal-hold flags",
        "Missing-document blockers on pipeline stage transitions",
        "Evidence pack export for audit or dispute",
      ],
      roles: ["transaction-coordinator", "listing-agent"],
      inputs: ["Transaction records", "Disclosure templates", "Signed documents"],
      outputs: ["Complete transaction file", "Retention schedule", "Evidence packs"],
      dataEntities: ["TransactionDocument", "DisclosureChecklist", "SignatureRecord"],
      integrations: ["E-signature provider", "Document storage", "Deal pipeline"],
      workflows: ["RRE-WF-02"],
      kpis: [
        {
          name: "File completeness at close",
          formula: "Complete files / closed transactions",
          target: "100%",
          unit: "%",
          frequency: "monthly",
        },
        {
          name: "Signature turnaround",
          formula: "Median hours request → signed",
          target: "≤48h",
          unit: "hours",
          frequency: "weekly",
        },
      ],
      aiUseCases: [
        {
          useCaseId: "RRE-AI-08",
          name: "Disclosure completeness checker",
          description:
            "Check an uploaded pack against the required checklist and flag gaps; the transaction coordinator confirms every finding.",
          autonomy: "A1",
          dataClass: "confidential",
          humanOwner: "transaction-coordinator",
          approvalStep: "Coordinator accepts every gap flag before the stage gate",
          guardrails: ["Checklist source is versioned", "No document content is auto-deleted"],
          metrics: ["False-positive rate", "Files complete at close"],
          rollbackPlan: "Manual checklist review",
          modelFamily: "document-understanding",
        },
      ],
      automations: ["Checklist generation", "Stage gate checks", "Retention reminders"],
      controls: ["Stage blocked while documents are missing", "Immutable upload history"],
      compliance: ["Disclosure obligations", "Records retention"],
      sla: "Checklist generated at listing; stage gate evaluated on every transition.",
      dependencies: ["Deal pipeline", "Document storage"],
      rolloutPhases: ["Wave 2"],
      effort: { design: 5, build: 26, test: 11 },
      acceptanceCriteria: [
        "Every transaction carries its required checklist",
        "Stage transition is refused while a required document is missing",
        "Retention dates are computed and visible per document",
      ],
    },
  ],

  agencies: [
    {
      id: "AGY-MOD-08",
      name: "Creative Review & Asset Approvals",
      domain: "creative",
      summary: "Versioned creative proofs, consolidated feedback, and usage rights.",
      problem:
        "Feedback arrives across chat, email and calls, so versions collide and nobody can prove which creative the client approved or whether usage rights were cleared.",
      capabilities: [
        "Versioned asset uploads with numbered proofs",
        "Pinned annotations and consolidated client feedback",
        "Approval records tied to a named client decision-maker",
        "Asset rights, expiry and territory metadata",
        "Approved-asset library for reuse across campaigns",
      ],
      roles: ["creative-lead", "qa-lead-agency", "account-director"],
      inputs: ["Creative files", "Client feedback", "Rights agreements"],
      outputs: ["Approved versions", "Approval records", "Rights register"],
      dataEntities: ["CreativeAsset", "ProofVersion", "ApprovalDecision", "RightsRecord"],
      integrations: ["Asset storage", "Project delivery", "Client collaboration portal"],
      workflows: ["AGY-WF-03"],
      kpis: [
        {
          name: "Revision rounds per asset",
          formula: "Proof versions / approved asset",
          target: "≤3",
          unit: "rounds",
          frequency: "monthly",
        },
        {
          name: "Approval evidence coverage",
          formula: "Assets with recorded approval / approved assets",
          target: "100%",
          unit: "%",
          frequency: "monthly",
        },
      ],
      aiUseCases: [
        {
          useCaseId: "AGY-AI-08",
          name: "Feedback consolidator",
          description:
            "Cluster duplicate client comments per proof version; the creative lead confirms each cluster before it becomes a task.",
          autonomy: "A1",
          dataClass: "confidential",
          humanOwner: "creative-lead",
          approvalStep: "Creative lead approves the consolidated change list",
          guardrails: ["Client text is quoted, never paraphrased into a decision", "No automatic approval"],
          metrics: ["Duplicate-comment reduction", "Revision rounds"],
          rollbackPlan: "Raw comment list remains authoritative",
          modelFamily: "text-clustering",
        },
      ],
      automations: ["Proof numbering", "Feedback intake from portal", "Rights-expiry alerts"],
      controls: ["Approval requires a named client identity", "Rights expiry blocks reuse"],
      compliance: ["Usage rights", "Advertising standards review"],
      sla: "Feedback consolidated within one business day of a proof round.",
      dependencies: ["Project delivery", "Client collaboration portal"],
      rolloutPhases: ["Wave 2"],
      effort: { design: 5, build: 28, test: 12 },
      acceptanceCriteria: [
        "Every approved creative has a stored approval record and approver",
        "Rights metadata is mandatory before an asset enters the library",
        "Expired-rights assets are blocked from new campaign use",
      ],
    },
  ],

  "professional-services": [
    {
      id: "PSV-MOD-08",
      name: "Engagement Risk & Independence",
      domain: "governance",
      summary: "Conflict checks, independence declarations, and quality review gates.",
      problem:
        "Independence and quality-review obligations are tracked in partner memory and spreadsheets, so a conflict or a missed review is discovered after the engagement has started.",
      capabilities: [
        "Conflict screening against clients, affiliates and prior work",
        "Independence declarations with expiry and re-attestation",
        "Quality review gates by engagement risk tier",
        "Rotation tracking for long-running engagements",
        "Immutable register of declarations and approvals",
      ],
      roles: ["engagement-principal", "knowledge-manager"],
      inputs: ["Prospect records", "Engagement risk tier", "Declarations"],
      outputs: ["Conflict decisions", "Independence register", "Review sign-offs"],
      dataEntities: ["ConflictCheck", "IndependenceDeclaration", "QualityReview"],
      integrations: ["Pursuit workspace", "Engagement delivery", "Identity provider"],
      workflows: ["PSV-WF-01", "PSV-WF-02"],
      kpis: [
        {
          name: "Conflict checks before acceptance",
          formula: "Engagements with recorded check / accepted engagements",
          target: "100%",
          unit: "%",
          frequency: "monthly",
        },
        {
          name: "Review gate completion",
          formula: "Completed reviews / required reviews",
          target: "100%",
          unit: "%",
          frequency: "monthly",
        },
      ],
      aiUseCases: [
        {
          useCaseId: "PSV-AI-08",
          name: "Conflict candidate finder",
          description:
            "Surface possible conflicts from entity-name similarity across parties; a principal decides every candidate.",
          autonomy: "A0",
          dataClass: "confidential",
          humanOwner: "engagement-principal",
          approvalStep: "Principal clears or escalates every candidate",
          guardrails: ["Advisory only", "No engagement is auto-accepted"],
          metrics: ["Candidates reviewed", "Escalations"],
          rollbackPlan: "Manual name search",
          modelFamily: "entity-matching",
        },
      ],
      automations: ["Name screening", "Declaration reminders", "Rotation alerts"],
      controls: ["Engagement cannot open without a cleared conflict check", "Reviews are signed by a named reviewer"],
      compliance: ["Professional independence standards", "Quality management"],
      sla: "Conflict check completed before proposal submission.",
      dependencies: ["Identity provider"],
      rolloutPhases: ["Wave 2"],
      effort: { design: 5, build: 24, test: 11 },
      acceptanceCriteria: [
        "An engagement cannot be opened while its conflict check is unresolved",
        "Declarations expire and require re-attestation",
        "Risk-tier rules determine which review gates are mandatory",
      ],
    },
  ],

  "marketing-agencies": [
    {
      id: "MKT-MOD-08",
      name: "Audience Consent & Data Governance",
      domain: "governance",
      summary: "Consent capture, suppression lists, and lawful-basis records for audiences.",
      problem:
        "Audience lists are assembled from exports nobody can provenance, so a client cannot demonstrate consent or honour a suppression request across channels.",
      capabilities: [
        "Consent capture and lawful-basis records per audience",
        "Global suppression list applied before every send",
        "Source and provenance for every imported list",
        "Retention rules and deletion evidence",
        "Pre-launch audience compliance check",
      ],
      roles: ["analyst", "campaign-manager"],
      inputs: ["Audience imports", "Consent records", "Suppression requests"],
      outputs: ["Eligible audience", "Compliance evidence", "Deletion records"],
      dataEntities: ["Audience", "ConsentRecord", "SuppressionEntry"],
      integrations: ["Advertising platforms", "Email service provider", "CRM"],
      workflows: ["MKT-WF-02", "MKT-WF-05"],
      kpis: [
        {
          name: "Suppression coverage",
          formula: "Sends checked against suppression / total sends",
          target: "100%",
          unit: "%",
          frequency: "weekly",
        },
        {
          name: "Lists with recorded provenance",
          formula: "Sourced lists / active lists",
          target: "100%",
          unit: "%",
          frequency: "monthly",
        },
      ],
      aiUseCases: [
        {
          useCaseId: "MKT-AI-08",
          name: "Audience risk annotator",
          description:
            "Flag imported lists with missing provenance or unusually high match rates; the analyst decides whether the list is usable.",
          autonomy: "A0",
          dataClass: "confidential",
          humanOwner: "analyst",
          approvalStep: "Analyst clears or rejects each flagged list",
          guardrails: ["Advisory only", "No list is activated automatically"],
          metrics: ["Flagged lists resolved", "Rejected lists"],
          rollbackPlan: "Manual provenance review",
          modelFamily: "classification",
        },
      ],
      automations: ["Suppression sync", "Consent expiry handling", "Deletion jobs with evidence"],
      controls: ["Send is blocked while suppression sync is stale", "Deletion produces an audit receipt"],
      compliance: ["Consent requirements", "Marketing privacy rules"],
      sla: "Suppression changes propagate to every channel within 15 minutes.",
      dependencies: ["Email service provider"],
      rolloutPhases: ["Wave 2"],
      effort: { design: 6, build: 30, test: 13 },
      acceptanceCriteria: [
        "A campaign cannot launch with an unsynced suppression list",
        "Every audience displays its provenance and lawful basis",
        "Deletion requests produce a stored evidence record",
      ],
    },
  ],

  "local-businesses": [
    {
      id: "LOC-MOD-08",
      name: "Supplier & Purchasing",
      domain: "purchasing",
      summary: "Supplier records, purchase orders, and receiving for small teams.",
      problem:
        "Purchases happen on phone calls and paper slips, so stock arrives without a record, supplier prices drift, and the daily close cannot reconcile spend.",
      capabilities: [
        "Supplier directory with agreed prices",
        "Simple purchase orders and approval thresholds (USD)",
        "Receiving against an order with variance notes",
        "Supplier invoice capture and three-way match",
        "Reorder suggestions from stock levels",
      ],
      roles: ["manager", "bookkeeper", "shift-lead"],
      inputs: ["Supplier prices", "Stock levels", "Delivery notes"],
      outputs: ["Purchase orders", "Receiving records", "Spend summary (USD)"],
      dataEntities: ["Supplier", "PurchaseOrder", "GoodsReceipt"],
      integrations: ["Inventory basics", "Cash and daily close", "Accounting export"],
      workflows: ["LOC-WF-04"],
      kpis: [
        {
          name: "Orders received against a PO",
          formula: "Receipts with PO / total receipts",
          target: "≥95%",
          unit: "%",
          frequency: "monthly",
        },
        {
          name: "Price variance",
          formula: "(Invoice − agreed price) / agreed price",
          target: "≤2%",
          unit: "%",
          frequency: "monthly",
        },
      ],
      aiUseCases: [
        {
          useCaseId: "LOC-AI-08",
          name: "Invoice line matcher",
          description:
            "Propose matches between a supplier invoice and a purchase order; the bookkeeper confirms before posting.",
          autonomy: "A1",
          dataClass: "confidential",
          humanOwner: "bookkeeper",
          approvalStep: "Bookkeeper confirms every posting",
          guardrails: ["No automatic payment", "Variance above threshold always escalates"],
          metrics: ["Match acceptance rate", "Posting errors"],
          rollbackPlan: "Manual entry from the invoice",
          modelFamily: "document-understanding",
        },
      ],
      automations: ["Reorder suggestions", "Approval routing", "Supplier price comparison"],
      controls: ["Approval threshold per user", "Three-way match before posting"],
      compliance: ["Record keeping", "Tax-document retention"],
      sla: "Purchase order issued the same day it is approved.",
      dependencies: ["Inventory basics"],
      rolloutPhases: ["Wave 2"],
      effort: { design: 4, build: 22, test: 10 },
      acceptanceCriteria: [
        "Every receipt can be traced to a purchase order",
        "Purchases above the threshold require approval",
        "Spend is reportable in USD by supplier and period",
      ],
    },
  ],

  "international-smes": [
    {
      id: "ISM-MOD-08",
      name: "FX Exposure & Landed Cost",
      domain: "finance",
      summary: "Landed cost per shipment and USD-reported FX exposure across entities.",
      problem:
        "Freight, duty and currency movements are absorbed into a single invoice total, so nobody knows the true landed cost of a shipment or the firm's open FX exposure.",
      capabilities: [
        "Landed-cost build-up per shipment (goods, freight, duty, handling)",
        "FX rate capture at commitment and settlement",
        "Open exposure by currency with USD equivalents",
        "Margin per shipment on a landed-cost basis",
        "Rate assumptions recorded for every quotation",
      ],
      roles: ["entity-controller", "export-sales", "buyer"],
      inputs: ["Shipment costs", "FX rates", "Supplier invoices"],
      outputs: ["Landed cost (USD)", "Exposure report", "Shipment margin"],
      dataEntities: ["LandedCost", "FxRate", "ExposurePosition"],
      integrations: ["Order management", "Multi-entity finance", "Rate provider feed"],
      workflows: ["ISM-WF-01", "ISM-WF-04"],
      kpis: [
        {
          name: "Shipments with landed cost",
          formula: "Costed shipments / shipped",
          target: "100%",
          unit: "%",
          frequency: "monthly",
        },
        {
          name: "FX exposure coverage",
          formula: "Exposure with recorded rate / open exposure",
          target: "100%",
          unit: "%",
          frequency: "weekly",
        },
      ],
      aiUseCases: [
        {
          useCaseId: "ISM-AI-08",
          name: "Duty and freight estimator",
          description:
            "Estimate duty and freight for a quotation from historical shipments; the controller confirms before any quote is sent.",
          autonomy: "A1",
          dataClass: "confidential",
          humanOwner: "entity-controller",
          approvalStep: "Controller confirms estimate used in a quote",
          guardrails: ["Estimate is labelled as an estimate", "No committed price without confirmation"],
          metrics: ["Estimate error", "Quotes issued"],
          rollbackPlan: "Manual estimate from the rate card",
          modelFamily: "regression",
        },
      ],
      automations: ["Rate retrieval", "Cost allocation", "Exposure rollup"],
      controls: ["Rate source and timestamp stored with every cost", "Manual override requires a reason"],
      compliance: ["Customs valuation records", "Financial reporting"],
      sla: "Landed cost finalised within two business days of shipment closure.",
      dependencies: ["Order management", "Multi-entity finance"],
      rolloutPhases: ["Wave 2"],
      effort: { design: 5, build: 28, test: 12 },
      acceptanceCriteria: [
        "Every shipment displays a landed cost in USD with its inputs",
        "FX rates used are stored with source and timestamp",
        "Exposure report reconciles to entity balances",
      ],
    },
  ],

  finance: [
    {
      id: "FIN-MOD-08",
      name: "Collateral & Covenant Tracking",
      domain: "credit-risk",
      summary: "Collateral registers, valuations, and covenant monitoring with breach workflow.",
      problem:
        "Collateral values and covenant tests are checked at origination and then tracked in spreadsheets, so a breach or a stale valuation is found at renewal instead of in time to act.",
      capabilities: [
        "Collateral register with valuation history and haircuts",
        "Covenant definitions, test dates and calculation inputs",
        "Automated covenant test with pass/watch/breach states",
        "Breach workflow with escalation and remediation tasks",
        "Concentration and coverage reporting in USD",
      ],
      roles: ["credit-manager", "risk-manager", "credit-analyst"],
      inputs: ["Loan records", "Valuations", "Covenant definitions", "Financial statements"],
      outputs: ["Coverage ratios", "Covenant test results", "Breach notifications"],
      dataEntities: ["Collateral", "Valuation", "Covenant", "CovenantTest"],
      integrations: ["Loan servicing", "Credit policy studio", "Risk monitoring"],
      workflows: ["FIN-WF-02", "FIN-WF-05"],
      kpis: [
        {
          name: "Covenant tests on time",
          formula: "Tests completed by due date / due tests",
          target: "100%",
          unit: "%",
          frequency: "monthly",
        },
        {
          name: "Stale valuations",
          formula: "Valuations older than policy / total collateral",
          target: "≤2%",
          unit: "%",
          frequency: "monthly",
        },
      ],
      aiUseCases: [
        {
          useCaseId: "FIN-AI-08",
          name: "Covenant input extractor",
          description:
            "Extract candidate covenant inputs from submitted statements; a credit analyst confirms every figure before a test runs.",
          autonomy: "A1",
          dataClass: "confidential",
          humanOwner: "credit-analyst",
          approvalStep: "Analyst confirms every extracted figure",
          guardrails: ["Never computes a breach without confirmation", "Source page cited per figure"],
          metrics: ["Extraction accuracy", "Tests completed on time"],
          rollbackPlan: "Manual data entry",
          modelFamily: "document-understanding",
        },
      ],
      automations: ["Test scheduling", "Valuation expiry alerts", "Breach escalation"],
      controls: ["Breach cannot be closed without remediation evidence", "Valuation policy thresholds enforced"],
      compliance: ["Credit risk policy", "Prudential reporting"],
      sla: "Covenant tests completed by the contractual test date.",
      dependencies: ["Loan servicing"],
      rolloutPhases: ["Wave 2"],
      effort: { design: 6, build: 32, test: 14 },
      acceptanceCriteria: [
        "Every secured loan shows current collateral coverage in USD",
        "Covenant tests run on schedule with stored inputs",
        "A breach opens an escalation task and cannot be silently cleared",
      ],
    },
  ],

  logistics: [
    {
      id: "LOG-MOD-08",
      name: "Claims & Exception Management",
      domain: "claims",
      summary: "Damage, loss and delay claims with evidence and settlement recovery.",
      problem:
        "Damage and shortage claims are handled by email, evidence is lost, and recovery from carriers or insurers is abandoned because nobody can reconstruct the timeline.",
      capabilities: [
        "Claim intake from delivery, warehouse or customer report",
        "Evidence pack assembly from POD, photos and scan events",
        "Liability determination against carrier terms",
        "Recovery tracking with insurer or carrier correspondence",
        "Root-cause tagging for recurring exceptions",
      ],
      roles: ["dispatch-manager", "log-finance", "warehouse-lead"],
      inputs: ["Delivery events", "Proof of delivery", "Photos", "Carrier terms"],
      outputs: ["Claim records", "Evidence packs", "Recovery status (USD)"],
      dataEntities: ["Claim", "ClaimEvidence", "RecoveryRecord"],
      integrations: ["Last-mile and POD", "Warehouse execution", "Settlement and billing"],
      workflows: ["LOG-WF-05"],
      kpis: [
        {
          name: "Claim cycle time",
          formula: "Median days open → decided",
          target: "≤15 days",
          unit: "days",
          frequency: "monthly",
        },
        {
          name: "Recovery rate",
          formula: "Recovered (USD) / claimed (USD)",
          target: "≥70%",
          unit: "%",
          frequency: "quarterly",
        },
      ],
      aiUseCases: [
        {
          useCaseId: "LOG-AI-08",
          name: "Exception clustering",
          description:
            "Group recurring exception signatures by route, carrier and consignee; the dispatch manager validates each cluster before action.",
          autonomy: "A0",
          dataClass: "internal",
          humanOwner: "dispatch-manager",
          approvalStep: "Dispatch manager validates the cluster before any carrier action",
          guardrails: ["Advisory only", "No claim is auto-filed"],
          metrics: ["Repeat exceptions identified", "Clusters actioned"],
          rollbackPlan: "Manual exception review",
          modelFamily: "clustering",
        },
      ],
      automations: ["Evidence assembly", "Deadline reminders", "Recovery follow-up"],
      controls: ["Claim cannot be submitted without an evidence pack", "Settlement requires a named approver"],
      compliance: ["Carrier liability terms", "Insurance documentation"],
      sla: "Claim acknowledged within one business day of intake.",
      dependencies: ["Last-mile and POD", "Settlement and billing"],
      rolloutPhases: ["Wave 2"],
      effort: { design: 5, build: 26, test: 12 },
      acceptanceCriteria: [
        "Every claim links to its delivery evidence",
        "Recovery amounts reconcile to settlement records in USD",
        "Recurring exception causes are reportable by route and carrier",
      ],
    },
  ],

  construction: [
    {
      id: "CON-MOD-08",
      name: "RFI & Submittal Control",
      domain: "information-control",
      summary: "RFIs, submittals and drawing revisions with response-time tracking.",
      problem:
        "RFIs and submittals move through email and site chat, so drawings go out of date, responses miss their deadline, and nobody can prove which revision was built.",
      capabilities: [
        "Numbered RFIs with due dates, owners and response tracking",
        "Submittal register with review codes and resubmittal loops",
        "Drawing revision control linked to affected BOQ items",
        "Response-time reporting against contract deadlines",
        "Close-out pack of as-built information",
      ],
      roles: ["site-engineer", "project-manager", "quantity-surveyor"],
      inputs: ["Drawing registers", "Site queries", "Submittal packages"],
      outputs: ["RFI responses", "Reviewed submittals", "Revision history"],
      dataEntities: ["Rfi", "Submittal", "DrawingRevision"],
      integrations: ["Site progress", "Variations and claims", "Document storage"],
      workflows: ["CON-WF-03"],
      kpis: [
        {
          name: "RFI response time",
          formula: "Median days raised → answered",
          target: "≤5 days",
          unit: "days",
          frequency: "weekly",
        },
        {
          name: "Overdue submittals",
          formula: "Overdue / open submittals",
          target: "≤5%",
          unit: "%",
          frequency: "weekly",
        },
      ],
      aiUseCases: [
        {
          useCaseId: "CON-AI-08",
          name: "RFI drafting assistant",
          description:
            "Draft a structured RFI from site notes and photos; the site engineer reviews and owns the submission.",
          autonomy: "A0",
          dataClass: "internal",
          humanOwner: "site-engineer",
          approvalStep: "Engineer reviews and submits every RFI",
          guardrails: ["Never sends externally", "Drafts are labelled as drafts"],
          metrics: ["Draft acceptance", "Response time"],
          rollbackPlan: "Manual RFI form",
          modelFamily: "text-generation",
        },
      ],
      automations: ["Due-date reminders", "Escalation on overdue", "Revision distribution"],
      controls: ["Work cannot cite a superseded drawing", "Responses require a named responder"],
      compliance: ["Contract information protocols", "Quality records"],
      sla: "RFI logged the day it is raised; overdue items escalate to the project manager.",
      dependencies: ["Site progress", "Document storage"],
      rolloutPhases: ["Wave 2"],
      effort: { design: 5, build: 28, test: 12 },
      acceptanceCriteria: [
        "Every RFI carries a number, owner and response date",
        "Superseded drawings are blocked from new work references",
        "Response-time reporting matches logged timestamps",
      ],
    },
  ],

  "legal-services": [
    {
      id: "LGL-MOD-08",
      name: "Client Trust Accounting",
      domain: "trust-accounting",
      summary: "Client-fund ledgers, three-way reconciliation, and compliant transfers.",
      problem:
        "Client funds are tracked in a separate ledger that is reconciled monthly by hand, so a shortfall can persist for weeks and transfers between trust and operating accounts lack written authority.",
      capabilities: [
        "Per-client trust ledger with running balances (USD)",
        "Deposits, withdrawals and matter-level allocation",
        "Three-way reconciliation: ledger, bank, and client balances",
        "Written-authority requirement for every transfer",
        "Negative-balance and overdraft prevention",
      ],
      roles: ["billing-manager", "compliance-officer", "partner"],
      inputs: ["Bank statements", "Client receipts", "Invoices"],
      outputs: ["Trust ledger", "Reconciliation report", "Transfer authority records"],
      dataEntities: ["TrustAccount", "TrustTransaction", "Reconciliation"],
      integrations: ["Billing and collections", "Bank statement import", "Matter management"],
      workflows: ["LGL-WF-04", "LGL-WF-05"],
      kpis: [
        {
          name: "Reconciliation currency",
          formula: "Days since last completed reconciliation",
          target: "≤30 days",
          unit: "days",
          frequency: "monthly",
        },
        {
          name: "Unreconciled differences",
          formula: "|Ledger − bank|",
          target: "0",
          unit: "USD",
          frequency: "monthly",
        },
      ],
      aiUseCases: [
        {
          useCaseId: "LGL-AI-08",
          name: "Statement matcher",
          description:
            "Propose matches between bank lines and trust transactions; the billing manager confirms every match before posting.",
          autonomy: "A1",
          dataClass: "restricted",
          humanOwner: "billing-manager",
          approvalStep: "Billing manager confirms each match; reconciliation signed by a partner",
          guardrails: ["No automatic transfer", "Unmatched lines always surface for review"],
          metrics: ["Match acceptance", "Unreconciled difference"],
          rollbackPlan: "Manual statement reconciliation",
          modelFamily: "matching",
        },
      ],
      automations: ["Statement import", "Negative-balance alerts", "Authority checklist"],
      controls: ["Transfer blocked without recorded written authority", "Reconciliation locked once signed"],
      compliance: ["Client-money rules", "Trust account regulations", "Audit trail requirements"],
      sla: "Reconciliation completed monthly and signed by a partner.",
      dependencies: ["Billing and collections"],
      rolloutPhases: ["Wave 2"],
      effort: { design: 6, build: 34, test: 15 },
      acceptanceCriteria: [
        "Trust balance for every client reconciles to the bank total",
        "No transfer can post without an authority record",
        "Signed reconciliations are immutable",
      ],
    },
  ],

  "technology-companies": [
    {
      id: "TEC-MOD-08",
      name: "Security & Vulnerability Management",
      domain: "security",
      summary: "Findings, risk acceptance, and remediation SLAs across environments.",
      problem:
        "Scanner output and dependency alerts land in different tools, so remediation is untracked, risk acceptance is undocumented, and nobody can report the age of open critical findings.",
      capabilities: [
        "Finding intake from scanners, dependency alerts and disclosure",
        "Severity and exploitability scoring with owner assignment",
        "Remediation SLA per severity with escalation",
        "Documented risk acceptance with expiry and approver",
        "Post-fix verification evidence",
      ],
      roles: ["security-engineer", "sre", "tech-lead"],
      inputs: ["Scanner results", "Dependency alerts", "Disclosure reports"],
      outputs: ["Remediation tasks", "Risk register", "Verification evidence"],
      dataEntities: ["SecurityFinding", "Remediation", "RiskAcceptance"],
      integrations: ["Engineering delivery", "Incident management", "CI pipeline"],
      workflows: ["TEC-WF-02"],
      kpis: [
        {
          name: "Critical finding age",
          formula: "Median days open for critical findings",
          target: "≤7 days",
          unit: "days",
          frequency: "weekly",
        },
        {
          name: "Findings with an owner",
          formula: "Assigned findings / open findings",
          target: "100%",
          unit: "%",
          frequency: "weekly",
        },
      ],
      aiUseCases: [
        {
          useCaseId: "TEC-AI-08",
          name: "Finding triage assistant",
          description:
            "Deduplicate and enrich findings with likely affected components; the security engineer confirms severity and owner.",
          autonomy: "A1",
          dataClass: "internal",
          humanOwner: "security-engineer",
          approvalStep: "Security engineer confirms severity and ownership",
          guardrails: ["Cannot downgrade severity", "Cannot close a finding"],
          metrics: ["Triage time", "Deduplication rate"],
          rollbackPlan: "Manual triage",
          modelFamily: "classification",
        },
      ],
      automations: ["Scanner ingestion", "SLA timers", "Verification re-scans"],
      controls: ["Risk acceptance expires automatically", "Closure requires verification evidence"],
      compliance: ["Security policy", "Customer assurance commitments"],
      sla: "Critical findings triaged within 24 hours of intake.",
      dependencies: ["Engineering delivery", "CI pipeline"],
      rolloutPhases: ["Wave 2"],
      effort: { design: 5, build: 30, test: 13 },
      acceptanceCriteria: [
        "Every open finding has an owner and a severity-derived due date",
        "Risk acceptance records an approver and an expiry",
        "Closure requires a stored verification result",
      ],
    },
  ],
};

/** Additional solution specifications, keyed by industry slug. */
export function additionalSolutionsFor(slug: string): ModuleSpec[] {
  return ADDITIONAL_SOLUTIONS[slug] ?? [];
}

/** Every additional solution specification, flattened. */
export const ALL_ADDITIONAL_SOLUTIONS: ModuleSpec[] = Object.values(ADDITIONAL_SOLUTIONS).flat();

export default additionalSolutionsFor;
