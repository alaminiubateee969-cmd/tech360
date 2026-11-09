# TECH360 — Global Industry Content Architecture (`GLOBAL_INDUSTRY_CONTENT_ARCHITECTURE.md`)

**Version:** 1.0.0  
**Date:** 2026-11-09  
**Scope:** Canonical data model, honesty/evidence taxonomy, USD-only policy, global vs regional regulatory classification, and validation contract for all 20 TECH360 Industry Solutions.

---

## 1. Architectural Principles

1. **Global Operational Applicability:** Every industry architecture is designed for international enterprises, mid-market operators, and cross-border organizations. No industry defaults to Bangladesh-specific or single-country assumptions. Each industry explicitly distinguishes:
   - **Globally Common Operational Practices** (universal domain workflows, double-entry accounting, lot traceability, RBAC, audit trails).
   - **Configurable Regional Capabilities** (multi-tax jurisdictions, language/date formatting, regional payment rails, carrier connectors, statutory chart-of-accounts mappings).
   - **Jurisdiction-Specific Regulatory Requirements** (HIPAA/GDPR/PCI-DSS/SOX/FDA 21 CFR Part 11/ISO 9001/FIDIC/IOLTA — implemented as scoped technical controls, never claimed as automatic legal certification).
2. **Mandatory USD (`$`) Exclusivity:** Every monetary example, hypothetical order size, threshold, approval limit, budget parameter, and illustrative scenario across all 20 industries uses **United States Dollars (`USD` / `$`)** exclusively. BDT, Taka, `৳`, and all non-USD currencies or conversion tables are strictly prohibited and blocked by automated schema validation.
3. **Strict Honesty & Delivery Status Taxonomy:**
   - `Core Factory Pattern` — Proven engineering pattern supported by TECH360's standard stack (Next.js, TypeScript, Node.js, PostgreSQL/MySQL, Cloud Run, RBAC, immutable audit logging).
   - `Configurable Blueprint` — Reference module or workflow configured per client Statement of Work (SOW), third-party provider credentials, and operational rules.
   - `Proposed Architecture` — Target-state enterprise architecture designed during discovery and delivered across agreed milestones.
   - `Illustrative Scenario` — Hypothetical end-to-end operational walkthrough explicitly labeled as non-client, non-audited, and non-measured.
4. **Governed AI & Safety Boundaries:** Every AI agent specification explicitly defines **allowed actions**, **prohibited actions**, **human approval gates**, **confidence/escalation thresholds**, **audit trail events**, and **deterministic fallback behavior**. AI never autonomously executes regulated medical diagnoses, legal advice, unreviewed financial disbursements, or industrial PLC/SCADA machinery actuation.

---

## 2. Canonical 20-Section Industry Schema (`IndustrySolution`)

Implemented in `src/data/industries/types.ts`, every entry in `INDUSTRY_SOLUTIONS` contains all 20 sections required by Section 5:

