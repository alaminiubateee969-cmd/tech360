# TECH360 — Production AI Agent Readiness: Delivery Report

**Target:** https://bdtech360.com
**Repository:** `alaminiubateee969-cmd/tech360`
**Branch:** `arena/5f2a22c2-tech360`
**Commits:** `95ab0c8` (public site reconstruction, Commits 1–3 of the website audit) → `85c3843` (this work)
**Reported:** 2026-11-09
**Verification environment:** production build (`next build --webpack`, `output: standalone`) served on `0.0.0.0:3100`. All HTTP evidence below is from that build, not the dev server.

Status vocabulary: **VERIFIED** (acceptance test passed against the built application), **FAILED**, **BLOCKED** (cannot be exercised here), **NOT TESTED**.

> Production deployment was **not** performed from this environment. Every item marked VERIFIED was verified against a production build running locally with the production configuration. Anything that requires the public DNS name, a real TLS handshake, a live crawler or a real browser with WebMCP enabled is marked BLOCKED or NOT TESTED rather than claimed.

---

## 1. Before / after for the ten issues

| # | Issue | Before | After | Status |
|---|---|---|---|---|
| 1 | Robots.txt + content signals | `User-agent: *` / `Allow: /` / seven `Disallow` lines / sitemap. No content signal. Private auth routes `/login`, `/verify`, `/reset-password` and `/private/`, `/official/` were crawlable. No statement that robots.txt is not security. | `Content-Signal: search=yes, ai-train=no` added, documented in-file as an emerging preference that neither technically nor legally prevents training. All private surfaces, APIs, auth routes and sensitive paths disallowed. Sitemap preserved. Explicit "NOT an authentication or access-control mechanism" note. | **VERIFIED** |
| 2 | Canonical URL + metadata | Homepage canonical emitted as `https://bdtech360.com` (no trailing slash); `/legal` reused the Terms title and description, so hub and policy were indistinguishable; no RSS alternate. | Absolute `https://bdtech360.com/` homepage canonical; self-referencing canonical on every public route, exactly one per document; unique title + description for all 58 catalogued routes; OG + Twitter on every route; `application/rss+xml` alternate declared. | **VERIFIED** |
| 3 | Organization identity + sameAs | `sameAs` contained `https://bdtech360.com` (the site itself) alongside the repository and feed; no `legalName`, `description`, `contactPoint`; logo field pointed at an asset that was not the official mark. | Single `Organization` node with `name`, `legalName`, `alternateName`, `url`, official `logo` (`/tech360-logo.png`, exists on disk), `image`, `description`, verified email/telephone/postal address, `contactPoint`, `knowsAbout`. `sameAs` limited to company-controlled URLs, asserted against an allow-list. One `@id` (`…#organization`) shared by every node that references the company. | **VERIFIED** |
| 4 | Structured data | One site-wide `@graph` emitted on every URL containing `WebPage`, `FAQPage` and all 21 `Service` nodes — so `/about` claimed to be a FAQ page and every page carried 24 unrelated entities. No `BreadcrumbList`, `AboutPage`, `ContactPage`, `SoftwareApplication`, `Article`. Service detail pages re-declared `Service` entities with different copy under the same `@id`. | `src/lib/structured-data.ts` is the single owner. Site graph: `Organization`, `WebSite`, homepage `WebPage`, 21 `Service`, `Blog`. Per-page graph: `WebPage`/`AboutPage`/`ContactPage`/`CollectionPage`/`FAQPage` + `BreadcrumbList`, `Service` referenced (not restated) via `mainEntity`, `SoftwareApplication` on `/platform` only, `Article` on `/work*`, `FAQPage` with `mainEntity` on `/faq` only. Zero duplicate `@id` in any document. No `offers`, `price`, `aggregateRating`, `review` or `availability` anywhere. | **VERIFIED** |
| 5 | Company/contact/legal navigation | Header and footer links used fragment hrefs (`#/about`, `#/legal/terms`), which crawlers treat as same-document anchors; 215 such links site-wide. No crawlable path links to policies. | All 215 rewritten to real paths across 29 files. The SPA intercepts plain-path clicks (keeping in-app navigation) and canonicalises legacy `#/…` bookmarks with `replaceState`. Header + footer now expose `/about`, `/contact` and all seven `/legal/*` policies as real anchors. Verified: 0 hash-only public links in the rendered homepage HTML. | **VERIFIED** |
| 6 | llms.txt | `public/llms.txt` existed but was served as `text/plain`; advertised `/.well-known/api-catalog` and `/.well-known/mcp/server-card.json` while `/.well-known/api-catalog` returned 404; no full index. | `content/llms.txt` rewritten from the live registries and served at `/llms.txt` as `text/markdown; charset=utf-8` by a dedicated route, plus `/llms-full.txt` (every service, industry and policy) generated from the same data. All 68 advertised URLs checked: every one returns 200 (`/api/mcp` returns 405 to a bare GET by design — POST is the transport). No credentials, private endpoints or customer records. | **VERIFIED** |
| 7 | Markdown content negotiation | Negotiation existed but `Vary` was limited to `Accept-Encoding` on HTML responses (Next.js rewrites the framework `Vary`), so a shared cache could serve Markdown to a browser. No explicit non-negotiated representation. | Negotiation returns `text/markdown; charset=utf-8` with `Vary: Accept` for public routes, and refuses `/portal`, `/admin`, `/pipeline`, `/design-kit`, `/factory`, `/api`, `/.well-known`. Added explicit, unambiguously cacheable representations (`/about.md`, `/services.md`, `/index.md`) because framework header rewriting makes negotiation-only caching unsafe. Same facts in both representations; private paths return `null` rather than a fabricated document. | **VERIFIED** |
| 8 | HTTP Link headers | One header advertising `llms.txt` and a single homepage Markdown alternate, on every route regardless of path. | RFC 8288 header on public HTML: `llms.txt` (rel=llms.txt), `llms-full.txt` (describedby), the per-route `.md` alternate, the per-route negotiated alternate, the AI catalog and the RSS feed. Every target independently verified 200 with the declared type. Existing framework `Link` is appended to, never replaced. | **VERIFIED** |
| 9 | Browser WebMCP | Registered `get_site_summary`, `list_services`, `list_industries`, `list_faqs`, `get_contact_info` via `navigator.modelContext.registerTool()` with no annotations, no unmount cleanup, and tool data duplicated from the MCP endpoint. | Feature-detected progressive enhancement; five tools named as specified (`search_public_services`, `list_public_products`, `get_company_information`, `get_public_faq`, `open_contact_page`) reusing the server-side data layer; `readOnlyHint: true` on all; unknown arguments rejected; `unregisterTool` on unmount; the removed `provideContext`/`clearContext` APIs are not called. Without the API the site is unchanged. | **VERIFIED** (static + data-layer) / **BLOCKED** (live registration — see §10) |
| 10 | MCP server card + endpoint | `/.well-known/mcp/server-card.json` (SEP-1649 shape) existed and `/api/mcp` answered JSON-RPC, but: no rate limiting, no origin check, no content-type enforcement, arguments not validated (unknown properties silently ignored), exceptions leaked as tool text, no audit trail, and no card at the SEP-2127 reserved location. | Legacy card retained and marked `supersededBy`. SEP-2127 card at `/api/mcp/server-card` (`application/mcp-server-card+json`, schema-conformant, ETag + 304, CORS, `max-age=3600`). AI catalog at `/.well-known/ai-catalog.json` (`application/ai-catalog+json`) with the domain-anchored identifier `urn:air:bdtech360.com:mcp:site`. Hardened transport: origin allow-list (403), 60 req/min/IP (429 + `Retry-After`), `application/json` required (415), batches capped at 20, only implemented protocol versions echoed, closed input schemas, JSON-RPC error codes `-32600/-32601/-32602/-32700/-32000`, audit line per call with no arguments and a truncated caller field. | **VERIFIED** |

