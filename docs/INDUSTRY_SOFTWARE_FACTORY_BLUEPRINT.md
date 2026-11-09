# TECH360 Global Industries Platform — Enterprise Software Factory Blueprint

**Document ID:** `INDUSTRY-SOFTWARE-FACTORY-2026`
**Owner:** TECH360 Platform Engineering
**Applies to:** All 20 global industry solutions delivered under the Industries Platform
**Currency policy:** USD-only (`$`) across every industry, region, and contract type
**Companion documents:** `GLOBAL_INDUSTRY_CONTENT_ARCHITECTURE.md` (content contract), `INDUSTRY_SOLUTIONS_AUDIT.md` (Phase 0 baseline)

---

## 1. Purpose

This blueprint defines the single reference architecture that every TECH360 industry solution is built on — the **Enterprise Software Factory**. It answers three questions that every buyer, delivery manager, and auditor asks:

1. **What planes does the platform have?** (six-plane architecture)
2. **How do we keep physical-world operations safe?** (ISA-95 / Purdue IT-OT boundary)
3. **Who is accountable for AI, and where must a human stay in the loop?** (governed AI responsibility framework)

It also defines what ships in **every** project (standard deliverables) versus what is quoted per engagement (scope-dependent deliverables), and the **11-phase delivery lifecycle** with hard stage gates.

---

## 2. The Six-Plane Enterprise Software Factory

Every industry solution — a hospital platform, an MES for a factory, an LMS for a school chain — is assembled from the same six planes. Industry flavor lives in the **Capability Plane** modules; the other five planes are shared, hardened, and reused.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  P1  EXPERIENCE PLANE — Web portals, mobile apps, staff consoles, kiosks    │
│      Design system · responsive UI · WCAG 2.1 AA · offline-tolerant PWA     │
├─────────────────────────────────────────────────────────────────────────────┤
│  P2  CAPABILITY PLANE — The industry modules (52 in Manufacturing)          │
│      Workflow engine · forms · approvals · role-scoped workbenches         │
├─────────────────────────────────────────────────────────────────────────────┤
│  P3  AUTOMATION PLANE — Event triggers · scheduled jobs · RPA-lite          │
│      Approval chains · notifications · governed AI agents (see §4)          │
├─────────────────────────────────────────────────────────────────────────────┤
│  P4  DATA PLANE — Operational store · MDM · warehouse · KPI marts · audit   │
│      Immutable audit log · retention policies · export & lineage            │
├─────────────────────────────────────────────────────────────────────────────┤
│  P5  INTEGRATION PLANE — REST/GraphQL APIs · webhooks · connectors          │
│      Identity federation (OIDC/SAML) · payments · SMS/email · IoT gateways  │
├─────────────────────────────────────────────────────────────────────────────┤
│  P6  ASSURANCE PLANE — Security · compliance · observability · QA           │
│      Backup & DR · release management · IT/OT safety boundary (ISA-95)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Plane contracts

| Plane | Owns | Never owns | Standard reusable services |
|---|---|---|---|
| **P1 Experience** | Rendering, navigation, accessibility, device adaptation | Business rules, data writes outside the API layer | Design tokens, component library, form renderer, i18n-ready strings |
| **P2 Capability** | Industry workflows, module state machines, departmental workbenches | Cross-tenant data, secrets, infrastructure | Workflow engine, module runtime, RBAC enforcement hooks |
| **P3 Automation** | Triggers, jobs, approvals, notification fan-out, AI agent execution | Direct database writes bypassing P2 validation | Job scheduler, event bus, approval service, AI agent host with guardrails |
| **P4 Data** | Source of truth, master data, audit trail, analytics models | UI concerns, vendor SDK calls | Postgres/MySQL schema patterns, MDM services, audit logger, KPI marts |
| **P5 Integration** | Connectivity, protocol translation, identity brokering, rate limits | Business decisions, long-term storage of third-party payloads beyond retention | API gateway, connector SDK, SSO, payment adapters, IoT gateway spec |
| **P6 Assurance** | Security controls, compliance evidence, test automation, observability, DR | Feature scope | SAST/DAST pipeline, backup/restore drills, SLO dashboards, change advisory |

### 2.2 Why six planes (and not a monolith or a mesh)

- **Buyer clarity:** Every RFP question maps to a plane. "Where is your audit log?" → P4. "How do you integrate with our payment provider?" → P5.
- **Reuse with variation:** 19 of 20 industries share P1, P3, P4, P5, P6 nearly verbatim. Only P2 changes — and only its module catalog.
- **Safe AI adoption:** AI lives in P3 with P4 data access and P6 oversight; it never reaches P1 directly or writes to OT control (see §3).

