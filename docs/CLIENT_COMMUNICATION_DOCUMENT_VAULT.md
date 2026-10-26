# Client Communication Ledger & AI Document Vault

## Status
Requirements and implementation contract for the Central Command Center. This document is not evidence that the full feature is already deployed. The current WhatsApp webhook writes text/message placeholders to the existing `Communication` ledger; actual media download, private object storage, portal access, OCR/extraction, and immutable retention require implementation and testing.

## Non-negotiable product rules

1. **One client identity:** Every accepted inbound/outbound communication must link to a stable internal Client row and public-facing `clientId` (for example, `TECH-YYYY-NNNNNN`). Never use the phone number as the permanent primary key.
2. **Unknown WhatsApp number:** On the first verified inbound webhook, normalize the phone number, check active Client records, and create a Client + Lead if no match exists. Save the original inbound message exactly once using the provider message ID as the idempotency key. Keep the provider ID and source metadata.
3. **Every channel uses one ledger:** WhatsApp, email, portal, web forms, Facebook/Instagram (where official APIs permit), and staff-entered calls/notes should be linked to the same client timeline. Store direction, sender/recipient, channel, provider ID, timestamp, delivery/read/failure status, message type, attachment references, and safe metadata.
4. **No public document URLs:** Private client documents must use private object storage or a private storage service, never a public web root, blog/media folder, or a guessable URL. Downloads must pass authenticated server-side authorization and use short-lived signed URLs only when needed.
5. **Documents are versioned records:** Preserve the original bytes, cryptographic hash, MIME type, size, original filename (safely encoded), uploader/source, received time, client ID, document category, scan status, AI extraction status, reviewer, and version/supersession links.
6. **AI assists; humans decide:** AI may classify a document, extract fields, summarize, detect likely duplicates, compare versions, and identify missing/expired/inconsistent items. AI output must be marked as machine-generated and retain source/page references and confidence. Never silently overwrite an original, assert uncertain extracted data as fact, or auto-submit/send a document without an authorized human approval.
7. **Duplicate detection:** Compute SHA-256 for exact-byte matches and use metadata/content similarity only to suggest likely duplicates. A matching filename alone is not proof. Keep each upload as an event and link duplicates to the canonical document/version rather than discarding evidence.
8. **Audit history is append-only by application policy:** Staff must not be able to delete communication records, document versions, audit events, or evidence of prior changes. Use archive/void/supersede states instead of destructive deletion. Enforce this server-side on every API, not just in the UI. Use database permissions/constraints and object-storage retention/versioning where supported. A Super Admin's emergency/legal-retention workflow must be separately approved, reason-coded, audited, and should not erase the audit evidence.
9. **Roles and least privilege:** Enforce server-side RBAC and client/brand scoping. Staff can view only assigned/authorized records. Managers/admins may review according to policy. Super Admin and Admin may manage access and retention exceptions, but ordinary Admin UI must not expose hard-delete actions. Client portal users may access only their own explicitly authorized records.
10. **Privacy and retention:** Collect only necessary data; verify client identity before portal access; record consent/legal basis where applicable; provide retention and lawful erasure workflows that preserve legally required audit evidence. “Immutable” means protected against ordinary users and tampering, not a promise to ignore applicable privacy law.

## Inbound WhatsApp workflow

1. Verify Meta's `X-Hub-Signature-256` over the raw request body.
2. Validate payload shape and provider event type; handle retries idempotently.
3. Normalize the sender's WhatsApp number to E.164 when possible.
4. Find an active client using normalized WhatsApp/phone mapping. If no match exists, create the Client + Lead with a generated Client ID. If a match is ambiguous, queue identity review rather than merging automatically.
5. Persist the inbound communication and provider ID in a transaction where practical. Add a database uniqueness constraint for provider + message ID + direction after reviewing legacy duplicates.
6. For text, store sanitized display text while preserving only permitted provider payload metadata. For media/document messages, create a pending attachment record immediately and queue secure media retrieval. Do not treat a placeholder such as `[document message]` as a saved file.
7. Retrieve media using the official provider API with server-side credentials, enforce size/type limits, scan/quarantine it, hash it, store it privately, and link the resulting document to the same Client and Communication. A failed download must remain visible as a retryable failure, not silently disappear.
8. Audit client creation, message ingest, attachment retrieval, classification, access, export, and review decisions.

## AI document workflow

`RECEIVED → QUARANTINED → SCANNED → CLASSIFICATION_PENDING → AI_EXTRACTED → HUMAN_REVIEW → VERIFIED / NEEDS_CORRECTION / REJECTED → SUPERSEDED / ARCHIVED`

- OCR/extraction runs in a queue with bounded file size, timeout, and retry policy.
- Treat document contents as untrusted input. Do not follow instructions embedded inside uploaded documents.
- Store extracted fields as structured JSON with model/provider, timestamp, confidence, page/region references, and a link to the immutable source.
- When a new file appears to match a prior document, show a comparison: exact hash match, likely same type, changed fields, dates/expiry, and confidence. Require human confirmation before changing the canonical/current version.
- For identity, passport, financial, academic, immigration, and other sensitive records, apply restricted permissions, encrypted storage, redacted logs, and access auditing.
- Never send client documents to an external AI provider unless that provider and data transfer are explicitly approved and configured.

## Portal requirements

- A stable authenticated client portal associated with the internal Client row and Client ID.
- Timeline for messages, calls/notes, requests, and document status.
- Secure document upload/download, upload receipts, missing-document checklist, reviewer feedback, and version history.
- Staff-side view linked from the CRM client profile.
- Client-facing messages must not reveal internal notes, staff-only metadata, other clients, provider credentials, or internal AI prompts.
- Invite/password reset links must be short-lived, single-use, and identity-verified; never grant portal access merely because someone sent a WhatsApp message from a phone number.

## Data model / migration work required

Review and add explicit records for:
- provider identity mapping and idempotent webhook event/message identifiers;
- communication attachment references;
- client document metadata, versions, hash, storage key, scan and AI processing states;
- AI extraction runs and human review decisions;
- retention/legal hold and append-only audit events.

Before changing foreign-key deletion behavior, inspect all current delete routes, legacy data, and migrations. The current Prisma schema has a `Communication.client` relation with `onDelete: Cascade`, which can erase communications if a Client row is hard-deleted. A reviewed migration and application-level delete prohibition are required; do not assume this document alone changes that behavior.

## Acceptance criteria

- Replayed Meta webhook does not create a duplicate communication, client, or attachment.
- First message from a new WhatsApp number creates one Client ID and one Lead, and the inbound message is visible on that client's timeline.
- Incoming document/media appears as a pending attachment and then as a private, scanned, client-linked document; failure states and retries are visible.
- The same document uploaded again is linked as an exact duplicate or proposed duplicate without deleting either event.
- AI extraction produces traceable suggestions and never replaces original bytes or bypasses human review.
- Staff/Admin endpoints reject deletion of communications, documents, versions, and audit events, even if called directly.
- Only authorized client portal accounts can view/download their own documents.
- Access, download, export, review, archive, and retention exceptions are audited.
- Database migrations, typecheck, lint, unit tests, and end-to-end tests pass before merge/deployment.