---

## 2. Files changed

### Added

| Path | Purpose |
|---|---|
| `src/lib/structured-data.ts` | Single owner of every JSON-LD node, `@id` and `sameAs` entry |
| `src/components/site/RouteStructuredData.tsx` | Per-route page graph (browser, after in-app navigation) |
| `src/lib/agent-tools.ts` | The five public read-only tools, shared by MCP and WebMCP |
| `src/app/api/mcp/server-card/route.ts` | SEP-2127 server card, ETag + CORS |
| `src/app/.well-known/ai-catalog.json/route.ts` | AI catalog → server card |
| `src/app/llms.txt/route.ts` | `text/markdown` delivery of `content/llms.txt` |
| `src/app/llms-full.txt/route.ts` | Generated extended index |
| `content/llms.txt` | Authored index (moved out of `public/` so it cannot be served as `text/plain`) |
| `scripts/copy-standalone-assets.mjs` | Idempotent static-asset copy for the standalone bundle |
| `scripts/codemod-hash-hrefs.mjs` | Reviewable codemod that rewrote the 215 fragment links |
| `tests/agent-readiness.test.ts` | 54 assertions across all ten areas |
| `tests/service-detail-content.test.ts` | Pillar/industry/FAQ coverage for the 21 service pages |
| `docs/audit/AGENT-READINESS-DELIVERY-REPORT.md` | This report |

