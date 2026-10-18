# The Tech360 AI Agent Communication Pipeline

| | |
|---|---|
| **Document** | `docs/implementation/COMMUNICATION_PIPELINE.md` |
| **Owner** | Platform engineering, Tech360 |
| **Collection date** | 2026-10-19 |
| **Last verification** | 2026-10-19 |
| **Access level** | Internal — engineering and Super Admin |
| **Version** | 1.0 |
| **Retention** | Retained for the life of the platform |
| **Source of truth** | `src/lib/pipeline/templates.ts` (the copy), `src/lib/pipeline/rules.ts` (the policy), `src/lib/pipeline/send.ts` (the sender) |

This is the implementation record for the eleven-stage client journey:
the first SMS to the final project delivery, with the exact WhatsApp/SMS
reply text, the exact email subjects and bodies, the CRM-save rules and
the admin-approval gates.

---

## 1. What was found before anything was written

The pipeline was **not** missing. `src/lib/journey.ts` (1,224 lines at
the time of this work) already implemented a real first-message →
final-delivery engine, and it was the correct place to extend:

| What already existed | Where | What was kept |
|---|---|---|
| the stage machine (`PIPELINE_STAGES`, 20 stages) | `src/lib/constants.ts` | unchanged |
| the journey actions (`JOURNEY_ACTIONS`, 25 actions) | `src/lib/constants.ts` | unchanged |
| the Client ID generator `TECH-YYYY-NNNNNN` | `src/lib/ids.ts` | unchanged — `TECH-2026-000001` is what it already produced |
| the lead intake, business detection, plan recommendation, scope review, scope approval, preview, payment, handover, delivery and closure paths | `src/lib/journey.ts` | all kept; the message copy and the gates were completed |
| the outbound dispatcher that already writes a `Communication` row per message | `src/lib/comms.ts` | extended with a `metadata` field |
| the approval execution path | `src/app/api/admin/approvals/[id]/decision/route.ts` | extended with two new approval types |
| the admin journey console action | `src/app/api/admin/journey/route.ts` | extended |

**No parallel system was created.** There is still exactly one journey
engine, one message dispatcher, one approval path and one CRM.

What was genuinely missing, and is now written:

