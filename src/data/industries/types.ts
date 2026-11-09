/**
 * TECH360 Global Industries Platform — canonical data contracts.
 *
 * Every industry solution (20 slugs) is expressed as one `IndustrySolutionData`
 * object validated by `validateIndustrySolution()` before it reaches any view.
 *
 * Guards enforced here:
 *  - USD-only money: no foreign currency symbol/code may appear in any string.
 *  - English-only content: no CJK / Cyrillic / Arabic / Hangul / etc. codepoints.
 *  - Completeness: required sections present; flagship counts (26 workflows,
 *    52 modules) enforced for the Manufacturing pilot via `FLAGSHIP_MIN_*`.
 *  - Visual assets: local paths only (no third-party CDNs), language "en".
 *
 * See docs/GLOBAL_INDUSTRY_CONTENT_ARCHITECTURE.md for the field-by-field
 * contract this file implements.
 */

/* ------------------------------------------------------------------ */
/* Money & currency (USD-only)                                        */
/* ------------------------------------------------------------------ */

export type CurrencyCode = "USD";

export interface Money {
  /** Numeric amount in USD. */
  amount: number;
  /** Always "USD" — the only permitted currency on this platform. */
  currency: CurrencyCode;
  /** Pre-formatted display string, e.g. "$18,500" / "$4,200/mo". */
  display: string;
}

/* ------------------------------------------------------------------ */
/* Workflow contract — 18 fields                                       */
/* ------------------------------------------------------------------ */

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  /** RBAC persona ID that owns this step. */
  ownerRole: string;
  /** Target duration for this step, human readable (e.g. "2 hours"). */
  sla: string;
  input: string;
  output: string;
  /** System/plane performing the step. */
  system: string;
  /** Approval requirement, if any ("none" when not required). */
  approval: string;
  automation: string;
  aiAssist: string;
  controls: string[];
  dataCaptured: string[];
  exceptionPath: string;
}

/**
 * 18-field operational workflow contract.
 * Field order is stable — validators and views rely on it.
 */
export interface IndustryWorkflow {
  /** 1: Stable ID, e.g. "MFG-WF-01". */
  id: string;
  /** 2: Workflow name. */
  name: string;
  /** 3: Business purpose — what outcome it guarantees. */
  purpose: string;
  /** 4: Trigger that starts the workflow. */
  trigger: string;
  /** 5: Owning department. */
  department: string;
  /** 6: RBAC personas involved (role IDs). */
  roles: string[];
  /** 7: Inputs consumed. */
  inputs: string[];
  /** 8: Outputs produced. */
  outputs: string[];
  /** 9: End-to-end SLA. */
  sla: string;
  /** 10: Ordered execution steps. */
  steps: WorkflowStep[];
  /** 11: KPIs measured by this workflow. */
  kpis: string[];
  /** 12: Systems/planes involved. */
  systems: string[];
  /** 13: Exception paths & failure modes. */
  exceptions: string[];
  /** 14: Control points (approvals, validations, interlocks). */
  controls: string[];
  /** 15: Compliance/standards references. */
  compliance: string[];
  /** 16: Automation opportunities identified. */
  automation: string[];
  /** 17: Governed AI assist opportunities (with autonomy hint). */
  aiAssist: string[];
  /** 18: Deliverables/artifacts this workflow produces. */
  deliverables: string[];
}

/* ------------------------------------------------------------------ */
/* Module contract — 22 fields                                         */
/* ------------------------------------------------------------------ */

export type AutonomyLevel = "A0" | "A1" | "A2" | "A3";

export interface AiUseCase {
  useCaseId: string;
  name: string;
  description: string;
  autonomy: AutonomyLevel;
  dataClass: "public" | "internal" | "confidential" | "restricted" | "PHI" | "PCI";
  humanOwner: string;
  approvalStep: string;
  guardrails: string[];
  metrics: string[];
  rollbackPlan: string;
  modelFamily: string;
}

export interface KpiDefinition {
  name: string;
  formula: string;
  target: string;
  unit: string;
  frequency: "realtime" | "daily" | "weekly" | "monthly" | "quarterly";
}

/**
 * 22-field module specification contract.
 */