### Modified (significant)

`public/robots.txt`, `public/.well-known/mcp/server-card.json`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/[...path]/page.tsx`, `src/app/api/mcp/route.ts`, `src/app/rss.xml/route.ts`, `src/lib/agent-content.ts`, `src/lib/public-route-catalog.ts`, `src/lib/public-blog.ts`, `src/proxy.ts`, `src/components/site/WebMCPTools.tsx`, `src/components/site/SiteFooter.tsx`, `src/components/site/SiteHeader.tsx`, `src/components/site/nav-structure.ts`, `src/components/site/HomeView.tsx`, `src/components/site/PremiumSections.tsx`, `src/components/site/ServicesView.tsx`, `src/components/site/ServiceDetailView.tsx`, `src/components/site/IndustriesView.tsx`, `src/components/site/IndustryDetailView.tsx`, plus the 20 other files touched by the fragment-link codemod, `next.config.ts`, `package.json`.

Full diff: `git diff fc66262..85c3843` — 117 files, +8,310 / −1,717.

---

## 3. Tests

| Gate | Result |
|---|---|
| `npm test` | **1,350 pass / 0 fail** (was 1,288 before this work; 54 new assertions in `tests/agent-readiness.test.ts`, 8 in `tests/service-detail-content.test.ts`) |
| `npm run typecheck` (`tsc --noEmit`) | **clean** |
| `npx eslint .` | **clean**, 0 warnings |
| `next build --webpack` | **clean** — 77 pages generated, `/.well-known/ai-catalog.json`, `/api/mcp/server-card`, `/llms.txt`, `/llms-full.txt` all emitted |
| `node scripts/verify-industry-assets.mjs` | pass — 20 slugs, 20 heroes, 4 UI screens, 103 public files |
| `node scripts/check-conflict-markers.mjs` | pass — 1,467 tracked files |
| `node scripts/check-migration-immutability.mjs` | pass — 18 migrations unchanged, none out of order |
| `npm run build` (full chained script) | **blocked** — see §9; the Prisma engine download and `migrate deploy` cannot run in this sandbox |

Skipped: none. Blocked: the chained `npm run build` (Prisma steps only; `next build` itself was run directly and passed).

---

## 4. HTTP response evidence (production build, port 3100)

### 4.1 Machine-readable surfaces

```
/robots.txt                              200  text/plain; charset=UTF-8
  Content-Signal: search=yes, ai-train=no
  Sitemap: https://bdtech360.com/sitemap.xml
