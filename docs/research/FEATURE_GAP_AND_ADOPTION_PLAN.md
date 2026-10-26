# Feature gap and adoption plan — tech360

| Field | Value |
| --- | --- |
| Author | Engineering |
| Owner | Platform owner |
| Collection date | 2026-10-18 |
| Last verification | 2026-10-18 |
| Access level | Internal |
| Version | 1.0.0 |
| Retention | Retained for the life of the platform; re-issued quarterly |
| Permission scope | Read-only for the auditor; the platform owner decides adoption |

---

## 1. How the source catalogue was built

`scripts/research/source-urls.txt` holds the 122 source slugs from the brief, each tagged with the
prompt section it came from. `scripts/research/fetch-sources.mjs` queried the GitHub REST API for
every one of them and wrote the live metadata to `scripts/research/sources.json`.

| Fact | Value |
| --- | --- |
| Sources requested | 122 |
| Resolved | 119 |
| Unavailable (HTTP 404) | 3 |
| Collection method | authenticated GitHub REST API (`gh` auth, 4-way concurrency) |
| Rate limit remaining after the run | 4,914 of 5,000 |

The three unresolvable URLs are `engralaminn-collab/{Ai-Markting-crm, alo-education-uk-final,
ukvi-ai-markting_n8n}`. The owner `engralaminn-collab` is a **user** account with four public
repositories: `tech360` (this project), `english-alo-education` (empty), `alolabs.net_ai` and
`cloudflare-docs` (vendored Cloudflare documentation, CC-BY-4.0). The three named repositories do
not exist under that owner. They are recorded as unavailable with the evidence, not silently dropped.

The full row-by-row result, with the reason for every disposition, is in
`docs/research/GITHUB_SOURCE_CATALOG.csv`.

## 2. Licence distribution and the compatibility rule

| Licence | Count | Compatible? |
| --- | ---: | --- |
| MIT | 47 | Yes — copy with attribution |
| NOASSERTION (no licence file) | 35 | **No** — not open source; may not be copied |
| Apache-2.0 | 18 | Yes — copy with attribution and the patent grant |
| AGPL-3.0 | 11 | **No** for linking; read for design only |
| GPL-3.0 | 6 | **No** for linking; read for design only |
| LGPL-2.1 | 1 | Weak copyleft; read for design only |
| LGPL-3.0 | 1 | Weak copyleft; read for design only |
| **Total** | **119** | |

### The rule that was applied

> **Public is not open source.** A repository with no LICENSE file may not be copied. A strong
> copyleft licence may not be linked or derived from, because it would impose its terms on this
> platform. Only a permissive licence permits copying.

`tech360-bd/alolabs_AI` is the case that matters most: it is a substantial, well-documented project
with **no LICENSE file**. It is therefore **reference-only**. Its architecture informed the design of
the private model gateway, the provider chain and the pagination envelope. **No code, schema,
migration, prompt or text was copied from it.** Every file added in this engagement was written in
this repository.

## 3. Dispositions

| Disposition | Count | What it means here |
| --- | ---: | --- |
| INTEGRATE | 44 | A permissive licence, actively maintained, and the feature is one the platform does not already have. The implementation follows this repository's conventions. |
| ADAPT | 15 | The design is taken; the code is rewritten to fit this platform's conventions. |
| REFERENCE | 18 | Read for the design. No code is taken. |
| DEFER | 5 | Compatible, but not needed yet. The trigger is recorded in §5. |
| REJECT | 40 | The licence forbids it, the project is archived, or the source does not exist. |
| **Total** | **122** | |

**How a disposition is decided.** Three facts, never a preference:

1. **The licence** — permissive, weak copyleft, strong copyleft, or absent.
2. **The maintenance state** — an archived repository is not adopted whatever its licence.
3. **The size and the platform's own coverage** — a very large project is adapted rather than
   vendored; a feature the platform already has is adapted (the idea is taken, the code is not).

The full reasoning is in `docs/research/GITHUB_LICENSE_MATRIX.md`.

## 4. What was actually adopted in this engagement

