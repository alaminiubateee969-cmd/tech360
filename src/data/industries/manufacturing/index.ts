import type {
  IndustrySolutionData,
  IndustryRegistryEntry,
  VisualAsset,
} from "../types";
import { committedIndustryHero, committedIndustryUi } from "../shared";
import { MANUFACTURING_WORKFLOWS } from "./workflows";
import { MANUFACTURING_MODULES } from "./modules";

/**
 * Manufacturing Flagship Pilot — full 20-section industry solution payload.
 * All money is USD ($). All content is English.
 * Validated by validateIndustrySolution() / validateFlagshipCounts().
 */

const heroImage: VisualAsset = {
  id: "mfg-hero-01",
  slug: "manufacturing",
  type: "hero",
  path: committedIndustryHero("manufacturing"),
  alt: "Automated production line with robotic arms and operators monitoring quality in a modern smart factory",
  caption: "Connected manufacturing: MES, QMS, and planning on one governed platform",
  width: 1920,
  height: 1080,
  language: "en",
  currency: "none",
  source: "generated",
  status: "pending-review",
};

const uiScreenAssets: VisualAsset[] = [
  { id: "mfg-ui-01", slug: "manufacturing", type: "ui", path: committedIndustryUi("manufacturing", 1), alt: "MES work order dispatch screen showing sequenced line schedule with station status", caption: "MES dispatch: sequenced schedule with live station status", width: 1440, height: 900, language: "en", currency: "none", source: "generated", status: "pending-review" },
  { id: "mfg-ui-02", slug: "manufacturing", type: "ui", path: committedIndustryUi("manufacturing", 2), alt: "QMS quality dashboard with control charts, NCR queue, and CAPA aging", caption: "QMS cockpit: control charts, NCR queue, CAPA aging", width: 1440, height: 900, language: "en", currency: "none", source: "generated", status: "pending-review" },
  { id: "mfg-ui-03", slug: "manufacturing", type: "ui", path: committedIndustryUi("manufacturing", 3), alt: "Planning workspace showing MPS grid with capacity load bars and exception list", caption: "Planning workspace: MPS grid, capacity load, exceptions", width: 1440, height: 900, language: "en", currency: "none", source: "generated", status: "pending-review" },
  { id: "mfg-ui-04", slug: "manufacturing", type: "ui", path: committedIndustryUi("manufacturing", 4), alt: "Executive dashboard with OEE, OTIF, margin, and safety KPIs in USD formatting", caption: "Executive dashboard: OEE, OTIF, margin, safety", width: 1440, height: 900, language: "en", currency: "none", source: "generated", status: "pending-review" },
];