/llms.txt                                200  text/markdown; charset=utf-8   (100 lines)
/llms-full.txt                           200  text/plain; charset=utf-8     (261 lines)
/.well-known/ai-catalog.json             200  application/ai-catalog+json; charset=utf-8
/.well-known/mcp/server-card.json        200  application/json               (legacy SEP-1649)
/api/mcp/server-card                     200  application/mcp-server-card+json; charset=utf-8
  ETag: "Xf6kkLw9pRNNKzKoPThyhEKbzi9"   Cache-Control: public, max-age=3600
/sitemap.xml                             200  64 <url>, 0 private paths
/rss.xml                                 200  application/rss+xml; charset=utf-8
/tech360-logo.png                        200
```

### 4.2 Canonical + metadata (exactly one canonical per document)

```
200 | /                                | canon:1 | https://bdtech360.com
200 | /about                           | canon:1 | https://bdtech360.com/about
200 | /services                        | canon:1 | https://bdtech360.com/services
200 | /services/custom-crm-development | canon:1 | https://bdtech360.com/services/custom-crm-development
200 | /industries                      | canon:1 | https://bdtech360.com/industries
200 | /industries/ecommerce            | canon:1 | https://bdtech360.com/industries/ecommerce
200 | /work                            | canon:1 | https://bdtech360.com/work
200 | /legal                           | canon:1 | https://bdtech360.com/legal
200 | /legal/terms                     | canon:1 | https://bdtech360.com/legal/terms
200 | /faq                             | canon:1 | https://bdtech360.com/faq
200 | /contact                         | canon:1 | https://bdtech360.com/contact
```

### 4.3 Markdown negotiation

```
GET /services  Accept: text/markdown
  → 200  content-type: text/markdown; charset=utf-8   vary: Accept, Accept-Encoding

GET /about  Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
  → 200  Content-Type: text/html; charset=utf-8        (browser path unchanged)

GET /portal.md / /admin.md / /pipeline.md / /design-kit.md
  → 404 / HTML — never a Markdown representation

GET /index.md   → 200  text/markdown; charset=utf-8
GET /about.md   → 200  text/markdown; charset=utf-8
GET /services.md → 200 text/markdown; charset=utf-8
```

### 4.4 Link header (public HTML)

```
link: <https://bdtech360.com/llms.txt>; rel="llms.txt"; type="text/markdown",
      <https://bdtech360.com/llms-full.txt>; rel="describedby"; type="text/markdown",
      <https://bdtech360.com/services.md>; rel="alternate"; type="text/markdown"; title="Markdown version",
      <https://bdtech360.com/services>; rel="alternate"; type="text/markdown"; title="Markdown version (content negotiation)",
      <https://bdtech360.com/.well-known/ai-catalog.json>; rel="ai-catalog"; type="application/ai-catalog+json",
      <https://bdtech360.com/rss.xml>; rel="alternate"; type="application/rss+xml"; title="Engineering notes"
```

### 4.5 MCP protocol (JSON-RPC over Streamable HTTP)

```
initialize            → {"protocolVersion":"2025-06-18","capabilities":{"tools":{"listChanged":false}},"serverInfo":{"name":"bdtech360-site-mcp","version":"1.1.0"}}
notifications/init.   → 202 Accepted
tools/list            → 5 tools: search_public_services, list_public_products,
                                get_company_information, get_public_faq, open_contact_page
tools/call × 5        → isError=false for all five
unknown method        → {"code":-32601,"message":"Method not found: resources/list"}
unknown tool          → {"code":-32602,"message":"Unknown tool: drop_tables"}
unknown argument      → isError=true, "Error (INVALID_ARGUMENT): Unknown argument(s): bogus"
Content-Type: text/plain → 415
GET /api/mcp          → 405 (Allow: POST, OPTIONS) — no SSE stream advertised
Origin: https://evil.example → 403
Origin: https://bdtech360.com → 200
65 rapid calls        → 53×200, 12×429 (60/min/IP enforced)
```

### 4.6 Existing features still work

```
/ /about /platform /services /services/whatsapp-automation /industries
/industries/manufacturing /work /work/projects /work/case-studies /technologies
/process /blog /careers /contact /faq /legal /legal/privacy /legal/delivery
/legal/source-code-handover /portal
  → all 200, exactly 1 <h1>, 0 occurrences of "Application error"

