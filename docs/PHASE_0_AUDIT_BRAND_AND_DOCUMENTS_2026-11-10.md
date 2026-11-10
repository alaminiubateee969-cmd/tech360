# TECH360 — PHASE 0 READ-ONLY AUDIT REPORT

### Brand Identity, Official Document Generator, WebChat, CRM, AI Workforce

**Repository:** `alaminiubateee969-cmd/tech360`
**Branch:** `arena/2073fcff-tech360` · **Commit:** `9d0547b`
**Audit date:** 2026-11-10
**Production domain:** `https://bdtech360.com`
**Mode:** READ-ONLY. **No** code change, no migration, no deployment, no
WhatsApp activation, **no brand redesign**.

---

## 0. SCOPE AND HONEST DISCLOSURE

The working tree already contained one security repair from an earlier turn
before this audit began:

```
 M src/app/api/webhooks/whatsapp/route.ts
?? src/lib/whatsapp-webhook.ts
?? tests/whatsapp-handshake.test.ts
?? docs/PRODUCTION_READINESS_VERIFICATION_2026-11-10.md
?? docs/PHASE_0_READ_ONLY_AUDIT_2026-11-10.md
```

I did **not** revert it and made **no new source changes** in this phase. The
only new file is this report. Nothing committed, nothing pushed.

**Owner assets received** (3 files, `/tmp/arena-coding-uploads/`):

| File | Dimensions | Bytes |
|---|---|---|
| `logo.jpg` | 1254 × 1254 | 133,622 |
| `Modern Tech360 Corporate Letterhead (2).png` | 1102 × 1427 | 938,343 |
| `Tech360 LLC Circular Tech Emblem.png` | 1254 × 1254 | 1,106,750 |

I read all three, and measured their colours with `sharp` rather than guessing.

---

## 1. EXECUTIVE SUMMARY

**Verdict: PROCEED WITH CONDITIONS.**

Four findings dominate this audit, and three of them are things the directive
did not anticipate.

1. **The supplied letterhead is already in the repository — byte-identical.**
   MD5 `a1806694482e934db3e07aaa705b7d76` matches
   `public/brand/tech360-letterhead-a4.png` exactly. The owner is re-supplying
   an asset the platform already has. Nothing to copy.

2. **The document system reconstructs the letterhead in HTML instead of using
   the supplied image as the page template.** `letterheadAsset: '/brand/tech360-letterhead-a4.png'`
   is **declared in config and never referenced by any renderer** — it is dead
   configuration. The directive is explicit: *"Use the supplied letterhead as
   the actual page template."* That requirement is **not met**.

3. **A seal is already enabled and rendered on SOW and Invoice documents** —
   `sealEnabledSOW: true`, `sealEnabledInvoice: true`, `sealSizeMm: 42`, using
   `public/brand/tech360-seal.png` (1254 × 1254). The directive says *"No
   official stamp image has been supplied… Do not invent a company seal"* and
   *"Missing stamp is not fabricated."* The two statements conflict. This is a
   **gate decision, not something I will silently change**: the repo seal is
   monochrome navy and visually distinct from the owner-supplied blue emblem,
   so I cannot assert it is the same artwork.

4. **There is no centralised design-token system, and the site palette does not
   match the supplied artwork.** The brand cream `#009FE3` appears **734 times**
   across src, but the owner's logo contains essentially **no cream/sky blue**
   (5.55% of *one* narrow hue band by my generous filter, 0.04% in the
   letterhead). The letterhead's actual palette is deep navy `#002478` /
   `#00186C` with pastel cyan `#6CB4E4`. Meanwhile `--primary` is
   `oklch(0.205 0 0)` — **achromatic grayscale**, which would make
   `bg-primary` render grey, not blue.

**What already works** (verified, not assumed): canonical `TECH-YYYY-NNNNNN`
identity, unified CRM with verified-identity linking and merge audit, WebChat
with hardened session security and a real 16-role-mapped AI workforce, the full
11-stage workflow, payment gating, and SUPER_ADMIN source handover.

