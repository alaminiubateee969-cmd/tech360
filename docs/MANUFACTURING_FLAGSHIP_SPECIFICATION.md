# Manufacturing Flagship Pilot — Specification

**Document ID:** `MFG-FLAGSHIP-SPEC-2026`
**Status:** Phase 3 complete — data engine validated (0 issues)
**Source of truth:** `src/data/industries/manufacturing/` (`workflows.ts`, `modules.ts`, `index.ts`)
**Contracts:** 18-field workflow / 22-field module (see `GLOBAL_INDUSTRY_CONTENT_ARCHITECTURE.md` §3)
**Validation:** `validateIndustrySolution()` + `validateFlagshipCounts()` → 0 issues; `tsc --noEmit` clean

---

## 1. Why Manufacturing is the flagship

Manufacturing exercises **every plane, every guardrail, and every phase** of the TECH360 delivery system:

- It is the only pilot where the **ISA-95 / Purdue IT-OT boundary** (blueprint §3) is fully materialised — including a dedicated edge-gateway module with a hard zero-write rule to L0–L2.
- Its process coverage spans **ISO 9001:2015 and IATF 16949** discipline end-to-end: RFQ → quote → plan → execute → inspect → ship → invoice → warranty → recall → CAPA → audit.
- It carries the largest module surface (**52 modules / 15 domains**) and workflow surface (**26 workflows**), proving the contracts scale.
- It is the reference payload every other industry is assembled from — same six planes, same USD-only/English-only validators, same honesty taxonomy.

## 2. Payload inventory (validated counts)

| Section | Count | Notes |
|---|---|---|
| Operational workflows (18-field) | **26** | `MFG-WF-01`..`MFG-WF-26` |
| Module specs (22-field) | **52** | `MFG-MOD-01`..`MFG-MOD-52`, 15 domains |
| Governed AI use cases (in modules) | **52** | All A0/A1 at pilot — promotion path defined |
| Governed AI agents (section 9) | **8** | A0–A1, each with owner + guardrails |
| Departments | **13** | With charters, module links, KPIs |
| RBAC personas | **24** | frontline → executive, permissions + dashboards |
| Data entities | **28** | With lifecycle + system-of-record |
| Business models | **8** | MTO, MTS, batch, CMO/tolling, hybrid, aftermarket, repetitive, regulated |
| Challenges | **12** | Each mapped to workflow/module response |
| Applications | **9** | Web, Mobile, API, Auth, Workflow, File, Reporting, AI, IoT gateway |
| Portals | **4** | Customer/Partner, Supplier, Shop Floor, Management |
| Integrations | **8** | EDI, ERP, IoT/IDMZ, SSO, carriers, bank, email/SMS, PLM |
| Security controls | **8** | RBAC, MFA/SSO, audit, OT boundary, secrets, pipeline, data, AI |
| Analytics dashboards | **4** | Executive, Operations, Quality, Supply |
| Roadmap phases | **11** | Weeks + gates G0–G10 |
| Pricing scenarios (USD) | **3** | Pilot $18,500 + $4,200/mo · Standard $48,000 + $11,500/mo · Enterprise $125,000 + $28,000/mo |
| FAQs | **8** | USD policy, OT boundary, AI governance, standards, waves |
| UI screens | **4** | MES dispatch, Quality cockpit, Planning workspace, Executive dashboard |

## 3. The 26 workflows by group

### Order-to-Cash (7)
| ID | Workflow | SLA headline |
|---|---|---|
| MFG-WF-01 | RFQ → Quotation → Order Capture | Quote ≤3 business days; confirm ≤4 business hours |
| MFG-WF-02 | Sales Order → Production Planning Handoff | MPS ≤2 business days; re-plan ≤1 business day |
| MFG-WF-03 | Make-to-Order Production Scheduling & Dispatch | Schedule 1 shift ahead; dispatch changes ≤15 min |
| MFG-WF-04 | Make-to-Stock Replenishment & Finished Goods Dispatch | Pick-to-ship ≤4 business hours |
| MFG-WF-05 | Contract Manufacturing (CMO) Batch Release & Tolling | Release ≤2 business days; invoice ≤5 |
| MFG-WF-06 | Dropship & 3PL Order Fulfilment | Supplier PO ≤4 business hours; tracking ≤1 h |
| MFG-WF-07 | Returns, RMA & Refunds | RMA decision ≤1 business day; disposition ≤3 |