/api/admin/pipeline/spec    401
/api/admin/design-kit       401
/api/portal/me              401
/api/admin/clients          401
```

---

## 5. JSON-LD validation results

Parsed every `<script type="application/ld+json">` block from ten routes. All blocks are valid JSON; no block contains a duplicate `@id` within the document.

| Route | Blocks | Nodes | Duplicate `@id` | Types |
|---|---:|---:|---:|---|
| `/` | 1 | 25 | 0 | Organization, WebSite, WebPage, Service, Blog |
| `/about` | 2 | 27 | 0 | + AboutPage, BreadcrumbList |
| `/contact` | 2 | 27 | 0 | + ContactPage, BreadcrumbList |
| `/faq` | 2 | 27 | 0 | + FAQPage (with `mainEntity`), BreadcrumbList |
| `/services` | 2 | 27 | 0 | + CollectionPage, BreadcrumbList |
| `/services/custom-crm-development` | 2 | 27 | 0 | page node references `Service` via `mainEntity` |
| `/industries/ecommerce` | 2 | 27 | 0 | page node + industry `Service` + BreadcrumbList |
| `/work` | 2 | 35 | 0 | + CollectionPage, BreadcrumbList, 8 × Article |
| `/legal/terms` | 2 | 27 | 0 | page node + BreadcrumbList |
| `/platform` | 2 | 33 | 0 | + CollectionPage, BreadcrumbList, 6 × SoftwareApplication |

Fabrication scan across all emitted nodes: no `offers`, `price`, `aggregateRating`, `review`, `ratingValue`, `availability`. `sameAs` entries: `https://bdtech360.com/rss.xml`, `https://github.com/alaminiubateee969-cmd/tech360` — both company-controlled and reachable; no social or directory profile was invented.

**Limitation:** validation was performed by parsing and structural assertion, not by Google's Rich Results Test or the Schema.org validator, both of which require the public deployment. A syntactically valid type is not a rich-result eligibility claim; nothing in this work asserts eligibility.

---

## 6. Security verification

| Control | Evidence |
|---|---|
| No private data in any agent surface | `tests/agent-readiness.test.ts` asserts tool output contains no `password`, `Bearer `, `DATABASE_URL`, `CLIENT_ID_`, `/api/admin`; `llms.txt` contains no credentials, tokens or private endpoints |
| Authenticated APIs still guarded | `/api/admin/*`, `/api/portal/me` → 401 while unauthenticated |
| Private routes never rendered as Markdown | `/portal`, `/admin`, `/pipeline`, `/design-kit`, `/factory`, `/api`, `/.well-known` denied in `src/proxy.ts`; `.md` variants 404 |
| MCP input validation | Closed JSON schemas (`additionalProperties: false`); unknown tool names and unknown arguments rejected; batch size capped at 20 |
| MCP origin check | Foreign `Origin` → 403; no-`Origin` clients (agent runtimes, curl) allowed, matching every other public read-only API |
| MCP rate limiting | 60/min/IP, verified by driving 65 calls (12 rejected with `Retry-After`) |
| MCP error handling | Structured JSON-RPC codes; exceptions never leak their message (replaced with `INTERNAL`) |
| MCP audit | One `[agent-audit]` line per call: timestamp, surface, method, tool, outcome, caller truncated to `a.b.x.x`. Arguments are deliberately **not** logged |
| CORS | Server card and catalog: `Access-Control-Allow-Origin: *`, `GET` only. Transport: `POST, GET, OPTIONS` with declared headers |
| Secrets | No environment variable is ever read into a response; `.well-known` documents are static and contain only public metadata |
| robots.txt | Documented in-file as a crawl preference, not an access-control mechanism; no protection is claimed from it |