**Test baseline reconfirmed this phase: 1,423 / 1,423 pass, 318 suites, 0
failures, 0 cancelled.** The directive's "1,398" is superseded by this stronger
verified figure.

**Missing:** 16 of the 18 required official document types have no renderer, no
server-side PDF generation exists, and `Milestone` / `QA record` /
`DeliveryArtifact` / `DiscoverySession` models are absent.

---

## 2. REPOSITORY VERIFICATION

| Check | Result |
|---|---|
| Repository | `alaminiubateee969-cmd/tech360` (public) |
| Branch | `arena/2073fcff-tech360` |
| Commit | `9d0547b` |
| Working tree | 1 modified, 5 untracked (disclosed §0) |
| Open PRs | **0** |
| CI on `main` | **PASS** — run `42768720254`, 35/35, against MySQL 8.0 |
| Node | `>=22 <23` (local v22.22.3) |
| Next.js | declared `^16.1.1`, installed 16.4.3 |
| Prisma | 6.19.3 |
| `main` protection | **`protected: false`** |
| Second public repo | `engralaminn-collab/tech360` still exists (last push 2026-11-09) |

---

## 3. TEST BASELINE — VERIFIED

```
npm run test:offline
# tests 1423 · suites 318 · pass 1423 · fail 0 · cancelled 0
```

Reproduced again in this phase. This is the **strongest** evidence available and
supersedes the directive's 1,398 figure. It includes the DB-backed suites
(payment gating, tenant isolation, scope versioning, handover) running against
SQLite built from the MySQL schema.

**Honest limits** (unchanged, still true):
- Not MySQL — proves logic, not dialect. CI covers MySQL.
- **No browser/E2E test exists.** Widget, mobile, accessibility = NOT TESTED.
- Local `tsc` reports 57 errors, all `unknown`-typed Prisma results from the
  ungenerated client stub. CI typecheck is green.

---

## 4. BRANDING COMPLIANCE AUDIT

This is the heart of the new directive and where it diverges most from reality.

### 4.1 Asset provenance — the letterhead is already owned

```
a1806694482e934db3e07aaa705b7d76  /tmp/.../Modern Tech360 Corporate Letterhead (2).png
a1806694482e934db3e07aaa705b7d76  public/brand/tech360-letterhead-a4.png
                                  ^ byte-identical
```

| Upload | In repo? | Verdict |
|---|---|---|
| Letterhead (2).png | **YES — identical** | Already committed; no action |
| `logo.jpg` (1254²) | **NO** | Repo has a *different* logo: `tech360-logo-original.jpg` (432², MD5 `60978c…`) and `tech360-logo.png` (1983×793) |
| Circular Emblem (1254²) | **Ambiguous** | `public/brand/tech360-seal.png` is also **1254²** — same dimensions, different bytes (1523 KB vs 1081 KB) and different rendering |

**Asset inventory in `public/brand/`:** `TECH360_Official_A4_Letterhead.pdf`,
`tech360-company-pad-design.png`, `-alt.png`, `tech360-header-high-res.png`,
`tech360-footer-high-res.png`, `tech360-letterhead-a4.png`,
`tech360-logo-original.jpg`, `tech360-seal.png`. Plus `public/tech360-logo.png`,
`public/logo.svg`, `public/tech360-banner.jpg`.

**Risk:** three competing logo files plus two seal-like files. Only one can be
canonical. This needs an owner decision (**D-4**), not a guess.

### 4.2 Brand colours — measured, not assumed

I sampled the supplied artwork with `sharp` and bucketed by saturation.

**Owner logo — dominant saturated tones:**

| Hex | Note |
|---|---|
| `#0060C0`, `#0054C0`, `#0048B4` | deep/bright blues |
| `#0078E4` | bright blue |
| `#30B43C`, `#24B43C`, `#18A848` | greens |
| `#005490`, `#0078A8` | teal-navy |
| `#00906C` | **teal** |

**Owner letterhead — dominant saturated tones:**

