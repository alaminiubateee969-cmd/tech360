import type {
  FactoryBlueprint,
  DeliveryPhase,
  SecurityControl,
  ApplicationEntry,
  PricingScenario,
  Money,
  IndustryHero,
  VisualAsset,
  ItOtBoundary,
} from "./types";
import { INDUSTRY_IMAGES } from "../industry-images";

/**
 * Shared builders for the 19 non-flagship industry payloads.
 * Guarantees: English content, USD-only money, identical lifecycle gates.
 * The Manufacturing flagship builds its own sections; these defaults let the
 * other industries ship the same six-plane contract with domain-specific
 * overrides where they matter (IT/OT boundary, portal set, pricing).
 */

export function money(amount: number, display: string): Money {
  return { amount, currency: "USD", display };
}

/**
 * Self-hosted imagery actually committed under `public/images/`.
 *
 * The per-industry `…/industries/<slug>-hero.jpg` files these builders used to
 * point at were never committed, so every payload advertised 81 image paths
 * that 404'd. Until dedicated per-industry art exists, every slot resolves to
 * a real, already-shipped photograph: the industry hero reuses the industry's
 * own photograph from `src/data/industry-images.ts` (a single source of truth),
 * and the UI screens reuse the closest committed screen/mockup.
 * `scripts/verify-industry-assets.mjs` fails the build if a referenced path
 * stops existing on disk, so this can never silently drift back to broken paths.
 */
const HERO_FALLBACK_IMAGE = "/images/industry-business.jpg";

/** Committed UI-screen placeholders, used when no dedicated screen art ships. */
const COMMITTED_UI_IMAGES = [
  "/images/website-mockup.png",
  "/images/admin-dashboard.png",
  "/images/crm-dashboard.png",
  "/images/automation-workflow.png",
] as const;

/** The hero photograph for an industry slug (always a committed file). */
export function committedIndustryHero(slug: string): string {
  return INDUSTRY_IMAGES[slug] ?? HERO_FALLBACK_IMAGE;
}

/** A committed UI-screen image for the 1-based screen index of an industry. */
export function committedIndustryUi(slug: string, idx: number): string {
  const offset = [...slug].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return COMMITTED_UI_IMAGES[(offset + idx - 1) % COMMITTED_UI_IMAGES.length];
}

export function heroImage(slug: string, alt: string, caption: string): VisualAsset {
  return {
    id: `${slug}-hero-01`,
    slug,
    type: "hero",
    path: committedIndustryHero(slug),
    alt,
    caption,
    width: 1920,
    height: 1080,
    language: "en",
    currency: "none",
    source: "generated",
    status: "pending-review",
  };
}

export function uiImage(slug: string, idx: number, alt: string, caption: string): VisualAsset {
  return {
    id: `${slug}-ui-0${idx}`,
    slug,
    type: "ui",
    path: committedIndustryUi(slug, idx),
    alt,
    caption,
    width: 1440,
    height: 900,
    language: "en",
    currency: "none",
    source: "generated",
    status: "pending-review",
  };
}

export function makeHero(
  slug: string,
  eyebrow: string,
  headline: string,
  subhead: string,
  alt: string,
  caption: string,
  anchors: [string, string][],
): IndustryHero {
  return {
    eyebrow,
    headline,
    subhead,
    ctas: anchors.map(([label, href]) => ({ label, href })),
    image: heroImage(slug, alt, caption),
  };
}

const STANDARD_DELIVERABLES = [
  "SSO-ready identity + persona RBAC",
  "Immutable audit log",
  "Workflow & approval engine",
  "Notification engine",
  "Document vault",
  "Admin console",
  "API layer + webhooks",
  "Core KPI dashboards (USD)",
  "Backup/DR runbook",
  "Staging→prod pipeline",
  "Security baseline (SAST, deps, secrets, TLS)",
  "English + USD-only content guard",
];

const SCOPE_DELIVERABLES = [
  "ERP/CRM connector",
  "Payment gateway onboarding",
  "IoT/edge gateway (physical operations)",
  "EDI/B2B file exchange",
  "E-signature integration",
  "On-prem/VPC deployment",
  "Multi-language pack",
  "White-label theming",
  "Hardware enablement",
  "Custom BI extract",
  "Legacy migration/ETL",
  "Regulated validation package",
];

const AI_GUARDRAILS = [
  "No autonomous clinical/legal/financial determinations",
  "PII minimisation in model contexts",
  "Full evidence logging of every execution",
  "Kill-switch reverts within one release",
  "No silent model swaps — model version pinned",
  "Default autonomy A0/A1; promotion needs gate review",
];