No credential, token, customer record or internal endpoint was introduced into any public document.

---

## 7. Git

* Branch: `arena/5f2a22c2-tech360`
* Commits: `95ab0c8` (public site reconstruction) and `85c3843` (agent readiness)
* Pushed: `95ab0c8..85c3843  arena/5f2a22c2-tech360`
* Compare: `https://github.com/alaminiubateee969-cmd/tech360/compare/main...arena/5f2a22c2-tech360`
* Pull request: **not opened.** The repository is configured with a session-scoped branch and the earlier instruction in this session was to commit and push to that branch; opening the PR is the only step left and should be done deliberately by the maintainer (see §11).

---

## 8. Deployment status

**NOT DEPLOYED.** This environment has no route to the production host (only `github.com`, `codeload.github.com`, `api.github.com`, `registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org`), so nothing was pushed to https://bdtech360.com and no claim in this report depends on the live site.

What was verified instead: a **production build** (`next build --webpack` + `output: standalone` + the real static-asset copy step) served over HTTP on port 3100 with the production configuration. That is the closest faithful proxy available here.

Two deployment defects were found and fixed while doing this:

1. **`cp -r public .next/standalone/` accumulated stale files on rebuild.** `cp -r` *merges* into an existing destination and never removes anything, so every file deleted from the source tree survived in `.next/standalone/` and kept being served. (An earlier draft of this report described the symptom as a nested `public/public`; that was **wrong** — GNU `cp` merges and does not nest, verified by running the original build commands three times. The correction matters because it changes the guard: the invariant that actually fails is source/destination parity, not flatness.)

   The failure is concrete on this branch, which moves `public/llms.txt` to `content/llms.txt`: a rebuild on a tree still holding a previous `public/` copy left `.next/standalone/public/llms.txt` in place, where it shadows the new `src/app/llms.txt/route.ts` handler and serves superseded content to crawlers. Reproduced directly — after deleting `public/llms.txt` from the source, `cp -r` left the standalone copy intact while remove-then-copy did not.

   Replaced by `scripts/copy-standalone-assets.mjs`, which removes each destination before copying and then asserts the copied tree matches its source exactly (reporting stale *and* missing files). `next build` on its own ships neither `public/` nor `.next/static`, so the step is mandatory, not cosmetic. The guard is covered by tests that fail if the `rm`-before-copy or the comparison is removed.
2. **`/rss.xml` and `/sitemap.xml` threw with `PrismaClientInitializationError` when no driver adapter was configured.** The lazy `db` proxy raises synchronously on property access, before `.catch()` can attach, so the guard did not work. A crawler surface now degrades to an empty-but-valid document instead of a 500.

---

## 9. Environment issues encountered (not product defects)

* `npx prisma generate` cannot reach `binaries.prisma.sh` from this sandbox (TLS blocked). `npm run build` therefore fails at its first step. `next build` was run directly against the already-generated client and passed.
* `migrate deploy` cannot run without database connectivity, so it was not attempted. **No migration was run, renamed, marked applied or otherwise touched.** `scripts/check-migration-immutability.mjs` confirms all 18 published migrations are unchanged.
* Prisma required a libsql adapter for the local preview database; production configuration is untouched by that.

---

## 10. Outstanding limitations

