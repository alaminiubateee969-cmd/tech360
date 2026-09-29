# Integration Configuration and Verification

Credentials belong only in the protected production environment. `.env.example` is the canonical variable inventory; never commit `.env`.

| Integration | Implementation | Required configuration | Current evidence | Activation test |
|---|---|---|---|---|
| SMTP email | Implemented with honest refusal | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Code verified; live account NOT_VERIFIED | Send to an approved test mailbox; verify provider ID, received message and communication status |
| SMS | Implemented adapter | `SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER` | Live provider NOT_VERIFIED | Approved test number, provider response ID and failure-path test |
| WhatsApp Business | Implemented private adapter/webhook; public contact intentionally removed | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` | Live Meta account BLOCKED; feature remains admin-gated | Verify webhook challenge/signature, inbound idempotency and one consented outbound message |
| Facebook/social lead intake | Webhook implemented | `FACEBOOK_PAGE_TOKEN`, `SOCIAL_WEBHOOK_SECRET`; optional social tokens | Provider payload NOT_VERIFIED | Signed approved lead test; verify dedupe, source/campaign and failure log |
| Stripe | Checkout and HMAC webhook implemented | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Pure signature/amount/currency/idempotency policies pass automated tests; live Stripe BLOCKED | Sandbox checkout plus signed webhook; verify one payment, invoice and project transition |
| PayPal | Registry/configuration only | PayPal variables in `.env.example` | `INTEGRATION_NOT_BUILT` | Implement adapter before any activation |
| SSLCommerz | Registry/configuration only | SSLCommerz variables in `.env.example` | `INTEGRATION_NOT_BUILT` | Implement adapter before any activation |
| bKash/Nagad/bank transfer | Platform-verified/manual recording | Merchant/account details | Code path exists; real reconciliation NOT_VERIFIED | Authorized evidence upload/record, finance verification and audit event |
| AI model provider | SDK-backed agent engine | Provider/runtime configuration supplied by hosting platform | Earlier worklog reports quota failures; current live success NOT_VERIFIED | One approved run per agent family; retain execution IDs and failure behavior |
| n8n | Workflow registry, definitions and webhook | `N8N_WEBHOOK_BASE`, `N8N_WEBHOOK_SECRET` | 25 definitions/records; external n8n instance NOT_VERIFIED | Signed webhook, replay/idempotency and failed-run retry |
| Notification relay | Socket.io mini-service | `NOTIFY_RELAY_URL`, `NOTIFY_RELAY_TOKEN` | Source exists; production process NOT_VERIFIED | Authenticated event and reconnect test |
| Analytics | Consent-gated GTM/Meta browser loading plus first-party tracking | Approved IDs/settings | Code verified; live dashboards NOT_VERIFIED | Consent accept/decline network test and first-party event check |
| Calendar/video meeting | Meeting records and external link storage | Approved provider/URL | No direct calendar-provider confirmation adapter | Keep status NOT_VERIFIED; do not claim provider booking |
| File storage/malware scanning | Local controlled file records and validation | Deployment storage path; optional scanner service | External scanner NOT_VERIFIED | Type/size/signature/quarantine/tenant-access tests |

## Activation rule

Presence of an environment variable is not proof that an integration works. An integration becomes operational only after its provider-specific acceptance test succeeds and the result is retained without exposing secrets.
