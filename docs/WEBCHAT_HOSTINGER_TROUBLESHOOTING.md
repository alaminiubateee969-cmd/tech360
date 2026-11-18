# Public WebChat — Hostinger readiness and troubleshooting

**Updated:** 2026-11-17 UTC
**Scope:** The public customer-facing floating WebChat, not the private shared AI gateway.
**Evidence boundary:** Source inspection and local regression checks only. No Hostinger hPanel, production logs, production database, provider account, or live browser session was accessible in this review.

## What is implemented

The website renders [`ChatWidget`](../src/components/site/ChatWidget.tsx) from [`src/app/page.tsx`](../src/app/page.tsx). It uses same-origin Next.js routes:

- `POST /api/chat/session` — validates contact consent, creates/resumes the visitor conversation, assigns/reuses a CRM prospect Client ID, stores the first message, and sets a signed browser cookie.
- `GET /api/chat/messages` — reads the visitor's consented thread using that cookie.
- `POST /api/chat/message` — persists later messages and invokes the chat orchestrator.

Messages are designed to remain usable without an AI provider: the visitor's message should still be stored and visible to the staff inbox. AI availability is separate from WebChat availability. An API key being present is only configuration evidence; a successful provider response still has to be tested.

## Code defects found and corrected in this change

1. **Anonymous first-contact retries could be rejected.** A chat-first session stores no email as `null`, while the retry submits an empty email string. Exact request replay compared those values strictly and returned `401 CHAT_SESSION_REQUIRED`, even when the same request ID was used to recover a lost response. Replay now treats absent and blank email as the same value, while still rejecting a changed non-empty address.
2. **A failed first-message database write could be reported as a successful start.** The session route swallowed all first-message persistence errors and returned success; the widget then cleared the form and could leave the visitor in an empty conversation. Persistence errors now fail the session request so the widget retains the original message and request ID for an idempotent retry.
3. **A transient thread-read error after a successful start looked like a failed intake.** The widget now keeps the successful conversation open and marks the read as a connection issue rather than stranding the visitor on a hidden form.
4. **Copy implied an immediate AI reply even when no AI provider was available.** The first-contact copy now distinguishes message storage, optional AI help, and human follow-up.

These repairs do not prove that the current Hostinger release contains them. They need to pass CI, merge to `main`, and be deployed before production behavior changes.

## Hostinger values and services required

Set values in **Hostinger → Node.js Web App → Environment Variables**, never in Git or a browser bundle:

| Requirement | Why WebChat needs it | If missing/wrong |
|---|---|---|
| `DATABASE_URL` using the actual Hostinger MySQL host/database/user | Conversations, messages, consent records, CRM onboarding and inbox are persisted in MySQL | Startup refusal or API `503 CHAT_DB_UNAVAILABLE`; confirm migrations have completed on the intended database |
| `SESSION_SECRET`, at least 32 random characters and stable across deploys | HMAC-signs the `t360_chat_session` HttpOnly cookie | Session start returns `503 CHAT_SESSION_MISCONFIGURED`; reads/writes cannot authenticate if the secret changes between instances/deploys |
| `APP_PUBLIC_URL=https://bdtech360.com` and `APP_ORIGIN=https://bdtech360.com` | Production origin and canonical link policy | Production startup validation fails if values are absent or non-canonical |
| `NODE_ENV=production`, Node.js 22.x, and the supported Hostinger Node.js Web App start path (`npm start`) | Secure-cookie and production startup behavior | The startup preflight may be bypassed if Hostinger launches a different command; verify hPanel/runtime logs |
| One supported AI provider plus its matching credentials, **if AI replies are required** | Drives the AI chat orchestrator | Set an approved provider using the names in [`.env.example`](../.env.example). `AI_PROVIDER=none` is an explicit degraded mode: messages can be saved for staff, but the assistant will not generate replies |
| Staff inbox access and an on-duty operator | Human response when AI is unavailable or escalates | A saved message can wait without a human answer; provider setup alone does not staff the inbox |

The app's production startup validator requires a complete AI provider configuration unless `AI_PROVIDER=none` is set. Do not set `none` if the acceptance requirement is automated AI replies. Optional SMTP/SMS/WhatsApp credentials are not prerequisites for the in-browser chat channel itself. They are required only for the selected external follow-up channel. SMS-first requires a valid phone number and an approved configured SMS adapter; generic `SMS_API_*` fields must match the adapter's expected request shape. Inbound SMS also has separate webhook-signature limitations documented in [`HOSTINGER-ENV-GUIDE.md`](HOSTINGER-ENV-GUIDE.md).

## Operator diagnosis from an authorized browser

1. Open the public canonical URL without `#/admin` or `#/portal` (the widget intentionally hides on those private hash routes).
2. In DevTools → Network, open the widget and submit a consented test enquiry. Confirm `POST /api/chat/session` returns `201`, includes a `Set-Cookie` for `t360_chat_session`, and the request stays on the same HTTPS origin.
3. Confirm `GET /api/chat/messages` returns `200` and includes the submitted message. Then send a second message and verify `POST /api/chat/message` returns `201` and the message appears in both the visitor thread and staff inbox.
4. Use `/api/health` to confirm the deployed `release.commit`, MySQL connectivity and schema status. Compare the full commit with the intended deployed `main` SHA; a healthy endpoint alone does not prove that it is the latest code.
5. Test AI separately with an authorized non-sensitive prompt. The widget's status says whether provider configuration is present; only a real successful response proves inference. If a shared AI gateway is a required architecture component, also require `/api/ai-gateway/ready` to return `200` (not just `/health`).
6. Record redacted status codes, response `code` fields, timestamps and release SHA only. Never capture cookie values, provider tokens, customer messages or database URLs in tickets or screenshots.

### Common response clues

| Response | Likely area to investigate |
|---|---|
| `503 CHAT_SESSION_MISCONFIGURED` | Missing/short `SESSION_SECRET`; verify secret length and startup logs without exposing its value |
| `503 CHAT_DB_UNAVAILABLE` | MySQL reachability, schema/migration state, permissions, or a write/read failure; inspect redacted server logs |
| `401 CHAT_SESSION_REQUIRED` | Browser did not retain/send the same-origin cookie, the cookie signature key changed, or the exact retry changed contact data; confirm HTTPS, cookie path/domain behavior, and stable `SESSION_SECRET` |
| `429 RATE_LIMITED` | Public chat rate limit; wait and retry, then review abusive traffic through normal monitoring |
| Session `201`, message visible, AI says unavailable | Chat transport is operational but provider is disabled, unconfigured, or execution failed; configure/test an approved provider or assign human follow-up |
| Session `201`, but no visitor thread on an older release | Check initial-message write errors and release SHA; the current branch change makes persistence failure non-successful and retryable |

## Release/acceptance gate

This repository review cannot tell whether current Hostinger values are correct or which SHA is live. Before calling WebChat production-ready, the owner must deploy the reviewed commit, execute the browser checks above against production, verify inbox handling and provider acceptance, and retain redacted evidence. A passing local test, green CI, or a configured API key is not a substitute for those checks.