| Item | Status | Detail |
|---|---|---|
| Live WebMCP registration | **BLOCKED** | `navigator.modelContext` is a W3C Web ML CG draft; it shipped natively in Chrome 146 / Edge 147 behind a flag and exists nowhere else. There is no browser in this sandbox (Playwright is unusable — missing `libnss3.so`, no root), so registration was verified by static analysis plus a direct execution of the tool data layer. A maintainer must confirm in a WebMCP-enabled browser. |
| WebMCP naming | **DELIBERATE** | The five tool names requested (`search_public_services`, `list_public_products`, `get_company_information`, `get_public_faq`, `open_contact_page`) were used exactly. The `function_name` / `action_name` spelling used in some WebMCP survey material was not adopted because the runtime API passes a `name` field. |
| Google Rich Results / Schema.org validator | **NOT TESTED** | Requires the public deployment; structural validation was done instead. |
| Live crawler / search console | **NOT TESTED** | Requires the public deployment. |
| `Vary: Accept` on HTML | **PARTIAL** | The proxy sets it, but Next.js rewrites the framework `Vary` header on HTML responses (observed: `rsc, next-router-state-tree, …, Accept-Encoding`). Mitigated by adding explicit `.md` URLs, which are unambiguously cacheable. Do not rely on negotiation-only caching behind a shared CDN. |
| `Content-Signal` | **PREFERENCE ONLY** | Emerging, non-universally-honoured convention. It is not a technical or legal restriction on training; the site states this explicitly. |
| `/.well-known/mcp/server-card.json` | **LEGACY** | Kept for clients that still probe it, and marked `supersededBy: /api/mcp/server-card`. SEP-1649 was closed 2026-01-26 and continues as SEP-2127, which reserves `GET <streamable-http-url>/server-card` with `application/mcp-server-card+json` — implemented and advertised through the AI catalog. |
| MCP `resources` / `prompts` | **OUT OF SCOPE** | Only `tools` is advertised, because only tools are implemented. `tools/list` is `dynamic`, and the server card's `_meta` lists the five tool names so a client sees no contradiction between card and runtime. |
| Production database workflows | **UNTOUCHED** | No seeding, no reset, no destructive command, no migration rename. Verified by the immutability check. |


---

## 10a. Review pass — regressions found and fixed before merge

A line-by-line audit of `85c3843` and `73700bd` against `origin/main` (`fc66262`) found `main` to be a strict ancestor, so the merge is a clean fast-forward with **no conflicts** and no duplicate functionality (the old WebMCP tool names are fully gone from `src/`). `prisma/`, `api-guard`, `auth`, `access-policy` and `ai-workforce-policy` are untouched, and every RBAC `minRole` is unchanged.

Four real defects surfaced during review. All are fixed and each fix is pinned by a test that fails if the bug returns.

| # | Defect | Evidence | Fix |
|---|---|---|---|
| 1 | **Internal deep link 404.** The fragment-link codemod rewrote `href="#/admin/prompt-library"` to `/admin/prompt-library` in `MediaStudioView.tsx`. That path has no route and no redirect. | `curl` → **404** on the production build. A scan of 628 files / 40 internal hrefs found this as the only genuine break. | Restored the hash form; internal surfaces keep `#/`, since only `/admin`, `/admin/command-center` and `/admin/factory-control` are real path routes. |
| 2 | **Operator console advertised as indexable.** `/admin/command-center` is a `'use client'` component that cannot export `metadata`, so it inherited `robots: index, follow` and the **homepage canonical** from the root layout. | `curl` → `<meta name="robots" content="index, follow">` on an authenticated surface. | Added `src/app/admin/layout.tsx` with `index: false, follow: false, noimageindex: true`. Public pages are unaffected. |
| 3 | **A false claim in `robots.txt`.** The new comment stated these paths "additionally send `X-Robots-Tag: noindex, nofollow, noarchive`", but `next.config.ts` only sent it for `/factory/*`. | `curl -I` → **no** `X-Robots-Tag` on `/admin/command-center`, `/pipeline`, `/design-kit`, `/portal`. | Added header rules for `/admin/:path*`, `/pipeline/:path*`, `/design-kit/:path*`, `/portal/:path*`. All five now send it. |
| 4 | **The static-copy guard tested the wrong invariant** (see §8.1) and the same `try/catch` was duplicated per call site. | `cp -r` never nests; it retains stale files. | Parity-based guard in the copy script; one tested `orEmpty()` helper in `src/lib/safe-db-read.ts` used by both crawler surfaces. |