| Section # | Schema Property | Required Structure & Minimum Depth |
|---|---|---|
| **5.1** | `hero` | `eyebrow`, `headline`, `valueProposition`, `sectorCategory`, `capabilityBadges` (4+), `primaryCta`, `secondaryCta`, `heroAssetId`, `scopeNote` |
| **5.2** | `overview` | `executiveSummary`, `operationalReality`, `whyGenericSoftwareFails`, `valueChainStages` (5+), `globalApplicability` (`globallyCommon`, `configurableRegional`, `jurisdictionSpecific`) |
| **5.3** | `businessModels` | Array of distinct operational segments (6+ standard; **8** for Manufacturing Flagship) with `name`, `description`, `operationalCharacteristics`, `revenueAndBillingModelUsd`, `softwareImplications` |
| **5.4** | `challenges` | Array of 6–8 sector challenges covering disconnected systems, manual bottlenecks, data errors, visibility gaps, customer friction, compliance risk, and scaling limits |
| **5.5** | `departments` | Array of functional departments (8+ standard; **13** for Manufacturing Flagship) with `name`, `mandate`, `dailyOperations`, `primarySystems`, `crossDepartmentHandoffs`, `keyBottleneckRemoved` |
| **5.6** | `rolesAndPermissions` | Array of 8+ job roles with `roleTitle`, `department`, `dailyResponsibilities`, `painPoints`, `requiredDashboards`, `keyActions`, `approvalAuthorityUsd`, `rbacScope` (least-privilege), `restrictedActions` |
| **5.7** | `workflows` | Array of operational workflows (6+ standard; **26** for Manufacturing Flagship), each containing **all 18 required fields** plus `normalPath`, `exceptionPath`, `recoveryPath`, and `diagramSteps` |
| **5.8** | `factoryBlueprint` | `architecturalThesis`, `layers` (6 stack planes: Experience, Core Domain Apps, Integration/Event Bus, Workflow & Governed AI, Analytics/BI, Security/Identity/Audit), `coreEntities` (with fields, relationships, lifecycle states), optional `otSafetyBoundary` (Purdue/ISA-95 Level 0–4 separation for industrial domains) |
| **5.9** | `applicationCatalogue` | 6–12 proposed enterprise applications with `appId`, `name`, `deliveryStatus`, `category`, `summary`, `primaryUsers`, `coreCapabilities`, `businessValue`, `deploymentOptions` |
| **5.10** | `modules` | Full module specifications (10+ standard; **52** for Manufacturing Flagship), each containing **all 22 required specification fields** |
| **5.11** | `aiAgents` | 5–10 governed AI agents with `agentId`, `name`, `role`, `trigger`, `inputSources`, `allowedActions`, `prohibitedActions`, `humanApprovalGate`, `confidenceEscalationRule`, `auditLogFields`, `fallbackBehavior`, `privacyAndSafetyBoundary` |
| **5.12** | `portals` | 4+ dedicated portals (Customer/Client, Vendor/Supplier/Partner, Staff/Field/Operator, Executive/Admin) with `portalName`, `audience`, `accessModel`, `selfServiceActions`, `documentsExchanged`, `securityBoundary` |
| **5.13** | `integrations` | 6–8 configurable integration categories (ERP/Accounting, USD Payments, Messaging/Email/SMS, Document Storage, Identity/SSO, Domain/Hardware/EDI) with `category`, `examples`, `integrationPattern`, `dataExchanged`, `errorAndRetryHandling`, `availabilityNote` |
| **5.14** | `securityGovernance` | Structured controls across `rbacAndLeastPrivilege`, `segregationOfDuties`, `immutableAuditLogging`, `encryptionAndSecrets`, `backupAndDisasterRecovery`, `dataRetentionAndPrivacy`, `environmentSeparation`, `apiAndWebhookSecurity`, `aiGovernance`, and `complianceAlignmentDisclaimer` |
| **5.15** | `analyticsAndKpis` | `executiveDashboards` (3–4 role dashboards) + `kpis` (8–15 KPIs with `name`, `formula`, `unit`, `targetRole`, `decisionSupported`, `sourceModules`, `refreshCadence`, `illustrativeBenchmarkNote`) |
| **5.16** | `factoryDeliverables` | Explicit separation of `standardDeliverables` (included in engineered custom builds) vs `scopeDependentDeliverables` (optional/SOW-scoped items) + `handoverAndOwnershipPolicy` |
| **5.17** | `implementationRoadmap` | **11 standardized phases** customized to the industry (`phaseNumber` 1–11, `phaseName`, `objective`, `keyActivities`, `deliverables`, `clientApprovalGate`, `riskControls`) |
| **5.18** | `illustrativeScenario` | Explicitly badged hypothetical walkthrough (`badge`, `hypotheticalProfile`, `operationalContextUsd`, `beforeState`, `proposedArchitecture`, `workflowTransformation`, `intendedOutcomes`, `honestyDisclaimer`) |
| **5.19** | `faqs` | 8 substantive, non-generic industry FAQs addressing custom vs off-the-shelf, migration, integrations, security/compliance, AI human-in-the-loop, USD scoping, phased delivery, and code ownership |
| **5.20** | `scopingCta` | Industry-tailored discovery headline, scoping preparation checklist (4–5 items), primary `#/contact` action, and secondary AI assistant trigger |

---

## 3. 18-Field Operational Workflow Contract (Section 5.7)