| Hex | Note |
|---|---|
| `#002478`, `#00186C`, `#0C2478` | **deep navy** (dominant) |
| `#6CB4E4`, `#78C0E4`, `#84C0E4` | pastel cyan rule/line art |
| `#90D8B4` | pale mint |

**What the codebase actually uses (734 occurrences for the first one):**

| Hex | Count | Present in owner artwork? |
|---|---|---|
| `#009FE3` cream/sky | **734** | **No** — a different, more cyan hue |
| `#0B1F33` navy-ink | 271 | Roughly, though artwork navy is `#002478` |
| `#063B8F` deep blue | 251 | Approximate |
| `#18B83A` green | 105 | Approximate |

### 4.3 Design tokens — b1 is real

`src/app/globals.css` defines shadcn **grayscale** tokens:

```css
--primary: oklch(0.205 0 0);            /* R=G=B → grey */
--sidebar-primary: oklch(0.205 0 0);    /* grey */
```

`tailwind.config.ts` maps `primary` → `hsl(var(--primary))`. So every
`bg-primary` / `text-primary` renders **grey**, not brand blue. There are
**14** such usages.

Conversely, the brand colours that *are* used are hardcoded hex in
**114 files**. `ChatWidget.tsx`, the primary channel, uses `#009FE3` **25
times** and **zero** CSS variables.

**Conclusion:** there is **no centralised design-token system**. The directive's
requirement — *"Create centralized design tokens based on the original logo and
letterhead… Apply the same identity to [11 surfaces]"* — is **NOT MET**. Colour
is duplicated as literals across 114 files with two independent, partly
conflicting palettes, and the semantic token layer points at grey.

This is the single largest piece of net-new work in the whole directive, and it
is a **refactor with real regression risk** — it touches the public site, admin,
portal and every document renderer. It must not be bundled with feature work.

### 4.4 Branding assets — a genuine strength

`src/lib/document-branding.ts` is a properly designed branding layer:
versioned config (`version`), `legalName`, `missouriLLC`, `ein`, `address`,
`tagline: 'CONNECT · INNOVATE · GROW'` (**matches the directive exactly**),
`domain`, `email`, `logoAsset`, `sealAsset`, `sealSizeMm`, per-document-type
seal permissions, and an admin override API. Tagline is already correct.

---

## 5. OFFICIAL DOCUMENT GENERATOR AUDIT

**Verdict: PARTIAL — 2 of 18 document types implemented.**

### 5.1 What exists

| Capability | Status |
|---|---|
| Branding config + versioning | **PASS** |
| HTML escaping / CSP-locked documents (`script-src 'none'`) | **PASS** — genuinely good |
| `internalNotes` never rendered to customers | **PASS** — explicit invariant |
| Invoice renderer | **PASS** — `renderInvoiceDocumentHtml` |
| Verified payment receipt renderer | **PASS** — `renderReceiptDocumentHtml` |
| Document registry (`GeneratedDocument`) | **PASS** — doc id, type, version, `sha256`, approval + finalization status, `auditHistory`, role-based `accessPermissions`, private `fileLocation` (**never** a public URL), archived `fileContent` |
| Print stylesheet + "Print / Save as PDF" | **PASS** |
| **Server-side PDF generation** | **ABSENT** |
| **Letterhead image used as page template** | **ABSENT** |
| **16 of 18 required document types** | **ABSENT** |

### 5.2 D-1 (P1): the supplied letterhead is dead configuration

`document-branding.ts` line 49 and 93:

```ts
letterheadAsset: string // full A4 letterhead fallback
letterheadAsset: '/brand/tech360-letterhead-a4.png',
```

`grep -rn "letterheadAsset" src/` returns **only**: the type declaration
(:49), the default (:93), the config merge (:144), and one admin form field
(:22 of `DocumentBrandingView.tsx`). **No renderer reads it.** It is never
emitted as a CSS `background-image`, never placed as a page template.

Instead `renderInvoiceDocumentHtml` calls `brandingPadHeader()` /
`brandingPadFooter()`, which rebuild the letterhead as HTML markup (logo `<img>`
+ tagline + navy rules). The result is *brand-adjacent*, not the supplied
artwork.