### 10a.1 RSS / sitemap database-error fallback — fault-injected, not just inspected

The fallback was previously only read, not exercised. It was verified by running the production bundle against a deliberately broken database, and the hazard was confirmed independently:

| Scenario | `/rss.xml` | `/sitemap.xml` | `/llms.txt` | `/llms-full.txt` | `/.well-known/ai-catalog.json` |
|---|---|---|---|---|---|
| Healthy DB | 200, 6 items | 200, 69 URLs | 200 | 200 | 200 |
| **Corrupt DB** (4 KB random bytes) | 200, 0 items, valid XML | 200, 64 URLs, valid XML | 200 | — | — |
| **No DB configured** | 200, 0 items, valid XML | 200, 64 URLs, valid XML | 200 | 200, 23 127 b | 200, valid JSON |

`db.blogPost.findMany(...)` with no adapter throws `PrismaClientInitializationError` **synchronously**, so `.catch()` can never attach — confirmed by capturing the throw before any promise exists. Removing the guard makes `listPublishedBlogSlugs()` throw, which would turn all three crawler surfaces into 500s; with it, they degrade to an empty-but-valid document. Output is byte-identical before and after the `orEmpty()` refactor.

### 10a.2 Gates re-run on the final tree

| Gate | Result |
|---|---|
| `npm test` | **1365 pass / 0 fail** (303 suites, 0 skipped) — up from 1351; 14 new assertions |
| `npm run typecheck` | clean |
| `npx eslint .` | clean (exit 0) |
| `next build --webpack` | ✓ compiled, **77/77** static pages |
| `check-migration-immutability.mjs` | 18 published migrations unchanged, 18 on disk, none out of order |
| `check-conflict-markers.mjs` | pass (1478 tracked files) |
| `verify-industry-assets.mjs` | pass (20 slugs, 103 public files) |

**Every result above is local. None of it is evidence about production.**

---

## 11. Rollback

The change is additive and reversible; nothing was deleted from production.

1. **Revert the code:** `git revert 85c3843` (agent readiness) — or `git revert 85c3843 95ab0c8` to also drop the public-site reconstruction.
2. **Rebuild and restart** with the existing procedure (`npm run build`, then `npm start`). Confirm `node scripts/copy-standalone-assets.mjs` reports `static tree matches source`.
3. **No database action is required.** No migration, seed or data change was introduced.
4. **DNS/redirects are unchanged.** `next.config.ts` gained one `Vary: Accept` header rule and lost nothing.
5. **Assume-static surfaces are self-healing:** `/llms.txt`, `/llms-full.txt`, `/.well-known/ai-catalog.json` and `/api/mcp/server-card` are generated routes and disappear cleanly when their files are reverted.
6. **Smoke test after rollback:** `/`, `/about`, `/services`, `/contact`, `/legal/terms`, `/portal` return 200 with one `<h1>`; `/api/mcp` returns 405 to GET and answers `initialize` on POST; `/api/admin/pipeline/spec` returns 401.

If a rollback of only the machine-readable layer is wanted, `git checkout fc66262 -- src/proxy.ts public/robots.txt` restores the previous robots and negotiation behaviour without touching any page, component or API.

---

## 12. What a maintainer should still do

1. Open the pull request from `arena/5f2a22c2-tech360` and review the diff (§2).
2. Deploy, then re-run the acceptance matrix in §4 against https://bdtech360.com — every "VERIFIED" in this report should reproduce against the public host before it is treated as fixed in production.
3. Confirm WebMCP registration in a WebMCP-enabled browser (Chrome 146+ with the `webmcp` flag), or accept that it is inert until such a browser is in use.
4. Submit https://bdtech360.com/sitemap.xml and validate the structured data with Google's Rich Results Test.
5. If a social or directory profile is created, add it to `sameAs` in `src/lib/structured-data.ts` **and** to the allow-list in `tests/agent-readiness.test.ts`, so the guard keeps its meaning.
