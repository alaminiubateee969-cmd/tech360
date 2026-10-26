# Tech360 WhatsApp CRM — Setup and Production Checklist

## Existing environment variable names

The repository already defines these server-side names in .env.example:

- WHATSAPP_TOKEN: Meta access token with the required WhatsApp Business Platform permissions.
- WHATSAPP_PHONE_NUMBER_ID: ID of the phone number registered with the Cloud API.
- WHATSAPP_APP_SECRET: Meta app secret used to verify x-hub-signature-256.
- WHATSAPP_VERIFY_TOKEN: random webhook verification string chosen by Tech360.

Set real values only in the hosting provider's encrypted environment-variable settings. Never commit values, paste them into source code, send them to a browser, or put them in screenshots. Use independent random secrets and rotate credentials if they are exposed.

## Meta configuration checklist

1. Create or select the official Meta developer app owned by Tech360.
2. Add/configure the WhatsApp product and select the intended WhatsApp Business Account and sending number.
3. Configure a server-side access token with the minimum required permissions; prefer a properly provisioned system-user token for production when Meta's setup supports it.
4. Set the public webhook callback to the deployed application's WhatsApp webhook route and set the same random verify token in Meta and WHATSAPP_VERIFY_TOKEN.
5. Subscribe the app to the WhatsApp account's messages webhook field.
6. Configure the app secret in WHATSAPP_APP_SECRET so the existing raw-body HMAC validation can verify Meta signatures.
7. Send a test message from an allowed test recipient, confirm inbound creation and outbound reply, then verify delivery-status callbacks.
8. Submit and wait for Meta approval for templates needed for business-initiated messages outside the 24-hour customer-service window.
9. Confirm business verification, permissions, display name, phone-number quality and messaging limits as applicable.
10. Add operational alerts for failed webhooks, token/number health and provider errors.

## Before enabling campaigns

- Validate that every recipient has a normalized number and a valid consent record.
- Provide clear opt-out handling. STOP/UNSUBSCRIBE-style messages should immediately suppress future marketing sends; START may re-enable only under the product's documented consent policy.
- Use approved templates for out-of-window business-initiated messages.
- Test audience counts and personalization using a dry-run preview before sending.
- Configure rate limits, per-number pacing, pause/cancel, retries and a dead-letter path.
- Record a result per recipient, including skipped/failed reason. Do not equate API acceptance with delivery or read.
- Require explicit authorized operator approval for large campaigns and keep an audit log.
- Keep message bodies and media private; set retention and deletion rules appropriate to customer data.

## Safe deployment

1. Take a database backup and verify that it can be restored.
2. Review Prisma schema and migration diffs; apply migrations to a disposable staging database first.
3. Run typecheck, lint, tests, build and migration checks.
4. Deploy with production credentials in the host environment only.
5. Run a low-volume test with an approved test contact before enabling production traffic.
6. Keep a rollback plan for code and database changes; do not automatically drop or rewrite existing CRM records.
7. Confirm the existing website, CRM, email, n8n and client portal still work after deployment.

## Important limitations

This checklist does not assert that the complete WabaCRM feature set is already implemented. The parity audit in WHATSAPP_CRM_WABACRM_PARITY.md separates the existing WhatsApp Cloud API foundation from the inbox, template/campaign, automation, multi-number, health and reporting work still to build. Meta approval, permissions, message fees and number eligibility remain external dependencies.
