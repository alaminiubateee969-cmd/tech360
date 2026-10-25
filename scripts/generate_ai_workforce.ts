/**
 * AI Workforce Registry Generator — deterministic, real data.
 *
 * Reads scripts/agentos_registry.txt (2,000 real AgentOS skill paths),
 * parses 100 categories × 20 agents, and seeds the full AI Workforce
 * schema: company, departments, agents, skills, prompts, SOPs,
 * permissions, tools, models, workflows, evaluations, tests.
 *
 * NO Math.random(). All IDs are derived from a stable hash of the
 * entity's natural key so relations can be wired without round-tripping
 * createMany return values.
 *
 * Usage:  bunx tsx scripts/generate_ai_workforce.ts
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const db = new PrismaClient({ log: ["warn", "error"] });

// =====================================================================
// DETERMINISTIC HELPERS
// =====================================================================

/** FNV-1a 32-bit hash — stable across runs and platforms. */
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic ID from a namespace + natural key. */
function detId(ns: string, key: string): string {
  const h = hashStr(ns + "::" + key);
  // expand to ~20 base36 chars using two hashes of derived keys
  const h2 = hashStr(key + "::" + ns);
  const a = h.toString(36).padStart(7, "0");
  const b = h2.toString(36).padStart(7, "0");
  return `${ns}_${a}${b}`;
}

const ACRONYMS = new Set([
  "crm", "ai", "seo", "api", "rbac", "bi", "lms", "ssl", "qa", "hr", "icla",
  "ceo", "sms", "os", "ui", "ux", "kpi", "mvp", "css", "sql", "pdf", "csv",
  "json", "url", "vps", "dns", "cdn", "ssh", "gpu", "cpu", "ram", "ssd",
  "saas", "paas", "iaas", "llm", "rag", "mcp", "sdk", "cli", "ide", "ffmpeg",
  "tts", "asr", "gpt", "html", "vpn", "roi", "cta", "erp", "cms", "pos",
  "ivr", "otp", "jwt", "oauth", "wasm", "vtt", "hd", "4k", "8k", "aios",
]);

function titleCaseWord(w: string): string {
  if (!w) return w;
  if (ACRONYMS.has(w)) return w.toUpperCase();
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function humanizeCategory(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w === "and" ? "&" : titleCaseWord(w)))
    .join(" ");
}

function humanizeRole(role: string): string {
  return role.split("-").map(titleCaseWord).join(" ");
}

function departmentDescription(slug: string): string {
  const name = humanizeCategory(slug);
  return `The ${name} department at Tech360. Owns the ${name.toLowerCase()} capability surface, operating a 20-agent team that covers intake, execution, quality, and delivery for this domain.`;
}

// =====================================================================
// ROLE TAXONOMY (20 standard AgentOS roles)
// =====================================================================

const STANDARD_ROLES = [
  "approval", "automation", "builder", "content", "cost-calculator", "data",
  "handover", "integration", "manager", "memory", "optimization", "planner",
  "protection", "qa", "rag", "report", "research", "strategy", "training",
  "workflow",
] as const;
type Role = (typeof STANDARD_ROLES)[number];

const ROLE_RESPONSIBILITIES: Record<string, string[]> = {
  manager: [
    "Orchestrate the department's 20-agent team and assign work based on priority and capacity.",
    "Monitor department KPIs and report progress to executive leadership weekly.",
    "Escalate blockers, risks, and ambiguous requests to the appropriate authority.",
    "Allocate resources across competing initiatives to maximise delivered value.",
    "Review team output for alignment with department goals and quality bar.",
    "Coordinate handovers between agents and to external teams.",
    "Maintain the department's operating cadence and SOPs.",
  ],
  approval: [
    "Review incoming requests against the active policy set and approval matrix.",
    "Validate requests for completeness, risk level, and required evidence.",
    "Approve, reject, or request revision on each request with a recorded rationale.",
    "Route high-risk requests to the manager agent or human reviewer.",
    "Maintain a complete, auditable trail of every approval decision.",
  ],
  automation: [
    "Design and configure automations that reduce manual toil across the department.",
    "Trigger workflows in response to events, schedules, or webhooks.",
    "Monitor automation health and resolve exceptions promptly.",
    "Optimise pipelines for latency, reliability, and cost.",
    "Document automation contracts and failure modes for the team.",
  ],
  builder: [
    "Build and configure systems, integrations, and reusable components.",
    "Translate specifications into working, tested implementations.",
    "Integrate third-party components and APIs safely.",
    "Test builds against acceptance criteria before handover.",
    "Document architecture decisions and component contracts.",
  ],
  content: [
    "Write and edit content that matches the brand voice and audience need.",
    "Maintain consistency of tone, terminology, and style across outputs.",
    "Optimise content for SEO, accessibility, and conversion where applicable.",
    "Manage the content calendar and delivery deadlines.",
    "Review draft content from other agents and apply editorial polish.",
  ],
  "cost-calculator": [
    "Estimate the cost of proposed work using current rate cards and historical data.",
    "Track actual spend against budget and forecast end-of-period cost.",
    "Compare vendor and model pricing to recommend the most economical option.",
    "Flag cost overruns and anomalies to the manager agent.",
    "Maintain an up-to-date cost model for the department.",
  ],
  data: [
    "Query datasets to answer business questions accurately and promptly.",
    "Build and maintain reports and dashboards for stakeholders.",
    "Ensure data quality by validating inputs and flagging anomalies.",
    "Transform and enrich datasets for downstream consumption.",
    "Maintain data pipelines and document lineage.",
  ],
  handover: [
    "Prepare comprehensive handover documentation for transitioning scope.",
    "Brief the receiving team on context, status, and open risks.",
    "Verify completeness of deliverables against the agreed scope.",
    "Transfer access, context, and outstanding actions explicitly.",
    "Confirm acceptance with the receiving party before closing out.",
  ],
  integration: [
    "Connect systems via APIs, webhooks, and event streams.",
    "Manage authentication, secrets, and connection health.",
    "Monitor sync jobs and troubleshoot failures end-to-end.",
    "Maintain integration contracts and version compatibility.",
    "Document integration topology and failure recovery steps.",
  ],
  memory: [
    "Manage the agent context store and persist important facts.",
    "Prune stale or low-value memory to keep context focused.",
    "Surface relevant memories to agents at execution time.",
    "Version memory snapshots for reproducibility and rollback.",
    "Enforce retention and privacy rules on stored memory.",
  ],
  optimization: [
    "Analyse system and process performance to find bottlenecks.",
    "Identify and prioritise improvement opportunities by impact.",
    "Propose and run controlled experiments (A/B tests).",
    "Measure gains and roll out successful changes.",
    "Document before/after metrics for every optimisation.",
  ],
  planner: [
    "Define milestones and break work into sequenced, estimable tasks.",
    "Identify dependencies, risks, and critical path.",
    "Estimate effort and duration using historical baselines.",
    "Maintain a living plan that reflects current reality.",
    "Communicate plan changes to stakeholders promptly.",
  ],
  protection: [
    "Enforce safety policies and guardrails on every action.",
    "Detect and block abusive, harmful, or out-of-policy requests.",
    "Validate outputs before they reach users or systems.",
    "Report violations and near-misses to the manager agent.",
    "Maintain the guardrail rule set and exception list.",
  ],
  qa: [
    "Review agent outputs against quality criteria and acceptance bars.",
    "Run and maintain the test suite for prompts, skills, and SOPs.",
    "File defects with reproduction steps and severity ratings.",
    "Verify fixes and close defects only when criteria are met.",
    "Maintain the department's quality dashboard.",
  ],
  rag: [
    "Index documents into the knowledge base with correct metadata.",
    "Retrieve the most relevant context for a given query.",
    "Rank and deduplicate retrieved chunks for quality.",
    "Maintain the knowledge base: add, update, retire documents.",
    "Tune retrieval parameters to improve precision and recall.",
  ],
  report: [
    "Compile metrics into clear, accurate, timely reports.",
    "Build and maintain dashboards for stakeholders.",
    "Schedule and distribute reports on the right cadence.",
    "Narrate findings and highlight what matters most.",
    "Ensure report definitions are versioned and auditable.",
  ],
  research: [
    "Investigate topics using credible, cited sources.",
    "Synthesise findings into concise, actionable briefs.",
    "Cite evidence and flag uncertainty explicitly.",
    "Identify trends and emerging signals relevant to Tech360.",
    "Deliver briefs on the schedule agreed with the requester.",
  ],
  strategy: [
    "Analyse the market, competitors, and internal capability.",
    "Define positioning and prioritise the roadmap.",
    "Assess strategic options and recommend a path forward.",
    "Translate strategy into quarterly objectives and key results.",
    "Communicate strategy clearly across the organisation.",
  ],
  training: [
    "Build training material tailored to the audience and objective.",
    "Deliver training sessions and hands-on exercises.",
    "Assess learner comprehension and certify readiness.",
    "Update curricula as processes and tools evolve.",
    "Maintain a library of reusable learning assets.",
  ],
  workflow: [
    "Design end-to-end workflows that orchestrate multiple agents.",
    "Assign steps to the right agent based on capability and load.",
    "Monitor workflow progress and handle escalations.",
    "Optimise routing and parallelism for throughput.",
    "Document workflow contracts and failure recovery.",
  ],
};

const ROLE_CAPABILITIES: Record<string, string[]> = {
  manager: ["orchestration", "decision-making", "escalation", "kpi-monitoring"],
  approval: ["policy-validation", "risk-assessment", "audit-logging", "decision-routing"],
  automation: ["workflow-design", "trigger-configuration", "exception-handling", "pipeline-monitoring"],
  builder: ["system-configuration", "spec-translation", "component-integration", "build-testing"],
  content: ["copywriting", "brand-voice", "seo-optimisation", "editorial-review"],
  "cost-calculator": ["cost-estimation", "budget-tracking", "vendor-comparison", "overrun-detection"],
  data: ["data-querying", "report-building", "data-quality-assurance", "pipeline-monitoring"],
  handover: ["documentation", "context-transfer", "completeness-verification", "acceptance-confirmation"],
  integration: ["api-management", "authentication-handling", "sync-monitoring", "troubleshooting"],
  memory: ["context-management", "fact-persistence", "memory-pruning", "recall-surfacing"],
  optimization: ["performance-analysis", "bottleneck-identification", "experimentation", "gain-measurement"],
  planner: ["milestone-definition", "task-sequencing", "effort-estimation", "risk-mapping"],
  protection: ["safety-enforcement", "abuse-detection", "output-validation", "guardrail-management"],
  qa: ["output-review", "test-execution", "defect-filing", "fix-verification"],
  rag: ["document-indexing", "context-retrieval", "chunk-ranking", "knowledge-base-management"],
  report: ["metric-compilation", "dashboard-building", "report-scheduling", "finding-narration"],
  research: ["topic-investigation", "source-synthesis", "evidence-citation", "trend-identification"],
  strategy: ["market-analysis", "positioning-definition", "roadmap-planning", "priority-recommendation"],
  training: ["material-development", "session-delivery", "comprehension-assessment", "curriculum-management"],
  workflow: ["workflow-design", "step-assignment", "progress-monitoring", "routing-optimisation"],
};