---

## 3. ISA-95 / Purdue IT-OT Safety Boundary

For any solution touching **physical operations** — Manufacturing, Logistics, Construction, Physical Operations, Travel & Hospitality (building systems), Hospitals — the platform adopts the **ISA-95 / IEC 62264 Purdue Reference Model** as its safety boundary. This is a hard architectural constraint, not a guideline.

### 3.1 Levels and what TECH360 is allowed to touch

| Purdue Level | Domain | Typical systems | TECH360 boundary |
|---|---|---|---|
| **L5** | Enterprise / cloud | External SaaS, partner portals | Allowed — external only |
| **L4** | Business planning & logistics | ERP (finance, procurement, MRP), CRM | **TECH360 lives here** — ERP-side modules, orders, costing, planning |
| **L3** | Site operations / MOM | MES, QMS, LIMS, historian, WMS (site) | **TECH360 lives here** — work orders, SPC, genealogy, dispatch |
| **L2** | Area supervisory control | SCADA, HMI, alarm servers | **Read-only via gateway** — no TECH360 writes to setpoints |
| **L1** | Basic control | PLC, DCS, RTU, motion controllers | **Forbidden** — never addressed by the platform |
| **L0** | Physical process | Sensors, actuators, drives, robots | **Forbidden** — never addressed by the platform |

### 3.2 The Industrial DMZ (IDMZ) and data diode pattern

```
  L0–L2  OT zone (safety-critical)          IDMZ                 L3–L5  IT zone (TECH360)
  ┌───────────────────────┐          ┌─────────────────────┐          ┌───────────────────────┐
  │ PLC / SCADA / HMI     │  historian│  OPC-UA / MQTT      │  REST/    │  TECH360 MES · QMS    │
  │ (no inbound from IT)  │──replicate▶│  broker + buffer    │◀─poll────▶│  ERP · CRM · BI       │
  └───────────────────────┘          │  (one-way diode or   │          └───────────────────────┘
        ▲                            │   reverse proxy)     │
        │ setpoints (manual,         └─────────────────────┘
        │  approved change window)
```

**Non-negotiable rules (enforced in code review and architecture review board):**

1. **No direct writes from L3–L5 into L0–L2.** Commands to machines, if ever required, are produced as *approved work instructions* that an operator executes at the HMI — never as automated setpoint writes from the cloud platform.
2. **Historian replication is one-way or polled.** Plant data flows up through the IDMZ broker; the platform never opens an inbound connection to the SCADA network.
3. **IEC 62443 zones & conduits.** Each Purdue level is a zone; every conduit (protocol path) is allow-listed, authenticated, and logged. IoT/edge gateways terminate protocols (OPC-UA, Modbus, MQTT) inside the IDMZ and speak only REST/MQTT-outbound to the platform.
4. **Change windows & safety interlocks.** Platform deployments never coincide with production-critical change freezes; alarm and interlock configuration changes require dual approval outside the platform.
5. **Fail-safe defaults.** Loss of platform connectivity degrades to local operator control — the plant never depends on the cloud to run safely.

### 3.3 When the boundary applies

- **Applies:** Manufacturing, Logistics, Construction, Physical Operations, Hospitals (medical gas / building systems), Restaurants (kitchen equipment telemetry).
- **Does not apply:** pure digital industries (Education, Legal, Marketing, Agencies) — there the equivalent boundary is *data classification* (PII/PHI/PCI) instead of physical safety, governed by the same zone-and-conduit discipline in P6.

---

## 4. Governed AI Responsibility Framework

AI is a capability of the **Automation Plane (P3)**, never a free-floating feature. Every AI use case is registered, classified, and assigned an autonomy level with a named human owner.

### 4.1 Autonomy levels

| Level | Name | Machine behavior | Human role | Evidence required |
|---|---|---|---|---|
| **A0** | Assist | Drafts, summarizes, classifies; never commits | Reviews and edits before use | Prompt + response logged |
| **A1** | Suggest | Recommends next action with confidence | Accepts / rejects in-line | Decision + reason logged |
| **A2** | Act-with-approval | Executes only after explicit approval in workflow | Approver named per workflow step | Approval record with approver identity |
| **A3** | Supervised-act | Executes routine actions automatically within policy bounds | Audits exceptions; can revoke | Full trace + sampled human audit |

**Default for every new module: A0 or A1.** Promotion to A2/A3 requires: (a) 30 days of A1 shadow-mode metrics, (b) documented rollback/kill-switch test, (c) named accountable owner, (d) data-class compliance sign-off.