export const MANUFACTURING_DATA: IndustrySolutionData = {
  hero: {
    eyebrow: "Global Industries Platform · Flagship Pilot",
    headline: "Run the factory on one governed system — from RFQ to recall",
    subhead: "TECH360's Manufacturing solution connects planning, MES, quality, maintenance, and supply chain on a six-plane enterprise operations architecture, with the ISA-95 IT/OT boundary enforced and every AI use case under human accountability.",
    ctas: [
      { label: "Explore 26 workflows", href: "#workflows" },
      { label: "See the 52 modules", href: "#modules" },
      { label: "View delivery roadmap", href: "#roadmap" },
    ],
    image: heroImage,
  },

  overview: {
    summary: "The Manufacturing flagship demonstrates the full TECH360 delivery system: 26 operational workflows, 52 module specifications across 15 domains, four roles-based portals, eight governed AI agents, and an 11-phase lifecycle with stage gates. It is the reference implementation every other industry solution is assembled from — the same six planes, the same USD-only and English-only guarantees, and the same honesty taxonomy for what is standard versus scope-dependent.",
    facts: [
      { label: "Operational workflows", value: "26 (18-field contract)" },
      { label: "Modules", value: "52 across 15 domains (22-field contract)" },
      { label: "Departments modelled", value: "13" },
      { label: "RBAC personas", value: "24" },
      { label: "Governed AI agents", value: "8 (A0–A3 autonomy)" },
      { label: "Delivery phases", value: "11 with stage gates G0–G10" },
    ],
    differentiators: [
      "ISA-95 / Purdue L0–L4 boundary with a hard no-write rule into OT control layers",
      "Every AI use case registered with autonomy level, human owner, guardrails, and kill-switch",
      "ISO 9001:2015 + IATF 16949-aligned process coverage from RFQ through recall",
      "USD-only commercial model across all scenarios — no foreign currency anywhere in the payload",
      "Standard vs scope-dependent deliverables declared before signature (blueprint §5)",
    ],
  },

  businessModels: [
    { id: "mfg-bm-01", name: "Discrete make-to-order (MTO)", description: "Engine-to-order components and assemblies sold against customer drawings and RFQs.", revenueMechanics: "Quote-based pricing with tooling/NRE amortisation; margin protected by DoA gates.", platformFit: "MFG-WF-01/03/11 + MOD-02/03/12." },
    { id: "mfg-bm-02", name: "Make-to-stock (MTS)", description: "Standard catalog products replenished to forecast and safety stock.", revenueMechanics: "Price-list and contract pricing; margin governed via price books and rebates.", platformFit: "MFG-WF-04/09 + MOD-04/09/21." },
    { id: "mfg-bm-03", name: "Process / batch manufacturing", description: "Batch-produced goods with electronic records and lot traceability.", revenueMechanics: "Contract volumes with batch-release billing; quality gates as commercial gates.", platformFit: "MFG-WF-05/12 + MOD-13/23." },
    { id: "mfg-bm-04", name: "Contract manufacturing (CMO / tolling)", description: "Convert customer-owned material under tolling agreements.", revenueMechanics: "Per-unit or yield-based tolling fees; material usage reconciliation protects both sides.", platformFit: "MFG-WF-05 + MOD-26." },
    { id: "mfg-bm-05", name: "Hybrid MTO/MTS", description: "Configurable products with standard subassemblies and custom finishing.", revenueMechanics: "Base price + option modifiers; configure-to-order margin analytics.", platformFit: "MFG-WF-01/04 + MOD-02/42." },
    { id: "mfg-bm-06", name: "Aftermarket & spares", description: "Replacement parts and service kits for installed base.", revenueMechanics: "Premium spares pricing, contract service agreements, warranty recovery flows.", platformFit: "MFG-WF-07/22 + MOD-36/33." },
    { id: "mfg-bm-07", name: "High-volume repetitive", description: "Line-fed repetitive production with tight changeover economics.", revenueMechanics: "Cost-plus and index-linked contracts; changeover cost visible in margin.", platformFit: "MFG-WF-09/03 + MOD-11/35." },
    { id: "mfg-bm-08", name: "Regulated manufacturing (GxP-style)", description: "Production under validation and electronic-records discipline.", revenueMechanics: "Long-term agreements; audit evidence and batch release as differentiators.", platformFit: "MFG-WF-12/25 + MOD-13/52." },
  ],

  challenges: [
    { id: "mfg-ch-01", title: "Disconnected planning and floor reality", description: "MPS, MRP, and shop floor run on different clocks; promises drift daily.", impact: "Missed OTIF, expedites, and eroded customer trust.", platformResponse: "MFG-WF-02/03/09/11 with freeze windows, dispatch, and backflush closing the loop." },
    { id: "mfg-ch-02", title: "Quality escapes discovered too late", description: "NCRs, SPC violations, and supplier defects surface after shipment.", impact: "Recalls, chargebacks, and certification risk.", platformResponse: "MFG-WF-18/19/20/21 with real-time SPC reaction plans and lot release gates." },
    { id: "mfg-ch-03", title: "Untraceable product history", description: "Paper or partial records break bidirectional trace during recalls.", impact: "Regulatory exposure and days-long trace queries.", platformResponse: "MFG-WF-23 + MOD-15: 4-hour bidirectional trace with evidence packs." },
    { id: "mfg-ch-04", title: "Uncontrolled engineering changes", description: "Mixed revisions on the floor and in the warehouse.", impact: "Scrap, rework, and customer complaints.", platformResponse: "MFG-WF-13 + MOD-07: ECO effectivity with MES revision blocking." },
    { id: "mfg-ch-05", title: "Supplier quality firefighting", description: "Defects found at incoming inspection; scorecards and SCARs informal.", impact: "Line stops and PPM misses.", platformResponse: "MFG-WF-14/17/26 + MOD-19: PPAP gates, scorecards, SCAR clocks." },
    { id: "mfg-ch-06", title: "Unplanned downtime and OEE fiction", description: "Downtime uncoded; OEE computed from memory.", impact: "Hidden capacity losses and bad capital decisions.", platformResponse: "MOD-14: signal-driven states, coded downtime, six-big-losses analytics." },
    { id: "mfg-ch-07", title: "Cost and margin opacity", description: "Variances visible only at close; loss-making tail hidden.", impact: "Margin erosion discovered too late.", platformResponse: "MOD-27/42: live variance bridges and margin decomposition." },
    { id: "mfg-ch-08", title: "IT/OT integration risk", description: "Ad-hoc cloud-to-PLC connections violate the Purdue model.", impact: "Safety and security exposure.", platformResponse: "MOD-46: IDMZ edge gateway, read-only ingestion, zero write paths to L0–L2." },
    { id: "mfg-ch-09", title: "Uncontrolled AI adoption", description: "Shadow AI tools with no audit, owner, or rollback.", impact: "Hallucinated actions, audit failures, lost trust.", platformResponse: "MOD-47: A0–A3 registry, evidence logs, kill-switches (blueprint §4)." },
    { id: "mfg-ch-10", title: "Skills gaps and certification lapses", description: "Operators run stations without current certification.", impact: "Quality/safety exposure found at audit.", platformResponse: "MOD-38: expiry tracking with dispatch eligibility enforcement." },
    { id: "mfg-ch-11", title: "Inventory accuracy and obsolescence", description: "Book stock diverges from physical; slow movers pile up.", impact: "Working capital loss and stockouts.", platformResponse: "MOD-20/22: status segregation, risk-based cycle counting, obsolescence watchers." },
    { id: "mfg-ch-12", title: "Fragmented audit evidence", description: "Assembling evidence for audits consumes weeks.", impact: "Audit stress and customer scorecard risk.", platformResponse: "MOD-52: evidence packs assembled in ≤1 day from governed sources." },
  ],

  departments: [
    { id: "mfg-dep-01", name: "Sales & Estimating", charter: "Win profitable orders with disciplined quoting and clean handoffs to planning.", primaryModules: ["MFG-MOD-01", "MFG-MOD-02"], kpis: ["Win rate", "Quote turnaround", "Average margin %"] },
    { id: "mfg-dep-02", name: "Production Planning", charter: "Publish feasible plans and protect committed dates.", primaryModules: ["MFG-MOD-08", "MFG-MOD-09", "MFG-MOD-10", "MFG-MOD-11"], kpis: ["MPS adherence", "Schedule stability", "Forecast accuracy"] },
    { id: "mfg-dep-03", name: "Production / Shop Floor", charter: "Execute safely and yield-first with real-time visibility.", primaryModules: ["MFG-MOD-12", "MFG-MOD-13", "MFG-MOD-14"], kpis: ["OEE", "Yield", "Release-to-start"] },
    { id: "mfg-dep-04", name: "Quality", charter: "Prevent escapes with SPC, disciplined NCR/CAPA, and release gates.", primaryModules: ["MFG-MOD-16", "MFG-MOD-17", "MFG-MOD-18"], kpis: ["Cpk", "CAPA cycle time", "Shipping escapes"] },
    { id: "mfg-dep-05", name: "Supplier Quality", charter: "Qualify and improve the supply base before defects arrive.", primaryModules: ["MFG-MOD-19", "MFG-MOD-24"], kpis: ["Incoming PPM", "PPAP first-pass", "SCAR on-time"] },
    { id: "mfg-dep-06", name: "Procurement", charter: "Buy right, on time, at contract price.", primaryModules: ["MFG-MOD-24", "MFG-MOD-25", "MFG-MOD-26"], kpis: ["Requisition-to-PO", "ASL compliance", "Supplier OTD"] },
    { id: "mfg-dep-07", name: "Warehouse & Logistics", charter: "Accurate, fast fulfilment with disciplined FEFO and cut-off adherence.", primaryModules: ["MFG-MOD-20", "MFG-MOD-21", "MFG-MOD-34", "MFG-MOD-35"], kpis: ["Inventory accuracy", "Pick accuracy", "Cut-off adherence"] },
    { id: "mfg-dep-08", name: "Maintenance & Asset", charter: "Maximise availability through PM discipline and calibration integrity.", primaryModules: ["MFG-MOD-31", "MFG-MOD-32", "MFG-MOD-33"], kpis: ["PM compliance", "Availability", "Overdue instruments"] },
    { id: "mfg-dep-09", name: "Finance", charter: "Protect margin with live variance visibility and controlled close.", primaryModules: ["MFG-MOD-27", "MFG-MOD-28", "MFG-MOD-29", "MFG-MOD-30"], kpis: ["Gross margin", "DSO", "Close duration"] },
    { id: "mfg-dep-10", name: "Engineering", charter: "Release controlled changes with complete impact analysis.", primaryModules: ["MFG-MOD-05", "MFG-MOD-06", "MFG-MOD-07"], kpis: ["ECO on-time", "BOM accuracy", "Change escapes"] },
    { id: "mfg-dep-11", name: "HR & Training", charter: "Keep the workforce competent, scheduled, and certified.", primaryModules: ["MFG-MOD-37", "MFG-MOD-38", "MFG-MOD-39"], kpis: ["Certification currency", "Training completion", "Labour plan adherence"] },
    { id: "mfg-dep-12", name: "IT & Integration", charter: "Run the platform safely with governed integrations and the IT/OT boundary.", primaryModules: ["MFG-MOD-44", "MFG-MOD-45", "MFG-MOD-46", "MFG-MOD-50"], kpis: ["API availability", "Sync success", "Boundary violations = 0"] },
    { id: "mfg-dep-13", name: "EHS & Compliance", charter: "Prevent incidents and keep evidence audit-ready.", primaryModules: ["MFG-MOD-51", "MFG-MOD-52"], kpis: ["Near-miss rate", "Incident closure", "Certificate currency"] },
  ],

  roles: [
    { id: "operator", name: "Operator", seniority: "frontline", responsibilities: ["Run dispatched work orders", "Capture good/scrap and downtime", "Raise Andon events"], permissions: ["Execute assigned WO", "Record measurements", "Call Andon"], dashboards: ["Station dashboard", "My tasks"] },
    { id: "line-supervisor", name: "Line Supervisor", seniority: "supervisor", responsibilities: ["Dispatch and sequence the shift", "Respond to Andon", "Approve completions"], permissions: ["Dispatch WO", "Approve completion", "Force-release with reason"], dashboards: ["Line performance", "Andon board"] },
    { id: "quality-engineer", name: "Quality Engineer", seniority: "manager", responsibilities: ["Own control plans and SPC", "Lead NCR/CAPA investigations", "Verify effectiveness"], permissions: ["Edit control plans", "Open/close CAPA", "Approve deviations"], dashboards: ["Quality cockpit", "SPC charts"] },
    { id: "incoming-inspector", name: "Incoming Inspector", seniority: "frontline", responsibilities: ["Execute sampling plans", "Record inspection results", "Trigger NCRs on reject"], permissions: ["Record inspections", "Disposition reject proposals"], dashboards: ["Inspection queue"] },
    { id: "production-planner", name: "Production Planner", seniority: "manager", responsibilities: ["Maintain MPS", "Run and triage MRP", "Manage exceptions"], permissions: ["Publish MPS", "Convert planned orders", "Override freeze with approval"], dashboards: ["Planning workspace"] },
    { id: "scheduling-engineer", name: "Scheduling Engineer", seniority: "manager", responsibilities: ["Finite sequence lines", "Resolve constraints", "Publish dispatch"], permissions: ["Run APS", "Publish schedule"], dashboards: ["Constraint board"] },
    { id: "materials-planner", name: "Materials Planner", seniority: "manager", responsibilities: ["Own MRP integrity", "Manage coverage policies", "Generate requisitions"], permissions: ["Run MRP", "Adjust coverage (logged)"], dashboards: ["Exception worklist"] },
    { id: "buyer", name: "Buyer", seniority: "manager", responsibilities: ["Convert requisitions to POs", "Manage supplier ACKs", "Resolve invoice exceptions"], permissions: ["Issue PO", "Resolve match exceptions"], dashboards: ["PO worklist"] },
    { id: "supplier-quality-engineer", name: "Supplier Quality Engineer", seniority: "manager", responsibilities: ["Run PPAP/APQP", "Own scorecards and SCARs", "Lead supplier audits"], permissions: ["Approve PSW", "Issue SCAR", "Update ratings"], dashboards: ["Supplier quality"] },
    { id: "warehouse-operator", name: "Warehouse Operator", seniority: "frontline", responsibilities: ["Directed putaway and picking", "Scan verification", "FEFO compliance"], permissions: ["Execute tasks", "Confirm counts"], dashboards: ["Task list"] },
    { id: "shipping-clerk", name: "Shipping Clerk", seniority: "frontline", responsibilities: ["Pick-to-ship execution", "Carrier handover", "ASN/POD capture"], permissions: ["Close shipments", "Print documents"], dashboards: ["Shipping board"] },
    { id: "logistics-coordinator", name: "Logistics Coordinator", seniority: "manager", responsibilities: ["Route orders to nodes", "Track SLAs", "Manage exceptions"], permissions: ["Override routing (logged)", "Chase carriers"], dashboards: ["Logistics control tower"] },
    { id: "maintenance-planner", name: "Maintenance Planner", seniority: "manager", responsibilities: ["Schedule PMs", "Manage spares", "Plan calibration"], permissions: ["Publish PM schedule", "Approve spare parameters"], dashboards: ["Maintenance board"] },
    { id: "maintenance-technician", name: "Maintenance Technician", seniority: "frontline", responsibilities: ["Execute work orders", "Record readings", "Report defects"], permissions: ["Complete MWs", "Issue parts"], dashboards: ["My work orders"] },
    { id: "calibration-technician", name: "Calibration Technician", seniority: "frontline", responsibilities: ["Perform calibrations", "Attach certificates", "Tag failures"], permissions: ["Update instrument status"], dashboards: ["Calibration due list"] },
    { id: "estimator", name: "Estimator", seniority: "manager", responsibilities: ["Build cost roll-ups", "Draft quotes", "Justify margins"], permissions: ["Create quotes", "View cost rates"], dashboards: ["Quote pipeline"] },
    { id: "sales-rep", name: "Sales Representative", seniority: "frontline", responsibilities: ["Own opportunities", "Capture RFQs", "Confirm orders"], permissions: ["Create opportunities", "Issue quotes (post-approval)"], dashboards: ["My pipeline"] },
    { id: "sales-manager", name: "Sales Manager", seniority: "manager", responsibilities: ["Approve discounts", "Own forecast", "Review win/loss"], permissions: ["Approve below-floor quotes"], dashboards: ["Team pipeline"] },
    { id: "customer-service-rep", name: "Customer Service Rep", seniority: "frontline", responsibilities: ["Process orders and RMAs", "Answer delivery queries", "Own customer comms"], permissions: ["Create RMAs", "Update order notes"], dashboards: ["CS worklist"] },
    { id: "design-engineer", name: "Design Engineer", seniority: "manager", responsibilities: ["Own items and BOMs", "Raise ECRs", "Release revisions"], permissions: ["Edit BOM/routing", "Submit ECR"], dashboards: ["Engineering changes"] },
    { id: "change-board", name: "Change Control Board", seniority: "executive", responsibilities: ["Review ECO impact", "Approve effectivity", "Govern change policy"], permissions: ["Approve/reject ECO"], dashboards: ["CCB queue"] },
    { id: "qa-officer", name: "QA Officer", seniority: "manager", responsibilities: ["Batch review and release", "Disposition lots", "Issue CoCs"], permissions: ["E-sign releases", "Disposition stock"], dashboards: ["Release queue"] },
    { id: "controller", name: "Controller", seniority: "executive", responsibilities: ["Own close and cost model", "Approve narratives", "Guard margin"], permissions: ["Approve close", "Approve revaluations"], dashboards: ["Finance close"] },
    { id: "plant-manager", name: "Plant Manager", seniority: "executive", responsibilities: ["Own plant P&L and OEE", "Chair shift reviews", "Drive improvement"], permissions: ["View all plant data", "Approve capital requests"], dashboards: ["Plant cockpit"] },
  ],

  factory: {
    planes: [
      { id: "P1", name: "Experience Plane", purpose: "Portals, mobile floor apps, dashboards", components: ["Operator mobile app", "Supervisor console", "Supplier portal", "Executive dashboards", "Design system (USD formatting, English UI)"] },
      { id: "P2", name: "Capability Plane", purpose: "The 52 industry modules and workflow engine", components: ["MES", "QMS", "APS/MRP", "WMS", "CMMS", "ERP-side modules", "Workflow & approval engine"] },
      { id: "P3", name: "Automation Plane", purpose: "Triggers, jobs, approvals, governed AI agents", components: ["Job scheduler", "Event bus", "Andon escalation", "AI agent host (A0–A3)", "Process Automation Studio"] },
      { id: "P4", name: "Data Plane", purpose: "Source of truth, audit, analytics", components: ["Operational store", "Genealogy/traceability", "Immutable audit log", "KPI marts", "Data warehouse"] },
      { id: "P5", name: "Integration Plane", purpose: "APIs, connectors, identity, IoT", components: ["API gateway", "ERP connectors", "EDI 850/855/810", "SSO (OIDC/SAML)", "IoT edge gateway (IDMZ)"] },
      { id: "P6", name: "Assurance Plane", purpose: "Security, compliance, observability, DR", components: ["SAST/DAST pipeline", "Backup & restore", "SLO dashboards", "IT/OT boundary enforcement", "Release management"] },
    ],
    standardDeliverables: ["SSO-ready identity + persona RBAC", "Immutable audit log", "Workflow & approval engine", "Notification engine", "Document vault", "Admin console", "API layer + webhooks", "Core KPI dashboards (USD)", "Backup/DR runbook", "Staging→prod pipeline", "Security baseline", "English + USD-only content guard"],
    scopeDeliverables: ["ERP/CRM connector", "Payment gateway onboarding", "IoT/edge gateway & OPC-UA broker", "EDI/B2B file exchange", "E-signature integration", "On-prem/VPC deployment", "Multi-language pack", "White-label theming", "Hardware enablement (printers/kiosks)", "Custom BI extract", "Legacy migration/ETL", "Regulated validation package"],
    itOtBoundary: {
      applies: true,
      summary: "ISA-95 / IEC 62264 Purdue model with an Industrial DMZ: TECH360 operates at L3–L4, reads L2 through the IDMZ, and never writes to L1/L0 control layers.",
      levels: [
        { level: "L4", name: "Business planning (ERP/CRM)", tech360Role: "Primary residence — planning, orders, costing" },
        { level: "L3", name: "Site operations (MES/QMS)", tech360Role: "Primary residence — execution, quality, historian" },
        { level: "L2", name: "Supervisory (SCADA/HMI)", tech360Role: "Read-only via IDMZ gateway" },
        { level: "L1", name: "Basic control (PLC/DCS)", tech360Role: "Forbidden — never addressed" },
        { level: "L0", name: "Physical process", tech360Role: "Forbidden — never addressed" },
      ],
      rules: ["No direct writes from L3–L5 into L0–L2", "Historian replication one-way/polled through IDMZ", "IEC 62443 zones & conduits with allow-listed protocols", "Deployments respect production change freezes", "Platform loss degrades to local operator control"],
    },
    aiGovernance: {
      summary: "Every AI use case is registered with autonomy A0–A3, a named human owner, guardrails, metrics, and a tested rollback; promotion beyond A1 requires shadow-mode evidence and gate review.",
      autonomyLevels: [
        { level: "A0", name: "Assist", humanRole: "Reviews and edits before use" },
        { level: "A1", name: "Suggest", humanRole: "Accepts/rejects in-line" },
        { level: "A2", name: "Act-with-approval", humanRole: "Approves per workflow step" },
        { level: "A3", name: "Supervised-act", humanRole: "Audits exceptions; can revoke" },
      ],
      standingGuardrails: ["AI never writes to OT control layers (L0–L2)", "No autonomous clinical/legal/financial determinations (n/a here: no money movement without maker-checker)", "PII minimisation in contexts", "Full evidence logging of every execution", "Kill-switch reverts within one release", "No silent model swaps — model version pinned in release"],
    },
  },

  applications: [
    { id: "app-web", name: "Web Application", description: "Responsive browser app for all roles — planning, quality, finance, and admin consoles.", plane: "P1" },
    { id: "app-mobile", name: "Mobile Application", description: "Operator/technician mobile experience for floor capture, Andon, and inspections (offline-tolerant).", plane: "P1" },
    { id: "app-api", name: "API & Integration Services", description: "Versioned REST APIs, webhooks, EDI adapters, and certified ERP connectors.", plane: "P5" },
    { id: "app-auth", name: "Authentication & Authorization", description: "SSO-ready identity, MFA, persona RBAC, and session governance.", plane: "P6" },
    { id: "app-workflow", name: "Workflow & Notification Services", description: "Approval chains, SLA timers, escalation ladders, and multi-channel notifications.", plane: "P3" },
    { id: "app-file", name: "File & Document Services", description: "Versioned document vault with retention, legal hold, and evidence rooms.", plane: "P4" },
    { id: "app-reporting", name: "Reporting & Analytics Services", description: "Semantic-layer reporting, dashboards, and scheduled exports with row-level security.", plane: "P4" },
    { id: "app-ai", name: "AI Agent Services", description: "Governed AI host: registry, evidence logging, model pinning, kill-switches.", plane: "P3" },
    { id: "app-gateway", name: "IoT Edge Gateway", description: "IDMZ-terminated protocol adapters (OPC-UA/MQTT/Modbus) with read-only ingestion.", plane: "P5" },
  ],

  agents: [
    { id: "agent-estimator", name: "Estimating Copilot", module: "MFG-MOD-02", autonomy: "A1", description: "Flags margin risk and drafts quote structures; estimator owns all pricing.", humanOwner: "estimator", guardrails: ["Never auto-prices", "Floor rules enforced by rules engine"] },
    { id: "agent-planner", name: "Planning Assistant", module: "MFG-MOD-10", autonomy: "A1", description: "Ranks MRP exceptions and proposes sequencing improvements; planner publishes.", humanOwner: "production-planner", guardrails: ["Hard constraints non-negotiable", "No unattended publish"] },
    { id: "agent-quality", name: "Quality Investigator", module: "MFG-MOD-16", autonomy: "A1", description: "Retrieves similar CAPAs and drafts evidence-linked root-cause hypotheses.", humanOwner: "quality-engineer", guardrails: ["RCA remains human-owned", "Evidence citations required"] },
    { id: "agent-spc", name: "SPC Watcher", module: "MFG-MOD-17", autonomy: "A1", description: "Detects pre-violation drift and suggests likely causes; never stops the line.", humanOwner: "quality-engineer", guardrails: ["Alerts only — no control actions"] },
    { id: "agent-supplier", name: "Supplier Risk Monitor", module: "MFG-MOD-19", autonomy: "A1", description: "Watches scorecards and delivery trends for early deterioration signals.", humanOwner: "procurement-manager", guardrails: ["Never auto-downgrades suppliers"] },
    { id: "agent-maintenance", name: "Maintenance Adviser", module: "MFG-MOD-31", autonomy: "A1", description: "Prioritises PMs by failure-risk signals within criticality floors.", humanOwner: "maintenance-planner", guardrails: ["Critical PMs never deprioritised"] },
    { id: "agent-docs", name: "Document Extractor", module: "MFG-MOD-48", autonomy: "A0", description: "Proposes structured fields from RFQs/invoices/batch documents; humans confirm.", humanOwner: "document-owner", guardrails: ["No unattended writes", "Source retained with extraction"] },
    { id: "agent-copilot", name: "Cross-Module Copilot", module: "MFG-MOD-47", autonomy: "A0", description: "Answers grounded questions from governed data with citations; drafts summaries.", humanOwner: "product-owner", guardrails: ["Semantic layer only", "No raw table access", "Evidence logged"] },
  ],

  dataModel: [
    { id: "ent-account", name: "Account / Plant", description: "Customer hierarchy down to ship-to plants.", domain: "customer-sales", keyAttributes: ["Account ID", "Plant code", "Terms", "Credit limit"], relations: ["SalesOrder", "Contract", "ShipTo"], lifecycle: "Active → Dormant → Archived", systemOfRecord: "ERP" },
    { id: "ent-item", name: "Item", description: "Controlled item master with lifecycle and revisions.", domain: "product-engineering", keyAttributes: ["Item ID", "Revision", "Lifecycle", "UoM"], relations: ["BOM", "Routing", "Inventory"], lifecycle: "Prototype → Active → Phase-out → EOL", systemOfRecord: "ERP/PLM" },
    { id: "ent-bom", name: "BOM", description: "Effective-dated multi-level bill of materials.", domain: "product-engineering", keyAttributes: ["BOM ID", "Effectivity", "Level"], relations: ["Item", "BOMLine"], lifecycle: "Draft → Released → Superseded", systemOfRecord: "PLM" },
    { id: "ent-routing", name: "Routing", description: "Work-center steps with standards and tooling.", domain: "product-engineering", keyAttributes: ["Routing ID", "Steps", "Std minutes"], relations: ["WorkCenter", "Item"], lifecycle: "Draft → Released → Superseded", systemOfRecord: "PLM/ERP" },
    { id: "ent-eco", name: "ECR/ECO", description: "Engineering change records with impact and effectivity.", domain: "product-engineering", keyAttributes: ["ECR ID", "ECO ID", "Effectivity"], relations: ["Item", "BOM", "Document"], lifecycle: "Open → Impact → Approved → Implemented → Closed", systemOfRecord: "PLM" },
    { id: "ent-opportunity", name: "Opportunity / RFQ", description: "Pipeline records with structured RFQ line items.", domain: "customer-sales", keyAttributes: ["Opp ID", "Stage", "Amount (USD)"], relations: ["Account", "Quote"], lifecycle: "Lead → Qualified → Quote → Won/Lost", systemOfRecord: "CRM" },
    { id: "ent-quote", name: "Quote", description: "Versioned quotations with margin data.", domain: "customer-sales", keyAttributes: ["Quote ID", "Version", "Margin %"], relations: ["Opportunity", "SalesOrder"], lifecycle: "Draft → Approved → Sent → Accepted/Expired", systemOfRecord: "CRM/ERP" },
    { id: "ent-salesorder", name: "Sales Order", description: "Confirmed orders with promise dates and credit status.", domain: "customer-sales", keyAttributes: ["SO ID", "Promise date", "Status"], relations: ["Account", "WorkOrder", "Shipment"], lifecycle: "Entered → Confirmed → Allocated → Shipped → Invoiced → Closed", systemOfRecord: "ERP" },
    { id: "ent-contract", name: "Price Contract", description: "Customer/supplier agreements with tiers and effectivity.", domain: "customer-sales", keyAttributes: ["Contract ID", "Tiers", "Effectivity"], relations: ["PriceBook", "Account"], lifecycle: "Draft → Active → Amended → Expired", systemOfRecord: "ERP" },
    { id: "ent-forecast", name: "Forecast", description: "Versioned demand forecasts with assumption logs.", domain: "production-planning", keyAttributes: ["Forecast ID", "Version", "Bias"], relations: ["Item", "SOPDecision"], lifecycle: "Draft → Reviewed → Signed → Superseded", systemOfRecord: "Demand planning" },
    { id: "ent-mps", name: "MPS Line", description: "Time-phased production targets with freeze windows.", domain: "production-planning", keyAttributes: ["Item", "Period", "Qty"], relations: ["SalesOrder", "WorkOrder"], lifecycle: "Proposed → Published → Frozen → Actualized", systemOfRecord: "ERP/APS" },
    { id: "ent-plannedorder", name: "Planned Order", description: "MRP outputs for production and purchase.", domain: "production-planning", keyAttributes: ["Planned ID", "Type", "Due date"], relations: ["WorkOrder", "Requisition"], lifecycle: "Generated → Released → Converted → Cancelled", systemOfRecord: "ERP" },
    { id: "ent-workorder", name: "Work Order", description: "Released production orders with execution events.", domain: "mes", keyAttributes: ["WO ID", "Qty", "Status"], relations: ["Item", "ExecutionEvent", "Completion"], lifecycle: "Planned → Released → Started → Completed → Closed", systemOfRecord: "MES" },
    { id: "ent-batch", name: "Batch", description: "Batch records with parameters and disposition.", domain: "mes", keyAttributes: ["Batch ID", "Parameters", "Disposition"], relations: ["WorkOrder", "Deviation"], lifecycle: "Setup → In-process → Review → Released/Rejected", systemOfRecord: "MES/QMS" },
    { id: "ent-genealogy", name: "Genealogy Link", description: "As-built/as-shipped lot and serial relationships.", domain: "mes", keyAttributes: ["Parent", "Child", "Timestamp"], relations: ["Lot", "Shipment"], lifecycle: "Append-only", systemOfRecord: "MES" },
    { id: "ent-controlplan", name: "Control Plan", description: "Characteristics, limits, and reaction plans.", domain: "qms", keyAttributes: ["Plan ID", "Characteristics", "Reaction"], relations: ["Item", "SPCPoint"], lifecycle: "Draft → Released → Revised", systemOfRecord: "QMS" },
    { id: "ent-ncr", name: "NCR / CAPA", description: "Nonconformances through root cause to verified closure.", domain: "qms", keyAttributes: ["NCR ID", "CAPA ID", "Root cause"], relations: ["InspectionRecord", "EffectivenessCheck"], lifecycle: "Open → Contained → RCA → Actions → Verified → Closed", systemOfRecord: "QMS" },
    { id: "ent-inspection", name: "Inspection Record", description: "Incoming/in-process/final results with dispositions.", domain: "qms", keyAttributes: ["Record ID", "Sample results", "Disposition"], relations: ["Lot", "NCR"], lifecycle: "Planned → Executed → Dispositioned", systemOfRecord: "QMS" },
    { id: "ent-inventory", name: "Inventory Balance", description: "Status-segregated stock with valuation.", domain: "inventory-warehouse", keyAttributes: ["Item", "Location", "Status", "Value (USD)"], relations: ["Lot", "Location", "Transaction"], lifecycle: "Received → Available → Allocated → Shipped", systemOfRecord: "ERP/WMS" },
    { id: "ent-lot", name: "Lot / Serial", description: "Traceability units with expiry and holds.", domain: "inventory-warehouse", keyAttributes: ["Lot ID", "Expiry", "Hold status"], relations: ["Item", "GenealogyLink"], lifecycle: "Created → Released → Held → Dispositioned", systemOfRecord: "MES/WMS" },
    { id: "ent-po", name: "Purchase Order", description: "Supplier orders with ACK and match status.", domain: "procurement", keyAttributes: ["PO ID", "ACK", "Match status"], relations: ["Supplier", "GR", "Invoice"], lifecycle: "Requisition → Approved → Transmitted → ACKed → Received → Matched → Closed", systemOfRecord: "ERP" },
    { id: "ent-supplier", name: "Supplier", description: "ASL entries with ratings, risk class, and terms.", domain: "procurement", keyAttributes: ["Supplier ID", "Rating", "Risk class"], relations: ["PO", "Scorecard", "SCAR"], lifecycle: "Applying → Qualified → Conditional → Approved → Suspended", systemOfRecord: "ERP" },
    { id: "ent-invoice", name: "Invoice (AP/AR)", description: "Supplier and customer invoices with approvals.", domain: "finance-cost", keyAttributes: ["Invoice ID", "Amount (USD)", "Status"], relations: ["PO", "Payment", "Dispute"], lifecycle: "Captured → Validated → Approved → Paid → Reconciled", systemOfRecord: "ERP" },
    { id: "ent-asset", name: "Asset & PM Plan", description: "Equipment registry with PM and calibration linkage.", domain: "maintenance-asset", keyAttributes: ["Asset ID", "Criticality", "PM plan"], relations: ["MaintenanceWorkOrder", "Instrument"], lifecycle: "Commissioned → In-service → PM → Overhaul → Retired", systemOfRecord: "CMMS" },
    { id: "ent-shipment", name: "Shipment", description: "Outbound shipments with ASN, carrier, and POD.", domain: "logistics-distribution", keyAttributes: ["Shipment ID", "Carrier", "POD"], relations: ["SalesOrder", "Invoice"], lifecycle: "Planned → Picked → Shipped → Delivered → POD", systemOfRecord: "WMS/TMS" },
    { id: "ent-timecard", name: "Time Card", description: "Approved labour time charged to work orders.", domain: "workforce", keyAttributes: ["Card ID", "Hours", "Approval"], relations: ["Employee", "WorkOrder"], lifecycle: "Captured → Approved → Exported", systemOfRecord: "T&A/ERP" },
    { id: "ent-audit", name: "Audit Event", description: "Immutable actor/before/after records across modules.", domain: "security-compliance", keyAttributes: ["Event ID", "Actor", "Before/After"], relations: ["All entities (reference)"], lifecycle: "Append-only", systemOfRecord: "Platform" },
    { id: "ent-aicfg", name: "AI Use Case Config", description: "Registry entries: autonomy, owner, guardrails, model version.", domain: "ai-automation", keyAttributes: ["UseCase ID", "Autonomy", "Model version"], relations: ["AIExecutionLog"], lifecycle: "Draft → Registered → Promoted/Demoted → Retired", systemOfRecord: "Platform" },
  ],

  portals: [
    { id: "portal-customer", name: "Customer & Partner Portal", audience: "Customers, dealers, suppliers", description: "RFQ submission, order status, deliveries, CoC retrieval, and returns initiation.", keyScreens: ["RFQ submit", "Order status", "Delivery tracking", "Document retrieval", "RMA request"] },
    { id: "portal-supplier", name: "Supplier Portal", audience: "Suppliers and 3PLs", description: "PO/ACK, ASN, invoice submission, scorecards, and PPAP/SCAR collaboration.", keyScreens: ["PO inbox", "ASN submit", "Invoice submit", "Scorecard view", "SCAR workspace"] },
    { id: "portal-shopfloor", name: "Shop Floor App", audience: "Operators and technicians", description: "Station dispatch, instruction view, capture, Andon, and maintenance tasks.", keyScreens: ["My dispatch", "Work instructions", "Capture", "Andon", "My work orders"] },
    { id: "portal-management", name: "Management Cockpit", audience: "Supervisors, managers, executives", description: "Role-scoped dashboards: line performance, quality, supply, finance, and safety.", keyScreens: ["Line board", "Quality cockpit", "Supply tower", "Finance pack", "Safety board"] },
  ],

  workflows: MANUFACTURING_WORKFLOWS,
  modules: MANUFACTURING_MODULES,

  integrations: [
    { id: "int-edi", name: "EDI (850/855/810/856)", direction: "bidirectional", protocol: "EDI AS2/SFTP", description: "Purchase orders, acknowledgments, invoices, and ASNs with trading partners." },
    { id: "int-erp", name: "ERP connector", direction: "bidirectional", protocol: "REST/OData", description: "Certified connectors for SAP, Oracle, Dynamics, NetSuite master and transaction sync." },
    { id: "int-iot", name: "IoT edge gateway", direction: "inbound", protocol: "OPC-UA/MQTT/Modbus via IDMZ", description: "Read-only machine signal ingestion; zero write paths to control layers." },
    { id: "int-sso", name: "Identity federation", direction: "inbound", protocol: "OIDC/SAML", description: "SSO with MFA and directory-driven group-to-role mapping." },
    { id: "int-carrier", name: "Carrier APIs", direction: "bidirectional", protocol: "REST", description: "Rates, labels, tracking, and POD for parcel and freight carriers." },
    { id: "int-bank", name: "Bank feeds", direction: "inbound", protocol: "MT940/CSV/API", description: "Statement ingestion for payment reconciliation and cash visibility." },
    { id: "int-email", name: "Email & SMS", direction: "outbound", protocol: "SMTP/API", description: "Notifications, acknowledgments, and escalation channels with delivery receipts." },
    { id: "int-plm", name: "PLM sync", direction: "bidirectional", protocol: "REST", description: "Items, BOMs, routings, and ECO effectivity with engineering systems." },
  ],

  security: [
    { id: "sec-rbac", name: "Persona RBAC", description: "24 personas with least-privilege permission sets and quarterly access reviews.", plane: "P6" },
    { id: "sec-mfa", name: "MFA & SSO", description: "Mandatory MFA for all users; SSO via OIDC/SAML with local fallback.", plane: "P6" },
    { id: "sec-audit", name: "Immutable audit log", description: "Append-only actor/before/after events with tamper alerting and SIEM export.", plane: "P4" },
    { id: "sec-ot", name: "IT/OT boundary", description: "IDMZ enforcement, protocol allow-lists, and zero-write rule to L0–L2.", plane: "P6" },
    { id: "sec-secrets", name: "Secrets management", description: "Vaulted credentials, rotation schedules, and no secrets in logs.", plane: "P6" },
    { id: "sec-pipeline", name: "Secure pipeline", description: "SAST, dependency scanning, and signed releases in CI.", plane: "P6" },
    { id: "sec-data", name: "Data protection", description: "Encryption in transit/at rest, PII minimisation, and retention policies.", plane: "P4" },
    { id: "sec-ai", name: "AI guardrails", description: "Registry-driven autonomy limits, evidence logging, and kill-switches.", plane: "P3" },
  ],

  analytics: [
    { id: "an-exec", name: "Executive Plant Cockpit", audience: "Executive", kpis: [
      { name: "OEE", formula: "A×P×Q", target: "≥80%", unit: "%", frequency: "daily" },
      { name: "OTIF", formula: "On-time-in-full lines / total", target: "≥95%", unit: "%", frequency: "weekly" },
      { name: "Gross margin", formula: "(Rev−COGS)/Rev", target: "Plan ±2pp", unit: "%", frequency: "monthly" },
      { name: "TRIR (safety)", formula: "Recordable incidents ×200k / hours", target: "Trend down", unit: "index", frequency: "monthly" },
    ] },
    { id: "an-ops", name: "Operations Board", audience: "Supervisor", kpis: [
      { name: "Schedule adherence", formula: "Actual starts / scheduled starts", target: "≥90%", unit: "%", frequency: "daily" },
      { name: "Yield", formula: "Good / started", target: "≥97%", unit: "%", frequency: "daily" },
      { name: "Downtime minutes", formula: "Σ stop minutes", target: "Trend down", unit: "minutes", frequency: "daily" },
    ] },
    { id: "an-quality", name: "Quality Cockpit", audience: "Quality", kpis: [
      { name: "Cpk (key chars)", formula: "min((USL−μ),(μ−LSL))/3σ", target: "≥1.67 new", unit: "index", frequency: "weekly" },
      { name: "Incoming PPM", formula: "Defective ppm received", target: "Trend down", unit: "ppm", frequency: "monthly" },
      { name: "CAPA cycle", formula: "Closure − creation", target: "≤45 days", unit: "days", frequency: "monthly" },
    ] },
    { id: "an-supply", name: "Supply Tower", audience: "Procurement", kpis: [
      { name: "Supplier OTD", formula: "On-time receipts / receipts", target: "≥95%", unit: "%", frequency: "weekly" },
      { name: "ASL compliance", formula: "ASL PO value / total", target: "100%", unit: "%", frequency: "monthly" },
      { name: "DSO/DSO-AP view", formula: "AR days / AP days", target: "Within policy", unit: "days", frequency: "monthly" },
    ] },
  ],

  deliverables: ["Solution architecture & RBAC matrix", "IT/OT boundary decision record", "Data model & migration plan", "Configured modules (wave scope)", "Integration adapters", "KPI dashboards (USD)", "Test evidence pack (SIT/UAT/performance/security)", "DR runbook + restore drill evidence", "Training materials & super-user program", "AI use-case registry with kill-switch tests", "Stage-gate records G0–G10"],

  roadmap: [
    { id: "ph-0", name: "Discovery & industry fit", weeks: "Weeks 1–2", activities: "Stakeholder interviews, current-state map, scope charter with standard vs scope-dependent table.", gate: "G0 — Signed scope charter" },
    { id: "ph-1", name: "Solution architecture", weeks: "Weeks 2–4", activities: "Data model, integration inventory, RBAC matrix, ISA-95 boundary decision, AI registrations.", gate: "G1 — Architecture Review Board sign-off" },
    { id: "ph-2", name: "Experience design", weeks: "Weeks 4–6", activities: "Design system tokens, IA, top-5 journey prototypes, WCAG check.", gate: "G2 — UX prototype approval" },
    { id: "ph-3", name: "Core platform build", weeks: "Weeks 6–10", activities: "Identity, RBAC, audit log, workflow engine, admin console, API skeleton.", gate: "G3 — Platform alpha on staging" },
    { id: "ph-4", name: "Module wave 1", weeks: "Weeks 10–18", activities: "Priority modules: MES, QMS basics, planning, WMS, orders, dashboards.", gate: "G4 — Wave-1 feature complete" },
    { id: "ph-5", name: "Module wave 2", weeks: "Weeks 18–26", activities: "Remaining modules, cross-module workflows, AI agents at A0/A1.", gate: "G5 — Wave-2 feature complete" },
    { id: "ph-6", name: "Integration & migration", weeks: "Weeks 24–30", activities: "Connectors, SSO, EDI, data migration dry-runs ×2 with reconciliation.", gate: "G6 — Integration test pass (zero P1)" },
    { id: "ph-7", name: "Assurance", weeks: "Weeks 28–32", activities: "Security review, performance test, UAT, DR drill.", gate: "G7 — UAT sign-off + security clearance" },
    { id: "ph-8", name: "Pilot & hypercare", weeks: "Weeks 32–36", activities: "Pilot line/site go-live, daily triage, adoption tracking.", gate: "G8 — Go/no-go for scale" },
    { id: "ph-9", name: "Scale rollout", weeks: "Weeks 36–48", activities: "Site waves, training, super-user program, support handover.", gate: "G9 — Adoption ≥70% weekly active" },
    { id: "ph-10", name: "Continuous improvement", weeks: "Quarterly", activities: "KPI review, AI autonomy promotion review, backlog grooming, release train.", gate: "G10 — Quarterly value review" },
  ],

  pricing: [
    { id: "price-pilot", name: "Pilot (1 line / 1 site, standard scope)", setup: { amount: 18500, currency: "USD", display: "$18,500" }, monthly: { amount: 4200, currency: "USD", display: "$4,200/mo" }, included: ["Core platform + wave-1 modules", "Up to 50 users", "Standard dashboards", "Email support"], notes: "Illustrative USD scenario — final pricing follows the scope charter." },
    { id: "price-standard", name: "Standard plant (single site, full wave 1+2)", setup: { amount: 48000, currency: "USD", display: "$48,000" }, monthly: { amount: 11500, currency: "USD", display: "$11,500/mo" }, included: ["All 13 core domains", "Up to 250 users", "2 connectors included", "Named customer success"], notes: "Scope-dependent items (IoT gateway, EDI, on-prem) quoted separately." },
    { id: "price-enterprise", name: "Multi-site enterprise", setup: { amount: 125000, currency: "USD", display: "$125,000" }, monthly: { amount: 28000, currency: "USD", display: "$28,000/mo" }, included: ["Unlimited sites (fair use)", "SSO + advanced security", "IoT/EDI package", "24×7 support tier"], notes: "Includes ISA-95 boundary design and AI governance onboarding." },
  ],

  faqs: [
    { q: "Is the Manufacturing solution really global and USD-only?", a: "Yes. Every price, scenario, and money field in this payload is USD ($). The runtime validator rejects any foreign currency symbol or code anywhere in the content." },
    { q: "Does the platform write to our PLCs or SCADA?", a: "No. Under the ISA-95/Purdue boundary, TECH360 operates at L3–L4 and reads L2 through an IDMZ gateway. There is a hard, architecture-reviewed rule: zero write paths to L1/L0 control layers." },
    { q: "How is AI kept under control?", a: "Every use case is registered with an autonomy level (A0–A3), a named human owner, guardrails, metrics, and a tested kill-switch. Promotion beyond A1 requires 30 days of shadow-mode evidence and a documented gate review." },
    { q: "What is included as standard versus quoted separately?", a: "Standard: identity/RBAC, audit log, workflow engine, notifications, document vault, admin console, API layer, core dashboards, backup/DR, secure pipeline, English + USD guard. Scope-dependent: ERP connectors, IoT gateway, EDI, payments, e-signature, on-prem, multi-language, hardware, migrations, validation packages." },
    { q: "How long does a typical rollout take?", a: "The 11-phase lifecycle targets G8 (pilot go-live) within 16 weeks for standard scope, with scale rollout to G9 by week 48. Physical-operations deployments add IoT/IDMZ work in phases 1–6." },
    { q: "Which standards does the process coverage align with?", a: "ISO 9001:2015 (clauses 7.1.5, 8.3–8.6, 9.1–9.2, 10.2), IATF 16949 where automotive applies, ISA-95/IEC 62264 and IEC 62443 for the IT/OT boundary, and AIAG PPAP/APQP practice for supplier quality." },
    { q: "Can we start with a subset of the 52 modules?", a: "Yes — the roadmap uses waves. Wave 1 covers the ~40% of modules by value (orders, MES basics, planning, QMS core, WMS, dashboards); wave 2 completes the rest." },
    { q: "How does traceability handle a recall?", a: "MFG-WF-23 executes bidirectional trace with a 4-hour SLA (MOD-15), notification fan-out within 24 hours of decision, retrieval coordination, and effectiveness-based closure with regulatory reporting." },
  ],

  uiScreens: [
    { id: "ui-mes", title: "MES Dispatch Board", description: "Sequenced line schedule with station status, kit readiness, and Andon state.", asset: uiScreenAssets[0] },
    { id: "ui-qms", title: "Quality Cockpit", description: "Control charts with reaction rules, NCR queue, and CAPA aging.", asset: uiScreenAssets[1] },
    { id: "ui-planning", title: "Planning Workspace", description: "MPS grid with capacity load bars, MRP exception list, and freeze-window state.", asset: uiScreenAssets[2] },
    { id: "ui-exec", title: "Executive Dashboard", description: "OEE, OTIF, gross margin (USD), safety, and adoption KPIs with drill-through.", asset: uiScreenAssets[3] },
  ],
};

export const MANUFACTURING_ENTRY: IndustryRegistryEntry = {
  slug: "manufacturing",
  name: "Manufacturing",
  tagline: "Factory operations on a unified six-plane enterprise architecture — RFQ to recall under one governed system",
  category: "physical-operations",
  data: MANUFACTURING_DATA,
  visualAssets: [heroImage, ...uiScreenAssets],
};

export default MANUFACTURING_ENTRY;