const ROLE_PERMISSIONS: Record<string, Array<{ resource: string; action: string }>> = {
  manager: [
    { resource: "department-resources", action: "read" },
    { resource: "department-resources", action: "write" },
    { resource: "agent-config", action: "write" },
    { resource: "audit-log", action: "read" },
    { resource: "approvals", action: "write" },
  ],
  approval: [
    { resource: "approval-requests", action: "read" },
    { resource: "approval-requests", action: "write" },
    { resource: "policy", action: "read" },
    { resource: "audit-log", action: "read" },
  ],
  automation: [
    { resource: "workflows", action: "write" },
    { resource: "triggers", action: "write" },
    { resource: "audit-log", action: "read" },
    { resource: "integrations", action: "read" },
  ],
  builder: [
    { resource: "configurations", action: "write" },
    { resource: "specs", action: "write" },
    { resource: "test-results", action: "read" },
    { resource: "components", action: "write" },
  ],
  content: [
    { resource: "content", action: "write" },
    { resource: "leads", action: "read" },
    { resource: "brand-assets", action: "read" },
    { resource: "content-calendar", action: "write" },
  ],
  "cost-calculator": [
    { resource: "costs", action: "read" },
    { resource: "budgets", action: "read" },
    { resource: "invoices", action: "read" },
    { resource: "rate-cards", action: "read" },
  ],
  data: [
    { resource: "datasets", action: "read" },
    { resource: "reports", action: "write" },
    { resource: "pipelines", action: "read" },
    { resource: "metrics", action: "read" },
  ],
  handover: [
    { resource: "handover-docs", action: "write" },
    { resource: "projects", action: "read" },
    { resource: "tasks", action: "read" },
    { resource: "deliverables", action: "read" },
  ],
  integration: [
    { resource: "apis", action: "write" },
    { resource: "webhooks", action: "write" },
    { resource: "audit-log", action: "read" },
    { resource: "credentials", action: "read" },
  ],
  memory: [
    { resource: "memory-store", action: "write" },
    { resource: "memory-store", action: "read" },
    { resource: "knowledge", action: "read" },
  ],
  optimization: [
    { resource: "metrics", action: "read" },
    { resource: "experiments", action: "write" },
    { resource: "audit-log", action: "read" },
    { resource: "performance-data", action: "read" },
  ],
  planner: [
    { resource: "plans", action: "write" },
    { resource: "tasks", action: "read" },
    { resource: "timelines", action: "write" },
    { resource: "dependencies", action: "read" },
  ],
  protection: [
    { resource: "safety-rules", action: "read" },
    { resource: "guardrails", action: "write" },
    { resource: "violations", action: "write" },
    { resource: "audit-log", action: "read" },
  ],
  qa: [
    { resource: "test-results", action: "write" },
    { resource: "defects", action: "write" },
    { resource: "deliverables", action: "read" },
    { resource: "quality-metrics", action: "read" },
  ],
  rag: [
    { resource: "knowledge-base", action: "write" },
    { resource: "documents", action: "read" },
    { resource: "embeddings", action: "write" },
    { resource: "retrieval-config", action: "write" },
  ],
  report: [
    { resource: "reports", action: "write" },
    { resource: "metrics", action: "read" },
    { resource: "dashboards", action: "write" },
    { resource: "audit-log", action: "read" },
  ],
  research: [
    { resource: "research-notes", action: "write" },
    { resource: "sources", action: "read" },
    { resource: "briefs", action: "write" },
    { resource: "citations", action: "write" },
  ],
  strategy: [
    { resource: "strategy-docs", action: "write" },
    { resource: "market-data", action: "read" },
    { resource: "roadmaps", action: "write" },
    { resource: "okrs", action: "write" },
  ],
  training: [
    { resource: "training-material", action: "write" },
    { resource: "curricula", action: "write" },
    { resource: "assessments", action: "read" },
    { resource: "learner-records", action: "read" },
  ],
  workflow: [
    { resource: "workflows", action: "write" },
    { resource: "workflow-runs", action: "read" },
    { resource: "steps", action: "write" },
    { resource: "audit-log", action: "read" },
  ],
};

const DEFAULT_PERMISSIONS: Array<{ resource: string; action: string }> = [
  { resource: "department-resources", action: "read" },
  { resource: "outputs", action: "write" },
  { resource: "audit-log", action: "read" },
];

const ROLE_TOOLS: Record<string, string[]> = {
  manager: ["database-query", "export-report", "schedule-task", "send-notification", "run-evaluation"],
  approval: ["generate-document", "send-notification", "file-read"],
  automation: ["api-call", "schedule-task", "web-scraper", "send-notification"],
  builder: ["code-execution", "file-read", "file-write", "api-call"],
  content: ["generate-document", "web-search", "generate-image", "file-read"],
  "cost-calculator": ["database-query", "export-report", "parse-document", "file-read"],
  data: ["database-query", "analyze-data", "export-report", "file-read"],
  handover: ["generate-document", "file-read", "send-notification"],
  integration: ["api-call", "web-scraper", "file-read", "file-write"],
  memory: ["database-query", "file-read", "file-write"],
  optimization: ["analyze-data", "database-query", "run-evaluation", "file-read"],
  planner: ["generate-document", "schedule-task", "file-read", "database-query"],
  protection: ["file-read", "send-notification", "generate-document"],
  qa: ["run-evaluation", "file-read", "export-report", "analyze-data"],
  rag: ["web-scraper", "file-read", "parse-document", "database-query"],
  report: ["export-report", "analyze-data", "database-query", "generate-document"],
  research: ["web-search", "web-scraper", "file-read", "generate-document"],
  strategy: ["web-search", "analyze-data", "export-report", "database-query"],
  training: ["generate-document", "file-read", "file-write"],
  workflow: ["api-call", "schedule-task", "send-notification", "database-query"],
};

const DEFAULT_TOOLS = ["file-read", "generate-document", "send-notification"];

const ROLE_INPUT_SCHEMAS: Record<string, object> = {
  manager: { type: "object", properties: { request: { type: "string" }, context: { type: "object" }, department: { type: "string" } }, required: ["request"] },
  approval: { type: "object", properties: { request: { type: "string" }, policy: { type: "string" }, riskLevel: { type: "string" } }, required: ["request"] },
  automation: { type: "object", properties: { trigger: { type: "string" }, payload: { type: "object" } }, required: ["trigger"] },
  builder: { type: "object", properties: { spec: { type: "string" }, components: { type: "array" } }, required: ["spec"] },
  content: { type: "object", properties: { topic: { type: "string" }, audience: { type: "string" }, format: { type: "string" } }, required: ["topic"] },
  "cost-calculator": { type: "object", properties: { items: { type: "array" }, period: { type: "string" } }, required: ["items"] },
  data: { type: "object", properties: { query: { type: "string" }, filters: { type: "object" } }, required: ["query"] },
  handover: { type: "object", properties: { scope: { type: "string" }, recipient: { type: "string" } }, required: ["scope"] },
  integration: { type: "object", properties: { source: { type: "string" }, target: { type: "string" }, mapping: { type: "object" } }, required: ["source", "target"] },
  memory: { type: "object", properties: { action: { type: "string" }, key: { type: "string" }, value: { type: "string" } }, required: ["action"] },
  optimization: { type: "object", properties: { target: { type: "string" }, metrics: { type: "object" } }, required: ["target"] },
  planner: { type: "object", properties: { goal: { type: "string" }, constraints: { type: "array" } }, required: ["goal"] },
  protection: { type: "object", properties: { content: { type: "string" }, rules: { type: "array" } }, required: ["content"] },
  qa: { type: "object", properties: { deliverable: { type: "string" }, criteria: { type: "array" } }, required: ["deliverable"] },
  rag: { type: "object", properties: { query: { type: "string" }, topK: { type: "number" } }, required: ["query"] },
  report: { type: "object", properties: { metrics: { type: "array" }, period: { type: "string" } }, required: ["metrics"] },
  research: { type: "object", properties: { topic: { type: "string" }, depth: { type: "string" } }, required: ["topic"] },
  strategy: { type: "object", properties: { question: { type: "string" }, horizon: { type: "string" } }, required: ["question"] },
  training: { type: "object", properties: { subject: { type: "string" }, audience: { type: "string" } }, required: ["subject"] },
  workflow: { type: "object", properties: { workflowId: { type: "string" }, input: { type: "object" } }, required: ["workflowId"] },
};

const DEFAULT_INPUT_SCHEMA = { type: "object", properties: { request: { type: "string" }, context: { type: "object" } }, required: ["request"] };

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    actions: { type: "array", items: { type: "string" } },
    nextSteps: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
  },
  required: ["summary"],
};

// =====================================================================
// ROLE KEYWORD MATCHING (for custom / domain roles)
// =====================================================================

function matchStandardRole(role: string): string | null {
  const r = role.toLowerCase();
  if (STANDARD_ROLES.includes(r as Role)) return r;
  if (r.includes("manag") || r.includes("lead") || r.includes("director") || r.includes("head") || r.includes("executive") || r.includes("admin") || r.includes("ceo")) return "manager";
  if (r.includes("approv")) return "approval";
  if (r.includes("qa") || r.includes("test") || r.includes("review") || r.includes("checker") || r.includes("verif")) return "qa";
  if (r.includes("content") || r.includes("writ") || r.includes("copy") || r.includes("editor") || r.includes("blog") || r.includes("social-media") || r.includes("caption")) return "content";
  if (r.includes("data") || r.includes("analyt") || r.includes("report") || r.includes("dashboard") || r.includes("bi") || r.includes("metric")) return "data";
  if (r.includes("integrat") || r.includes("api") || r.includes("connect") || r.includes("sync") || r.includes("webhook")) return "integration";
  if (r.includes("research") || r.includes("investig") || r.includes("intel")) return "research";
  if (r.includes("security") || r.includes("protect") || r.includes("guard") || r.includes("compliance") || r.includes("legal") || r.includes("audit") || r.includes("safety")) return "protection";
  if (r.includes("finance") || r.includes("cost") || r.includes("payment") || r.includes("billing") || r.includes("invoice") || r.includes("budget") || r.includes("pricing") || r.includes("subscription")) return "cost-calculator";
  if (r.includes("training") || r.includes("educat") || r.includes("learn") || r.includes("teach") || r.includes("course") || r.includes("exam") || r.includes("assessment")) return "training";
  if (r.includes("memory") || r.includes("knowledge") || r.includes("rag") || r.includes("embedding")) return "rag";
  if (r.includes("workflow") || r.includes("automation") || r.includes("trigger") || r.includes("scheduler") || r.includes("runner")) return "workflow";
  if (r.includes("build") || r.includes("deploy") || r.includes("render") || r.includes("generat") || r.includes("factory") || r.includes("installer") || r.includes("debugger")) return "builder";
  if (r.includes("planner") || r.includes("planning") || r.includes("schedule") || r.includes("calendar")) return "planner";
  if (r.includes("optim") || r.includes("perform") || r.includes("tune") || r.includes("benchmark")) return "optimization";
  if (r.includes("strategy") || r.includes("vision") || r.includes("roadmap") || r.includes("positioning")) return "strategy";
  if (r.includes("handover") || r.includes("transfer") || r.includes("onboard") || r.includes("delivery")) return "handover";
  return null;
}

