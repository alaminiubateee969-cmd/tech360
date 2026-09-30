# TECH360 Hostinger deployment matrix

Audit performed from the checked-out repository on 2026-09-30 UTC. Values marked external are not available in this repository and were not guessed.

## A. Repository

| Item | Actual value | Status |
|---|---|---|
| Repository | `alaminiubateee969-cmd/tech360` via `origin` (`https://github.com/alaminiubateee969-cmd/tech360.git`) | PASS |
| Branch | `arena/01a0f3e8-tech360` (session branch); `main` points to the same baseline locally | PASS |
| Latest commit | `50b4f61 Merge PR #4: Node.js 22 runtime, npm ci lockfile repair, Super Admin bootstrap hardening` | PASS |
| Production baseline | `50b4f61c50c196418b9d8767b02cd2cab696343a`, present in history and currently checked out | PASS |
| Package manager | npm for Hostinger (`package-lock.json`); `bun.lock` also exists for existing Bun CI/local tooling | PASS |

The repository is a shallow checkout at the verified baseline. No reset or force-push was performed.

## B. Runtime

| Item | Actual value | Required value | Status |
|---|---|---|---|
| Framework | Next.js `^16.1.1`, React 19, TypeScript | Next.js/Node compatible | PASS |
| Node requirement | `>=22.0.0 <23` in `package.json` | Node 22 | PASS |
| Package manager | npm install path and committed `package-lock.json` | npm | PASS |
| Install command | `npm ci --no-audit --no-fund` was run successfully; Hostinger command is `npm ci` | `npm ci` | PASS |
| Build command | `npm run hostinger:build` = Prisma generate, migrate deploy, Next build, standalone asset copy | production build | BLOCKED — Prisma engine download was unavailable in this audit environment |
| Start command | `npm run start` = `NODE_ENV=production node .next/standalone/server.js` | `npm run start` | BLOCKED — no verified production build artifact |

## C. Environment variables

The complete variable manifest is in [HOSTINGER_ENVIRONMENT_VARIABLES.md](./HOSTINGER_ENVIRONMENT_VARIABLES.md). No secret values are printed here.

