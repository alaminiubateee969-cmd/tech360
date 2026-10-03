# TECH360 Hostinger environment variables

This is a configuration manifest, not a secrets file. Values below are intentionally omitted. Set them in **Hostinger → Node.js Web App → Environment Variables**; do not commit `.env` or paste production credentials into GitHub.

## Required for the application

| Variable | Purpose | Secret/non-secret | Source | Required |
|---|---|---|---|---|
| `DATABASE_URL` | Prisma MySQL connection | Secret | Copy the exact URL from Hostinger's MySQL panel, including its actual host, port, database name, username, and password; hPanel values are **NOT VERIFIED** here | Yes |
| `NODE_ENV` | Production runtime behavior | Non-secret | Set to `production` | Yes |
| `APP_PUBLIC_URL` | Public links, sitemap and email links | Non-secret | `https://bdtech360.com` | Yes |
| `APP_ORIGIN` | Checkout origin | Non-secret | `https://bdtech360.com` | Yes |
| `SESSION_SECRET` | Fallback signing secret for portal/newsletter tokens | Secret | Generate a unique random value | Yes |
| `PORTAL_SECRET` | Client portal token signing | Secret | Generate a unique random value | Yes |
| `OPS_SECRET` | Authenticates operations endpoints | Secret | Generate a unique random value distinct from the other application secrets | Yes |
| `ADMIN_EMAIL` | First-boot Super Admin seed account | Non-secret | Owner-selected account | Yes for first seed |
| `ADMIN_PASSWORD` | First-boot Super Admin seed account | Secret | Owner-generated password, at least 12 characters; change at first login | Yes for first seed |

`NOTIFY_RELAY_TOKEN`, `NOTIFY_RELAY_URL`, `OPS_INTERVAL_SEC`, and `PLATFORM_URL` are used only when the optional relay/operations service is deployed. For a production sidecar, provide unique `OPS_SECRET` and `PLATFORM_URL`; the ai-ops service now refuses to start in production without them. The notify relay refuses `/emit` when its production token is missing. Do not point a production app or sidecar at `localhost`; configure the actual service URL, or leave the optional relay disabled.

## Optional integrations (empty values fail closed or remain not configured)

| Variable(s) | Purpose | Secret/non-secret | Source | Required |
|---|---|---|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe checkout and webhook verification | Secret | Stripe dashboard | Optional; required before Stripe is enabled |
| `BANK_TRANSFER_DETAILS`, `BKASH_MERCHANT_NUMBER`, `NAGAD_MERCHANT_NUMBER` | Payment instructions | Sensitive business configuration | Owner | Optional |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` | PayPal integration flags | Mixed; secrets marked by name | PayPal dashboard | Optional; integration is not enabled by empty values |
| `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD` | SSLCommerz integration flags | Mixed; password is secret | SSLCommerz dashboard | Optional |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | WhatsApp Cloud API and webhook verification | Secret | Meta developer console | Optional |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | SMTP email delivery | `SMTP_PASS` secret; others configuration | Mail provider | Optional; required before email sending |
| `SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER` | Generic SMS delivery | `SMS_API_KEY` secret; others configuration | SMS provider | Optional |
| `HTTPSMS_API_KEY`, `HTTPSMS_BASE_URL`, `HTTPSMS_FROM` | HTTP SMS provider adapter | `HTTPSMS_API_KEY` secret; base URL/sender are configuration | httpsSMS account | Optional |
| `PORTAL_OTP`, `PORTAL_OTP_CHANNEL` | Portal one-time-code behavior and preferred channel | Non-secret | Owner policy (`auto`/`off`/`required`; `email`/`whatsapp`/`sms`) | Optional |
| `FACEBOOK_PAGE_TOKEN`, `INSTAGRAM_TOKEN`, `LINKEDIN_TOKEN`, `X_TOKEN` | Social publishing | Secret | Respective provider | Optional |
| `SOCIAL_WEBHOOK_SECRET` | Social inbound webhook auth | Secret | Owner-generated | Optional; required to enable endpoint |
| `N8N_WEBHOOK_SECRET`, `N8N_WEBHOOK_BASE` | n8n bridge auth and URL | Secret/URL | n8n deployment | Optional; required to enable endpoint |
| `PREVIEW_TTL_DAYS` | Preview expiry policy | Non-secret | Optional; the application defaults to 30 days | Optional |

The repository also contains dynamic feature metadata for the payment credentials above (`src/lib/features.ts`), so those names are included even though they are not accessed using a literal `process.env.NAME` expression.

## Production safety

- `.env.example` lists variable names with empty values only; it is not a source of production settings.
- `npm start` runs `scripts/validate-production-env.mjs` before launching the standalone server. It requires a credentialed MySQL URL with a database name, the canonical HTTPS origins, and three distinct random application secrets of at least 32 characters. It reports variable names only and never prints values; it does not guess or hard-code the Hostinger database endpoint.
- An authorized operator must confirm `DATABASE_URL` exactly matches the actual Hostinger MySQL panel before any deployment build can apply migrations. The hPanel values, connection, migration state, and backup remain **NOT VERIFIED**.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` are required for the one-time production seed; `ADMIN_PASSWORD` is not needed by normal runtime startup and must be removed after seeding/password change.
- Do not commit a production `.env` file.
- Empty integration credentials are expected to produce `NOT_CONFIGURED`/a refusal, not a fake success.