function responsibilitiesFor(role: string): string[] {
  const std = matchStandardRole(role);
  if (std && ROLE_RESPONSIBILITIES[std]) return ROLE_RESPONSIBILITIES[std];
  const name = humanizeRole(role);
  return [
    `Perform the ${name.toLowerCase()} function for the department end-to-end.`,
    `Receive requests, validate scope, and execute using the appropriate skills.`,
    `Collaborate with the manager agent on prioritisation and escalation.`,
    `Maintain quality and audit standards on every output.`,
    `Document decisions and hand off cleanly when scope transitions.`,
  ];
}

function capabilitiesFor(role: string): string[] {
  const std = matchStandardRole(role);
  if (std && ROLE_CAPABILITIES[std]) return ROLE_CAPABILITIES[std];
  return [role.replace(/-/g, "-"), "execution", "collaboration", "quality-assurance"].map((s) => s.replace(/-/g, "-"));
}

function permissionsFor(role: string): Array<{ resource: string; action: string }> {
  const std = matchStandardRole(role);
  if (std && ROLE_PERMISSIONS[std]) return ROLE_PERMISSIONS[std];
  return DEFAULT_PERMISSIONS;
}

function toolsFor(role: string): string[] {
  const std = matchStandardRole(role);
  if (std && ROLE_TOOLS[std]) return ROLE_TOOLS[std];
  return DEFAULT_TOOLS;
}

function inputSchemaFor(role: string): object {
  const std = matchStandardRole(role);
  if (std && ROLE_INPUT_SCHEMAS[std]) return ROLE_INPUT_SCHEMAS[std];
  return DEFAULT_INPUT_SCHEMA;
}

// =====================================================================
// POLICY RESOLVERS
// =====================================================================

function humanApprovalRequired(role: string): boolean {
  const r = role.toLowerCase();
  return (
    r.includes("approv") ||
    r.includes("protect") ||
    r.includes("guard") ||
    r.includes("handover") ||
    r.includes("training") ||
    r.includes("legal") ||
    r.includes("compliance") ||
    r.includes("security") ||
    r.includes("deploy") ||
    r.includes("payment") ||
    r.includes("cost") ||
    r.includes("finance") ||
    r.includes("escalat") ||
    r.includes("incident") ||
    r.includes("emergency")
  );
}

function timeoutFor(role: string): number {
  const r = role.toLowerCase();
  if (r.includes("builder") || r.includes("content") || r.includes("video") || r.includes("render") || r.includes("ffmpeg") || r.includes("design") || r.includes("creative") || r.includes("generat")) return 120;
  if (r.includes("manager") || r.includes("approval") || r.includes("executive") || r.includes("ceo")) return 30;
  return 60;
}

function memoryPolicyFor(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("manager") || r.includes("memory") || r.includes("knowledge") || r.includes("rag") || r.includes("research") || r.includes("strategy")) {
    return JSON.stringify({ type: "long-term", retentionDays: 365 });
  }
  return JSON.stringify({ type: "session", retentionDays: 30 });
}

function ragPolicyFor(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("rag") || r.includes("research") || r.includes("knowledge") || r.includes("content") || r.includes("training") || r.includes("strategy")) {
    return JSON.stringify({ enabled: true, topK: 5 });
  }
  return JSON.stringify({ enabled: false });
}

function safetyPolicyFor(role: string): string {
  const r = role.toLowerCase();
  const allowExternal =
    r.includes("integrat") ||
    r.includes("automation") ||
    r.includes("workflow") ||
    r.includes("api") ||
    r.includes("connect") ||
    r.includes("webhook") ||
    r.includes("scraper");
  return JSON.stringify({ maxOutputTokens: 4096, allowExternalCalls: allowExternal });
}

function retryPolicyFor(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("data") || r.includes("rag") || r.includes("research") || r.includes("integration")) {
    return JSON.stringify({ maxRetries: 3, backoffMs: 2000 });
  }
  return JSON.stringify({ maxRetries: 2, backoffMs: 1000 });
}

function routingPolicyFor(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("vision") || r.includes("image") || r.includes("avatar") || r.includes("video") || r.includes("render") || r.includes("design") || r.includes("creative") || r.includes("tts") || r.includes("voice")) return "vision";
  if (r.includes("manager") || r.includes("approval") || r.includes("strategy") || r.includes("executive") || r.includes("ceo") || r.includes("director")) return "high-quality";
  return "default";
}

function fallbackPolicyFor(role: string): string {
  return "standard-cascade";
}

// =====================================================================
// PROMPT TEMPLATES (25, parameterised by role + department)
// =====================================================================

interface PromptTemplate {
  slug: string;
  name: string;
  description: string;
  template: string; // contains {{department}} {{role}} and runtime {{vars}}
  promptType: "system" | "user";
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  { slug: "analyze-status", name: "Analyze Department Status", description: "Assess what is working, blocked, and needs attention.", promptType: "system", template: "Analyze the current operational status of the {{department}} department from the perspective of the {{role}} role. Identify what is working well, what is blocked, and what needs immediate attention. Context: {{context}}" },
  { slug: "weekly-report", name: "Weekly Report", description: "Generate the weekly department report.", promptType: "system", template: "Generate a weekly report for the {{department}} department covering: tasks completed, tasks pending, blockers encountered, and recommendations for next week. Focus on the {{role}} function." },
  { slug: "prioritize-tasks", name: "Prioritize Tasks", description: "Rank tasks by impact and urgency.", promptType: "user", template: "Given the following task list for the {{department}} department, prioritise by impact and urgency from the {{role}} viewpoint: {{tasks}}" },
  { slug: "handle-request", name: "Handle Incoming Request", description: "Process and respond to a request.", promptType: "user", template: "Process this incoming request as the {{role}} agent for the {{department}} department: {{request}}. Determine the appropriate response, any required actions, and whether escalation is needed." },
  { slug: "escalation-analysis", name: "Escalation Analysis", description: "Assess severity of an escalation.", promptType: "system", template: "Analyse this escalation for the {{department}} department and determine the appropriate response: {{request}}. Assess severity, recommend next steps, and decide whether further escalation is warranted." },
  { slug: "resource-allocation", name: "Resource Allocation", description: "Recommend resource allocation.", promptType: "system", template: "Recommend how to allocate {{department}} resources across these initiatives from the {{role}} perspective: {{initiatives}}" },
  { slug: "risk-assessment", name: "Risk Assessment", description: "Produce a risk matrix.", promptType: "system", template: "Assess the risks associated with: {{scenario}} for the {{department}} department. Provide a risk matrix and mitigation recommendations." },
  { slug: "performance-review", name: "Performance Review", description: "Review performance over a period.", promptType: "system", template: "Review the performance of the {{department}} department over the last {{period}} from the {{role}} viewpoint. Highlight wins, gaps, and trends." },
  { slug: "decision-brief", name: "Decision Brief", description: "Prepare a decision brief.", promptType: "system", template: "Prepare a decision brief for: {{decision}} affecting the {{department}} department. Include options, trade-offs, and a recommendation." },
  { slug: "process-improvement", name: "Process Improvement", description: "Identify improvement opportunities.", promptType: "system", template: "Identify process improvement opportunities in the {{department}} department's {{area}} workflow from the {{role}} perspective." },
  { slug: "stakeholder-update", name: "Stakeholder Update", description: "Draft a stakeholder update.", promptType: "user", template: "Draft a stakeholder update for {{stakeholder}} covering {{department}} progress: {{points}}. Keep it concise and action-oriented." },
  { slug: "incident-response", name: "Incident Response", description: "Respond to an incident.", promptType: "system", template: "Respond to this incident in the {{department}} department: {{incident}}. Provide immediate actions and a root-cause hypothesis from the {{role}} viewpoint." },
  { slug: "compliance-check", name: "Compliance Check", description: "Verify compliance against a policy.", promptType: "system", template: "Verify compliance of {{subject}} against {{policy}} for the {{department}} department. List any gaps and remediation steps." },
  { slug: "cost-analysis", name: "Cost Analysis", description: "Analyse cost implications.", promptType: "system", template: "Analyse the cost implications of {{proposal}} for the {{department}} department from the {{role}} perspective." },
  { slug: "capacity-planning", name: "Capacity Planning", description: "Project capacity needs.", promptType: "system", template: "Project capacity needs for the {{department}} department over the next {{horizon}} based on {{demand}}." },
  { slug: "quality-review", name: "Quality Review", description: "Score a deliverable against criteria.", promptType: "system", template: "Review the quality of {{deliverable}} produced by the {{department}} department. Score against criteria and suggest improvements." },
  { slug: "onboarding-guide", name: "Onboarding Guide", description: "Create an onboarding guide.", promptType: "system", template: "Create an onboarding guide for a new {{role}} joining the {{department}} department. Cover first-day, first-week, and first-month milestones." },
  { slug: "handover-document", name: "Handover Document", description: "Prepare a handover document.", promptType: "system", template: "Prepare a handover document for transitioning {{scope}} from the {{role}} in the {{department}} department to the receiving party." },
  { slug: "knowledge-capture", name: "Knowledge Capture", description: "Capture key knowledge.", promptType: "system", template: "Capture and structure the key knowledge from {{activity}} for the {{department}} department's knowledge base." },
  { slug: "root-cause-analysis", name: "Root Cause Analysis", description: "Perform RCA.", promptType: "system", template: "Perform a root cause analysis for {{problem}} affecting the {{department}} department. Use the 5-whys method." },
  { slug: "scenario-planning", name: "Scenario Planning", description: "Develop scenario plans.", promptType: "system", template: "Develop scenario plans for the {{department}} department given these possible futures: {{scenarios}}" },
  { slug: "metric-definition", name: "Metric Definition", description: "Define key metrics.", promptType: "system", template: "Define the key metrics the {{department}} department should track for {{objective}} from the {{role}} viewpoint." },
  { slug: "automation-opportunity", name: "Automation Opportunity", description: "Identify automation opportunities.", promptType: "system", template: "Identify automation opportunities in the {{department}} department's current workflow that would benefit the {{role}} function." },
  { slug: "communication-draft", name: "Communication Draft", description: "Draft a communication.", promptType: "user", template: "Draft a {{channel}} communication for {{audience}} regarding {{topic}} on behalf of the {{department}} department." },
  { slug: "retrospective", name: "Retrospective", description: "Run a retrospective.", promptType: "system", template: "Run a retrospective on {{initiative}} for the {{department}} department. Capture what went well, what didn't, and what to change." },
];

function extractVariables(template: string): string[] {
  const vars = new Set<string>();
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    if (m[1] !== "department" && m[1] !== "role") vars.add(m[1]);
  }
  return Array.from(vars);
}

function bakeTemplate(template: string, department: string, role: string): string {
  return template.replace(/\{\{department\}\}/g, department).replace(/\{\{role\}\}/g, role);
}

// =====================================================================
// SOP TEMPLATES (5 per department)
// =====================================================================

interface SOPTemplate {
  slugSuffix: string;
  namePrefix: string;
  description: string;
  steps: Array<{ order: number; action: string; expectedOutcome: string }>;
  trigger: object;
  success: object;
}