const DIGITAL_BOUNDARY: ItOtBoundary = {
  applies: false,
  summary:
    "No physical process control. The equivalent boundary is data classification (PII/PHI/PCI) governed by the same zone-and-conduit discipline in the Assurance Plane.",
  levels: [
    { level: "L4", name: "Business systems", tech360Role: "Primary residence" },
    { level: "L3", name: "Operational applications", tech360Role: "Primary residence" },
    { level: "L2", name: "Departmental tools", tech360Role: "Integrated read-only where relevant" },
    { level: "L1", name: "Local devices", tech360Role: "Not applicable" },
    { level: "L0", name: "Physical process", tech360Role: "Not applicable" },
  ],
  rules: [
    "Data classification zones (public/internal/confidential/restricted/PHI/PCI)",
    "Least-privilege conduits between zones with audit logging",
    "Encryption in transit and at rest",
    "Retention and legal-hold policies per data class",
  ],
};

const PHYSICAL_BOUNDARY: ItOtBoundary = {
  applies: true,
  summary:
    "ISA-95 / IEC 62264 Purdue model with an Industrial DMZ: TECH360 operates at L3–L4, reads L2 through the IDMZ, and never writes to L1/L0 control layers.",
  levels: [
    { level: "L4", name: "Business planning", tech360Role: "Primary residence" },
    { level: "L3", name: "Site operations", tech360Role: "Primary residence" },
    { level: "L2", name: "Supervisory control", tech360Role: "Read-only via IDMZ" },
    { level: "L1", name: "Basic control", tech360Role: "Forbidden" },
    { level: "L0", name: "Physical process", tech360Role: "Forbidden" },
  ],
  rules: [
    "No direct writes from L3–L5 into L0–L2",
    "Historian/telemetry replication one-way or polled through IDMZ",
    "Allow-listed protocols at the gateway (IEC 62443 zones & conduits)",
    "Deployments respect operational change freezes",
    "Platform loss degrades to local operator control",
  ],
};

export function makeFactory(physical: boolean): FactoryBlueprint {
  return {
    planes: [
      { id: "P1", name: "Experience Plane", purpose: "Web, mobile, dashboards, portals", components: ["Responsive web app", "Mobile app", "Role dashboards", "Design system (English, USD)"] },
      { id: "P2", name: "Capability Plane", purpose: "Industry modules and workflow engine", components: ["Domain modules", "Workflow & approval engine", "Form builders"] },
      { id: "P3", name: "Automation Plane", purpose: "Triggers, jobs, governed AI", components: ["Job scheduler", "Event bus", "AI agent host (A0–A3)", "Notification fan-out"] },
      { id: "P4", name: "Data Plane", purpose: "Source of truth, audit, analytics", components: ["Operational store", "Immutable audit log", "KPI marts", "Data warehouse"] },
      { id: "P5", name: "Integration Plane", purpose: "APIs, connectors, identity", components: ["API gateway", "SSO (OIDC/SAML)", "Payment/email/SMS adapters", physical ? "IoT/edge gateway (IDMZ)" : "Partner connectors"] },
      { id: "P6", name: "Assurance Plane", purpose: "Security, compliance, observability, DR", components: ["SAST/DAST pipeline", "Backup & restore", "SLO dashboards", "Release management"] },
    ],
    standardDeliverables: STANDARD_DELIVERABLES,
    scopeDeliverables: SCOPE_DELIVERABLES,
    itOtBoundary: physical ? PHYSICAL_BOUNDARY : DIGITAL_BOUNDARY,
    aiGovernance: {
      summary:
        "Every AI use case is registered with autonomy A0–A3, a named human owner, guardrails, metrics, and a tested rollback; promotion beyond A1 requires shadow-mode evidence and gate review.",
      autonomyLevels: [
        { level: "A0", name: "Assist", humanRole: "Reviews and edits before use" },
        { level: "A1", name: "Suggest", humanRole: "Accepts/rejects in-line" },
        { level: "A2", name: "Act-with-approval", humanRole: "Approves per workflow step" },
        { level: "A3", name: "Supervised-act", humanRole: "Audits exceptions; can revoke" },
      ],
      standingGuardrails: AI_GUARDRAILS,
    },
  };
}