### Plan-to-Produce (6)
| ID | Workflow | SLA headline |
|---|---|---|
| MFG-WF-08 | Demand Planning & S&OP Cycle | 10 business days/month |
| MFG-WF-09 | Master Production Schedule & Finite Capacity Scheduling | Weekly MPS; shift schedules |
| MFG-WF-10 | MRP Run & Purchase Requisition | MRP ≤4 business hours |
| MFG-WF-11 | Production Order Release, Execution & Backflush | Release-to-start ≤1 shift |
| MFG-WF-12 | Batch Processing & Electronic Batch Record | Real-time records; QA ≤1 business day |
| MFG-WF-13 | Engineering Change Order / Revision Management | ECR triage ≤2 business days |

### Procure-to-Pay (4)
| ID | Workflow | SLA headline |
|---|---|---|
| MFG-WF-14 | Supplier Onboarding & Qualification | Decision ≤15 business days |
| MFG-WF-15 | Requisition → PO → GR → Three-Way Match | PO ≤1 business day; GR ≤4 business hours |
| MFG-WF-16 | Supplier Invoice & Payment | Post ≤3 business days; pay per terms |
| MFG-WF-17 | Supplier Scorecard & SCAR | Scorecards day 5; SCAR response ≤10 business days |

### Quality-to-Customer (4)
| ID | Workflow | SLA headline |
|---|---|---|
| MFG-WF-18 | Incoming Inspection & Nonconformance | Inspect ≤1 business day; NCR same day |
| MFG-WF-19 | In-Process SPC & Control Plan Enforcement | Reaction ≤15 minutes |
| MFG-WF-20 | Outgoing Quality Release & Certificate of Conformity | Release ≤4 business hours |
| MFG-WF-21 | CAPA | Containment same day; RCA ≤10 business days |

### Service & Compliance (5)
| ID | Workflow | SLA headline |
|---|---|---|
| MFG-WF-22 | Warranty Claims & Field Service | Decision ≤2 business days; response ≤48 h |
| MFG-WF-23 | Product Recall / Traceability Response | Trace ≤4 hours; notify ≤24 hours |
| MFG-WF-24 | Calibration & Preventive Maintenance | PM within due week; overdue = blocked |
| MFG-WF-25 | ISO / IATF 16949 Audit & Certification | NC response ≤10 business days |
| MFG-WF-26 | Supplier PPAP / APQP Approval | Decision ≤10 business days |

Every workflow carries all **18 fields** and ordered steps with owner, SLA, approval, automation, AI hint, controls, data captured, and exception path.

## 4. The 52 modules by domain

| # | Domain (count) | Modules |
|---|---|---|
| 1 | Customer & Sales (4) | Sales CRM & Pipeline · Quotation & Estimation · Order Management & ATP · Pricing & Contracts |
| 2 | Product & Engineering (3) | Item Master & PLM · BOM & Routing · ECO & Document Control |
| 3 | Production Planning (4) | Demand Planning & S&OP · MPS · MRP · Finite Scheduling & Dispatch |
| 4 | MES (4) | Work Order Execution · Batch/EBR · Andon & OEE · Genealogy & Traceability |
| 5 | QMS (4) | NCR & CAPA · SPC & Control Plans · Inspection & Audit · Supplier Quality (PPAP/SCAR) |
| 6 | Inventory & Warehouse (4) | Inventory Control & Valuation · WMS · Cycle Counting · Lot/Serial & Shelf Life |
| 7 | Procurement (3) | Sourcing & Onboarding · Requisition-to-PO · Contracts & Collaboration |
| 8 | Finance & Cost (4) | Cost Accounting · AP & Payments · AR & Invoicing · Budgeting & Close |
| 9 | Maintenance & Asset (3) | CMMS & PM · Calibration Control · Spare Parts & MRO |
| 10 | Logistics & Distribution (3) | Fulfillment & Shipping · TMS · Returns & Reverse Logistics |
| 11 | Workforce (3) | Time & Attendance · Skills & Certification · Labour Planning |
| 12 | Analytics & BI (4) | Dashboards · OEE Analytics · Cost & Margin Analytics · Self-Service Reporting |
| 13 | Integration & API (3) | API Gateway & Webhooks · ERP Connectors · IoT Edge Gateway (IDMZ) |
| 14 | AI & Automation (3) | Governed AI Copilot · Document Intelligence · Process Automation Studio |
| 15 | Security, Compliance & EHS (3) | Identity/RBAC/Audit · EHS · Compliance Evidence & Certificates |