const SOP_TEMPLATES: SOPTemplate[] = [
  {
    slugSuffix: "intake-triage",
    namePrefix: "Intake & Triage",
    description: "Standard procedure for receiving, logging, and triaging incoming work for the department.",
    steps: [
      { order: 1, action: "Receive request via the department intake channel.", expectedOutcome: "Request is logged with timestamp, source, and requester." },
      { order: 2, action: "Validate request completeness against the intake checklist.", expectedOutcome: "Missing fields are flagged and requested." },
      { order: 3, action: "Classify request by type, priority, and required role.", expectedOutcome: "Request is tagged with type, priority, and target agent." },
      { order: 4, action: "Assign to the appropriate agent based on capability and load.", expectedOutcome: "Agent is assigned and notified." },
      { order: 5, action: "Confirm acceptance with the requester.", expectedOutcome: "Requester receives acknowledgement with ETA." },
    ],
    trigger: { event: "new-request", channel: "any" },
    success: { sla: "intake < 15 min", completeness: "100%" },
  },
  {
    slugSuffix: "execution-delivery",
    namePrefix: "Execution & Delivery",
    description: "Standard procedure for executing assigned work and delivering the output.",
    steps: [
      { order: 1, action: "Load the assigned request and resolve the relevant prompt template.", expectedOutcome: "Prompt is resolved with all variables filled." },
      { order: 2, action: "Retrieve relevant context from memory and RAG.", expectedOutcome: "Context is attached to the execution." },
      { order: 3, action: "Execute the agent via the model routing policy.", expectedOutcome: "Output is produced and logged." },
      { order: 4, action: "Validate output against the output schema and safety policy.", expectedOutcome: "Output passes validation." },
      { order: 5, action: "Deliver output to the requester and update the task record.", expectedOutcome: "Task status is SUCCESS; requester is notified." },
    ],
    trigger: { event: "task-assigned" },
    success: { successRate: ">= 95%", meanLatency: "< 5s" },
  },
  {
    slugSuffix: "quality-review",
    namePrefix: "Quality Review",
    description: "Standard procedure for reviewing agent output before final delivery.",
    steps: [
      { order: 1, action: "Select output for review based on the sampling policy.", expectedOutcome: "Sample is selected deterministically." },
      { order: 2, action: "Score output against the quality rubric.", expectedOutcome: "Score is recorded with rationale." },
      { order: 3, action: "If score below threshold, file a defect and route for rework.", expectedOutcome: "Defect is logged; rework is triggered." },
      { order: 4, action: "If score at or above threshold, approve for delivery.", expectedOutcome: "Output is approved." },
      { order: 5, action: "Aggregate scores into the quality dashboard.", expectedOutcome: "Dashboard is updated." },
    ],
    trigger: { event: "output-produced", sampleRate: "20%" },
    success: { passRate: ">= 90%" },
  },
  {
    slugSuffix: "escalation-handover",
    namePrefix: "Escalation & Handover",
    description: "Standard procedure for escalating blocked or high-risk work and handing off scope.",
    steps: [
      { order: 1, action: "Detect escalation trigger (low confidence, high risk, timeout).", expectedOutcome: "Trigger is logged." },
      { order: 2, action: "Capture full context of the current state.", expectedOutcome: "Context snapshot is saved." },
      { order: 3, action: "Route to the manager agent or human reviewer.", expectedOutcome: "Escalation is assigned." },
      { order: 4, action: "Prepare handover document with status, open items, and risks.", expectedOutcome: "Handover doc is produced." },
      { order: 5, action: "Confirm acceptance with the receiving party.", expectedOutcome: "Handover is acknowledged." },
    ],
    trigger: { event: "escalation-condition", conditions: ["confidence<0.7", "high-risk", "timeout"] },
    success: { resolutionTime: "< 1h" },
  },
  {
    slugSuffix: "reporting-retrospective",
    namePrefix: "Reporting & Retrospective",
    description: "Standard procedure for producing periodic reports and running retrospectives.",
    steps: [
      { order: 1, action: "Compile metrics for the reporting period.", expectedOutcome: "Metrics are assembled." },
      { order: 2, action: "Generate the period report from the report template.", expectedOutcome: "Report is produced." },
      { order: 3, action: "Distribute report to stakeholders on the agreed cadence.", expectedOutcome: "Stakeholders receive the report." },
      { order: 4, action: "Run a retrospective with the department team.", expectedOutcome: "Action items are captured." },
      { order: 5, action: "Log action items and assign owners.", expectedOutcome: "Action items are tracked." },
    ],
    trigger: { schedule: "weekly" },
    success: { onTimeDelivery: "100%" },
  },
];

// =====================================================================
// TOOLS
// =====================================================================

interface ToolDef {
  slug: string;
  name: string;
  description: string;
  type: string;
  inputSchema: object;
  outputSchema: object;
  config: object;
}

const TOOLS: ToolDef[] = [
  { slug: "web-search", name: "Web Search", description: "Search the web for real-time information.", type: "api", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }, outputSchema: { type: "object", properties: { results: { type: "array" } } }, config: { provider: "zai-web-search" } },
  { slug: "code-execution", name: "Code Execution", description: "Execute a code snippet in a sandbox.", type: "function", inputSchema: { type: "object", properties: { language: { type: "string" }, code: { type: "string" } }, required: ["code"] }, outputSchema: { type: "object", properties: { stdout: { type: "string" }, result: { type: "string" } } }, config: { sandbox: "isolated", timeoutMs: 10000 } },
  { slug: "file-read", name: "File Read", description: "Read a file from the workspace.", type: "builtin", inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }, outputSchema: { type: "object", properties: { content: { type: "string" } } }, config: { root: "workspace" } },
  { slug: "file-write", name: "File Write", description: "Write content to a file in the workspace.", type: "builtin", inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] }, outputSchema: { type: "object", properties: { written: { type: "boolean" } } }, config: { root: "workspace" } },
  { slug: "api-call", name: "API Call", description: "Make an authenticated HTTP request.", type: "api", inputSchema: { type: "object", properties: { url: { type: "string" }, method: { type: "string" }, body: { type: "object" } }, required: ["url", "method"] }, outputSchema: { type: "object", properties: { status: { type: "number" }, body: { type: "object" } } }, config: { auth: "env" } },
  { slug: "send-email", name: "Send Email", description: "Send a transactional email.", type: "api", inputSchema: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] }, outputSchema: { type: "object", properties: { messageId: { type: "string" } } }, config: { provider: "smtp" } },
  { slug: "send-whatsapp", name: "Send WhatsApp", description: "Send a WhatsApp message.", type: "api", inputSchema: { type: "object", properties: { to: { type: "string" }, body: { type: "string" } }, required: ["to", "body"] }, outputSchema: { type: "object", properties: { messageId: { type: "string" } } }, config: { provider: "whatsapp-business" } },
  { slug: "send-sms", name: "Send SMS", description: "Send an SMS message.", type: "api", inputSchema: { type: "object", properties: { to: { type: "string" }, body: { type: "string" } }, required: ["to", "body"] }, outputSchema: { type: "object", properties: { messageId: { type: "string" } } }, config: { provider: "twilio" } },
  { slug: "create-lead", name: "Create Lead", description: "Create a new lead in the CRM.", type: "function", inputSchema: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, source: { type: "string" } }, required: ["name", "email"] }, outputSchema: { type: "object", properties: { leadId: { type: "string" } } }, config: { table: "Lead" } },
  { slug: "update-lead", name: "Update Lead", description: "Update an existing lead.", type: "function", inputSchema: { type: "object", properties: { leadId: { type: "string" }, fields: { type: "object" } }, required: ["leadId", "fields"] }, outputSchema: { type: "object", properties: { updated: { type: "boolean" } } }, config: { table: "Lead" } },
  { slug: "create-project", name: "Create Project", description: "Create a new project.", type: "function", inputSchema: { type: "object", properties: { name: { type: "string" }, clientId: { type: "string" } }, required: ["name"] }, outputSchema: { type: "object", properties: { projectId: { type: "string" } } }, config: { table: "Project" } },
  { slug: "update-payment", name: "Update Payment", description: "Update a payment record.", type: "function", inputSchema: { type: "object", properties: { paymentId: { type: "string" }, status: { type: "string" } }, required: ["paymentId", "status"] }, outputSchema: { type: "object", properties: { updated: { type: "boolean" } } }, config: { table: "Payment" } },
  { slug: "generate-document", name: "Generate Document", description: "Generate a formatted document.", type: "function", inputSchema: { type: "object", properties: { type: { type: "string" }, content: { type: "string" } }, required: ["type", "content"] }, outputSchema: { type: "object", properties: { url: { type: "string" } } }, config: { formats: ["pdf", "docx", "md"] } },
  { slug: "parse-document", name: "Parse Document", description: "Extract structured data from a document.", type: "function", inputSchema: { type: "object", properties: { url: { type: "string" }, format: { type: "string" } }, required: ["url"] }, outputSchema: { type: "object", properties: { data: { type: "object" } } }, config: { ocr: true } },
  { slug: "web-scraper", name: "Web Scraper", description: "Scrape content from a URL.", type: "api", inputSchema: { type: "object", properties: { url: { type: "string" }, selector: { type: "string" } }, required: ["url"] }, outputSchema: { type: "object", properties: { content: { type: "string" } } }, config: { renderer: "headless" } },
  { slug: "database-query", name: "Database Query", description: "Run a read-only database query.", type: "function", inputSchema: { type: "object", properties: { sql: { type: "string" }, params: { type: "array" } }, required: ["sql"] }, outputSchema: { type: "object", properties: { rows: { type: "array" } } }, config: { access: "read-only" } },
  { slug: "schedule-task", name: "Schedule Task", description: "Schedule a task for future execution.", type: "function", inputSchema: { type: "object", properties: { agentSlug: { type: "string" }, input: { type: "object" }, runAt: { type: "string" } }, required: ["agentSlug", "input", "runAt"] }, outputSchema: { type: "object", properties: { taskId: { type: "string" } } }, config: { queue: "default" } },
  { slug: "send-notification", name: "Send Notification", description: "Send an in-app or push notification.", type: "function", inputSchema: { type: "object", properties: { recipient: { type: "string" }, message: { type: "string" } }, required: ["recipient", "message"] }, outputSchema: { type: "object", properties: { sent: { type: "boolean" } } }, config: { channels: ["in-app", "push"] } },
  { slug: "create-ticket", name: "Create Ticket", description: "Create a support ticket.", type: "function", inputSchema: { type: "object", properties: { subject: { type: "string" }, body: { type: "string" }, priority: { type: "string" } }, required: ["subject", "body"] }, outputSchema: { type: "object", properties: { ticketId: { type: "string" } } }, config: { system: "internal" } },
  { slug: "update-crm", name: "Update CRM", description: "Update a CRM record.", type: "function", inputSchema: { type: "object", properties: { entity: { type: "string" }, id: { type: "string" }, fields: { type: "object" } }, required: ["entity", "id", "fields"] }, outputSchema: { type: "object", properties: { updated: { type: "boolean" } } }, config: { table: "generic" } },
  { slug: "export-report", name: "Export Report", description: "Export data as a report file.", type: "function", inputSchema: { type: "object", properties: { data: { type: "array" }, format: { type: "string" } }, required: ["data"] }, outputSchema: { type: "object", properties: { url: { type: "string" } } }, config: { formats: ["csv", "xlsx", "pdf"] } },
  { slug: "transcribe-audio", name: "Transcribe Audio", description: "Transcribe an audio file to text.", type: "api", inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] }, outputSchema: { type: "object", properties: { transcript: { type: "string" } } }, config: { provider: "zai-asr" } },
  { slug: "generate-image", name: "Generate Image", description: "Generate an image from a prompt.", type: "api", inputSchema: { type: "object", properties: { prompt: { type: "string" }, size: { type: "string" } }, required: ["prompt"] }, outputSchema: { type: "object", properties: { url: { type: "string" } } }, config: { provider: "zai-image" } },
  { slug: "analyze-data", name: "Analyse Data", description: "Run statistical analysis on a dataset.", type: "function", inputSchema: { type: "object", properties: { data: { type: "array" }, metrics: { type: "array" } }, required: ["data"] }, outputSchema: { type: "object", properties: { summary: { type: "object" } } }, config: { engine: "builtin" } },
  { slug: "run-evaluation", name: "Run Evaluation", description: "Run an evaluation against a test set.", type: "function", inputSchema: { type: "object", properties: { evaluationId: { type: "string" } }, required: ["evaluationId"] }, outputSchema: { type: "object", properties: { runId: { type: "string" }, results: { type: "object" } } }, config: { runner: "ai-eval" } },
];