### 4.2 Standing guardrails (all industries)

1. **AI never writes to OT control layers (L0–L2).** Hard-coded platform rule.
2. **AI never makes final clinical, legal, or financial determinations.** Healthcare → clinical decision *support* only (A1/A2 with clinician approval). Legal → draft-and-review, never filed automatically. Finance → maker-checker on any money movement; AI may prepare, a human releases.
3. **PII/PHI minimization.** AI contexts are built from redacted/minimized feature sets; raw identifiers are replaced with tokens before inference where the use case allows.
4. **Full auditability.** Every inference logs: use-case ID, autonomy level, model version, input hash, output hash, human decision (if any), timestamp. Logs are immutable in P4.
5. **Kill switch & fallback.** Every A2/A3 use case ships a documented disable path that reverts the workflow to the pre-AI manual step within one release.
6. **No silent model swaps.** Model version is part of the release; regression suite must pass before promotion.
7. **Industry content honesty.** AI capabilities are described as *capabilities with guardrails*, never as "replaces your staff" — see the honesty taxonomy in the content architecture document.

### 4.3 AI registry fields (per use case)

`useCaseId · module · description · autonomy (A0–A3) · dataClass (public/internal/confidential/restricted/PHI/PCI) · humanOwner · approvalStep · guardrails[] · metrics[] · rollbackPlan · modelFamily`

---

## 5. Standard vs Scope-Dependent Deliverables

### 5.1 Standard (included in every industry engagement)

| # | Deliverable | Plane |
|---|---|---|
| S1 | Identity, SSO-ready auth, granular RBAC (personas from the role catalogue) | P5/P6 |
| S2 | Immutable audit log with query UI and retention policy | P4 |
| S3 | Workflow & approval engine (SLA timers, escalation, delegation) | P2/P3 |
| S4 | Notification engine (in-app, email, SMS-ready, webhook) | P3/P5 |
| S5 | Document & file vault (versioning, access control, retention) | P4 |
| S6 | Admin console (tenants, users, modules, feature flags, lookups) | P1 |
| S7 | Public API layer + API keys + webhooks with replay | P5 |
| S8 | Core KPI dashboards (executive, operational) with USD money formatting | P4/P1 |
| S9 | Backup, point-in-time restore, DR runbook (RPO/RTO defined) | P6 |
| S10 | Staging → production release pipeline with smoke tests | P6 |
| S11 | Security baseline: SAST, dependency scanning, secrets management, TLS 1.2+ | P6 |
| S12 | Global content compliance: English UI, USD-only currency, non-ASCII guard | P1/P6 |

### 5.2 Scope-dependent (quoted per engagement)

| # | Deliverable | Typical trigger |
|---|---|---|
| C1 | ERP/CRM connector (SAP, Oracle, Dynamics, HubSpot…) | Existing system-of-record |
| C2 | Payment gateway onboarding & reconciliation | Direct payment collection |
| C3 | IoT / edge gateway & OPC-UA/MQTT broker (IDMZ) | Physical operations (§3) |
| C4 | EDI / B2B file exchange (AS2, SFTP, VAN) | Enterprise trading partners |
| C5 | E-signature integration (DocuSign, Adobe, regional) | Contract-heavy workflows |
| C6 | On-prem / private VPC deployment | Data residency mandate |
| C7 | Multi-language pack (beyond English) | Regional rollout |
| C8 | White-label / multi-brand theming | Channel partners |
| C9 | Hardware enablement (label printers, kiosks, scanners, badge printers) | Warehouse, front-desk, retail floor |
| C10 | Custom BI extract / warehouse sync | Enterprise analytics team |
| C11 | Migration from legacy system (ETL, reconciliation, cutover plan) | Replacement engagements |
| C12 | Regulated validation package (CSV/GxP, SOC2 evidence pack) | Life sciences, finance audit |

**Rule:** Anything not in §5.1 must appear in the opportunity's scope charter with an explicit "Standard vs Scope-dependent" table before signature.

---

## 6. The 11-Phase Delivery Lifecycle (with stage gates)