**Directive requirement:** *"Use the supplied letterhead as the actual page
template. Preserve its original proportions. Do not overlap the logo or footer.
Repeat the branding on every PDF page."* → **NOT MET.** The current approach
does not preserve original proportions and cannot guarantee no-overlap, because
margins are hand-tuned constants (`PAD`, `PAD_CSS`).

**Recommended fix (Phase 5):** render the supplied PNG as a fixed A4
`background-image` with `@page` margins reserved from measured artwork insets,
keeping the HTML body in the safe area. This is a genuine improvement *and* a
regression risk to the two working renderers — needs its own PR and visual diff.

### 5.3 D-2 (P1): no server-side PDF generation

There is **no PDF library** in `package.json` (no `puppeteer`, `pdfkit`,
`jspdf`, `playwright`). `unpdf` is present but that is for *reading* PDFs
(`doc-extract.ts`). "PDF generation" is currently **browser print-to-PDF** via
`window.print()`.

Consequences: the directive's *"PDF generation", "Document registry", "Verify
the generated PDF before issuing"* cannot be satisfied server-side. No document
can be produced unattended, and nothing verifies the rendered output. A
`TECH360_Official_A4_Letterhead.pdf` exists in `public/brand/` but nothing
generates documents from it.

**Decision needed (D-6):** accept print-to-PDF (zero new dependencies, human in
the loop) or add a headless-Chromium/Puppeteer dependency (server PDF, automated
verification, ~300 MB image weight on Hostinger). I recommend the former for
Phase 5 and revisit only if unattended issuance is required.

### 5.4 D-3 (P1): 16 of 18 document types have no renderer

Required vs implemented:

| # | Document type | Renderer |
|---|---|---|
| 1 | Invoice | **PASS** |
| 2 | Verified payment receipt *(not in list, exists)* | **PASS** |
| 3 | Business Proposal | **ABSENT** |
| 4 | Scope of Work (SOW) | **ABSENT** |
| 5 | Quotation | **ABSENT** |
| 6 | Payment Instruction | **ABSENT** |
| 7 | Service Agreement | **ABSENT** |
| 8 | Contract | **ABSENT** |
| 9 | Meeting Minutes | **ABSENT** |
| 10 | Change Request | **ABSENT** |
| 11 | Scope Approval | **ABSENT** |
| 12 | Project Progress Report | **ABSENT** |
| 13 | QA Report | **ABSENT** |
| 14 | Project Completion Report | **ABSENT** |
| 15 | Delivery and Handover Report | **ABSENT** |
| 16 | Customer Acceptance | **ABSENT** |
| 17 | Warranty / Support Document | **ABSENT** |
| 18 | Official Business Letter | **ABSENT** |
| 19 | Certificate | **ABSENT** |

`GeneratedDocument.documentType` accepts these strings, and
`document-storage.ts` has role rules for `SOW`, `HANDOVER_CERTIFICATE`,
`DELIVERY_PACKAGE`, `WORK_PROPOSAL` — so the **registry and permissions already
anticipate them**. Only the renderers are missing. That is the right shape for
Phase 5: add renderers, not a new subsystem.

### 5.5 D-4 (GATE): the seal conflict

| Fact | Evidence |
|---|---|
| Seal **enabled by default** on SOW and Invoice | `sealEnabledSOW: true`, `sealEnabledInvoice: true` (:96-97) |
| Seal rendered at 42 mm | `sealSizeMm: 42` (:100) |
| Seal asset committed | `public/brand/tech360-seal.png`, 1254², 1523 KB |
| Owner uploaded an emblem | 1254², 1081 KB — **different bytes**, different rendering |
| Directive says | *"No official stamp image has been supplied… Do not invent a company seal or signature"* |
| Directive also says | *"Missing stamp is not fabricated"* |

The repo currently **stamps official commercial documents** with an asset whose
provenance I cannot verify. The owner-supplied emblem is navy-only and visually
different from the repo seal (which renders as a navy circle on white with a
white centre).