export interface ModuleSpec {
  /** 1: Stable ID, e.g. "MFG-MOD-01". */
  id: string;
  /** 2: Module name. */
  name: string;
  /** 3: Domain key (from INDUSTRY_DOMAINS). */
  domain: string;
  /** 4: One-line summary. */
  summary: string;
  /** 5: The problem this module solves. */
  problem: string;
  /** 6: Capability list (feature bullets). */
  capabilities: string[];
  /** 7: RBAC roles that use it. */
  roles: string[];
  /** 8: Data inputs. */
  inputs: string[];
  /** 9: Data outputs. */
  outputs: string[];
  /** 10: Master/transactional data entities owned. */
  dataEntities: string[];
  /** 11: Integrations (S5). */
  integrations: string[];
  /** 12: Workflow IDs this module implements or supports. */
  workflows: string[];
  /** 13: KPIs with formulas. */
  kpis: KpiDefinition[];
  /** 14: Governed AI use cases (see AI Responsibility Framework). */
  aiUseCases: AiUseCase[];
  /** 15: Automations (jobs, triggers, RPA-lite). */
  automations: string[];
  /** 16: Control points. */
  controls: string[];
  /** 17: Compliance/standards. */
  compliance: string[];
  /** 18: Operational SLA. */
  sla: string;
  /** 19: Module dependencies (other module IDs or services). */
  dependencies: string[];
  /** 20: Rollout waves. */
  rolloutPhases: string[];
  /** 21: Effort estimate (person-days). */
  effort: { design: number; build: number; test: number };
  /** 22: Acceptance criteria (testable). */
  acceptanceCriteria: string[];
}

/* ------------------------------------------------------------------ */
/* Visual asset manifest — 12 fields                                   */
/* ------------------------------------------------------------------ */

export interface VisualAsset {
  /** 1: Stable asset ID, e.g. "mfg-hero-01". */
  id: string;
  /** 2: Industry slug (or "platform"). */
  slug: string;
  /** 3: Asset type. */
  type: "hero" | "ui" | "diagram" | "icon";
  /** 4: Public path (must start with "/"). */
  path: string;
  /** 5: Alt text (English, descriptive). */
  alt: string;
  /** 6: Caption (English). */
  caption: string;
  /** 7: Width in px (0 when unknown). */
  width: number;
  /** 8: Height in px (0 when unknown). */
  height: number;
  /** 9: Content language — always "en". */
  language: "en";
  /** 10: Currency depicted (money-bearing assets must be "USD"). */
  currency: CurrencyCode | "none";
  /** 11: Provenance. */
  source: "generated" | "redrawn" | "photography";
  /** 12: Review status. */
  status: "approved" | "pending-review" | "rejected";
}

/* ------------------------------------------------------------------ */
/* The 20 industry sections                                            */
/* ------------------------------------------------------------------ */

export interface IndustryHero {
  headline: string;
  subhead: string;
  eyebrow: string;
  ctas: { label: string; href: string }[];
  image: VisualAsset;
}

export interface IndustryOverview {
  summary: string;
  facts: { label: string; value: string }[];
  differentiators: string[];
}

export interface BusinessModel {
  id: string;
  name: string;
  description: string;
  revenueMechanics: string;
  platformFit: string;
}

export interface IndustryChallenge {
  id: string;
  title: string;
  description: string;
  impact: string;
  platformResponse: string;
}

export interface Department {
  id: string;
  name: string;
  charter: string;
  primaryModules: string[];
  kpis: string[];
}

export interface RolePersona {
  id: string;
  name: string;
  seniority: "frontline" | "supervisor" | "manager" | "executive" | "system";
  responsibilities: string[];
  permissions: string[];
  dashboards: string[];
}

export interface DataEntity {
  id: string;
  name: string;
  description: string;
  domain: string;
  keyAttributes: string[];
  relations: string[];
  lifecycle: string;
  systemOfRecord: string;
}

export interface ApplicationEntry {
  id: string;
  name: string;
  description: string;
  plane: "P1" | "P2" | "P3" | "P4" | "P5" | "P6";
  replaces?: string;
}

export interface GovernedAgent {
  id: string;
  name: string;
  module: string;
  autonomy: AutonomyLevel;
  description: string;
  humanOwner: string;
  guardrails: string[];
}

export interface PortalEntry {
  id: string;
  name: string;
  audience: string;
  description: string;
  keyScreens: string[];
}

