/**
 * Seed the RAG knowledge base with real Tech360 documentation.
 * Run with: bunx tsx scripts/seed_rag.ts
 *
 * Indexes ~12 documents covering services, process, pricing, legal,
 * audit report, and SOPs. Content is real Tech360 material derived
 * from the existing public site and audit worklog.
 */

import { PrismaClient } from "@prisma/client";
import { indexDocument } from "../src/lib/ai-rag";

const db = new PrismaClient({ log: ["warn", "error"] });

const DOCS: Array<{ title: string; source: string; sourceRef?: string; content: string }> = [
  {
    title: "Tech360 Services Overview",
    source: "file",
    sourceRef: "docs/services.md",
    content: `Tech360 is an AI-powered Business Operating System for SMEs. Core services include: (1) Custom Software Development — web, mobile, and SaaS applications built with Next.js, React Native, and Node.js. (2) CRM Implementation — a unified lead, project, payment, and communication dashboard. (3) Marketing Automation — WhatsApp Business API integration, social inbox, and workflow orchestration. (4) AI Workforce — 2,000 specialised agents across 100 departments, modelled on the AgentOS skill taxonomy, covering CRM, content, finance, design, devops, and more. (5) Design & Creative — brand identity, UI/UX, and avatar/video production. (6) DevOps & Security — server automation, SSL, backups, and monitoring. (7) SEO & Digital Marketing — technical SEO, paid ads, and content strategy. Each service is delivered through a documented SOP with quality gates and human-in-the-loop approval where required.`,
  },
  {
    title: "Tech360 Delivery Process",
    source: "file",
    sourceRef: "docs/process-handbook.md",
    content: `The Tech360 delivery process has five phases. Phase 1 Intake: a lead arrives via website, WhatsApp, or referral and is logged in the CRM with source and score. Phase 2 Qualification: the manager agent qualifies the lead against budget, timeline, and fit criteria. Phase 3 Scoping: the builder agent drafts a scope with deliverables, timeline, and budget; the cost-calculator agent validates pricing; the approval agent routes for client sign-off. Phase 4 Execution: the relevant department agents execute using their SOPs, with QA review on a 20% sample. Phase 5 Delivery & Handover: the handover agent prepares documentation, the training agent onboards the client, and the report agent confirms acceptance. Every phase is logged to the audit trail and visible in the CRM dashboard.`,
  },
  {
    title: "Tech360 Pricing Structure",
    source: "file",
    sourceRef: "docs/pricing.csv",
    content: `Tech360 pricing is value-based with three tiers. Starter: USD 1,500–5,000 for landing pages, basic CRM setup, and 1-month support. Growth: USD 5,000–25,000 for full websites, CRM implementation, marketing automation, and 3-month support. Enterprise: USD 25,000+ for custom SaaS, AI workforce deployment, dedicated infrastructure, and 12-month SLA. Retainer options: USD 500–3,000/month for ongoing optimisation, content, and support. Add-ons: WhatsApp Business setup USD 300, SEO audit USD 500, brand identity USD 1,200–4,000, avatar video USD 50–150/minute. All prices exclude VAT. Payment terms: 50% upfront, 50% on delivery for projects under USD 10,000; milestone-based for larger engagements.`,
  },
  {
    title: "Tech360 Privacy Policy Summary",
    source: "url",
    sourceRef: "/privacy",
    content: `Tech360 collects personal data only as necessary to deliver contracted services: name, email, phone, company, and project details. Data is stored on encrypted servers with role-based access control. We do not sell personal data. We retain client data for the duration of the engagement plus 7 years for legal and tax compliance, then securely delete it. Clients may request access, correction, or deletion of their data at any time via privacy@tech360.com. Third-party processors (hosting, email, WhatsApp) are bound by data processing agreements. AI agent executions log inputs and outputs for audit; sensitive fields are masked where possible. EU/UK users have GDPR rights including data portability and the right to be forgotten.`,
  },
  {
    title: "Tech360 Terms of Service Summary",
    source: "url",
    sourceRef: "/terms",
    content: `By engaging Tech360, clients agree to these terms. Scope: work is delivered as defined in the signed scope document; out-of-scope work is billed separately. Payment: invoices are due within 14 days; late payment incurs 1.5% monthly interest. Intellectual property: all deliverables transfer to the client on full payment; Tech360 retains rights to reusable components and tools. Confidentiality: both parties keep shared information confidential for 3 years post-engagement. Warranties: Tech360 warrants work against defects for 30 days post-delivery; excludes third-party integrations and client-supplied content. Liability: capped at the fees paid in the preceding 3 months. Termination: either party may terminate with 30 days notice; client pays for work completed to date. Governing law: Bangladesh.`,
  },
  {
    title: "Tech360 Codebase Audit Report Summary",
    source: "file",
    sourceRef: "worklog.md",
    content: `A technical audit of the Tech360 codebase was conducted. Findings: the platform is a Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui application backed by Prisma (SQLite) and Zustand for state. The CRM module covers leads, projects, communications, scopes, payments, approvals, files, staff, knowledge, analytics, and audit. The automation hub covers WhatsApp, social inbox, workflows, and webhooks. The AI command center runs 20 demo agents with a skill resolver and natural-language terminal. Key gaps identified: no real agent registry, no execution engine with LLM integration, no permissions or memory system, no RAG store, no evaluation framework. The AI Workforce build addresses these gaps by adding 2,000 agents, 2,500+ skills, 50,000 prompts, 500 SOPs, a real execution engine calling z-ai-web-dev-sdk, a permissions matrix, session/long-term memory, a keyword RAG store, and an evaluation harness with metrics.`,
  },
  {
    title: "Tech360 AI Workforce Architecture",
    source: "file",
    sourceRef: "docs/ai-workforce.md",
    content: `The AI Workforce is organised as one company (Tech360) with 100 departments. Each department has 20 agents, totalling 2,000 agents. Agents are generated deterministically from the real AgentOS skill registry (skills/private/<category>/<agent>/SKILL.md). Each agent has a role, system instructions, input/output schemas, policies (memory, rag, safety, retry, escalation, timeout, audit), capabilities, skills (5-10 each), prompts (25 each), and permissions. The execution engine (ai-executor.ts) loads the agent, checks permissions, resolves the best prompt template by keyword, calls the Z.AI SDK, and falls back to a deterministic response on failure. Every execution is logged to AITaskExecution with logs, usage, and audit entries. Human approval is required for high-risk actions on approval/protection/handover/training agents. Model routing policies (default, high-quality, fast, vision) map agents to the right LLM with fallback chains.`,
  },
  {
    title: "Tech360 AgentOS Skill Taxonomy",
    source: "file",
    sourceRef: "docs/agentos.md",
    content: `The AgentOS skill taxonomy defines 100 categories, each with 20 agents. 49 categories use the standard 20-role template: approval, automation, builder, content, cost-calculator, data, handover, integration, manager, memory, optimization, planner, protection, qa, rag, report, research, strategy, training, workflow. 51 categories use custom domain-specific agent names (e.g., avatar-video-studio has ffmpeg-render-agent, lip-sync-agent, voice-tts-agent; image-ai-studio has logo-design-agent, image-generation-agent). Each agent's SKILL.md path is the source of truth for its slug and role. The generator parses these paths to create the registry, deriving human-readable names, responsibilities, and policies from the role and category.`,
  },
  {
    title: "Tech360 SOP Library Overview",
    source: "file",
    sourceRef: "sops/",
    content: `Each Tech360 department operates five standard SOPs: (1) Intake & Triage — receive, validate, classify, and assign requests within 15 minutes. (2) Execution & Delivery — resolve prompt, retrieve context, execute via model, validate output, deliver. (3) Quality Review — sample 20% of outputs, score against rubric, file defects below threshold. (4) Escalation & Handover — detect triggers (low confidence, high risk, timeout), capture context, route to manager, prepare handover. (5) Reporting & Retrospective — compile metrics, generate report, distribute, run retro, log actions. SOPs are versioned and linked to all agents in the department via the agentIds JSON field. Success criteria include SLA targets, pass rates, and on-time delivery.`,
  },
  {
    title: "Tech360 Model Routing Policy",
    source: "file",
    sourceRef: "docs/model-routing.md",
    content: `Tech360 routes agent executions through four policies. Default: Z.AI GLM-4 Flash with OpenAI GPT-4o-mini and Ollama Llama3:8b fallback, cost limit USD 0.05/request — used by most agents. High Quality: Anthropic Claude 3 Opus with GPT-4o and GLM-4 fallback, cost limit USD 0.50 — used by manager, approval, strategy, and executive agents. Fast: local Ollama Llama3:8b with GLM-4 Flash fallback, cost limit USD 0.01 — used for low-latency reads. Vision: Google Gemini Pro Vision with GLM-4V and GPT-4o fallback, cost limit USD 0.10 — used by image, video, avatar, and design agents. The standard-cascade fallback policy retries on failure with 1s backoff. The fail-hard policy is reserved for protection agents that must surface errors immediately.`,
  },
  {
    title: "Tech360 Permissions Model",
    source: "file",
    sourceRef: "docs/permissions.md",
    content: `Each Tech360 AI agent holds a minimal set of permissions following least-privilege. Manager agents read and write department resources, agent config, and approvals. Approval agents read and write approval requests and policies. Content agents write content and read leads. Data agents read datasets and write reports. RAG agents write the knowledge base and embeddings. Protection agents read safety rules and write guardrails and violations. Permissions are stored as (agentId, resource, action) triples with a unique constraint preventing duplicates. The execution engine checks that an agent holds at least one write or execute permission before proceeding; read-only agents are flagged. Tool permissions are separate: each agent is granted a role-appropriate subset of the 25 available tools (web-search, code-execution, file-read, database-query, etc.).`,
  },
  {
    title: "Tech360 Evaluation Framework",
    source: "file",
    sourceRef: "docs/evaluation.md",
    content: `Every Tech360 agent has a baseline evaluation with four metrics: accuracy (target 0.9 ratio), latency (target 2000ms), cost (target USD 0.05/request), and hallucination-rate (target 0.05 ratio). Running an evaluation creates an AIEvaluationRun, executes the agent against its 3 test cases, computes metrics, and persists results. The hallucination heuristic flags outputs that are not valid JSON or lack a sufficiently long summary field. Feedback (1-5 rating with comment) and incidents (low/medium/high/critical severity) are tracked per agent and surfaced in the monitoring dashboard. Incidents can be resolved; feedback informs prompt and policy iteration.`,
  },
];

async function main() {
  // Clear existing RAG docs.
  await db.aIRAGChunk.deleteMany({});
  await db.aIRAGDocument.deleteMany({});
  console.log(`→ Indexing ${DOCS.length} RAG documents…`);
  let totalChunks = 0;
  for (const doc of DOCS) {
    const { documentId, chunksCreated } = await indexDocument(doc.title, doc.content, doc.source, doc.sourceRef);
    totalChunks += chunksCreated;
    console.log(`  ✓ ${doc.title} → ${chunksCreated} chunks (${documentId})`);
  }
  console.log(`\n✓ RAG seed complete: ${DOCS.length} documents, ${totalChunks} chunks.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("FATAL:", e);
    await db.$disconnect();
    process.exit(1);
  });