**Risk: commercial.** A seal implies corporate authorisation. Issuing an invoice
bearing an unverified seal is a real-world liability, not a cosmetic issue.

**I did not change it** (Phase 0). Options for the owner:

- **(a)** Confirm `tech360-seal.png` is the authentic seal → no change, current
  behaviour is correct.
- **(b)** Adopt the uploaded emblem as the seal → asset swap + visual regression.
- **(c)** Disable the seal (`sealEnabledSOW/Invoice: false`) until an approved
  asset is supplied → satisfies the directive's "reserve a stamp area" literally.

**Recommended default until decided: (c)** — reserving the area is explicitly
what the directive asks for, and stamps can be re-enabled by config with no
code change.

---

## 6. WEBCHAT STATUS

**Verdict: PASS (security) / PARTIAL (features) / NOT TESTED (browser).**

| Directive requirement | Status |
|---|---|
| Floating chat widget | **PASS** — `src/components/site/ChatWidget.tsx` |
| Secure conversation sessions | **PASS** — HMAC-SHA256, `HttpOnly`, `SameSite=Strict`, `Secure` in prod, ≥32-byte secret, **no prod fallback** |
| Constant-time signature check | **PASS** |
| Persistent message history | **PASS** — `ChatConversation` + `ChatMessage` |
| Customer identity resolution | **PASS** — but email-gated by design |
| Lead creation | **PASS** |
| Existing customer recognition | **PASS** — same-browser only; never links by typed email |
| AI-assisted responses | **PASS (logic)** — orchestrator + `screenAiReply` guard |
| Human handover / escalation | **PASS** |
| CRM integration | **PASS** |
| Customer portal connection | **PASS** |
| Conversation status / unread | **PASS** |
| **Attachment support** | **ABSENT** — no upload path in the chat route |
| Responsive mobile | **NOT TESTED** — no browser run |

**Notable design decision:** a Client ID is **not** issued until a valid email is
supplied (`EMAIL_GATE_PROMPT`). This is a deliberate anti-duplicate control and
is defensible — but it means the directive's Stage 1 ("assign Client ID on first
message") is satisfied only *after* the visitor provides an email. Worth
aligning the two documents.

Brand: the widget hardcodes `#009FE3` ×25, `#063B8F` ×6, `#EF4444` ×4, and uses
**0** CSS variables (§4.3).

---

## 7. CRM STATUS

**Verdict: PASS.**

| Requirement | Status |
|---|---|
| One Client ID per customer | **PASS** — `nextClientId()`, `TECH-YYYY-NNNNNN`, unique |
| Unified history | **PASS** — `Client` owns 27 relations (comms, projects, invoices, payments, scopes, previews, meetings, approvals, deliveries, handovers, files, agent jobs, identities, documents, inbound events) |
| Verified contact identities | **PASS** — `ClientIdentity`, unique `(identityType, normalizedHash)` |
| Duplicate detection + merge audit | **PASS** — `crm-merge.ts`; flagged by normalized email/phone/business name; self-merge and already-merged rejected; **never deletes** the original `TECH-` row |
| Lead management | **PASS** |
| Business profiles | **PASS** — `businessName`, `businessType` on `Client`; `Lead` detail |
| Communication history | **PASS** |
| Segmentation / follow-up / timeline / support | **PASS** — pipeline stages, `AutomationLog`, follow-up policy |
| **`BusinessProfile` model** | **ABSENT** — fields are on `Client`, no separate profile |
| **`DiscoverySession` model** | **ABSENT** — discovery lives in an `AiMemory` blob + `Lead.requirements` |
| **`Tenant` model** | **ABSENT** — isolation is client-scoped (`clientId`), which is consistent for a single-business CRM |