// =====================================================================
// MODELS / PROVIDERS / POLICIES
// =====================================================================

interface ProviderDef { slug: string; name: string; apiBase: string | null; apiKeyEnv: string | null; }
const PROVIDERS: ProviderDef[] = [
  { slug: "zai", name: "Z.AI", apiBase: "https://api.z.ai/v1", apiKeyEnv: "ZAI_API_KEY" },
  { slug: "openai", name: "OpenAI", apiBase: "https://api.openai.com/v1", apiKeyEnv: "OPENAI_API_KEY" },
  { slug: "anthropic", name: "Anthropic", apiBase: "https://api.anthropic.com/v1", apiKeyEnv: "ANTHROPIC_API_KEY" },
  { slug: "google", name: "Google", apiBase: "https://generativelanguage.googleapis.com/v1", apiKeyEnv: "GOOGLE_API_KEY" },
  { slug: "openrouter", name: "OpenRouter", apiBase: "https://openrouter.ai/api/v1", apiKeyEnv: "OPENROUTER_API_KEY" },
  { slug: "ollama", name: "Ollama (local)", apiBase: "http://localhost:11434/v1", apiKeyEnv: null },
];

interface ModelDef { providerSlug: string; slug: string; name: string; contextWindow: number; inputCostPer1k: number | null; outputCostPer1k: number | null; capabilities: string[]; }
const MODELS: ModelDef[] = [
  { providerSlug: "zai", slug: "glm-4", name: "GLM-4", contextWindow: 128000, inputCostPer1k: 0.01, outputCostPer1k: 0.03, capabilities: ["text", "tools", "json"] },
  { providerSlug: "zai", slug: "glm-4-flash", name: "GLM-4 Flash", contextWindow: 128000, inputCostPer1k: 0.001, outputCostPer1k: 0.002, capabilities: ["text", "json"] },
  { providerSlug: "zai", slug: "glm-4v", name: "GLM-4V", contextWindow: 128000, inputCostPer1k: 0.02, outputCostPer1k: 0.04, capabilities: ["text", "vision", "json"] },
  { providerSlug: "openai", slug: "gpt-4o", name: "GPT-4o", contextWindow: 128000, inputCostPer1k: 0.005, outputCostPer1k: 0.015, capabilities: ["text", "vision", "tools", "json"] },
  { providerSlug: "openai", slug: "gpt-4o-mini", name: "GPT-4o mini", contextWindow: 128000, inputCostPer1k: 0.00015, outputCostPer1k: 0.0006, capabilities: ["text", "tools", "json"] },
  { providerSlug: "openai", slug: "o1-preview", name: "o1-preview", contextWindow: 128000, inputCostPer1k: 0.015, outputCostPer1k: 0.06, capabilities: ["text", "reasoning"] },
  { providerSlug: "anthropic", slug: "claude-3-opus", name: "Claude 3 Opus", contextWindow: 200000, inputCostPer1k: 0.015, outputCostPer1k: 0.075, capabilities: ["text", "vision", "tools", "json"] },
  { providerSlug: "anthropic", slug: "claude-3-sonnet", name: "Claude 3 Sonnet", contextWindow: 200000, inputCostPer1k: 0.003, outputCostPer1k: 0.015, capabilities: ["text", "vision", "tools", "json"] },
  { providerSlug: "anthropic", slug: "claude-3-haiku", name: "Claude 3 Haiku", contextWindow: 200000, inputCostPer1k: 0.00025, outputCostPer1k: 0.00125, capabilities: ["text", "vision", "json"] },
  { providerSlug: "google", slug: "gemini-1.5-pro", name: "Gemini 1.5 Pro", contextWindow: 1000000, inputCostPer1k: 0.00125, outputCostPer1k: 0.005, capabilities: ["text", "vision", "tools", "json"] },
  { providerSlug: "google", slug: "gemini-1.5-flash", name: "Gemini 1.5 Flash", contextWindow: 1000000, inputCostPer1k: 0.000075, outputCostPer1k: 0.0003, capabilities: ["text", "vision", "json"] },
  { providerSlug: "google", slug: "gemini-pro-vision", name: "Gemini Pro Vision", contextWindow: 32000, inputCostPer1k: 0.0005, outputCostPer1k: 0.0015, capabilities: ["text", "vision"] },
  { providerSlug: "openrouter", slug: "mistral-large", name: "Mistral Large", contextWindow: 32000, inputCostPer1k: 0.002, outputCostPer1k: 0.006, capabilities: ["text", "tools", "json"] },
  { providerSlug: "openrouter", slug: "llama-3-70b", name: "Llama 3 70B", contextWindow: 8000, inputCostPer1k: 0.0007, outputCostPer1k: 0.0008, capabilities: ["text", "json"] },
  { providerSlug: "openrouter", slug: "qwen-2-72b", name: "Qwen 2 72B", contextWindow: 32000, inputCostPer1k: 0.0005, outputCostPer1k: 0.001, capabilities: ["text", "json"] },
  { providerSlug: "ollama", slug: "llama3:8b", name: "Llama 3 8B (local)", contextWindow: 8000, inputCostPer1k: 0, outputCostPer1k: 0, capabilities: ["text"] },
  { providerSlug: "ollama", slug: "llama3:70b", name: "Llama 3 70B (local)", contextWindow: 8000, inputCostPer1k: 0, outputCostPer1k: 0, capabilities: ["text"] },
  { providerSlug: "ollama", slug: "mistral:7b", name: "Mistral 7B (local)", contextWindow: 8000, inputCostPer1k: 0, outputCostPer1k: 0, capabilities: ["text"] },
];

// =====================================================================
// MAIN
// =====================================================================

interface ParsedAgent {
  category: string;
  folder: string;
  skillPath: string;
  slug: string;
  role: string;
}

function parseRegistry(): ParsedAgent[] {
  const raw = readFileSync(join(ROOT, "scripts", "agentos_registry.txt"), "utf-8");
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: ParsedAgent[] = [];
  for (const line of lines) {
    // skills/private/<category>/<folder>/SKILL.md
    const parts = line.split("/");
    if (parts.length < 5 || parts[0] !== "skills" || parts[1] !== "private") continue;
    const category = parts[2];
    const folder = parts[3];
    if (!category || !folder) continue;
    let slug = `${category}-${folder}`;
    if (folder.startsWith(category + "-")) slug = folder;
    let role = folder;
    if (role.startsWith(category + "-")) role = role.slice(category.length + 1);
    if (role.endsWith("-agent")) role = role.slice(0, -6);
    if (role.endsWith("-agent")) role = role.slice(0, -6);
    if (!role) role = "general";
    out.push({ category, folder, skillPath: line, slug, role });
  }
  return out;
}

async function batch(model: { createMany: (args: { data: any[] }) => Promise<any> }, rows: any[], size = 400) {
  for (let i = 0; i < rows.length; i += size) {
    await model.createMany({ data: rows.slice(i, i + size) });
  }
}

async function cleanup() {
  console.log("→ Cleaning existing AI Workforce data…");
  // leaves first
  await db.aIMemoryChunk.deleteMany({});
  await db.aIRAGChunk.deleteMany({});
  await db.aIEmbedding.deleteMany({});
  await db.aIExecutionLog.deleteMany({});
  await db.aITaskResult.deleteMany({});
  await db.aIWorkflowExecutionStep.deleteMany({});
  await db.aIPromptTest.deleteMany({});
  await db.aISOPTest.deleteMany({});
  await db.aISkillTest.deleteMany({});
  await db.aIAgentTest.deleteMany({});
  await db.aIEvaluationMetric.deleteMany({});
  await db.aIEvaluationRun.deleteMany({});
  await db.aIAgentFeedback.deleteMany({});
  await db.aIAgentIncident.deleteMany({});
  await db.aIApprovalRequest.deleteMany({});
  await db.aIHumanReview.deleteMany({});
  await db.aIAuditLog.deleteMany({});
  await db.aIUsageLog.deleteMany({});
  await db.aIJob.deleteMany({});
  await db.aIQueue.deleteMany({});
  await db.aIModelTrainingJob.deleteMany({});
  await db.aIModelExperiment.deleteMany({});
  await db.aIModelDeployment.deleteMany({});
  await db.aIModelTrainingDataset.deleteMany({});
  await db.aIPromptVersion.deleteMany({});
  await db.aISOPVersion.deleteMany({});
  await db.aISkillVersion.deleteMany({});
  await db.aIAgentVersion.deleteMany({});
  await db.aIKnowledgeVersion.deleteMany({});
  await db.aIAgentCapability.deleteMany({});
  await db.aIAgentSkill.deleteMany({});
  await db.aIAgentPermission.deleteMany({});
  await db.aIAgentToolPermission.deleteMany({});
  await db.aIPrompt.deleteMany({});
  await db.aITaskExecution.deleteMany({});
  await db.aITask.deleteMany({});
  await db.aIWorkflowExecution.deleteMany({});
  await db.aIWorkflowStep.deleteMany({});
  await db.aIWorkflow.deleteMany({});
  await db.aISOP.deleteMany({});
  await db.aIAgentMemory.deleteMany({});
  await db.aIRAGDocument.deleteMany({});
  await db.aIKnowledgeSource.deleteMany({});
  await db.aIEvaluation.deleteMany({});
  await db.aIAgentTool.deleteMany({});
  await db.aIAgentPolicy.deleteMany({});
  await db.aIModelCapability.deleteMany({});
  await db.aIAgent.deleteMany({});
  await db.aIModelRoutingPolicy.deleteMany({});
  await db.aIFallbackPolicy.deleteMany({});
  await db.aIModel.deleteMany({});
  await db.aIModelProvider.deleteMany({});
  await db.aIDepartment.deleteMany({});
  await db.aICompany.deleteMany({});
  console.log("✓ Clean slate.");
}