All 52 carry the **22-field contract** including KPI formulas, governed AI use cases with autonomy/owner/guardrails/rollback, effort estimates (design/build/test person-days), and testable acceptance criteria.

## 5. Flagship hard guarantees (tested)

1. **USD-only:** No `€£¥￥₹…` symbols and no `EUR|GBP|BDT|INR|AED|…` codes anywhere in the payload (recursive string walk).
2. **English-only:** No CJK/Cyrillic/Arabic/Hangul/Thai/Devanagari codepoints anywhere.
3. **Completeness:** All 20+ sections non-empty; every workflow has 18 fields; every module has 22 fields.
4. **Counts:** ≥26 workflows, ≥52 modules for `slug === "manufacturing"`.
5. **Visual assets:** Local paths only (no `z-cdn.chatglm.cn` or any third-party CDN), descriptive alt ≥8 chars, `language: "en"`, money-bearing assets `currency: "USD"`.
6. **AI governance:** 52 module-level use cases + 8 agents, each with autonomy level, human owner, guardrails, metrics, rollback plan.

**Evidence run (`.scratch/validate-mfg.ts`):** `issues: 0` — workflows 26, modules 52, roles 24, departments 13, entities 28, agents 8, AI use cases 52.

## 6. IT/OT boundary as implemented in data

`factory.itOtBoundary` (applies = true) declares:

- **L4** business planning — primary residence (ERP-side).
- **L3** site operations — primary residence (MES/QMS).
- **L2** supervisory — read-only via IDMZ.
- **L1/L0** — forbidden, never addressed.

Module **MFG-MOD-46 (IoT/Edge Gateway)** operationalises the boundary: IDMZ-terminated adapters (OPC-UA/MQTT/Modbus), outbound-only replication, allow-listed protocols, IEC 62443 zones & conduits, acceptance criterion *"Architecture review proves zero write paths to L0–L2"*, and KPI **Boundary violations = 0**.

## 7. Governed AI at the flagship

| Level | Count at pilot | Examples |
|---|---|---|
| A0 Assist | 20 | Document extraction, EBR completeness scan, variance narratives, error describer |
| A1 Suggest | 32 | Sequencing optimiser, SPC drift warning, promise-date advisor, risk monitors |
| A2 / A3 | 0 at pilot | Defined in framework; promotion requires 30-day shadow metrics + gate review |

Standing guardrails (blueprint §4) are embedded in `factory.aiGovernance.standingGuardrails` and repeated in every use case's `guardrails[]`.

## 8. Delivery roadmap (11 phases, G0–G10)

Weeks 1–2 Discovery (G0) → 2–4 Architecture incl. ISA-95 decision (G1) → 4–6 UX (G2) → 6–10 Core platform (G3) → 10–18 Module wave 1 (G4) → 18–26 Wave 2 + AI A0/A1 (G5) → 24–30 Integration & migration ×2 dry-runs (G6) → 28–32 Assurance (G7) → 32–36 Pilot hypercare (G8) → 36–48 Scale (G9, ≥70% WAU) → Quarterly continuous improvement (G10).

Standard scope targets **G8 ≤16 weeks** (blueprint §7).

## 9. Illustrative USD pricing (policy-compliant)

| Scenario | Setup | Monthly | Included |
|---|---|---|---|
| Pilot (1 line/site, standard scope) | $18,500 | $4,200/mo | Core + wave-1, 50 users, email support |
| Standard plant (full wave 1+2) | $48,000 | $11,500/mo | 13 domains, 250 users, 2 connectors, named CSM |
| Multi-site enterprise | $125,000 | $28,000/mo | Fair-use unlimited sites, SSO, IoT/EDI package, 24×7 |

All amounts use `Money { currency: "USD", display: "$…" }` — validator-enforced.

## 10. What the other 19 industries inherit

Everything above except the Capability-plane module catalogue and ISA-95 applicability flag: six planes, governance framework, standard/scope deliverable split, lifecycle gates, validators, USD/English policy, honesty taxonomy, and the UI section structure. Phase 4 authors each remaining industry's independent module set (global, USD-only) per `GLOBAL_INDUSTRY_CONTENT_ARCHITECTURE.md`.