| Source area | What it informed | Implementation in this repository |
| --- | --- | --- |
| The AI gateway / router layout | A local-first provider chain with a remote fallback, a private upstream guard and a pagination envelope | `src/lib/model/router.ts`, `src/lib/model/gateway.ts` — **original code** |
| The skills / agents registry layout | A versioned registry with declared schemas, permissions, owners and lifecycle states | `src/lib/skills/registry.ts`, `src/lib/agents/catalogue.ts` — **original code** |
| The workforce policy pattern | One policy module that every route is checked against | `src/lib/ai-workforce-policy.ts` (pre-existing) — reused, not rebuilt |
| The n8n workflow definitions | The shape of a workflow graph | `src/lib/workflows/definitions.ts` — **original code**, validated on write |

**The material point:** the adoption in this engagement was of *ideas and architecture*, implemented
from scratch in this repository's conventions. The code volume written is roughly 6,000 lines, all
original, all covered by tests.

## 5. Feature gap and adoption plan

| # | Gap | State | Action | Trigger / owner |
| --- | --- | --- | --- | --- |
| P1 | No private model service | **CLOSED** | Delivered (`62c718c`) | — |
| P2 | No vector retrieval | **CLOSED** | Delivered (`7bd5534`) | — |
| P3 | No skill entity | **CLOSED** | Delivered (`54f17b9`) | — |
| P4 | No 2,000-scale registries | **CLOSED** | Delivered (`54f17b9`) | — |
| P5 | API contract paths absent | **CLOSED** | Delivered (`7bd5534`) | — |
| P6 | No evaluation benchmark | **CLOSED** — 266 questions | Delivered (`b9918af`) | — |
| P7 | The seven console pages absent | **CLOSED** | Delivered (`dc4a5dd`) | — |
| P8 | Model weights unverified | **OPEN** | Run `npm run models:verify` on the host | Platform owner |
| P9 | No real CPU benchmark | **OPEN** | Run `npm run bench:models` on the host | Platform owner |
| P10 | No live evaluation score | **OPEN** | Run `npm run eval:run` on the host | Platform owner |
| P11 | Backup and restore unproven | **OPEN** — the release gate | Run the restore test in the runbook §7 | Platform owner, **with explicit authorisation** |
| P12 | The outbound channels have no credentials | **OPEN** | Configure the credentials | Platform owner, **with explicit authorisation** |
| P13 | The `bun` sidecars are unverified | **OPEN** | Install `bun`, run the sidecars | Platform owner |
| P14 | LoRA fine-tuning | **DEFERRED** | Only after P8–P10 produce real numbers | Platform owner |
| P15 | The `notify-relay` and `ai-ops` sidecars are Bun-only, with no Node fallback | DEFERRED | Accept for now; a Node fallback is a portability improvement, not a requirement | Platform owner |
| P16 | The vector store is a linear scan | DEFERRED | Swap the storage adapter when the corpus outgrows a bounded scan | Platform owner |
| P17 | The public contract routes expose the same data as the admin routes under different paths | DEFERRED | The delegation is deliberate; a single canonical path would be cleaner if the specification's paths were not fixed | — |
| P18 | Redis / Qdrant are not present | NOT ADOPTED | Not needed at the current corpus size. Adding a datastore is a deployment decision with an operational cost, not a code gap | Platform owner |

## 6. Sources deliberately not adopted

| Source | Why not | What was taken instead |
| --- | --- | --- |
| Any `NOASSERTION` repository (35) | No LICENSE file — not open source | Nothing. Read at most for architecture. |
| Any GPL / AGPL repository (17) | Strong copyleft would impose its terms on this platform | The design, read. No code. |
| `huggingface/education-toolkit` | Archived | Nothing. |
| `ramon-victor/freegpt-webui` | Archived | Nothing. |
| `tech360-bd/alolabs_AI` | No LICENSE file | The architecture of a private model gateway and a provider chain. **No code.** |
| `Onyx-Dev-Labs` (an organisation URL) | The URL resolves to an organisation with a single public repository; the prompt's target is ambiguous | Recorded against `doodle-note` with the ambiguity noted |
| `engralaminn-collab/{Ai-Markting-crm, alo-education-uk-final, ukvi-ai-markting_n8n}` | HTTP 404 — the repositories do not exist under that owner | The sibling repositories were mapped instead: `alolabs.net_ai` and `cloudflare-docs` |

## 7. Review triggers

This plan is re-issued when any of the following happens:

- a benchmark score changes the model selection,
- the corpus outgrows a bounded vector scan (P16),
- a new integration is requested and its licence reviewed,
- the platform owner decides on LoRA (P14),
- a restore test is run (P11),
- the corpus of curated sources changes.

The next scheduled review is **2027-01-18**.