export interface IntegrationEntry {
  id: string;
  name: string;
  direction: "inbound" | "outbound" | "bidirectional";
  protocol: string;
  description: string;
}

export interface SecurityControl {
  id: string;
  name: string;
  description: string;
  plane: "P1" | "P2" | "P3" | "P4" | "P5" | "P6";
}

export interface AnalyticsDashboard {
  id: string;
  name: string;
  audience: string;
  kpis: KpiDefinition[];
}

export interface DeliveryPhase {
  id: string;
  name: string;
  weeks: string;
  activities: string;
  gate: string;
}

export interface PricingScenario {
  id: string;
  name: string;
  setup: Money;
  monthly: Money;
  included: string[];
  notes: string;
}

export interface IndustryFaq {
  q: string;
  a: string;
}

export interface UIScreen {
  id: string;
  title: string;
  description: string;
  asset: VisualAsset;
}

export interface FactoryPlane {
  id: "P1" | "P2" | "P3" | "P4" | "P5" | "P6";
  name: string;
  purpose: string;
  components: string[];
}

export interface ItOtBoundary {
  applies: boolean;
  summary: string;
  levels: { level: string; name: string; tech360Role: string }[];
  rules: string[];
}

export interface AiGovernance {
  summary: string;
  autonomyLevels: { level: AutonomyLevel; name: string; humanRole: string }[];
  standingGuardrails: string[];
}

export interface FactoryBlueprint {
  planes: FactoryPlane[];
  standardDeliverables: string[];
  scopeDeliverables: string[];
  itOtBoundary: ItOtBoundary;
  aiGovernance: AiGovernance;
}

/** The full 20-section industry solution payload. */
export interface IndustrySolutionData {
  /** 1: Hero */
  hero: IndustryHero;
  /** 2: Overview */
  overview: IndustryOverview;
  /** 3: Business models */
  businessModels: BusinessModel[];
  /** 4: Challenges */
  challenges: IndustryChallenge[];
  /** 5: Departments */
  departments: Department[];
  /** 6: Roles & RBAC */
  roles: RolePersona[];
  /** 7: Factory blueprint (six planes, deliverables, IT/OT, AI governance) */
  factory: FactoryBlueprint;
  /** 8: Application catalogue */
  applications: ApplicationEntry[];
  /** 9: Governed AI agents */
  agents: GovernedAgent[];
  /** 10: Data model */
  dataModel: DataEntity[];
  /** 11: Portals */
  portals: PortalEntry[];
  /** 12: Workflow explorer (18-field contract) */
  workflows: IndustryWorkflow[];
  /** 13: Module explorer (22-field contract) */
  modules: ModuleSpec[];
  /** 14: Integrations */
  integrations: IntegrationEntry[];
  /** 15: Security & governance */
  security: SecurityControl[];
  /** 16: Analytics & KPIs */
  analytics: AnalyticsDashboard[];
  /** 17: Factory deliverables */
  deliverables: string[];
  /** 18: Delivery roadmap */
  roadmap: DeliveryPhase[];
  /** 19: Illustrative pricing (USD) */
  pricing: PricingScenario[];
  /** 20: FAQs */
  faqs: IndustryFaq[];
  /** 21: Illustrative UI screens */
  uiScreens: UIScreen[];
}

export interface IndustryRegistryEntry {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  data: IndustrySolutionData;
  visualAssets: VisualAsset[];
}

/* ------------------------------------------------------------------ */
/* Runtime validation                                                  */
/* ------------------------------------------------------------------ */

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

/** Flagship pilot minimums (Manufacturing). */
export const FLAGSHIP_MIN_WORKFLOWS = 26;
export const FLAGSHIP_MIN_MODULES = 52;

/** Non-Latin scripts that must never appear in English-only content. */
const NON_LATIN_SCRIPTS: RegExp =
  /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/;

/** Foreign currency indicators that violate the USD-only policy. */
const FOREIGN_CURRENCY: RegExp =
  /[€£¥￥₫₽₹₺₴₦₱₩฿]/;
const FOREIGN_CURRENCY_CODES: RegExp =
  /\b(EUR|GBP|BDT|INR|AED|SAR|CAD|AUD|JPY|CNY|RMB|BDT|Tk|taka)\b/i;

/** The only permitted currency tokens. */
export const ALLOWED_CURRENCY_TOKENS = ["USD", "$"];