1. the **exact copy** — the existing templates were generic ("Our team
   is reviewing your requirements and will reply shortly");
2. the **auto-send vs admin-approval gate** — the payment instruction
   was sent directly to the client with no approval;
3. the **"always save" contract** as an explicit, testable rule;
4. the **"no phone number in AI content"** rule — it did not exist;
5. the **client profile** as a first-class, readable record.

---

## 2. The eleven stages

The stage table is the single definition, in
`src/lib/pipeline/rules.ts` (`CLIENT_JOURNEY_STAGES`). The console and
the API read it; nothing hard-codes a second copy.

| # | Stage | What happens | Gate |
|---:|---|---|---|
| 1 | First message received | lead created, **Client ID generated and saved**, the inbound message saved, the source detected, the business type and the project need asked for | AUTO |
| 2 | Business type received | the industry is detected, a plan is recommended, the eight scope questions are asked, **WhatsApp + email** are sent | AUTO |
| 3 | Scope details received | the scope is saved, a draft SOW is generated, **an admin approval is raised** | AUTO (acknowledgement) |
| 4 | Final scope approved | the final SOW, the payment policy and the HTML-preview policy are sent, the client is asked to review, a meeting link is offered | **ADMIN APPROVAL** |
| 5A | Meeting needed | the meeting link is sent, the request is saved, a task is created | AUTO |
| 5B | Scope approved | the approval is saved, the confirmation is sent, the HTML preview is prepared | AUTO |
| 6 | Preview sent | the preview link is sent, the client is asked for Approved / Need revision / Need meeting, the tracking is saved | AUTO |
| 7A | Revision | the revision is saved, the admin is notified, a task is created | AUTO |
| 7B | Preview approved | the approval is saved, the payment step is raised | **ADMIN APPROVAL** (payment-specific) |
| 8 | Payment received | the payment is saved, the admin and the team are notified, the delivery is unlocked | AUTO |
| 9 | Delivery ready | the notice is sent; **the source code is not released unless payment is confirmed, and the file links need an admin approval** | AUTO (notice) / **ADMIN APPROVAL** (links) |
| 10 | Delivery completed | the delivery is saved, the password-change confirmation is asked for, the client is asked to confirm | AUTO |
| 11 | Client confirms | the project is closed, a review is requested, an optional recommendation is requested | AUTO |

### Why 7B is gated

The specification lists the auto-send messages as "first reply,
business-type request, recommended plan, scope questions, meeting link,
HTML-preview notification, revision acknowledgement, payment-received
acknowledgement, review request". Stage 7B is not on that list, and the
stage text is explicit: *"send payment instruction only after admin
approval"*. It is therefore gated. The final rule *"no payment-specific
message without admin approval"* is enforced twice:

- by stage (`ADMIN_APPROVAL_STAGES`), and
- by **content** — `effectiveGate()` re-checks the body and gates any
  message that carries a monetary amount, whatever its stage label.

A payment-received acknowledgement (stage 8) carries **no amount** (the
verified amount lives on the `Payment` record and in the audit trail),
so it stays on the auto-send list as the specification requires.

---

## 3. The gates, enforced in code

`src/lib/pipeline/rules.ts`:

| Constant | Contents |
|---|---|
| `AUTO_SEND_STAGES` | the eleven stages above that the AI may send on its own |
| `ADMIN_APPROVAL_STAGES` | `FINAL_SCOPE_APPROVED`, `HTML_PREVIEW_APPROVED` |
| `ADMIN_APPROVAL_CATEGORIES` | `FINAL_SCOPE`, `PAYMENT_INSTRUCTION`, `INVOICE`, `LEGAL_RESPONSE`, `REFUND_RESPONSE`, `SOURCE_CODE_HANDOVER`, `DELIVERY_FILE_LINKS`, `DISPUTE_RESPONSE` |
| `effectiveGate(stage, body, category?)` | the effective gate, including the content check |
| `assertDeliveryRules({ paymentConfirmed, sourceCodeRelease, adminApproved })` | *Source Code After Full Payment* + admin approval |
| `assertNoSensitiveFilesInPublicContent(text)` | no file link in a public AI message |

Both lists **fail closed**: an unknown stage or an unknown category is
`ADMIN_APPROVAL_REQUIRED`. `gatePartitionIsComplete()` proves that the
two lists cover every message stage exactly once, and the test suite
asserts it.

A gated message is never half-sent. `sendPipelineMessage()` composes
the message, writes the `ApprovalRequest`, notifies the Super Admin,
audits it, and returns `AWAITING_APPROVAL` with **no** delivery
attempt. The approval execution path then re-sends it with
`approved: true`.

### 3.1 The content gate — the amount rule, and the six siblings

The stage label is not the only gate. A message is also gated by what
it **says**, so a message cannot slip past by being filed under an
auto-send stage:

| Content | Result |
|---|---|
| a monetary amount | `ADMIN_APPROVAL_REQUIRED` — whatever the stage |
| an invoice (`invoice`, `INV-2026-0001`) | `ADMIN_APPROVAL_REQUIRED` |
| a legal response (`legal`, `liability`, `indemnity`, `attorney`, …) | `ADMIN_APPROVAL_REQUIRED` |
| a refund response (`refund`, but **not** `non-refundable`) | `ADMIN_APPROVAL_REQUIRED` |
| a dispute response (`dispute`) | `ADMIN_APPROVAL_REQUIRED` |
| a link to a delivered package (`/download`, `/handover`, `/package`, …) | `ADMIN_APPROVAL_REQUIRED` — a source-code handover **and** a delivery-file-links message |

`gateReason()` returns the human-readable reason, and it is written
into the `ApprovalRequest` description and the audit entry, so the
operator sees *why* a message was held.

**Why the markers are so narrow.** The auto-send copy legitimately
contains the phrases "source code", "admin access", "handover",
"payment policy", "payment gateway" and "non-refundable" — as
**policy statements** ("the final source code is provided after full
payment"). A loose keyword scan would have wrongly gated five of the
nine auto-send items. So the markers use only words that appear in
**none** of the auto-send copy, and the amount test distinguishes
`$1,500` and `1,500 USD` (money) from `40%` and `2026` (not money).

The regression test for this is explicit: it feeds eight real policy
statements from the auto-send copy into the gate and asserts that
**every one of them is still `AUTO_SEND`**.

### 3.2 The same gate on the manual admin path

A human composing a message in the console could otherwise have sent
an invoice, a legal response or a payment instruction with a manager's
authority alone. `POST /api/admin/communications/send` now applies the
same content classifier:

- a **MANAGER** whose body falls into a gated category is **refused**
  with `403`, the reason is audited, and **nothing is sent**;
- a **SUPER_ADMIN** sending it *is* the admin approval the policy
  requires, so it goes out.

### 3.3 The two policies, in code

`assertDeliveryRules({ paymentConfirmed, sourceCodeRelease, adminApproved })`
is called on the handover release path, so *Source Code After Full
Payment* and the admin approval for every handover are both enforced
before a single byte is released. The HTML preview is generated and
sent **before** any payment is requested — *HTML Preview Before
Payment* — and the preview link never contains a file.

---

## 4. No phone number in AI content

> *"AI AGENT NOT MENTION ANY NUMBER AT WEBSITED."*

`findPhoneNumbers()` / `redactPhoneNumbers()` / `assertNoPhoneNumber()`
in `src/lib/pipeline/rules.ts`.

The scanner first **blanks out the safe patterns** — so a number inside
one of them is never a false positive:

| Blanked out | Example |
|---|---|
| the Client ID | `TECH-2026-000001` |
| URLs | `https://bdtech360.com/services` |
| email addresses | `info@bdtech360.com` |
| ISO dates | `2026-10-19` |
| currency amounts | `$50,000`, `5000 USD`, `BDT 12,000` |
| document numbers | `INV-2026-0042`, `PRJ-2026-0007` |

What remains is scanned for a run of **seven or more digits** with the
usual separators, plus the masked form (`+880 1XXX-XXXXXX`).

The rule is applied at three points:

1. **every** pipeline message body, before it is dispatched — a number
   is redacted, the redaction is logged (`PHONE_NUMBER_IN_AI_CONTENT`)
   and audited (`PHONE_NUMBER_REDACTED_FROM_AI_CONTENT`);
2. the AI **business type** and the AI **recommended plan**, before they
   are stored on the client row, because both are shown to the client;
3. the **HTML preview page copy** is not affected: it is a document, not
   an AI message.

The site itself never renders a phone number: `COMPANY.phone` exists
in the constants but is not written into any page component — verified
by grep over `src/components/site/*.tsx`.

---

## 5. Always save

| What | Where it is written |
|---|---|
| the inbound message | `Communication` row, `direction: 'IN'`, created by `intakeLead()` and by the social, website, n8n and portal paths |
| the outbound WhatsApp body | `Communication` row, `direction: 'OUT'`, `channel: 'WHATSAPP'` |
| the outbound SMS body | `Communication` row, `direction: 'OUT'`, `channel: 'SMS'` |
| the outbound email body | `Communication` row, `direction: 'OUT'`, `channel: 'EMAIL'` — the HTML body plus the **exact plain text** in `metadata.plainText` |
| the client ID | `Client.clientId` (unique), and it is in the body of every stage-1 message |
| the status change | `Client.pipelineStage` **and** a `Communication` row with `messageType: 'SYSTEM'`, `templateName: 'PIPELINE_STAGE_CHANGE'` and its own timestamp |
| the timestamp | every row carries `createdAt`; the stage-change record also carries `at` in its metadata |
| the admin approval | `ApprovalRequest` rows, linked to the client and to the `Communication` row through `approvalId` |
| the payment proof | `Payment` row (`transactionId`, `method`, `verifiedAt`, `verifiedBy`, `proofFileId`) |
| the delivery proof | `Delivery` row (`clientConfirmedAt`, `confirmationAnswers`) and `HandoverRecord` (`releasedBy`, `releasedAt`, `passwordChangeRequestedAt`, `passwordChangeConfirmedAt`, `confirmedAt`) |

`ACTION_SAVE_FIELDS` in the rules module maps every journey action to
the records it must write, and the test suite asserts the mapping.

When a client has **no** usable channel, the composed body is still
written to the CRM with `status: 'NOT_CONFIGURED'` and an explanatory
error, so the message is never lost.

---

## 6. The client profile

`src/lib/pipeline/profile.ts` → `clientProfile(ref)` returns the record
the specification requires, read from the records the journey already
writes (it is a **view**, not a second copy):

`clientId` · `name` · `businessName` · `businessType` · `phone` ·
`whatsapp` · `email` · `leadSource` · `messageHistory` ·
`scopeHistory` · `approvalHistory` · `paymentHistory` ·
`deliveryHistory` · `reviewHistory` · plus per-history counters and the
paid total.

Exposed at `GET /api/admin/pipeline/profile/{clientId}` (STAFF) and
shown in the console.

---

## 7. The API and the console

| Route | Method | Role | Purpose |
|---|---|---|---|
| `/api/admin/pipeline` | GET | MANAGER | the eleven stages with their live client counts, the gate lists, the exact copy and the live statistics |
| `/api/admin/pipeline/profile/{id}` | GET | STAFF | the saved client profile |
| `/api/admin/journey` | POST | MANAGER | the journey actions, now including `PREVIEW_DECISION` |
| `/api/admin/approvals/{id}/decision` | POST | SUPER_ADMIN | executes `PIPELINE_MESSAGE` and `PAYMENT_INSTRUCTION` approvals for real |
| `/api/preview/{token}/action` | POST | public | the client's preview decision → stage 7A / 7B |

**Console:** *Communication Pipeline* (CRM section, MANAGER) —
four tabs: **Journey** (the eleven stages with their live counts and
gates), **Exact copy** (the WhatsApp and email bodies the pipeline
sends), **Gates** (auto-send vs admin-approval, the two delivery
policies, the communications saved per channel) and **Client profile**
(the record above, with all six histories).

---

## 8. The files

| File | Lines | What it is |
|---|---:|---|
| `src/lib/pipeline/templates.ts` | 858 | the exact copy for all thirteen message stages + the plain-text → HTML renderer |
| `src/lib/pipeline/rules.ts` | 557 | the gates, the phone-number scanner, the delivery rules, the always-save map, the eleven-stage table |
| `src/lib/pipeline/send.ts` | 330 | the sender: the gate, the redaction, the CRM write, the approval request |
| `src/lib/pipeline/profile.ts` | 240 | the client profile view |
| `src/app/api/admin/pipeline/route.ts` | 90 | the pipeline API |
| `src/app/api/admin/pipeline/profile/[id]/route.ts` | 32 | the client profile API |
| `src/components/admin/PipelineView.tsx` | 369 | the console panel |
| `tests/communication-pipeline.test.ts` | 683 | 61 tests |

Changed, not rewritten: `src/lib/journey.ts` (the stage copy and the
gates), `src/lib/comms.ts` (a `metadata` field), `src/lib/contact-policy.ts`
(SMS became a first-class reply channel), `src/lib/constants.ts`
(`PIPELINE_MESSAGE` approval type), `src/app/api/admin/journey/route.ts`,
`src/app/api/admin/approvals/[id]/decision/route.ts`,
`src/app/api/preview/[token]/action/route.ts`, `src/components/admin/AdminApp.tsx`,
`prisma/seed.ts` (two pipeline memories), `.env.example`
(`MEETING_BOOKING_URL`).

---

## 9. The tests

`tests/communication-pipeline.test.ts` — **61 tests, 61 pass**.

| Group | Tests | What it proves |
|---|---:|---|
| the exact client copy | 15 | every stage's WhatsApp body, email subject and email body match the specified wording, item by item |
| the email HTML renderer | 5 | markup is escaped, a markdown link becomes an anchor, a `javascript:` URL stays plain text, bold and lists render, the paragraph structure is preserved |
| the message gates | 7 | the auto-send list, the approval list, the named categories, fail-closed behaviour, the content check, the amount detector |
| no phone number in AI content | 6 | the positives, the negatives (Client ID, URL, email, date, amount, invoice number, list numbering, `24/7`), the redaction, the screening, the throw, the file-link refusal |
| the delivery rules | 4 | source code is refused before payment, refused without an approval, allowed with both, and the two policy names |
| the CRM save contract | 3 | the seven required fields, the action → records map, and the payment/delivery/review histories |
| identifiers and channels | 5 | the `TECH-YYYY-NNNNNN` format, SMS as a reply channel, a phone preference is **not** silently turned into an SMS, the exact website consent boolean |
| channel selection | 4 | the channels a client may receive, the requested-channel filter, the empty case, and the agent that owns each channel |
| **the stated policy, item by item** | 7 | each of the nine auto-send items auto-sends on its real copy; each of the seven approval items is gated; an amount gates **every** stage; eight real policy statements from the auto-send copy still auto-send; the gate explains itself; the categories are detected |

---

## 10. The limits, stated honestly

- The pipeline is implemented and unit-tested; the **end-to-end run
  against a live MySQL, a live WhatsApp provider and a live SMTP server
  is not proven here** — this environment has no generated Prisma client
  and no provider credentials. The CI job generates the client and
  starts MySQL; the provider paths are exercised by the existing
  outbox-retry suite with a fake provider.
- The **exact copy is fixed** in the template module. When the business
  changes a sentence, the template changes and the 61 tests must be
  updated with it — that is deliberate, so the wording cannot drift
  silently.
- The AI's own scope questions (the `SCP-006` agent) are **kept for
  the sales team** in memory and in the automation log; the wording the
  client receives is the specified copy. The AI informs the plan and
  the internal notes, not the fixed client-facing wording.
- The meeting link is a **booking URL** (`MEETING_BOOKING_URL`,
  defaulting to `https://bdtech360.com/#contact`), not a generated
  calendar slot. Slot generation needs the calendar provider.
- The source-code handover and the delivery file links keep their
  existing, stronger mechanism: a per-file manifest pinned into the
  approval, re-verified against the stored bytes at release time.
  `assertDeliveryRules()` adds the explicit payment + approval check
  on top of it.
