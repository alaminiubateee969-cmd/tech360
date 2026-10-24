# Hostinger Mail API integration

Status: **implemented and tested with a mock provider. Not yet verified live.**
No live email has been sent through Hostinger, and no webhook has been registered
in Hostinger. Do not treat either as working until the checklist at the end is done.

## What it does

- Email (`EMAIL` channel) can be sent through the official `hostinger-mail-api-sdk`
  (pinned to `1.19.6`) instead of SMTP.
- The SDK is imported only in `src/lib/mail/hostinger-mail.ts`. A boundary test
  (`tests/hostinger-mail-client-boundary.test.ts`) fails if a client component or
  `NEXT_PUBLIC_` variable touches the mail configuration.
- Inbound mail is pulled from the mailbox INBOX in bounded batches
  (`src/lib/mail/hostinger-inbound.ts`). Each message is stored once as an inbound
  `Communication`, and the checkpoint is persisted in `Setting`.
- A public webhook (`POST /api/webhooks/hostinger-mail`) only **triggers** a bounded
  sync. Its payload is not trusted for content, because the webhook event schema is
  not documented.
- Admin routes (SUPER_ADMIN only): `GET /api/admin/mail/status` (config state by
  variable name, checkpoint, optional read-only `?verify=1`) and
  `POST /api/admin/mail/sync` (one bounded sync, audited as `HOSTINGER_INBOX_SYNC`).

## Configuration

Variable names are in `.env.example`. Values never go in Git and are never sent to the
browser.

| Variable | Purpose |
| --- | --- |
| `HOSTINGER_MAIL_ENABLED` | Must be exactly `true` to select Hostinger. Anything else keeps SMTP. |
| `HOSTINGER_MAIL_API_TOKEN` | Bearer token scoped to one Hostinger order. Use the narrowest scope. |
| `HOSTINGER_MAILBOX_RESOURCE_ID` | `resourceId` of the managed mailbox. |
| `HOSTINGER_MAIL_FROM_ADDRESS` | Address of that mailbox. Must be on `bdtech360.com`. |
| `HOSTINGER_MAIL_WEBHOOK_SECRET` | Optional. Only the one-time secret Hostinger returns when an authorized person configures a webhook. |

Rules:

- If `HOSTINGER_MAIL_ENABLED=true` and any required value is missing or invalid, email
  sends return `NOT_CONFIGURED` and name the variables. There is **no silent fallback to SMTP**.
- The webhook route returns 503 when its secret is unset, and 401 for a bad bearer token.

## Delivery semantics (important)

The Hostinger send endpoint returns HTTP 204 with no message id. That means:

- `SENT` = the provider **accepted** the request. It never means the customer received it.
- A timeout after the request was sent, or a 5xx, is classified `AMBIGUOUS_PROVIDER_OUTCOME`.
  The outbox parks these for an operator to check the Sent folder first. It does not
  retry them automatically, to avoid duplicate customer emails.
- A refused connection or a validation rejection is `NOT_PROCESSED` or `REJECTED`.

## Verification done (no live account)

| Check | What it proves |
| --- | --- |
| `tests/hostinger-mail-policy.test.ts` (22) | Config validation, error sanitising, HTML-to-text, outcome classes. |
| `tests/hostinger-mail-sdk-contract.test.ts` (11) | The **real SDK** against a local `node:http` fake that follows the documented shapes: paths, methods, Bearer header, body shape, search/pagination, 401/422/429/504, timeouts, refused connections. Tokens never appear in errors. |
| `tests/hostinger-mail-inbound.test.ts` (7) | Storage, dedupe on replay, checkpoint resume after a provider error, busy-lease stop, budget, unconfigured stop, no matching by display name. |
| `tests/hostinger-mail-webhook-route.test.ts` (7) | Auth gate, body cap, JSON validation, event handling, redelivery dedupe, no secret in responses. |
| `tests/hostinger-mail-routing.test.ts` (4) | SMTP default kept; enabled-but-invalid refuses; no credential material in status. |
| `tests/hostinger-mail-client-boundary.test.ts` (5) | Client bundles cannot reach the SDK or the token. |

A deliberate mutation (removing the stored-row dedupe) was caught by 6 of the 7 inbound tests.

The full `npm test` reports `fail 4` and `cancelled 17`, the same counts as the untouched base
commit. The failing and cancelled suites are pre-existing: copy/template expectations, and
database-backed suites that need a disposable MySQL. Only the TAP numbering differs. The new
tests add 51 passing tests.

## Not verified (do not claim)

- Live send through `api.mail.hostinger.com`.
- Webhook registration in Hostinger, its signature scheme, payload fields, or retry policy.
  The public docs (v1.3.0) do not document these, and the SDK reports API 1.2.2.
- Delivery to a real inbox.

## Operator checklist before enabling

1. Confirm the token's permissions and purpose with the account owner. Do not reuse existing tokens without that confirmation.
2. Set the variables in the Hostinger environment (not in Git). Check `GET /api/admin/mail/status?verify=1`.
3. Send **one** test email to an internal address only, with explicit authorization.
4. Only if webhooks are wanted: an authorized person configures the webhook in hPanel,
   then a real event must be observed and verified before it is claimed working.
5. Deploy through the existing Hostinger Git path. CI (`.github/workflows/ci.yml`) remains the validation path.