async function main() {
  const agents = parseRegistry();
  console.log(`→ Parsed ${agents.length} agents from registry.`);
  if (agents.length === 0) throw new Error("No agents parsed — check scripts/agentos_registry.txt");

  await cleanup();

  // ---------- COMPANY ----------
  const companyId = detId("co", "tech360");
  await db.aICompany.create({
    data: {
      id: companyId,
      slug: "tech360",
      name: "Tech360",
      description: "Tech360 is an AI-powered Business Operating System. The AI Workforce operates 2,000 specialised agents across 100 departments, modelled on the real AgentOS skill taxonomy.",
    },
  });

  // ---------- DEPARTMENTS ----------
  const categorySet = Array.from(new Set(agents.map((a) => a.category)));
  categorySet.sort();
  const departments = categorySet.map((slug) => ({
    id: detId("dep", slug),
    slug,
    name: humanizeCategory(slug),
    description: departmentDescription(slug),
    companyId,
  }));
  await batch(db.aIDepartment, departments);
  console.log(`✓ ${departments.length} departments created.`);
  const depIdBySlug: Record<string, string> = {};
  for (const d of departments) depIdBySlug[d.slug] = d.id;

  // ---------- PROVIDERS / MODELS / POLICIES ----------
  const providerRows = PROVIDERS.map((p) => ({
    id: detId("prv", p.slug),
    slug: p.slug,
    name: p.name,
    apiBase: p.apiBase,
    apiKeyEnv: p.apiKeyEnv,
    status: "ACTIVE",
  }));
  await batch(db.aIModelProvider, providerRows);
  const providerIdBySlug: Record<string, string> = {};
  for (const p of providerRows) providerIdBySlug[p.slug] = p.id;

  const modelRows = MODELS.map((m) => ({
    id: detId("mdl", m.slug),
    providerId: providerIdBySlug[m.providerSlug],
    slug: m.slug,
    name: m.name,
    contextWindow: m.contextWindow,
    inputCostPer1k: m.inputCostPer1k,
    outputCostPer1k: m.outputCostPer1k,
    capabilities: JSON.stringify(m.capabilities),
    status: "ACTIVE",
  }));
  await batch(db.aIModel, modelRows);
  const modelIdBySlug: Record<string, string> = {};
  for (const m of modelRows) modelIdBySlug[m.slug] = m.id;

  const modelCapRows: any[] = [];
  for (const m of MODELS) {
    for (const cap of m.capabilities) {
      modelCapRows.push({
        id: detId("mcap", m.slug + ":" + cap),
        modelId: modelIdBySlug[m.slug],
        capability: cap,
        score: cap === "vision" ? 0.9 : cap === "tools" ? 0.85 : cap === "json" ? 0.9 : 1.0,
      });
    }
  }
  await batch(db.aIModelCapability, modelCapRows);

  const routingDefs = [
    { slug: "default", name: "Default Routing", description: "Cost-balanced routing via Z.AI with OpenAI and Ollama fallback.", primary: "glm-4-flash", fallback: ["gpt-4o-mini", "llama3:8b"], rules: { "text": "glm-4-flash", "tools": "glm-4" }, costLimit: 0.05 },
    { slug: "high-quality", name: "High Quality Routing", description: "Highest-quality model with strong fallback chain.", primary: "claude-3-opus", fallback: ["gpt-4o", "glm-4"], rules: { "text": "claude-3-opus", "reasoning": "o1-preview" }, costLimit: 0.5 },
    { slug: "fast", name: "Fast Routing", description: "Lowest-latency local model with cloud fallback.", primary: "llama3:8b", fallback: ["glm-4-flash"], rules: { "text": "llama3:8b" }, costLimit: 0.01 },
    { slug: "vision", name: "Vision Routing", description: "Vision-capable models for image/video tasks.", primary: "gemini-pro-vision", fallback: ["glm-4v", "gpt-4o"], rules: { "vision": "gemini-pro-vision" }, costLimit: 0.1 },
  ];
  const routingRows = routingDefs.map((r) => ({
    id: detId("rt", r.slug),
    slug: r.slug,
    name: r.name,
    description: r.description,
    primaryModelId: r.primary ? modelIdBySlug[r.primary] : null,
    fallbackModelIds: JSON.stringify(r.fallback.map((s) => modelIdBySlug[s])),
    routingRules: JSON.stringify(r.rules),
    costLimitPerRequest: r.costLimit,
  }));
  await batch(db.aIModelRoutingPolicy, routingRows);
  const routingIdBySlug: Record<string, string> = {};
  for (const r of routingRows) routingIdBySlug[r.slug] = r.id;

  const fallbackDefs = [
    { slug: "standard-cascade", name: "Standard Cascade", description: "Cascade through cloud providers on failure.", strategy: "cascade", chain: ["glm-4", "gpt-4o-mini", "llama3:8b"], maxRetries: 2, backoffMs: 1000 },
    { slug: "fail-hard", name: "Fail Hard", description: "No fallback — fail immediately on error.", strategy: "fail-hard", chain: [], maxRetries: 0, backoffMs: 0 },
  ];
  const fallbackRows = fallbackDefs.map((f) => ({
    id: detId("fb", f.slug),
    slug: f.slug,
    name: f.name,
    description: f.description,
    strategy: f.strategy,
    fallbackChain: JSON.stringify(f.chain.map((s) => modelIdBySlug[s])),
    maxRetries: f.maxRetries,
    backoffMs: f.backoffMs,
  }));
  await batch(db.aIFallbackPolicy, fallbackRows);
  const fallbackIdBySlug: Record<string, string> = {};
  for (const f of fallbackRows) fallbackIdBySlug[f.slug] = f.id;

  // ---------- TOOLS ----------
  const toolRows = TOOLS.map((t) => ({
    id: detId("tool", t.slug),
    slug: t.slug,
    name: t.name,
    description: t.description,
    inputSchema: JSON.stringify(t.inputSchema),
    outputSchema: JSON.stringify(t.outputSchema),
    type: t.type,
    config: JSON.stringify(t.config),
    status: "ACTIVE",
  }));
  await batch(db.aIAgentTool, toolRows);
  const toolIdBySlug: Record<string, string> = {};
  for (const t of toolRows) toolIdBySlug[t.slug] = t.id;

  // ---------- SKILLS ----------
  // 1) Standard role skills
  const skillMap = new Map<string, { slug: string; name: string; description: string; category: string; instructions: string }>();
  const ROLE_SKILL_SLUGS: Record<string, string[]> = {
    manager: ["orchestration", "decision-making", "escalation-management", "kpi-monitoring", "resource-allocation", "team-coordination", "strategic-planning"],
    approval: ["policy-validation", "risk-assessment", "approval-routing", "audit-logging", "compliance-checking"],
    automation: ["workflow-design", "trigger-configuration", "exception-handling", "pipeline-optimisation", "integration-patterns"],
    builder: ["system-configuration", "spec-translation", "component-integration", "build-testing", "architecture-documentation"],
    content: ["copywriting", "brand-voice", "seo-optimisation", "content-calendar-management", "editorial-review"],
    "cost-calculator": ["cost-estimation", "budget-tracking", "spend-forecasting", "vendor-comparison", "overrun-detection"],
    data: ["data-querying", "report-building", "data-quality-assurance", "pipeline-management", "dataset-transformation"],
    handover: ["handover-documentation", "context-transfer", "completeness-verification", "acceptance-confirmation", "stakeholder-briefing"],
    integration: ["api-management", "authentication-handling", "sync-monitoring", "troubleshooting", "webhook-configuration"],
    memory: ["context-management", "fact-persistence", "memory-pruning", "recall-surfacing", "memory-versioning"],
    optimization: ["performance-analysis", "bottleneck-identification", "ab-testing", "improvement-proposal", "gain-measurement"],
    planner: ["milestone-definition", "task-sequencing", "effort-estimation", "dependency-mapping", "risk-management"],
    protection: ["safety-enforcement", "abuse-detection", "output-validation", "guardrail-application", "violation-reporting"],
    qa: ["output-review", "test-suite-execution", "defect-filing", "fix-verification", "quality-assurance"],
    rag: ["document-indexing", "context-retrieval", "chunk-ranking", "knowledge-base-management", "retrieval-tuning"],
    report: ["metric-compilation", "dashboard-building", "report-scheduling", "finding-narration", "stakeholder-distribution"],
    research: ["topic-investigation", "source-synthesis", "evidence-citation", "trend-identification", "brief-delivery"],
    strategy: ["market-analysis", "positioning-definition", "roadmap-planning", "competitor-assessment", "priority-recommendation"],
    training: ["material-development", "session-delivery", "comprehension-assessment", "curriculum-updates", "learner-certification"],
    workflow: ["workflow-design", "step-assignment", "progress-monitoring", "escalation-handling", "routing-optimisation"],
  };
  function addSkill(slug: string, category: string, description: string, instructions: string) {
    if (skillMap.has(slug)) return;
    const name = slug.split("-").map(titleCaseWord).join(" ");
    skillMap.set(slug, { slug, name, description, category, instructions });
  }
  for (const [role, slugs] of Object.entries(ROLE_SKILL_SLUGS)) {
    for (const slug of slugs) {
      const name = slug.split("-").map(titleCaseWord).join(" ");
      addSkill(slug, `role:${role}`, `${name} — core capability for the ${humanizeRole(role)} role.`, `1. Identify the trigger for this skill.\n2. Gather required inputs and context.\n3. Apply the ${name} method appropriate to the situation.\n4. Validate the result against acceptance criteria.\n5. Log the outcome and hand off if needed.`);
    }
  }

  // 2) Domain skills per category
  const VERB_SUFFIXES = ["management", "operations", "optimisation", "analysis", "automation"];
  for (const cat of categorySet) {
    const keywords = cat.split("-").filter((w) => w !== "and" && w.length > 2);
    const primaryKw = keywords[0] || cat;
    // keyword-based skills
    for (const suffix of VERB_SUFFIXES) {
      addSkill(`${primaryKw}-${suffix}`, `domain:${cat}`, `${titleCaseWord(primaryKw)} ${suffix} for the ${humanizeCategory(cat)} department.`, `1. Scope the ${suffix} task within the ${humanizeCategory(cat)} domain.\n2. Collect relevant data and constraints.\n3. Execute the ${suffix} procedure.\n4. Verify against domain-specific acceptance criteria.\n5. Document and report.`);
    }
    // role-based skills for each unique role in this category
    const catRoles = Array.from(new Set(agents.filter((a) => a.category === cat).map((a) => a.role)));
    for (const role of catRoles) {
      addSkill(`${cat}-${role}-execution`, `domain:${cat}`, `${humanizeRole(role)} execution within the ${humanizeCategory(cat)} department.`, `1. Receive the ${humanizeRole(role)} task for ${humanizeCategory(cat)}.\n2. Resolve the relevant prompt and context.\n3. Execute using the assigned model.\n4. Validate output against the ${humanizeCategory(cat)} quality bar.\n5. Log and hand off.`);
    }
  }
  // 3) Cross-cutting skills
  for (const slug of ["prompt-engineering", "context-window-management", "token-budgeting", "output-formatting", "error-handling", "logging", "audit-trail-management", "human-handoff", "safety-checking", "json-schema-validation"]) {
    const name = slug.split("-").map(titleCaseWord).join(" ");
    addSkill(slug, "cross-cutting", `${name} — shared capability across all agents.`, `1. Identify when this skill applies.\n2. Apply the standard ${name} procedure.\n3. Validate the result.\n4. Log the outcome.`);
  }

  const skillRows = Array.from(skillMap.values()).map((s) => ({
    id: detId("skl", s.slug),
    slug: s.slug,
    name: s.name,
    description: s.description,
    category: s.category,
    inputSchema: JSON.stringify(DEFAULT_INPUT_SCHEMA),
    outputSchema: JSON.stringify(OUTPUT_SCHEMA),
    instructions: s.instructions,
    version: 1,
    status: "ACTIVE",
  }));
  await batch(db.aISkill, skillRows);
  console.log(`✓ ${skillRows.length} skills created.`);
  const skillIdBySlug: Record<string, string> = {};
  for (const s of skillRows) skillIdBySlug[s.slug] = s.id;

  // ---------- compute department manager (escalation target) ----------
  const deptManagerSlug: Record<string, string> = {};
  for (const cat of categorySet) {
    const catAgents = agents.filter((a) => a.category === cat);
    const mgr = catAgents.find((a) => ["manager", "lead", "director", "head", "ceo", "executive", "admin"].some((k) => a.role.includes(k)));
    deptManagerSlug[cat] = mgr ? mgr.slug : (catAgents[0]?.slug ?? "manual-review");
  }

  // ---------- AGENTS ----------
  console.log(`→ Building ${agents.length} agents…`);
  const agentRows: any[] = [];
  const agentVersionRows: any[] = [];
  const capRows: any[] = [];
  const agentSkillRows: any[] = [];
  const permRows: any[] = [];
  const toolPermRows: any[] = [];

  for (const a of agents) {
    const depName = humanizeCategory(a.category);
    const roleName = humanizeRole(a.role);
    const responsibilities = responsibilitiesFor(a.role);
    const caps = capabilitiesFor(a.role);
    const perms = permissionsFor(a.role);
    const tools = toolsFor(a.role);
    const inputSchema = inputSchemaFor(a.role);
    const routingSlug = routingPolicyFor(a.role);
    const fallbackSlug = fallbackPolicyFor(a.role);
    const desc = `${roleName} agent for the ${depName} department. ${responsibilities[0]}`;
    const businessPurpose = `Orchestrate the ${depName} department's ${a.role} function across intake, execution, and delivery.`;
    const sysInst = [
      `You are the ${depName} ${roleName} Agent, part of the ${depName} department at Tech360.`,
      ``,
      `## Your Role`,
      desc,
      ``,
      `## Responsibilities`,
      ...responsibilities.map((r) => `- ${r}`),
      ``,
      `## Operating Principles`,
      `1. Always confirm the request is within your scope before acting.`,
      `2. If you lack required context, ask for it explicitly.`,
      `3. If the action requires human approval, route to the approval queue.`,
      `4. Log all decisions and actions to the audit trail.`,
      `5. Escalate to the manager agent if the request is ambiguous or high-risk.`,
      ``,
      `## Output Format`,
      `Respond in structured JSON: {"summary": "...", "actions": [...], "nextSteps": [...], "confidence": 0.0-1.0}`,
    ].join("\n");

    const agentId = detId("agt", a.slug);
    const escalationRules = a.role === "manager" || a.role.includes("manager") || a.role.includes("lead") || a.role.includes("director")
      ? JSON.stringify([])
      : JSON.stringify([{ condition: "confidence < 0.7", escalateTo: deptManagerSlug[a.category] }]);

    agentRows.push({
      id: agentId,
      slug: a.slug,
      name: `${depName} ${roleName} Agent`,
      departmentId: depIdBySlug[a.category],
      role: a.role,
      description: desc,
      businessPurpose,
      responsibilities: JSON.stringify(responsibilities),
      inputSchema: JSON.stringify(inputSchema),
      outputSchema: JSON.stringify(OUTPUT_SCHEMA),
      systemInstructions: sysInst,
      version: 1,
      status: "ACTIVE",
      skillPath: a.skillPath,
      modelRoutingPolicyId: routingIdBySlug[routingSlug],
      fallbackPolicyId: fallbackIdBySlug[fallbackSlug],
      memoryPolicy: memoryPolicyFor(a.role),
      ragPolicy: ragPolicyFor(a.role),
      safetyPolicy: safetyPolicyFor(a.role),
      humanApprovalRequired: humanApprovalRequired(a.role),
      escalationRules,
      timeoutPolicy: timeoutFor(a.role),
      retryPolicy: retryPolicyFor(a.role),
      auditPolicy: JSON.stringify({ logInput: true, logOutput: true }),
    });

    agentVersionRows.push({
      id: detId("aver", a.slug),
      agentId,
      version: 1,
      snapshot: JSON.stringify({ slug: a.slug, role: a.role, version: 1 }),
      changelog: "Initial version generated from AgentOS registry.",
      createdBy: "registry-generator",
    });

    for (const cap of caps) {
      capRows.push({
        id: detId("cap", a.slug + ":" + cap),
        agentId,
        name: cap,
        description: `${titleCaseWord(cap)} capability for the ${depName} ${roleName} Agent.`,
      });
    }

    // skills: standard role skills + category skills
    const stdRole = matchStandardRole(a.role);
    const roleSkillSlugs = (stdRole && ROLE_SKILL_SLUGS[stdRole]) ? ROLE_SKILL_SLUGS[stdRole] : [];
    const catSkillSlugs = [`${a.category}-${a.role}-execution`];
    const primaryKw = a.category.split("-").filter((w) => w !== "and" && w.length > 2)[0] || a.category;
    const catKwSkills = VERB_SUFFIXES.map((s) => `${primaryKw}-${s}`);
    const allSkills = Array.from(new Set([...roleSkillSlugs.slice(0, 4), ...catSkillSlugs, ...catKwSkills.slice(0, 4)]));
    const proficiencyLevels = ["novice", "intermediate", "expert"];
    allSkills.forEach((slug, idx) => {
      const skillId = skillIdBySlug[slug];
      if (!skillId) return;
      // deterministic proficiency: hash-based
      const ph = hashStr(a.slug + slug) % 3;
      agentSkillRows.push({
        id: detId("askl", a.slug + ":" + slug),
        agentId,
        skillId,
        proficiency: proficiencyLevels[ph],
      });
    });

    for (const p of perms) {
      permRows.push({
        id: detId("perm", a.slug + ":" + p.resource + ":" + p.action),
        agentId,
        resource: p.resource,
        action: p.action,
        constraints: "{}",
        grantedBy: "registry-generator",
      });
    }

    for (const tSlug of tools) {
      const toolId = toolIdBySlug[tSlug];
      if (!toolId) continue;
      toolPermRows.push({
        id: detId("toolp", a.slug + ":" + tSlug),
        agentId,
        toolId,
        grantedBy: "registry-generator",
      });
    }
  }

  await batch(db.aIAgent, agentRows);
  console.log(`✓ ${agentRows.length} agents created.`);
  await batch(db.aIAgentVersion, agentVersionRows);
  await batch(db.aIAgentCapability, capRows);
  console.log(`✓ ${capRows.length} capabilities created.`);
  await batch(db.aIAgentSkill, agentSkillRows);
  console.log(`✓ ${agentSkillRows.length} agent-skill links created.`);
  await batch(db.aIAgentPermission, permRows);
  console.log(`✓ ${permRows.length} permissions created.`);
  await batch(db.aIAgentToolPermission, toolPermRows);
  console.log(`✓ ${toolPermRows.length} tool permissions created.`);

  const agentIdBySlug: Record<string, string> = {};
  for (const a of agentRows) agentIdBySlug[a.slug] = a.id;

  // ---------- PROMPTS (25 per agent) ----------
  console.log(`→ Building ${agents.length * PROMPT_TEMPLATES.length} prompts…`);
  const promptRows: any[] = [];
  for (const a of agents) {
    const depName = humanizeCategory(a.category);
    const roleName = humanizeRole(a.role);
    for (const tpl of PROMPT_TEMPLATES) {
      const baked = bakeTemplate(tpl.template, depName, roleName);
      const variables = extractVariables(baked);
      promptRows.push({
        id: detId("prm", a.slug + ":" + tpl.slug),
        agentId: agentIdBySlug[a.slug],
        slug: tpl.slug,
        name: tpl.name,
        description: `${tpl.description} (${depName} ${roleName})`,
        template: baked,
        variables: JSON.stringify(variables),
        promptType: tpl.promptType,
        version: 1,
        status: "ACTIVE",
      });
    }
  }
  await batch(db.aIPrompt, promptRows, 300);
  console.log(`✓ ${promptRows.length} prompts created.`);

  // ---------- SOPs (5 per department) ----------
  console.log(`→ Building ${categorySet.length * SOP_TEMPLATES.length} SOPs…`);
  const sopRows: any[] = [];
  for (const cat of categorySet) {
    const depName = humanizeCategory(cat);
    const depId = depIdBySlug[cat];
    const catAgentIds = agents.filter((a) => a.category === cat).map((a) => agentIdBySlug[a.slug]);
    for (const tpl of SOP_TEMPLATES) {
      const slug = `${cat}-sop-${tpl.slugSuffix}`;
      const steps = tpl.steps.map((s) => ({
        order: s.order,
        action: s.action.replace("the department", `the ${depName} department`),
        expectedOutcome: s.expectedOutcome,
      }));
      sopRows.push({
        id: detId("sop", slug),
        slug,
        name: `${depName} — ${tpl.namePrefix} SOP`,
        description: tpl.description.replace("the department", `the ${depName} department`),
        departmentId: depId,
        steps: JSON.stringify(steps),
        triggerConditions: JSON.stringify(tpl.trigger),
        successCriteria: JSON.stringify(tpl.success),
        version: 1,
        status: "ACTIVE",
        agentIds: JSON.stringify(catAgentIds),
      });
    }
  }
  await batch(db.aISOP, sopRows);
  console.log(`✓ ${sopRows.length} SOPs created.`);

  // ---------- KNOWLEDGE SOURCES ----------
  const knowledgeDefs = [
    { slug: "tech360-services-docs", name: "Tech360 Services Documentation", type: "file", config: { path: "docs/services.md", format: "markdown" } },
    { slug: "tech360-pricing-sheet", name: "Tech360 Pricing Sheet", type: "file", config: { path: "docs/pricing.csv", format: "csv" } },
    { slug: "tech360-process-handbook", name: "Tech360 Process Handbook", type: "file", config: { path: "docs/process-handbook.md", format: "markdown" } },
    { slug: "tech360-legal-policies", name: "Tech360 Legal & Privacy Policies", type: "url", config: { urls: ["/privacy", "/terms", "/cookies"] } },
    { slug: "tech360-audit-report", name: "Tech360 Codebase Audit Report", type: "file", config: { path: "worklog.md", format: "markdown" } },
    { slug: "tech360-sop-library", name: "Tech360 SOP Library", type: "file", config: { path: "sops/", format: "markdown" } },
    { slug: "tech360-api-documentation", name: "Tech360 API Documentation", type: "api", config: { baseUrl: "/api", spec: "openapi" } },
    { slug: "tech360-client-knowledge-base", name: "Tech360 Client Knowledge Base", type: "database", config: { tables: ["Lead", "Project", "Communication"] } },
  ];
  const knowledgeRows = knowledgeDefs.map((k) => ({
    id: detId("ks", k.slug),
    slug: k.slug,
    name: k.name,
    type: k.type,
    config: JSON.stringify(k.config),
    status: "ACTIVE",
  }));
  await batch(db.aIKnowledgeSource, knowledgeRows);

  // ---------- WORKFLOWS (10 sample) ----------
  const wfDefs = [
    { slug: "lead-intake-to-qualification", name: "Lead Intake → Qualification", desc: "From inbound lead to qualified status.", trigger: "event", steps: [["intake-agent", "receive"], ["data-agent", "enrich"], ["manager-agent", "qualify"], ["report-agent", "log"]] },
    { slug: "project-scope-approval", name: "Project Scope Approval", desc: "Draft, review, and approve a project scope.", trigger: "manual", steps: [["builder-agent", "draft"], ["cost-calculator-agent", "estimate"], ["qa-agent", "review"], ["approval-agent", "approve"]] },
    { slug: "content-production-pipeline", name: "Content Production Pipeline", desc: "Plan, draft, edit, publish.", trigger: "scheduled", steps: [["planner-agent", "plan"], ["content-agent", "draft"], ["qa-agent", "edit"], ["workflow-agent", "publish"]] },
    { slug: "payment-verification-flow", name: "Payment Verification Flow", desc: "Verify and reconcile a payment.", trigger: "webhook", steps: [["data-agent", "fetch"], ["cost-calculator-agent", "verify"], ["approval-agent", "approve"], ["report-agent", "receipt"]] },
    { slug: "client-onboarding", name: "Client Onboarding", desc: "Onboard a new client end-to-end.", trigger: "manual", steps: [["manager-agent", "kickoff"], ["handover-agent", "setup"], ["training-agent", "orient"], ["report-agent", "confirm"]] },
    { slug: "monthly-report-generation", name: "Monthly Report Generation", desc: "Compile and distribute the monthly report.", trigger: "scheduled", steps: [["data-agent", "compile"], ["report-agent", "build"], ["qa-agent", "review"], ["manager-agent", "distribute"]] },
    { slug: "incident-response", name: "Incident Response", desc: "Detect, respond, and resolve an incident.", trigger: "event", steps: [["protection-agent", "detect"], ["manager-agent", "triage"], ["automation-agent", "respond"], ["report-agent", "postmortem"]] },
    { slug: "knowledge-base-indexing", name: "Knowledge Base Indexing", desc: "Index new documents into the RAG store.", trigger: "webhook", steps: [["rag-agent", "chunk"], ["rag-agent", "embed"], ["qa-agent", "verify"], ["memory-agent", "register"]] },
    { slug: "agent-evaluation-cycle", name: "Agent Evaluation Cycle", desc: "Run evaluations across the department.", trigger: "scheduled", steps: [["planner-agent", "select"], ["qa-agent", "run"], ["data-agent", "score"], ["manager-agent", "review"]] },
    { slug: "quarterly-strategy-review", name: "Quarterly Strategy Review", desc: "Review strategy and adjust roadmap.", trigger: "scheduled", steps: [["research-agent", "analyse"], ["strategy-agent", "propose"], ["manager-agent", "decide"], ["report-agent", "communicate"]] },
  ];
  const wfRows: any[] = [];
  const wfStepRows: any[] = [];
  for (const wf of wfDefs) {
    const wfId = detId("wf", wf.slug);
    wfRows.push({
      id: wfId,
      slug: wf.slug,
      name: wf.name,
      description: wf.desc,
      triggerType: wf.trigger,
      triggerConfig: JSON.stringify({ type: wf.trigger }),
      version: 1,
      status: "ACTIVE",
    });
    wf.steps.forEach((s, idx) => {
      const [roleHint, action] = s;
      // find a real agent with this role across the agent-runtime department (deterministic)
      const candidate = agents.find((a) => a.role === roleHint.replace("-agent", "") || a.folder === roleHint);
      wfStepRows.push({
        id: detId("wfs", wf.slug + ":" + idx),
        workflowId: wfId,
        order: idx + 1,
        name: `${action} (${roleHint})`,
        agentId: candidate ? agentIdBySlug[candidate.slug] : null,
        action: idx === wf.steps.length - 1 ? "complete" : "execute-agent",
        config: JSON.stringify({ roleHint, action }),
        nextStepId: null,
      });
    });
  }
  await batch(db.aIWorkflow, wfRows);
  await batch(db.aIWorkflowStep, wfStepRows);
  console.log(`✓ ${wfRows.length} workflows, ${wfStepRows.length} steps created.`);

  // ---------- EVALUATIONS (1 per agent) + METRICS ----------
  console.log(`→ Building evaluations for ${agents.length} agents…`);
  const evalRows: any[] = [];
  const metricRows: any[] = [];
  const metricDefs = [
    { name: "accuracy", target: 0.9, unit: "ratio" },
    { name: "latency-ms", target: 2000, unit: "ms" },
    { name: "cost-usd", target: 0.05, unit: "usd" },
    { name: "hallucination-rate", target: 0.05, unit: "ratio" },
  ];
  for (const a of agents) {
    const evalId = detId("eval", a.slug);
    evalRows.push({
      id: evalId,
      agentId: agentIdBySlug[a.slug],
      name: `${humanizeCategory(a.category)} ${humanizeRole(a.role)} — Baseline Evaluation`,
      description: `Standard evaluation for the ${a.slug} agent covering accuracy, latency, cost, and hallucination rate.`,
      status: "DRAFT",
    });
    for (const m of metricDefs) {
      metricRows.push({
        id: detId("em", a.slug + ":" + m.name),
        evaluationId: evalId,
        name: m.name,
        value: null,
        target: m.target,
        unit: m.unit,
      });
    }
  }
  await batch(db.aIEvaluation, evalRows);
  await batch(db.aIEvaluationMetric, metricRows);
  console.log(`✓ ${evalRows.length} evaluations, ${metricRows.length} metrics created.`);

  // ---------- TESTS (3 per agent) ----------
  console.log(`→ Building tests for ${agents.length} agents…`);
  const testRows: any[] = [];
  const testScenarios = [
    { name: "Standard request handling", input: { request: "Process a standard request for the department.", context: {} }, expected: { summary: "string", confidence: "number" } },
    { name: "Edge case — missing context", input: { request: "Handle a request with incomplete context." }, expected: { summary: "string", nextSteps: "array" } },
    { name: "Escalation trigger", input: { request: "High-risk request requiring escalation.", context: { risk: "high" } }, expected: { summary: "string", actions: "array" } },
  ];
  for (const a of agents) {
    for (let i = 0; i < testScenarios.length; i++) {
      const t = testScenarios[i];
      testRows.push({
        id: detId("test", a.slug + ":" + i),
        agentId: agentIdBySlug[a.slug],
        name: t.name,
        input: JSON.stringify(t.input),
        expected: JSON.stringify(t.expected),
        lastResult: null,
        lastRunAt: null,
      });
    }
  }
  await batch(db.aIAgentTest, testRows, 300);
  console.log(`✓ ${testRows.length} tests created.`);

  // ---------- POLICIES ----------
  const policyDefs = [
    { slug: "default-safety", name: "Default Safety Policy", description: "Standard safety guardrails for all agents.", type: "safety", rules: { maxOutputTokens: 4096, allowExternalCalls: false, blockPII: true } },
    { slug: "default-cost", name: "Default Cost Policy", description: "Cost limits per request and per day.", type: "cost", rules: { maxCostPerRequest: 0.05, maxCostPerDay: 10 } },
    { slug: "default-rate-limit", name: "Default Rate Limit", description: "Rate limiting for agent invocations.", type: "rate-limit", rules: { maxRequestsPerMinute: 60, maxRequestsPerHour: 1000 } },
    { slug: "default-data-access", name: "Default Data Access", description: "Data access boundaries for agents.", type: "data-access", rules: { allowedTables: ["Lead", "Project", "Communication"], blockedTables: ["User", "Staff"] } },
  ];
  const policyRows = policyDefs.map((p) => ({
    id: detId("pol", p.slug),
    slug: p.slug,
    name: p.name,
    description: p.description,
    type: p.type,
    rules: JSON.stringify(p.rules),
    version: 1,
    status: "ACTIVE",
  }));
  await batch(db.aIAgentPolicy, policyRows);

  // ---------- QUEUES ----------
  const queueDefs = [
    { name: "default", description: "Default execution queue.", maxConcurrency: 5 },
    { name: "high-priority", description: "High-priority execution queue.", maxConcurrency: 2 },
    { name: "batch", description: "Batch execution queue for evaluations.", maxConcurrency: 10 },
  ];
  const queueRows = queueDefs.map((q) => ({
    id: detId("q", q.name),
    name: q.name,
    description: q.description,
    maxConcurrency: q.maxConcurrency,
    jobs: "[]",
  }));
  await batch(db.aIQueue, queueRows);

  // ---------- SUMMARY ----------
  console.log("\n========================================");
  console.log("AI WORKFORCE REGISTRY — GENERATION COMPLETE");
  console.log("========================================");
  console.log(`Company:           1`);
  console.log(`Departments:       ${departments.length}`);
  console.log(`Agents:            ${agentRows.length}`);
  console.log(`Agent versions:    ${agentVersionRows.length}`);
  console.log(`Capabilities:      ${capRows.length}`);
  console.log(`Skills:            ${skillRows.length}`);
  console.log(`Agent-skill links: ${agentSkillRows.length}`);
  console.log(`Prompts:           ${promptRows.length}`);
  console.log(`SOPs:              ${sopRows.length}`);
  console.log(`Permissions:       ${permRows.length}`);
  console.log(`Tools:             ${toolRows.length}`);
  console.log(`Tool permissions:  ${toolPermRows.length}`);
  console.log(`Model providers:   ${providerRows.length}`);
  console.log(`Models:            ${modelRows.length}`);
  console.log(`Model caps:        ${modelCapRows.length}`);
  console.log(`Routing policies:  ${routingRows.length}`);
  console.log(`Fallback policies: ${fallbackRows.length}`);
  console.log(`Workflows:         ${wfRows.length}`);
  console.log(`Workflow steps:    ${wfStepRows.length}`);
  console.log(`Knowledge sources: ${knowledgeRows.length}`);
  console.log(`Evaluations:       ${evalRows.length}`);
  console.log(`Eval metrics:      ${metricRows.length}`);
  console.log(`Tests:             ${testRows.length}`);
  console.log(`Policies:          ${policyRows.length}`);
  console.log(`Queues:            ${queueRows.length}`);
  console.log("========================================\n");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("FATAL:", e);
    await db.$disconnect();
    process.exit(1);
  });
