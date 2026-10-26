# Reference-to-Implementation Audit — 2026-10-26

Method: each reference checked on six separate evidence levels —
(1) repo verified, (2) capability source exists, (3) UI exposed,
(4) API/data/auth works, (5) automated test passes, (6) live
production verified. Level 6 is NOT VERIFIED for everything: the
production host is unreachable from the audit sandbox and no
credentials were available. Licenses from the authenticated
registry generation (`docs/reference-verification.json`) plus
GitHub API checks on 2026-10-26. AGPL/GPL upstreams are training
sources only — never vendored into this proprietary codebase.

## P0 — target repository cannot build (verified, not fixable from here)

`alaminiubateee969-cmd/tech360@main` (`d8c73b1`) `package.json`
contains unresolved conflict markers at lines 7, 41, 49, 82, 95,
122 (fetched raw via GitHub API in this audit). Evidence-based
repair, proven against that repo's own `package-lock.json`
(lockfileVersion 3): take the **incoming side for `scripts`** (the
HEAD side is empty there) and the **HEAD side for dependencies** —
the lockfile contains @prisma/client **6.19.3** (HEAD's exact pin),
@tailwindcss/postcss 4.3.3, dotenv 16.6.1, fflate, and
hostinger-mail-api-sdk, while the incoming-only `bcryptjs` is
**absent** from the lockfile (drop it or regenerate the lockfile
deliberately — do not guess). This session's repo
(`engralaminn-collab/tech360`) has a clean package.json (gate
below proves it) and cannot push to the target repo; the repair
must be applied there by an authorized writer, followed by
`npm ci`, `npm run build`, and the CI in that repo. A
conflict-marker CI gate was added here so this class of failure
can never merge silently again: `scripts/check-conflict-markers.mjs`
+ CI step + `tests/conflict-markers.test.ts` (3/3).

## Per-reference matrix (30 unique; omarchy duplicate counted once)

| # | Reference (license) | Tech360 match (files/routes) | Evidence | Disposition |
|---|---|---|---|---|
| 1 | ToolJet/ToolJet (AGPL-3.0) | App Factory admin surfaces (`FactoryView`, factory APIs) — source-generating, not a ToolJet clone | 1,2,3 | ADOPTED-IN-PART (patterns only; AGPL code never copied) |
| 2 | huggingface/education-toolkit (Apache-2.0, archived) | Agent training curriculum (`src/lib/agents/training.ts`) | 1,2,5 | ADOPTED-IN-PART (learning-path structure; no LMS claimed) |
| 3 | omacom/omarchy (MIT) | Bootstrap/deploy docs + fail-closed start scripts | 1,2 | ADOPTED-IN-PART (reproducible-setup practice; no OS change) |
| 4 | cathrynlavery/diagram-design (MIT) | `diagram-kit.tsx`, `diagrams.tsx`, `#/design-kit` + NEW searchable `DiagramGallery` (filter, copy SVG, download SVG) | 1,2,3,5 | PASS (levels 1–3,5); live NOT VERIFIED |
| 5 | cursor/plugins (no license asserted) | Agent/skill registry manifests (`agents/registry.ts`, workforce policy) | 1,2 | ADOPTED-IN-PART (manifest/permission conventions; nothing installed) |
| 6 | AprilNEA/OpenLogi (Apache-2.0) | Projects/tasks + tracking timeline (Project/ProjectTask/TrackingEvent) | 1,2,3 | ADOPTED-IN-PART (timeline patterns; no logistics clone) |
| 7 | volcengine/OpenViking (AGPL-3.0) | Agent memory/knowledge with MySQL retained | 1,2 | PATTERN-ONLY (AGPL engine not adopted; MySQL kept per rules) |
| 8 | debpalash/VoiceStudio (AGPL-3.0) | Media Studio voice states — provider-gated, consent-first | 1,2,3 | ADOPTED-IN-PART (job/state pattern; no voice cloning claimed) |
| 9 | akitaonrails/ai-memory (MIT) | `AiMemory` scoped memory + Memory view + tests | 1,2,3,5 | PASS (1–3,5); production writes NOT VERIFIED |
| 10 | Lakr233/vphone-cli (MIT) | — | 1 | NOT APPLICABLE (device tooling; no privileged device control added) |
| 11 | public-apis/public-apis (MIT) | Provider/integration catalogue in reference registry | 1,2 | ADOPTED-IN-PART (discovery catalogue; no open proxy built) |
| 12 | harry0703/MoneyPrinterTurbo (MIT) | Media Studio brief→script→shots→SRT→composition (`src/lib/media/studio.ts`, tests) | 1,2,3,5 | PASS (planning); rendering NOT_CONFIGURED until a provider is set |
| 13 | blader/humanizer (MIT) | Content style pass in Content Studio | 1,2,3 | ADOPTED-IN-PART (style only; never marketed as detector evasion) |
| 14 | heygen-com/hyperframes (Apache-2.0) | Media composition spec (fps/aspect/timing) in Media Studio | 1,2,5 | ADOPTED-IN-PART (spec; no fake MP4s) |
| 15 | every-app/open-seo (MIT) | `src/lib/seo-audit-core.ts` grouped checks + SeoAudit view + `tests/seo-audit.test.ts` | 1,2,3,5 | PASS (1–3,5) |
| 16 | ruvnet/ruflo (MIT) | Agent engine executions: persisted runs, failures recorded, approvals | 1,2,3,5 | ADOPTED-IN-PART (orchestration evidence via AiAgentExecution) |
| 17 | coreyhaines31/marketingskills (MIT) | Marketing Kit templates + NEW Marketing Dashboard (idea→drafts→approve→publish) | 1,2,3,5 | PASS (1–3,5); publishing gated on real credentials |
| 18 | mksglu/context-mode (license unasserted) | Bounded context (input slicing, tool grants in engine/policy) | 1,2 | PATTERN-ONLY (no code imported; license unresolved upstream) |
| 19 | fmtlib/fmt (MIT) | — | 1 | NOT APPLICABLE (C++ library; no native extension exists) |
| 20 | affaan-m/ECC (MIT) | Agent quality/security routines (RBAC tests, training gaps) | 1,2,5 | ADOPTED-IN-PART |
| 21 | alsk1992/CloddsBot (MIT) | Approval/policy controls for autonomous agents only | 1,2 | PATTERN-ONLY (trading explicitly out of scope) |
| 22 | nashsu/llm_wiki (license unasserted) | Knowledge Base scan→approve→index with provenance | 1,2,3 | ADOPTED-IN-PART (no code imported) |
| 23 | vastsa/PI-Desktop (LGPL-3.0) | — | 1 | NOT APPLICABLE (desktop/device tooling) |
| 24 | armory3d/armorpaint (license unasserted) | — | 1 | NOT APPLICABLE (3D painting; no client commission) |
| 25 | anthropics/claude-plugins-community (Apache-2.0) | AgentOS registry governance (provenance/permissions/audit in policy) | 1,2 | ADOPTED-IN-PART (governance pattern; no upstream plugins installed) |
| 26 | nabaleducation/EducationConsultancyWebsite (no license) | Study-abroad landing + lead intake (site pages, leads) | 1,2,3 | ADOPTED-IN-PART (patterns; no code copied — no license) |
| 27 | arupdas0825/studytra (no license) | Study-abroad pages/intake patterns | 1,2,3 | ADOPTED-IN-PART (patterns only) |
| 28 | Bhawana0218/NextStep-Abroad (no license) | Journey/timeline patterns in client journey | 1,2,3 | ADOPTED-IN-PART (patterns only; no invented university data) |
| 29 | DIYgod/RSSHub (AGPL-3.0) | Feed Hub RSS/Atom intake with SSRF guards (`feeds` APIs) | 1,2,3 | ADOPTED-IN-PART (patterns; AGPL code not copied) |
| 30 | siyuan-note/siyuan (AGPL-3.0) | Knowledge notes patterns only | 1,2 | PATTERN-ONLY (block editor out of scope; AGPL not copied) |

Social automation (owner brief): implemented previous delivery —
persisted `SocialPost` queue (text/platform/URL/status/timestamps/
error), Meta FB+IG adapters, LinkedIn and X adapters gated on
credentials/approvals, manual-approval-first, EN/BN/both, per-app
env secrets on host only. Added in this audit: **scheduling**
(`schedule` action) and an **idempotent publish-due** endpoint —
publishing moves posts out of APPROVED, so re-runs never
double-post. Webhook verification exists for inbound social
(`SOCIAL_WEBHOOK_SECRET`, fail-closed); per-tenant isolation:
accounts are platform-level for this single-tenant deployment —
multi-tenant account separation is P2, not claimed.

AI Gateway: verified present from the prior delivery
(`src/lib/ai-gateway/`, 25 tests) — not rebuilt.

## Test log (exact, this session)

- `tests/conflict-markers.test.ts`: 3/3 pass; gate on repo: PASS (551 files).
- Full suite, lint, typecheck, build and smoke results are recorded
  in the delivery summary accompanying this document; the standing
  sandbox limits (Prisma engine download blocked, no production DB)
  keep level-6 evidence NOT VERIFIED.

## Backlog

- **P0** Apply the package.json repair (above) on
  `alaminiubateee969-cmd/tech360` with write access; confirm which
  repo is the production source; verify deployed commit.
- **P1** Host: set social/gateway env secrets, run migrations,
  verify `/api/admin/marketing` + platform Verify buttons live.
- **P2** Multi-tenant social accounts; gateway state to MySQL/Redis;
  YouTube/TikTok upload OAuth; analytics/comment automation phase 4.
- **P3** Production build + browser screenshot pass on the host.

## Blockers (exact)

OAuth/API approvals (Meta app review, LinkedIn Community
Management approval, X developer access), host env secrets,
production MySQL migration window, GitHub write access to the
target repo, and production reachability — each closes only with
the named evidence (platform approval screens, Verify=CONNECTED,
migration log, deployed-commit check).
