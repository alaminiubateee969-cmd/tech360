# Agent training & the 3-month "every department AI MODEL" roadmap

_Owner order, implemented 2026-10-26. Internal document — this system is
never mentioned publicly (`docs/AI_VISIBILITY_POLICY.md`)._

## The order, translated

> "We already have our own AI agents and AI employees. These references
> are backup: first our agents take training from them, learn where they
> are lacking, and within 3 months every department will be AI MODEL."

Implemented as three mechanisms, all visible in **Admin → AI Workforce**:

1. **Backup sources** — every owner reference is registered
   (`scripts/verify-reference-links.mjs`, 159 references) and grouped
   into per-category learning tracks (`src/lib/agents/training.ts`,
   37 sources across 8 tracks). MetaGPT is the key structural teacher
   (multi-agent SOPs); Twenty/Frappe/WaCRM teach Revenue; ToolJet +
   Hatchable teach Delivery surfaces; marketingskills/humanizer/
   open-seo/diagram-design teach Content; ai-memory/llm_wiki/docGPT
   teach Operations; Refine teaches Governance verification.
2. **Learning loop** — sources are ingested in the Knowledge Base
   (scan → classify → **approve**), distilled into scoped memory
   (`rememberMemory`), and exercised through real executions with
   recorded success/failure. Failures drive prompt/tool fixes; the
   ops loop keeps cycling the work.
3. **Qualification** — maturity is **evidence-based, never
   calendar-based** (`maturityFor`): FOUNDATION → OPERATIONAL
   (≥10 executions, ≥80% success) → **AI_MODEL_QUALIFIED**
   (≥50 executions, ≥90% success, audit sample passed).

## 3-month roadmap (per department)

| Month | Focus | Exit criteria (evidence) |
|---|---|---|
| 1 — Learn | Ingest track sources to Knowledge (approved), memory distillation, supervised executions | Sources approved; ≥10 executions/agent, outputs reviewed |
| 2 — Fill gaps | Close each track's listed gaps (tool grants, n8n workflows, failure-cause fixes) | ≥30 executions/agent; ≥80% success; no unresolved repeat failures |
| 3 — Operate & qualify | End-to-end department pipelines under approval gates; Admin/Super Admin audit; **fine-tune decision gate** | ≥50 executions; ≥90% success; audit passed |

## What "AI MODEL" does and does not mean here

- **Does mean:** every department's agents run on curated knowledge +
  memory + evaluated executions, routed over free models
  (`model-provider.ts`), with qualification evidence in the dashboard.
- **Does not mean (yet):** training custom model weights. That is the
  Month-3 decision gate: with ≥50 real executions per agent we will
  have the dataset to fine-tune an open model (e.g. GLM/Llama via a
  GPU provider) **if** the owner approves that budget. Claiming it
  earlier would be fabrication.

## Already-implemented elements the owner flagged

- **Diagram & button designs** — `diagram-design` tokens live in
  `src/components/site/diagram-kit.tsx` + `buttons.tsx`, browsable at
  `#/design-kit` (public page uses the real components).
- **Marketing kits** — `marketingskills` structures in
  `src/data/marketing-templates.ts`, generated in Content Studio /
  Marketing Kit view.
- **CRM/video/chat/analytics families** — mapped per-repo in
  `COVERAGE-AUDIT.md` (139 audited) and the verification matrix;
  applicable cores are shipped (CRM lifecycle, Media Studio planning
  + captions, DB-backed live chat, SEO audit), non-applicable
  products are documented with reasons, never simulated.

## Roles

Training control follows the workforce boundary: **Super Admin and
Admin only** (`AI_WORKFORCE_MIN_ROLE`); creating agents and exporting
the registry stay Super Admin. Staff/Manager/public have no access
and see no mention of any of this.