export function makeRoadmap(): DeliveryPhase[] {
  return [
    { id: "ph-0", name: "Discovery & industry fit", weeks: "Weeks 1–2", activities: "Stakeholder interviews, current-state map, scope charter with standard vs scope-dependent table.", gate: "G0 — Signed scope charter" },
    { id: "ph-1", name: "Solution architecture", weeks: "Weeks 2–4", activities: "Data model, integration inventory, RBAC matrix, boundary decision, AI registrations.", gate: "G1 — Architecture Review Board sign-off" },
    { id: "ph-2", name: "Experience design", weeks: "Weeks 4–6", activities: "Design system tokens, IA, top-5 journey prototypes, WCAG check.", gate: "G2 — UX prototype approval" },
    { id: "ph-3", name: "Core platform build", weeks: "Weeks 6–10", activities: "Identity, RBAC, audit log, workflow engine, admin console, API skeleton.", gate: "G3 — Platform alpha on staging" },
    { id: "ph-4", name: "Module wave 1", weeks: "Weeks 10–18", activities: "Priority modules by value (top ~40%), department dashboards.", gate: "G4 — Wave-1 feature complete" },
    { id: "ph-5", name: "Module wave 2", weeks: "Weeks 18–26", activities: "Remaining modules, cross-module workflows, AI agents at A0/A1.", gate: "G5 — Wave-2 feature complete" },
    { id: "ph-6", name: "Integration & migration", weeks: "Weeks 24–30", activities: "Connectors, SSO, data migration dry-runs ×2 with reconciliation.", gate: "G6 — Integration test pass (zero P1)" },
    { id: "ph-7", name: "Assurance", weeks: "Weeks 28–32", activities: "Security review, performance test, UAT, DR drill.", gate: "G7 — UAT sign-off + security clearance" },
    { id: "ph-8", name: "Pilot & hypercare", weeks: "Weeks 32–36", activities: "Pilot go-live, daily triage, adoption tracking.", gate: "G8 — Go/no-go for scale" },
    { id: "ph-9", name: "Scale rollout", weeks: "Weeks 36–48", activities: "Site waves, training, super-user program, support handover.", gate: "G9 — Adoption ≥70% weekly active" },
    { id: "ph-10", name: "Continuous improvement", weeks: "Quarterly", activities: "KPI review, AI autonomy promotion review, backlog grooming, release train.", gate: "G10 — Quarterly value review" },
  ];
}

export function makeSecurity(extra: SecurityControl[] = []): SecurityControl[] {
  const base: SecurityControl[] = [
    { id: "sec-rbac", name: "Persona RBAC", description: "Least-privilege permission sets per persona with quarterly access reviews.", plane: "P6" },
    { id: "sec-mfa", name: "MFA & SSO", description: "Mandatory MFA; SSO via OIDC/SAML with local fallback.", plane: "P6" },
    { id: "sec-audit", name: "Immutable audit log", description: "Append-only actor/before/after events with tamper alerting.", plane: "P4" },
    { id: "sec-secrets", name: "Secrets management", description: "Vaulted credentials, rotation schedules, no secrets in logs.", plane: "P6" },
    { id: "sec-pipeline", name: "Secure pipeline", description: "SAST, dependency scanning, signed releases in CI.", plane: "P6" },
    { id: "sec-data", name: "Data protection", description: "Encryption in transit/at rest, PII minimisation, retention policies.", plane: "P4" },
    { id: "sec-ai", name: "AI guardrails", description: "Registry-driven autonomy limits, evidence logging, kill-switches.", plane: "P3" },
  ];
  return [...base, ...extra];
}

export function makeApplications(domainNote: string): ApplicationEntry[] {
  return [
    { id: "app-web", name: "Web Application", description: `Responsive browser app for all roles — ${domainNote}.`, plane: "P1" },
    { id: "app-mobile", name: "Mobile Application", description: "Mobile experience for field and frontline capture (offline-tolerant).", plane: "P1" },
    { id: "app-api", name: "API & Integration Services", description: "Versioned REST APIs, webhooks, and certified connectors.", plane: "P5" },
    { id: "app-auth", name: "Authentication & Authorization", description: "SSO-ready identity, MFA, persona RBAC, session governance.", plane: "P6" },
    { id: "app-workflow", name: "Workflow & Notification Services", description: "Approval chains, SLA timers, escalation ladders, multi-channel notifications.", plane: "P3" },
    { id: "app-file", name: "File & Document Services", description: "Versioned document vault with retention, legal hold, evidence rooms.", plane: "P4" },
    { id: "app-reporting", name: "Reporting & Analytics Services", description: "Semantic-layer reporting, dashboards, scheduled exports, row-level security.", plane: "P4" },
    { id: "app-ai", name: "AI Agent Services", description: "Governed AI host: registry, evidence logging, model pinning, kill-switches.", plane: "P3" },
  ];
}