| Phase | Name | Key activities | Exit gate (G) | Owner |
|---|---|---|---|---|
| **0** | Discovery & industry fit | Stakeholder interviews, current-state map, module fit vs catalog, USD commercial model | **G0** — Signed scope charter (standard + scope-dependent table) | Engagement Lead |
| **1** | Solution architecture | Data model, integration inventory, RBAC matrix, IT-OT boundary decision (§3), AI use-case registrations | **G1** — Architecture Review Board sign-off | Solution Architect |
| **2** | Experience design | Design system tokens, IA, prototypes for top 5 journeys, WCAG check | **G2** — UX prototype approval | Design Lead |
| **3** | Core platform build | Identity, RBAC, audit log, workflow engine, admin console, API skeleton | **G3** — Platform alpha on staging | Platform Lead |
| **4** | Module wave 1 | Priority modules (top ~40% by value), form builders, department dashboards | **G4** — Wave-1 feature complete + demo | Module Leads |
| **5** | Module wave 2 | Remaining modules, cross-module workflows, AI agents at A0/A1 | **G5** — Wave-2 feature complete | Module Leads |
| **6** | Integration & migration | Connectors, SSO, payment/SMS, data migration dry-runs (2×), reconciliation report | **G6** — Integration test pass (zero P1 defects) | Integration Lead |
| **7** | Assurance | Security review, performance test (target concurrency), UAT with business users, DR drill | **G7** — UAT sign-off + security clearance | QA & Security |
| **8** | Pilot & hypercare | Pilot site/department go-live, daily triage, adoption tracking, defect burn-down | **G8** — Go/no-go for scale rollout | Engagement Lead |
| **9** | Scale rollout | Site/region waves, enablement training, super-user program, support model handover | **G9** — Adoption metrics review (≥70% weekly active target) | Customer Success |
| **10** | Continuous improvement | Quarterly KPI review, AI autonomy promotion review (§4), backlog grooming, release train | **G10** — Quarterly value review | Product Owner |

**Gate discipline:** No phase starts before its gate is recorded in the delivery system with evidence (document link + approver + date). Waivers require Engagement Lead + Architect dual approval and are time-boxed to 10 business days.

---

## 7. Factory Metrics (how we know the factory works)

| Metric | Target | Plane |
|---|---|---|
| Stage-gate pass rate (first attempt) | ≥ 85% | Process |
| P1 defects escaped to pilot | 0 | P6 |
| Integration test pass rate at G6 | 100% | P5/P6 |
| Audit-log completeness (events with actor + before/after) | 100% | P4 |
| AI use cases with registered owner + rollback plan | 100% | P3 |
| OT-boundary violations found in architecture review | 0 | P6 |
| USD-only content violations in CI | 0 | P6 |
| Weekly active users at G9 | ≥ 70% of licensed users | P1/P2 |
| Time-to-first-value (G0 → G8) | ≤ 16 weeks (standard scope) | Process |

---

## 8. Reference: how the 20 industries map to the factory

| Industry group | P2 Capability examples | P3 Automation examples | P5 Integration examples | §3 boundary |
|---|---|---|---|---|
| Manufacturing (flagship) | MES, QMS, PPAP, SPC, CMMS | Andon escalation, SCADA data collection, AI quality review | ERP, OPC-UA gateway, PLM | **Yes — full ISA-95** |
| Logistics & Physical Operations | TMS, WMS, dispatch, yard, HSE | Route optimizer, telematics ingest, exception TMS alerts | TMS/WMS APIs, telematics, ELD | **Yes — full ISA-95** |
| Construction | BOQ, RFIs, submittals, safety, progress billing | Progress photo AI, certification reminders | Accounting, CAD/BIM viewer, payroll | **Yes — partial (equipment)** |
| Healthcare & Hospitals | HIS, ADT, orders, ED triage, claims, compliance | Triage routing, claims scrub, bed management | HL7 v2 / FHIR, LIS/PACS, clearinghouse | **Yes — building systems only** |
| Retail & E-commerce | Commerce, OMS, POS, loyalty, merchandising | Fraud scoring, replenishment, abandoned-cart flows | Payment gateways, shipping carriers, marketplace APIs | Partial (warehouse equipment) |
| Education & Schools | SIS, LMS, admissions, timetabling, accreditation | Attendance nudges, plagiarism review, gradebook analytics | LTI/SSO, payment, proctoring | No — data-class boundary |
| Finance & Professional | Core banking adapters, ledger, KYC/AML, advisory CRM | Transaction monitoring, document extraction | Core systems, bureaus, card networks | No — data-class + maker-checker |
| Legal, Agencies, Marketing, Local, International SMEs, Travel | Matter/case, intake, campaign, booking, property | Intake triage, content assist, booking optimization | CMS, calendars, channel APIs | No — data-class boundary |

---

*This blueprint is the contract between TECH360 solution consultants, engineering, and customers. Any deviation requires an Architecture Review Board record.*