| Variable | Found in file(s) | Used for | Secret? | Required production value/source | Hostinger required? | GitHub safe? | Status |
|---|---|---|---|---|---|---|---|
| `DATABASE_URL` | `src/app/api/health/route.ts`, `scripts/verify-database.mjs` | Prisma MySQL | Yes | Hostinger MySQL URL with actual hPanel host | Yes | Name only | EXTERNAL CONFIG REQUIRED |
| `APP_PUBLIC_URL` | layout, sitemap, RSS, journey, newsletter send | Public URLs | No | `https://bdtech360.com` | Yes | Yes | PASS |
| `APP_ORIGIN` | Stripe checkout route | Checkout origin | No | `https://bdtech360.com` | Yes when Stripe enabled | Yes | PASS |
| `NODE_ENV` | auth, db, portal login, seed | Runtime mode | No | `production` | Yes | Yes | PASS |
| `SESSION_SECRET`, `PORTAL_SECRET`, `OPS_SECRET` | portal/newsletter and ops routes | Token/ops signing | Yes | Owner-generated unique random values | Yes | Names only | EXTERNAL CONFIG REQUIRED |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `prisma/seed.ts` | First-boot Super Admin | Password secret | Owner-selected email and generated password (12+ chars) | First seed only | Names only | EXTERNAL CONFIG REQUIRED |
| `NOTIFY_RELAY_TOKEN`, `NOTIFY_RELAY_URL` | `src/lib/notify.ts` | Optional relay | Token secret / URL | External relay config, not localhost | Only if relay enabled | Names only | EXTERNAL CONFIG REQUIRED if used |
| `OPS_INTERVAL_SEC`, `PLATFORM_URL`, `PREVIEW_TTL_DAYS` | ops status, journey | Operations/policy | No | Owner policy; safe template defaults documented | Optional | Yes | PASS |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | checkout/webhook | Stripe | Yes | Stripe dashboard | If Stripe enabled | Names only | EXTERNAL CONFIG REQUIRED if used |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | comms/webhook | WhatsApp | Yes | Meta developer console | If WhatsApp enabled | Names only | EXTERNAL CONFIG REQUIRED if used |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | `src/lib/comms.ts` | Email | SMTP password secret | Mail provider | If email enabled | Names only | EXTERNAL CONFIG REQUIRED if used |
| `SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER` | `src/lib/comms.ts` | SMS | API key secret | SMS provider | If SMS enabled | Names only | EXTERNAL CONFIG REQUIRED if used |
| `FACEBOOK_PAGE_TOKEN`, `INSTAGRAM_TOKEN`, `LINKEDIN_TOKEN`, `X_TOKEN` | `src/lib/comms.ts` | Social publishing | Yes | Provider consoles | If enabled | Names only | EXTERNAL CONFIG REQUIRED if used |
| `SOCIAL_WEBHOOK_SECRET` | social webhook | Webhook auth | Yes | Owner-generated | If enabled | Names only | EXTERNAL CONFIG REQUIRED if used |
| `N8N_WEBHOOK_SECRET`, `N8N_WEBHOOK_BASE` | n8n webhook/comms | n8n bridge | Secret/URL | n8n deployment | If enabled | Names only | EXTERNAL CONFIG REQUIRED if used |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD` | dynamic feature metadata and template | Optional gateways | Mixed | Provider dashboards | If enabled | Names only | EXTERNAL CONFIG REQUIRED if used |

## D. Database

| Item | Actual | Required | Status |
|---|---|---|---|
| ORM | Prisma `6.18.0` / `@prisma/client` | Prisma | PASS |
| Provider | `mysql` in `prisma/schema.prisma` | mysql | PASS |
| `DATABASE_URL` | No production value in repository; template is a placeholder | Hostinger MySQL | EXTERNAL CONFIG REQUIRED |
| Migration directory | `prisma/migrations/0_init/migration.sql` | required | PASS |
| Migration status | `prisma migrate status` could not be verified without a configured database; no destructive reset/push was run | deployable via `prisma migrate deploy` | BLOCKED — external DB required |
| Seed strategy | `prisma/seed.ts`; production refuses absent/short `ADMIN_PASSWORD`, sets `SUPER_ADMIN` and `mustChangePassword` | production-safe bootstrap | PASS (code); external credentials required |

## E. Authentication

| Area | Actual finding | Status |
|---|---|---|
| Login/logout/session | DB-backed `Session` rows; login creates HttpOnly SameSite cookie; logout deletes session | PASS (code) |
| Cookies/CSRF | Secure cookie in production; CSRF double-submit token in `src/lib/auth.ts` | PASS (code) |
| Password hashing | Node `scryptSync` with random salt and timing-safe comparison | PASS |
| Lockout/2FA | Five failed attempts create a 15-minute lock; optional TOTP is verified | PASS (code) |
| RBAC/admin authorization | `SUPER_ADMIN` policy is enforced on workforce and sensitive admin routes; tests cover protected surfaces | PASS (code/tests) |
| Password reset/OAuth | No password-reset or OAuth implementation was found | NOT APPLICABLE / no feature found |
| Production login test | Requires built app, MySQL, seeded account, and Hostinger runtime | BLOCKED — external configuration required |

## F. Deployment

| Item | Repository finding | Disposition |
|---|---|---|
| GitHub Actions | `ci.yml` validates MySQL migrations and quality; no production deployment job | KEEP / CI-ONLY |
| Hostinger | `docs/HOSTINGER_DEPLOYMENT.md` and this matrix describe Git integration | KEEP / MANUAL-ONLY configuration |
| SSH diagnostics | `.github/scripts/hostinger-*` are read-only/manual diagnostics and require external secrets | CI-ONLY / MANUAL-ONLY; not deployment |
| Old SSH/PM2 helper | `scripts/deploy-hostinger.sh` previously attempted PM2/SSH deployment; it is now a fail-fast retired helper | REPLACE |
| VPS/Cloud Run deployment | `deployment/` and `deployment/deploy.sh` are Google Cloud material, not Hostinger runtime | MANUAL-ONLY legacy/alternate path; do not use for Hostinger |
| PM2/rsync/scp | Present only in legacy diagnostics/docs/history and the retired helper; production path does not require them | REMOVE from production path |

## G. Production blockers

| BLOCKER | SEVERITY | FILE | LINE | PROBLEM | REQUIRED FIX | CAN_AI_BUILDER_FIX? | EXTERNAL_VALUE_REQUIRED? |
|---|---|---|---:|---|---|---|---|
| Prisma client/engine generation | Critical | `package.json`, Prisma CLI | n/a | `npx prisma generate` failed because the sandbox could not connect to `binaries.prisma.sh`; typecheck/tests that instantiate Prisma consequently failed | Re-run `npm run hostinger:build`/Prisma generation in a network-enabled Hostinger or CI environment, then run migration deploy | No, not without engine download/network | Yes: network/runtime |
| Production database | Critical | `DATABASE_URL` | n/a | No Hostinger MySQL host/credentials are present in the repository | Set actual hPanel MySQL URL; run `prisma migrate deploy` and health check | No | Yes |
| Public runtime | Critical | Hostinger configuration | n/a | Hostinger application is not accessible from this repository session | Create/configure the Node.js Web App and map domains | No | Yes |
| AI provider | High/non-core | `src/lib/agents/engine.ts` | 1, 41–44 | Application uses `z-ai-web-dev-sdk` via `ZAI.create()`; no production provider credential/configuration is present or verified | Configure the provider supported by the SDK, then perform one controlled run; do not claim AI live beforehand | No | Yes |
| Optional integrations | Medium/non-core | `.env.example`, `src/lib/comms.ts`, webhooks | various | Provider credentials are intentionally empty | Configure only the integrations actually purchased/required | No | Yes |

## Verified feature inventory

Repository routes/components include the existing admin surfaces for dashboard, operations, leads/clients, approvals, communications/chat, payments, projects, reviews, agents, command, memory, newsletter, knowledge, content/blog, analytics, logs, reports, settings and team, plus client portal routes. No replacement dashboard was added.

## Hostinger configuration matrix

| Hostinger setting | Required value |
|---|---|
| Application type | Node.js Web App |
| Repository | `alaminiubateee969-cmd/tech360` |
| Branch | `main` (Hostinger production setting; this Arena session can only push `arena/01a0f3e8-tech360`) |
| Node.js | `22` |
| Install | `npm ci` |
| Build | `npm run hostinger:build` |
| Start | `npm run start` |
| Database | Hostinger MySQL |
| Domain | `bdtech360.com` |
| WWW | `www.bdtech360.com` |
| Environment | Production |
| Application directory | Not guessed; use the directory/runtime value shown by Hostinger hPanel |

## DNS safety

No DNS records were changed. MX, SPF, DKIM, DMARC, autodiscover and autoconfig are outside this repository audit and must remain untouched while the website domain is mapped.

## Final audit state

Repository-side safe changes are complete, but the application was not claimed live: no Hostinger runtime, MySQL connection, migration deployment, HTTPS check, or AI provider execution was available to verify. See the exact current command results in the final response.