export function makePricing(
  pilotSetup: number, pilotMonthly: number,
  standardSetup: number, standardMonthly: number,
  enterpriseSetup: number, enterpriseMonthly: number,
): PricingScenario[] {
  const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;
  return [
    { id: "price-pilot", name: "Pilot (single site/department, standard scope)", setup: money(pilotSetup, fmt(pilotSetup)), monthly: money(pilotMonthly, `${fmt(pilotMonthly)}/mo`), included: ["Core platform + wave-1 modules", "Up to 50 users", "Standard dashboards", "Email support"], notes: "Illustrative USD scenario — final pricing follows the scope charter." },
    { id: "price-standard", name: "Standard deployment (full wave 1+2)", setup: money(standardSetup, fmt(standardSetup)), monthly: money(standardMonthly, `${fmt(standardMonthly)}/mo`), included: ["All core domains", "Up to 250 users", "2 connectors included", "Named customer success"], notes: "Scope-dependent items quoted separately." },
    { id: "price-enterprise", name: "Multi-site / enterprise", setup: money(enterpriseSetup, fmt(enterpriseSetup)), monthly: money(enterpriseMonthly, `${fmt(enterpriseMonthly)}/mo`), included: ["Fair-use unlimited sites", "SSO + advanced security", "Priority connector package", "24×7 support tier"], notes: "Includes architecture review and AI governance onboarding." },
  ];
}

/* ------------------------------------------------------------------ */
/* Compact definition → full IndustryRegistryEntry assembler           */
/* ------------------------------------------------------------------ */

import type {
  BusinessModel,
  IndustryChallenge,
  Department,
  RolePersona,
  IndustryWorkflow,
  ModuleSpec,
  GovernedAgent,
  DataEntity,
  PortalEntry,
  IntegrationEntry,
  AnalyticsDashboard,
  IndustryFaq,
  IndustrySolutionData,
  IndustryRegistryEntry,
} from "./types";

export interface IndustryDef {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  /** true = ISA-95 physical boundary applies */
  physical: boolean;
  hero: { headline: string; subhead: string; alt: string; caption: string };
  overview: { summary: string; facts: { label: string; value: string }[]; differentiators: string[] };
  businessModels: BusinessModel[];
  challenges: IndustryChallenge[];
  departments: Department[];
  roles: RolePersona[];
  workflows: IndustryWorkflow[];
  modules: ModuleSpec[];
  agents: GovernedAgent[];
  dataModel: DataEntity[];
  portals: PortalEntry[];
  integrations: IntegrationEntry[];
  securityExtra?: SecurityControl[];
  analytics: AnalyticsDashboard[];
  faqs: IndustryFaq[];
  /** [pilotSetup, pilotMonthly, stdSetup, stdMonthly, entSetup, entMonthly] */
  pricing: [number, number, number, number, number, number];
  uiScreens: { title: string; description: string; alt: string; caption: string }[];
  applicationsNote: string;
}

export function assembleIndustry(def: IndustryDef): IndustryRegistryEntry {
  const hero = makeHero(
    def.slug,
    `Global Industries Platform · ${def.name}`,
    def.hero.headline,
    def.hero.subhead,
    def.hero.alt,
    def.hero.caption,
    [
      ["Explore workflows", "#workflows"],
      ["See the modules", "#modules"],
      ["View delivery roadmap", "#roadmap"],
    ],
  );

  const screenAssets: VisualAsset[] = def.uiScreens.map((s, i) =>
    uiImage(def.slug, i + 1, s.alt, s.caption),
  );

  const data: IndustrySolutionData = {
    hero,
    overview: def.overview,
    businessModels: def.businessModels,
    challenges: def.challenges,
    departments: def.departments,
    roles: def.roles,
    factory: makeFactory(def.physical),
    applications: makeApplications(def.applicationsNote),
    agents: def.agents,
    dataModel: def.dataModel,
    portals: def.portals,
    workflows: def.workflows,
    modules: def.modules,
    integrations: def.integrations,
    security: makeSecurity(def.securityExtra),
    analytics: def.analytics,
    deliverables: [...STANDARD_DELIVERABLES],
    roadmap: makeRoadmap(),
    pricing: makePricing(...def.pricing),
    faqs: def.faqs,
    uiScreens: def.uiScreens.map((s, i) => ({
      id: `${def.slug}-ui-${i + 1}`,
      title: s.title,
      description: s.description,
      asset: screenAssets[i],
    })),
  };

  return {
    slug: def.slug,
    name: def.name,
    tagline: def.tagline,
    category: def.category,
    data,
    visualAssets: [hero.image, ...screenAssets],
  };
}
