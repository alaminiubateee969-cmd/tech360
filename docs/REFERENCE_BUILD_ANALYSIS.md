# How the reference products are built — and what TECH360 takes from each

_Fetched live 2026-10-26. "How built" is from observable evidence
(CDN/asset URLs, page structure, public pricing/docs) — labelled as
observed or inferred, never stated as inside knowledge._

## Per-reference

| Reference | What it is | How it is built (evidence) | What TECH360 adopts |
|---|---|---|---|
| buffer.com | Social media management (publish/create/community/insights) | Mature SaaS: account-based app behind marketing site; per-channel OAuth integrations | Campaign-studio pattern: draft → approve → scheduled publish, channel-gated until credentials exist |
| coder.qwen.ai | Qwen Coder prompt-to-web-app | Alibaba model front-end: prompt → generated web app → GitHub export | Analogue only: our delivery factory takes a brief → real source → ZIP. Export honesty (real files, not screenshots) |
| stackoverflow.com | Developer Q&A (24.1M questions) | Content/SEO machine: canonical Q&A pages, reputation system | Reference only — knowledge/Q&A discipline for our Knowledge Base (approved docs before indexing) |
| mureka.ai | AI music generator (text→music, stems) | Hosted model provider with web studio | Media Studio keeps a music *brief*; audio stays `NOT_CONFIGURED` until a provider (e.g. Mureka API) is keyed |
| astryx.atmeta.com | Meta Astryx design system | 180+ React 19 + StyleX components, themed, agent-ready docs (observed on site) | Design-kit pattern: tokens + components + documented rules browsable in-product (`#/design-kit`) |
| cline.bot / cline/cline | Open-source coding agent (Apache-2.0, ~70K★) | VS Code extension + CLI; BYOK — runs on any OpenAI-compatible endpoint incl. free models | Developer-side workflow for building TECH360 itself: Cline + OpenRouter free models (below). Not shipped to clients |
| openrouter.ai | Unified model gateway (500+ models, OpenAI-compatible) | One API key routes to many providers; `:free` slugs + `openrouter/free` router cost $0 (rate-limited) | **Wired in:** `src/lib/agents/model-provider.ts` — internal engine tries free models first when `OPENROUTER_API_KEY` is set |
| enerpize.com | Cloud ERP (Egypt/global): sales, invoicing, POS, accounting, inventory, HR/payroll, CRM — packaged per industry | Classic multi-module SaaS (`/users/login`, module sub-sites per feature for SEO) | Module+industry packaging pattern. We ship CRM/invoice/payment/project slice; full ERP (ledger, POS, payroll) is NOT built and never claimed |
| aipraktor.com | Bangladeshi commerce agent for Messenger/IG/WhatsApp | Bengali-first chat commerce: catalog cards, size-chart answers, order+receipt, Steadfast/Pathao courier updates, review asks; free credits, no monthly fee | Journey shape (catalog → size/stock → order → courier → review) matches our journey engine; courier APIs + image matching stay provider-gated |
| supercool.com | "Humanoid" voice/video agent that works on-screen, joins meetings, own phone number | Avatar/voice pipeline + meeting bots + telephony; paid plans | Not shipped. Honest analogue: Calls & SMS with real provider states — never a simulated person |
| join.supercool.com | Story→movie/TV in one chat | Generative video pipeline (script, scenes, voices, music, trailer, poster) | Not shipped. Media Studio plans shots/scripts; render stays `RENDER_NOT_CONFIGURED` |
| hatchable.com | Free AI app builder + host | Bring-your-own-AI (ChatGPT/Claude/Cursor via MCP) + managed Postgres, passwordless auth, email, storage, cron, domains — apps remain operable by the AI post-launch | The sharpest pattern here: **separate the model from the platform**. Our factory generates source; if managed runtime is ever offered, it must be real (DB/auth/host per app), not simulated |
| hetrixtools.com | Uptime + blacklist monitoring | 1-min checks from 12 locations, consensus before outage, free tiers (15 uptime / 32 blacklist), status pages, MCP | Ops Monitor analogue in-product. Operator can add HetrixTools free tier externally in minutes — recommended for the production domain, no code needed |
| mat3ra.com / platform.mat3ra.com | Materials R&D cloud (simulations, AI/ML for materials) | Marketing on Webflow (`cdn.prod.website-files.com`); platform is a scientific workspace (QE/VASP/LAMMPS engines) | Not applicable — different domain entirely |
| refine.ink | AI verification of technical documents | Next.js on Vercel (`_vercel/image`); trained verifiers + deterministic checkers over frontier models; SOC 2/ISO 27001 | Verify-before-trust pattern: content review pass, SEO audit (42 deterministic checks), scope review, approval gates before anything client-facing moves |
| larksuite.com | Lark productivity superapp (ByteDance) | Suite: Messenger, Docs, Base, Meetings, Approvals, Wiki, OKR + AI notes | Not a product for us. Analogue: client portal + communications + meetings under one login |

## The all-free model stack (now used)

For building and running at $0 model cost:

1. **OpenRouter free models** (runtime, wired): `openrouter/free` router →
   `qwen/qwen3-coder:free` → `deepseek/deepseek-r1:free` →
   `meta-llama/llama-3.3-70b-instruct:free` → `google/gemma-3-27b-it:free` →
   `mistralai/mistral-small-3.1-24b-instruct:free` → `openai/gpt-oss-20b:free`.
   Set `OPENROUTER_API_KEY` (free key) in the server env; failures fall
   through the chain and are recorded, never invented. Override with
   `OPENROUTER_MODELS`.
2. **Cline** (development): free, Apache-2.0; point it at the same
   OpenRouter key and the same free models — this is how a developer
   workstation builds with premium-style assistance at $0.
3. **Qwen Coder** (web): free prompt-to-app for throwaway prototypes;
   production work stays in this repo's real stack.
4. Free tiers needing no code: HetrixTools monitoring (above).

Free-model honesty: free tiers are rate-limited and slugs rotate.
The chain + router design means a retired slug degrades to the next
model instead of breaking the platform, and every failure lands in the
execution record the Admin dashboard already shows.

## Why "full premium" is not finished — honestly

This is answered in full in `KNOWN_ISSUES_AND_BLOCKERS.md` (B-001…B-008).
Summary: the **code** is not the blocker — CI on main passes build,
tests, and migration smoke. The blockers are evidence and access:

1. **Sandbox network allowlist** — Prisma engine binaries
   (`binaries.prisma.sh`) cannot download here, so this workspace
   cannot run a production build or DB-backed tests locally (CI can).
2. **No production access from this session** — Hostinger panel,
   production MySQL, DNS/TLS, and provider credentials (Stripe,
   WhatsApp, SMTP, etc.) can only be configured/verified by the owner
   in hPanel; without them every integration correctly reports
   `NOT_CONFIGURED` instead of faking success.
3. **"Premium" claims need proof** — uptime, payments, delivery
   channels must pass real acceptance tests on the live domain before
   anyone can honestly call the deployment premium/complete.

What would finish it: owner sets env secrets in hPanel (incl.
`OPENROUTER_API_KEY` for free models), confirms the Hostinger deploy
of the intended commit, verifies MySQL backup, then runs the
acceptance checklist in `docs/OPERATIONS_RUNBOOK.md`.