Admin surface: **54 admin view components** in `src/components/admin/`, covering
CRM (`LeadsView`, `ClientDetailView`, `LeadsBoard`), comms
(`CommunicationsView`, `ConversationsView`), workforce (`WorkforceView`,
`AgentsView`, `DepartmentsView`), documents (`DocumentBrandingView`), payments
(`PaymentsView`), projects (`ProjectsView`, `TaskQueueView`), approvals
(`ApprovalsView`), audit (`LogsView`), integrations (`IntegrationsView`),
settings (`SettingsView`). Most directive modules have a home.

---

## 8. AI WORKFORCE STATUS

**Verdict: PASS (structure) / BLOCKED (execution).**

| Check | Result |
|---|---|
| 44 executable core agents | **PASS** — `validateAgentRegistry().valid`, 0 duplicates |
| 110 departments | **PASS** |
| 2,200 logical definitions | **PASS** (`LOGICAL_AGENT_CATALOGUE.length`) |
| Depts with ≥1 runnable agent | **36 of 110** — the other 74 are organisational only |
| Agent execution | **BLOCKED** — no provider credentials; **0 of 44 executed** |

**The directive's 16 required roles all map onto existing agents — no new agents
needed** (verified by code existence): `COM-010`, `CST-020`, `CRM-003`,
`BIZ-004`, `PLN-005`, `SCP-006/007/008`, `MTG-015`, `PRP-009`, `PAY-016`,
`PRJ-018`, `TSK-019`, `QA-038`, `DLV-029`/`HND-030`, `VOX-043`, `SEC-025`, with
`REV-032`/`ADM-033` for governance.

Orchestrator (`chat-orchestrator.ts`) enforces: one Client ID, same CRM history,
answer-first, one follow-up max, never re-ask, persist before advancing, and on
AI failure **record the failure rather than invent a reply**. Agents cannot
approve their own restricted actions (`ApprovalRequest` gate). **I fabricated no
AI output and marked no logical profile as a running agent.**

---

## 9. PAYMENT STATUS

**Verdict: PASS (logic + DB transactions) / BLOCKED (live).**

Verified by passing tests this phase:

| Rule | Status |
|---|---|
| Screenshot = `SUBMITTED` evidence only | **PASS** |
| `SUBMITTED` never auto-becomes `PAID` | **PASS** |
| Direct operator bypass to `PAID` forbidden | **PASS** |
| Unverified payment cannot activate project | **PASS** |
| Failed verification has no side effect | **PASS** |
| Amount/currency mismatch rejected | **PASS** |
| Idempotent duplicate settlement | **PASS** |
| Governed `PAYMENT_VERIFY` approval | **PASS** |
| Stripe signature validated (constant-time, raw body) | **PASS** |

Stripe is **not an SDK dependency** — hand-rolled REST. No charge, refund or
webhook was exercised. **No live payment claim is made.**

---

## 10. DELIVERY / SOURCE HANDOVER STATUS

**Verdict: PASS, with an honest self-disclosure.**

Tests passing this phase: `blocks source access before explicit release`,
`blocks a released package until full verified payment`, `blocks expired links`,
`approved source handover end-to-end`, `approved handover artifact manifest`.
Download re-verifies SHA-256 and rejects changed bytes (`HANDOVER_ARTIFACT_CHANGED` → 409).

The code tells the customer the truth:

> *"Files passed TECH360 deterministic structural and credential-pattern checks. External malware scanning is not configured."*

So "security checks passed" = **pattern scanning only, no antivirus**. Must never
be reported as full malware scanning. **Owner risk acceptance needed (D-7).**

**Missing:** `DeliveryArtifact` and any QA model. Delivery evidence lives in
`Delivery.checklist` / `Delivery.evidence` JSON; QA and defect status have **no
queryable table** — so "QA failure blocks delivery" cannot be enforced by query
today.

---

## 11. SECURITY FINDINGS