/**
 * Recursively walk an object collecting issues from string leaves.
 * `checker` returns a message or null.
 */
function walkStrings(
  value: unknown,
  path: string,
  checker: (s: string, p: string) => string | null,
  issues: ValidationIssue[],
): void {
  if (typeof value === "string") {
    const message = checker(value, path);
    if (message) issues.push({ path, code: "CONTENT", message });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walkStrings(v, `${path}[${i}]`, checker, issues));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      walkStrings(v, `${path}.${k}`, checker, issues);
    }
  }
}

/** USD-only guard: no foreign currency symbol or code in any string. */
export function findCurrencyViolations(data: unknown, rootPath = "$"): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  walkStrings(
    data,
    rootPath,
    (s, p) => {
      if (FOREIGN_CURRENCY.test(s)) return `Foreign currency symbol in "${p}": ${s.slice(0, 80)}`;
      if (FOREIGN_CURRENCY_CODES.test(s)) return `Foreign currency code in "${p}": ${s.slice(0, 80)}`;
      return null;
    },
    issues,
  );
  return issues;
}

/** English-only guard: no non-Latin script codepoints in any string. */
export function findScriptViolations(data: unknown, rootPath = "$"): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  walkStrings(
    data,
    rootPath,
    (s, p) => {
      if (NON_LATIN_SCRIPTS.test(s)) {
        return `Non-English text in "${p}": ${s.slice(0, 80)}`;
      }
      return null;
    },
    issues,
  );
  return issues;
}

function requireNonEmpty(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  const empty =
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0);
  if (empty) issues.push({ path, code: "MISSING", message: `Required section empty: ${path}` });
}

/** Validate one workflow against the 18-field contract. */
export function validateWorkflow(wf: IndustryWorkflow, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fields: [string, unknown][] = [
    ["id", wf.id], ["name", wf.name], ["purpose", wf.purpose], ["trigger", wf.trigger],
    ["department", wf.department], ["roles", wf.roles], ["inputs", wf.inputs],
    ["outputs", wf.outputs], ["sla", wf.sla], ["steps", wf.steps], ["kpis", wf.kpis],
    ["systems", wf.systems], ["exceptions", wf.exceptions], ["controls", wf.controls],
    ["compliance", wf.compliance], ["automation", wf.automation],
    ["aiAssist", wf.aiAssist], ["deliverables", wf.deliverables],
  ];
  for (const [name, v] of fields) requireNonEmpty(v, `${path}.${name}`, issues);
  if (Array.isArray(wf.steps) && wf.steps.length > 0) {
    wf.steps.forEach((s, i) => {
      if (!s.id || !s.name || !s.ownerRole || !s.system) {
        issues.push({
          path: `${path}.steps[${i}]`,
          code: "MISSING",
          message: "Workflow step missing required fields (id/name/ownerRole/system)",
        });
      }
    });
  }
  return issues;
}

/** Validate one module against the 22-field contract. */
export function validateModule(mod: ModuleSpec, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fields: [string, unknown][] = [
    ["id", mod.id], ["name", mod.name], ["domain", mod.domain], ["summary", mod.summary],
    ["problem", mod.problem], ["capabilities", mod.capabilities], ["roles", mod.roles],
    ["inputs", mod.inputs], ["outputs", mod.outputs], ["dataEntities", mod.dataEntities],
    ["integrations", mod.integrations], ["workflows", mod.workflows], ["kpis", mod.kpis],
    ["aiUseCases", mod.aiUseCases], ["automations", mod.automations], ["controls", mod.controls],
    ["compliance", mod.compliance], ["sla", mod.sla], ["dependencies", mod.dependencies],
    ["rolloutPhases", mod.rolloutPhases], ["effort", mod.effort],
    ["acceptanceCriteria", mod.acceptanceCriteria],
  ];
  for (const [name, v] of fields) requireNonEmpty(v, `${path}.${name}`, issues);
  return issues;
}