Every workflow object (`OperationalWorkflow`) enforces all 18 required attributes:
1. `workflowId` & `workflowName` — Unique identifier and domain-specific title
2. `domain` — Functional domain classification
3. `businessObjective` — Measurable operational purpose
4. `triggerEvent` — Exact initiating event (user action, webhook, schedule, threshold)
5. `participatingRoles` — Ordered list of actors across departments/portals
6. `inputData` — Required structured inputs and documents
7. `validationRules` — Pre-execution schema, business, and credit/tolerance checks
8. `stepByStepProcess` — Ordered step array (`stepNumber`, `actor`, `action`, `systemModule`, `stateTransition`)
9. `normalPath` — End-to-end happy-path execution summary
10. `exceptionPath` — Explicit handling of rejections, variances, stockouts, holds, or API failures
11. `recoveryPath` — Compensating transaction, rework, escalation, or retry resolution
12. `systemModulesInvolved` — Linked module IDs/names from Section 5.10
13. `approvalsAndGates` — Maker-checker, threshold (in USD `$`), or quality release sign-offs
14. `automationsAndNotifications` — Event-driven alerts, SLA timers, and webhooks
15. `aiAssistancePoints` — Optional bounded AI drafting/classification/anomaly assistance
16. `humanReviewGates` — Mandatory human sign-off points before irreversible actions
17. `outputRecordsCreated` — Persistent database records and generated documents
18. `auditEventsLogged`, `kpisMeasured`, `securityAccessControls` — Immutable audit trail events, linked KPIs, and RBAC/field-level controls

---

## 4. 22-Field Module Specification Contract (Section 5.10)

Every module object (`IndustryModuleSpec`) enforces all 22 required attributes:
1. `moduleId` — Canonical identifier (e.g., `MFG-MOD-001`)
2. `moduleName` — Clear functional module name
3. `category` — Application domain grouping
4. `deliveryStatus` — `'Core Factory Pattern' | 'Configurable Blueprint' | 'Proposed Architecture'`
5. `purpose` — Operational problem solved
6. `primaryUsers` — Authorized job roles
7. `inputs` — Upstream records, forms, or events consumed
8. `outputs` — Downstream records, ledgers, or dispatches emitted
9. `keyScreens` — Primary UI views (workspace, detail, queue, matrix)
10. `coreEntities` — Persistent domain entities managed
11. `submodules` — Granular submodule breakdown (3+ per module)
12. `workflowLinks` — Workflow IDs utilizing this module
13. `permissions` — Role-level read/create/approve/admin rules
14. `validations` — Invariant checks, tolerances, and state guards
15. `notifications` — Triggered alerts and escalations
16. `reports` — Operational and reconciliation reports
17. `apiEndpointsConceptual` — Conceptual REST/webhook contracts (e.g., `POST /api/v1/work-orders/{id}/release`)
18. `integrationTouchpoints` — External/internal system connectors
19. `aiCapabilitiesOptional` — Optional governed AI copilot/extraction capabilities
20. `securityControls` — Row-level scoping, field masking, MFA/step-up rules
21. `auditLogging` — Before/after diff and actor logging specification
22. `configurableOptions` — Tenant/plant/branch parameters configurable without code rewrites

---

## 5. Differentiating Closely Related Industries

To eliminate generic overlap across the 20 preserved slugs, paired sectors have distinct architectural scopes:
- **`education` vs `schools-training`:** `education` models Higher Education, Universities, Colleges, Academic Research & Multi-Campus Registrar/SIS/Credit-Hour Lifecycle; `schools-training` models K-12 Schools, Guardian Attendance/Safeguarding, Vocational Academies & Corporate Certification Cohorts.
- **`healthcare` vs `hospitals-clinics`:** `healthcare` models Outpatient Specialty Practices, Ambulatory Care, Dental/Allied Health, Telehealth & Recall Workflows; `hospitals-clinics` models Multi-Department Inpatient/Acute Hospitals, Bed/Ward ADT Management, Surgical Theatres, Diagnostic Lab/Radiology & Clinical Governance.
- **`agencies` vs `marketing-agencies`:** `agencies` models Digital Product, Design, Creative & Custom Engineering Agencies (scoping, SOW milestones, time/utilization PSA, client deliverable sign-off); `marketing-agencies` models Performance Media, Paid Acquisition, Content/Social Calendars, Brand Asset Compliance & Multi-Channel Campaign Attribution.
- **`professional-services` vs `legal-services`:** `professional-services` models Management Consulting, Accounting, Audit, Tax & Engineering Advisory Practices (engagement letters, working papers, resource capacity, WIP billing); `legal-services` models Law Firms & Corporate Legal Departments (ethical conflict checks, matter/docket calendaring, privilege walls, IOLTA/client trust accounting).
- **`ecommerce` vs `retail`:** `ecommerce` models Digital-First D2C/B2B Storefronts, Cart/Checkout Orchestration, Subscription/Wholesale Catalogs & 3PL Fulfillment; `retail` models Physical Multi-Store POS, In-Store Inventory/Cycle Counting, Endless-Aisle Ship-from-Store, Merchandising Planograms & Franchise Replenishment.
