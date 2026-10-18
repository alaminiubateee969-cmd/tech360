# GitHub source licence matrix

| Field | Value |
| --- | --- |
| Source | `scripts/research/sources.json` — live GitHub REST metadata |
| Collector | `scripts/research/fetch-sources.mjs` |
| Collection date | 2026-10-18 |
| Last verification | 2026-10-18 |
| Access level | Internal — engineering and audit |
| Version | 1.0.0 |
| Retention | Retained for the life of the engagement, then archived with the audit record |
| Permission scope | Read-only access to public repository metadata |

## How a disposition is decided

A disposition is derived from three facts about each source, never from a preference:

1. **The licence.** A permissive licence (MIT, Apache-2.0, BSD, ISC) permits copying. A weak copyleft (MPL, LGPL, EPL) imposes file-level obligations. A strong copyleft (GPL, AGPL, SSPL, BUSL) would impose its terms on this platform if linked or derived from. No licence at all means the code is **not** open source and may not be copied.
2. **The maintenance state.** An archived repository is not adopted, whatever its licence.
3. **The size and the platform’s own coverage.** A very large project is adapted rather than vendored; a feature the platform already has is adapted (the idea is taken, the code is not).

> **Public is not open source.** A repository with no LICENSE file is not open source. `tech360-bd/alolabs_AI` has no LICENSE file and is therefore **reference-only** — its architecture may be read, its code may not be copied, and none of it has been.

## Totals

| Disposition | Count |
| --- | ---: |
| INTEGRATE | 44 |
| REJECT | 40 |
| REFERENCE | 18 |
| ADAPT | 15 |
| DEFER | 5 |
| **Total sources** | **122** |

## By licence

| Licence | Count | INTEGRATE | ADAPT | REFERENCE | DEFER | REJECT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| MIT | 47 | 34 | 10 | 0 | 3 | 0 |
| NOASSERTION | 38 | 0 | 0 | 0 | 0 | 38 |
| Apache-2.0 | 18 | 10 | 5 | 0 | 2 | 1 |
| AGPL-3.0 | 11 | 0 | 0 | 11 | 0 | 0 |
| GPL-3.0 | 6 | 0 | 0 | 5 | 0 | 1 |
| LGPL-2.1 | 1 | 0 | 0 | 1 | 0 | 0 |
| LGPL-3.0 | 1 | 0 | 0 | 1 | 0 | 0 |

## What each disposition permits

- **INTEGRATE** — The licence permits copying and redistribution with attribution. Compatible with this platform.
- **ADAPT** — The licence permits copying. The design is taken; the code is rewritten to fit this platform’s conventions.
- **REFERENCE** — The design is read. No code is copied.
- **DEFER** — Compatible, but not needed yet. Revisit when the trigger in the adoption plan is met.
- **REJECT** — Not used. Either the licence forbids it, the project is unmaintained, or the source does not exist.

## The sources that could not be resolved

These are the prompt URLs that return HTTP 404. They are recorded with the evidence, not silently dropped.

| Prompt URL | Status | Evidence |
| --- | --- | --- |
| `engralaminn-collab/Ai-Markting-crm` | UNAVAILABLE | The owner `engralaminn-collab` is a user account whose four public repositories are `tech360` (this project), `english-alo-education` (empty), `alolabs.net_ai` and `cloudflare-docs`. The named repository does not exist under that owner. |
| `engralaminn-collab/alo-education-uk-final` | UNAVAILABLE | The owner `engralaminn-collab` is a user account whose four public repositories are `tech360` (this project), `english-alo-education` (empty), `alolabs.net_ai` and `cloudflare-docs`. The named repository does not exist under that owner. |
| `engralaminn-collab/ukvi-ai-markting_n8n` | UNAVAILABLE | The owner `engralaminn-collab` is a user account whose four public repositories are `tech360` (this project), `english-alo-education` (empty), `alolabs.net_ai` and `cloudflare-docs`. The named repository does not exist under that owner. |

## The separately-named project

| Project | URL | Licence | Disposition | Reason |
| --- | --- | --- | --- | --- |
| ALO Labs AgentOS | https://github.com/tech360-bd/alolabs_AI | **none (no LICENSE file)** | REFERENCE (architecture only) | The repository carries 1,341 files and documents an `ai-router` / `ai-gateway` / `ai-workforce` structure and a `{data,total,page,limit,totalPages}` API envelope. It has **no LICENSE file**, so the code is not open source. Its architecture informed the design of the private model gateway, the provider chain and the pagination envelope; **no code was copied**. |

## Full per-source detail

The complete row-by-row table, including the reason for every disposition, is in `docs/research/GITHUB_SOURCE_CATALOG.csv`.