/** Validate visual assets: local paths, English, approved status optional. */
export function validateVisualAsset(asset: VisualAsset, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!asset.path.startsWith("/")) {
    issues.push({ path: `${path}.path`, code: "ASSET", message: `Asset path must be local: ${asset.path}` });
  }
  if (/chatglm|z-cdn|http/i.test(asset.path) && !asset.path.startsWith("/")) {
    issues.push({ path: `${path}.path`, code: "ASSET", message: `Third-party CDN forbidden: ${asset.path}` });
  }
  if (!asset.alt || asset.alt.trim().length < 8) {
    issues.push({ path: `${path}.alt`, code: "ASSET", message: "Alt text must be descriptive (≥8 chars)" });
  }
  if (asset.language !== "en") {
    issues.push({ path: `${path}.language`, code: "ASSET", message: "Asset language must be 'en'" });
  }
  if (asset.currency !== "none" && asset.currency !== "USD") {
    issues.push({ path: `${path}.currency`, code: "ASSET", message: `Asset currency must be USD or none, got ${asset.currency}` });
  }
  return issues;
}

/**
 * Full industry solution validation: sections, contracts, USD, English, assets.
 * Returns an empty array when the payload is delivery-ready.
 */
export function validateIndustrySolution(
  entry: IndustryRegistryEntry,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const d = entry.data;

  // Section presence (the 20-section contract + metadata)
  requireNonEmpty(entry.slug, "slug", issues);
  requireNonEmpty(entry.name, "name", issues);
  requireNonEmpty(entry.category, "category", issues);
  requireNonEmpty(d.hero, "data.hero", issues);
  requireNonEmpty(d.overview, "data.overview", issues);
  requireNonEmpty(d.businessModels, "data.businessModels", issues);
  requireNonEmpty(d.challenges, "data.challenges", issues);
  requireNonEmpty(d.departments, "data.departments", issues);
  requireNonEmpty(d.roles, "data.roles", issues);
  requireNonEmpty(d.factory, "data.factory", issues);
  requireNonEmpty(d.applications, "data.applications", issues);
  requireNonEmpty(d.agents, "data.agents", issues);
  requireNonEmpty(d.dataModel, "data.dataModel", issues);
  requireNonEmpty(d.portals, "data.portals", issues);
  requireNonEmpty(d.workflows, "data.workflows", issues);
  requireNonEmpty(d.modules, "data.modules", issues);
  requireNonEmpty(d.integrations, "data.integrations", issues);
  requireNonEmpty(d.security, "data.security", issues);
  requireNonEmpty(d.analytics, "data.analytics", issues);
  requireNonEmpty(d.deliverables, "data.deliverables", issues);
  requireNonEmpty(d.roadmap, "data.roadmap", issues);
  requireNonEmpty(d.pricing, "data.pricing", issues);
  requireNonEmpty(d.faqs, "data.faqs", issues);
  requireNonEmpty(d.uiScreens, "data.uiScreens", issues);

  // Contract-level checks
  d.workflows.forEach((wf, i) => issues.push(...validateWorkflow(wf, `data.workflows[${i}]`)));
  d.modules.forEach((m, i) => issues.push(...validateModule(m, `data.modules[${i}]`)));

  // Visual assets
  entry.visualAssets.forEach((a, i) => issues.push(...validateVisualAsset(a, `visualAssets[${i}]`)));
  issues.push(...validateVisualAsset(d.hero.image, "data.hero.image"));
  d.uiScreens.forEach((s, i) => issues.push(...validateVisualAsset(s.asset, `data.uiScreens[${i}].asset`)));

  // USD-only + English-only (whole payload)
  issues.push(...findCurrencyViolations({ entry }, "$"));
  issues.push(...findScriptViolations({ entry }, "$"));

  return issues;
}

/**
 * Convenience guard for CI/tests: the flagship Manufacturing payload must
 * carry at least 26 workflows and 52 modules.
 */
export function validateFlagshipCounts(entry: IndustryRegistryEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (entry.slug === "manufacturing") {
    if (entry.data.workflows.length < FLAGSHIP_MIN_WORKFLOWS) {
      issues.push({
        path: "data.workflows",
        code: "COUNT",
        message: `Manufacturing flagship requires ≥${FLAGSHIP_MIN_WORKFLOWS} workflows (got ${entry.data.workflows.length})`,
      });
    }
    if (entry.data.modules.length < FLAGSHIP_MIN_MODULES) {
      issues.push({
        path: "data.modules",
        code: "COUNT",
        message: `Manufacturing flagship requires ≥${FLAGSHIP_MIN_MODULES} modules (got ${entry.data.modules.length})`,
      });
    }
  }
  return issues;
}