| ID | Sev | Finding | Status |
|---|---|---|---|
| S-1 | Low | WhatsApp GET handshake used `===` on a secret | **Fixed earlier turn** — pure verifier + 7 tests; awaiting gate |
| S-2 | **P1** | Seal stamps SOW/Invoice with **unverified provenance** | **GATE D-4** |
| S-3 | P2 | Channel status from env presence, not connectivity (§12 violation) | **Open** |
| S-4 | P1 | WhatsApp env naming drift (`WHATSAPP_TOKEN` in code vs `WHATSAPP_ACCESS_TOKEN` in an operator doc) | **Open** |
| S-5 | Info | No malware scanning; pattern checks only, honestly disclosed | **D-7** |
| S-6 | P1 | `main` **unprotected**, repository **public** | **Open** — owner |
| S-7 | Info | Chat token not revocable before 30-day expiry | Accepted |

Verified-good: **no** hardcoded secret fallbacks in `src/`; Prisma `query`
logging disabled in production (PII/credentials never logged); every webhook
validates signatures in constant time over the raw body; `guard()` fails closed
(default `minRole: ADMIN`, AUDITOR strictly read-only, CSRF double-submit).
**No secret was read, printed or committed.**

---

## 12. DATABASE AND MIGRATION RISKS

18 migrations, 97 models, MySQL. CI proves **zero drift**. Immutability enforced
by `check-migration-immutability.mjs`. `prisma-migration-doctor.mjs` handles
P3009 recovery. Historical hazard: a **renamed** migration
(`13_post_review_grid` → `93_post_review_grid`) broke production because Prisma
tracks by name.

Missing models: `Milestone`, `QA record`, `DeliveryArtifact`,
`DiscoverySession`, `BusinessProfile`, `Tenant`. **No migration was run; no
database was reset.**

---

## 13. MISSING CAPABILITIES

| # | Missing | Phase |
|---|---|---|
| 1 | Centralised brand design tokens (114 files of hardcoded hex; `--primary` is grey) | 1 |
| 2 | Letterhead image used as true A4 page template (currently dead config) | 5 |
| 3 | 16 of 18 official document renderers | 5 |
| 4 | Server-side PDF generation + PDF verification | 5 |
| 5 | Seal provenance decision | **GATE** |
| 6 | WebChat attachment support | 2 |
| 7 | QA model — QA gate not queryable | 9 |
| 8 | `Milestone`, `DeliveryArtifact`, `DiscoverySession` models | 8–9 |
| 9 | 4-state integration connectivity vocabulary | 2 |
| 10 | Browser E2E harness | 2 |
| 11 | Malware scanning | 9 |
| 12 | Rehearsed rollback | gate |

**Not missing — do not rebuild:** canonical Client ID, `ClientIdentity` +
verified-only linking, CRM merge with audit, WebChat session security, approval
chain, SOW versioning, preview gate, payment gate, delivery gate, handover
authorization, document registry, branding config layer, RBAC, audit logging.

---

## 14. RECOMMENDED IMPLEMENTATION PLAN

| Phase | Scope | Risk | DB change |
|---|---|---|---|
| **Gate 0** | Approve report; decide D-1…D-8 | — | — |
| **1** | **Design-token foundation**: single palette extracted from supplied artwork; replace `--primary` grey; migrate hardcoded hex **incrementally** with visual regression tests | **High** (114 files) | none |
| **2** | WebChat: attachments, 4-state connectivity, browser E2E | Medium | none |
| **3** | CRM: `DiscoverySession` | Low | +1 additive |
| **4** | AI Workforce: verified credential exercise | Medium | none |
| **5** | Documents: letterhead page template, 16 renderers, PDF decision, seal policy | **High** | none |
| **6** | SOW / approval / preview hardening (already ~80% built) | Low | none |
| **7** | Payment / Finance (built; needs Stripe sandbox rehearsal) | Medium | none |
| **8** | Projects: `Milestone` | Low | +1 additive |
| **9** | QA/delivery: `QA record` + `DeliveryArtifact`; rollback drill | Medium | +1 additive |
| **10** | Customer success (largely built) | Low | none |
| **11** | WhatsApp activation — **owner gate only** | — | none |

**Sequencing note:** Phase 1 must precede Phase 5, or the document renderers will
bake in the wrong palette and have to be rewritten twice.

---

## 15. ROLLBACK PLAN

**Current state: no rehearsed rollback.** Available:

- Git history; every change is a revertable merge.
- `scripts/backup/mysql-backup.sh` + `mysql-restore-drill.sh` (well-safed: target
  must start `tech360_drill_`, must differ from `DATABASE_URL`, prod opened
  read-only, `DROP DATABASE` refused otherwise). **Never executed.**
- `prisma-migration-doctor.mjs` for P3009.
- Migration immutability gate.

**Proposed:**

1. `9d0547b` is the known-good baseline.
2. Feature branch only; no force-push; no work on `main`.
3. Before any migration: backup **and** a completed restore drill; record row counts.
4. Additive migrations only — never drop/retype in the same release.
5. App rollback = redeploy previous SHA via Hostinger.
6. DB rollback = restore pre-migration backup (only after a passing drill).
7. Post-deploy smoke: `/api/health`, homepage, portal login, WebChat session.
8. For Phase 1 (tokens) and Phase 5 (documents): **visual regression snapshots
   before and after**, since these are visual changes to live customer surfaces.

**Honest limitation:** steps 3–6 are unrehearsed. Rollback is a plan, not yet a
capability.

---

## 16. REQUIRED OWNER DECISIONS

| # | Decision | Blocks |
|---|---|---|
| **D-1** | Approve this Phase 0 report (Gate 0) | all work |
| **D-2** | Confirm canonical repo; retire `engralaminn-collab/tech360` | deployment |
| **D-3** | Should the commercial source remain **public**? | source exposure |
| **D-4** | **Seal**: (a) repo seal authentic → keep · (b) adopt uploaded emblem · (c) disable seal until approved. **Recommended: (c)** | commercial docs |
| **D-5** | **Canonical logo asset** — three candidates exist; which is authoritative? | Phase 1 + 5 |
| **D-6** | **PDF**: accept print-to-PDF, or add headless-Chromium dependency? **Recommended: print-to-PDF** | Phase 5 |
| **D-7** | Accept pattern-scan-only delivery (no malware scanning)? | Phase 9 |
| **D-8** | Approve Phase 1 (design tokens) — the largest, riskiest refactor | Phase 1 |
| **D-9** | Protect `main`: required review + required CI | merge safety |
| **D-10** | Confirm canonical WhatsApp env name (`WHATSAPP_TOKEN`) at Gate 8 | Phase 11 |
| **D-11** | Keep or revert the pending WhatsApp handshake repair | tree cleanliness |

Silence is not permission. **No credentials were requested in chat and none were
invented.**

---

## 17. FINAL RECOMMENDATION

# PROCEED WITH CONDITIONS

**Why not SAFE TO PROCEED:** the directive's own document requirements are unmet
in three specific, load-bearing ways — the supplied letterhead is not used as the
page template (it is dead config), 16 of 18 document types have no renderer, and
no server-side PDF generation exists. Separately, official invoices are currently
stamped with an asset whose provenance cannot be verified, which is a commercial
liability rather than a cosmetic one. And production has still never been
observed.

**Why not DO NOT PROCEED:** the platform is genuinely strong where it counts.
Canonical identity, unified CRM, verified-only identity linking, WebChat session
hardening, the approval chain, payment gating and SUPER_ADMIN handover are all
implemented **and pass 1,423 of 1,423 tests**, including real database
transactions. The document registry, branding config layer and tagline
(`CONNECT · INNOVATE · GROW`) already match the directive. Building a parallel
system would destroy working code.

**Conditions before any implementation:**

1. **D-4 (seal)** and **D-5 (logo)** answered — both are blocking asset-provenance
   questions I will not guess at.
2. **D-8** approve Phase 1. The token refactor touches 114 files; it needs a
   dedicated PR, visual regression snapshots and no bundled features.
3. **D-2/D-3/D-9** — resolve repo identity, visibility and `main` protection.
4. Accept **1,423** as the regression target (supersedes 1,398).
5. Staging target + one **restored** backup before any migration.

**Stopping here as instructed.** No implementation, no migration, no deployment,
no WhatsApp activation, no brand redesign. Awaiting Gate 0.
