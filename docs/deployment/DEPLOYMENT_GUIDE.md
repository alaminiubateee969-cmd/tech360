# Deployment guide — owner-controlled Hostinger release

| Field | Evidence / scope |
|---|---|
| Source review | Repository audit dated 2026-11-18; see [current audit and limitations](../audit/2026-11-18/REPOSITORY_AUDIT.md) |
| Application | npm application `0.2.1`, Next.js / eslint-config-next `16.4.6`, Node.js 22, Prisma / Prisma Client `6.19.3` |
| Database | Production Prisma provider **MySQL**; SQLite is disposable local test tooling, not production storage |
| Hosting | Existing Hostinger-managed Node.js Web App; no hosting, DNS, endpoint or infrastructure change is authorized here |
| Release authorization | **Neither staging nor production deployment is approved by this audit.** Obtain explicit owner approval for publication, migration execution and deployment. |

This is a procedure, not evidence that a Hostinger deployment, database restore,
model inference or external delivery has succeeded. Earlier wording that authorized
staging, treated backups as the sole blocker, or equated catalogue counts with
running AI employees is superseded by this guide.

## 1. Preserve the existing installation

- Record the reviewed commit, working-tree state, current release identity and
  rollback target without printing environment values or credentials.
- Preserve the owner's known-working Hostinger database endpoint. The panel host
  is not automatically the application's database host; do not substitute it for
  the existing application endpoint based on a hostname/IP assumption.
- Back up and prove an **isolated restore** before any authorized production schema
  change. Source checks and a database health flag are not restore evidence.
- Preserve `IDENTITY_HASH_SECRET` and existing identity links. Do not rotate secrets,
  re-bootstrap accounts or run a seed as an ordinary upgrade step.
- Never use `prisma migrate reset`, `prisma db push`, destructive synchronization,
  broad DELETE/DROP/TRUNCATE, or production test records for acceptance.

See [backup and restore](../BACKUP_AND_RESTORE.md) and
[rollback procedure](ROLLBACK_GUIDE.md). A rollback/recovery plan still requires
owner review; no production restore was executed during this audit.

## 2. Test in a separate disposable checkout/environment

**Do not execute tests in the live application's checkout or against its database.**
`npm test` is database-mutating: offline mode creates a fresh `.preview/test.db`
and generates a SQLite client; CI uses a disposable loopback MySQL schema.
The test wrapper rejects non-disposable database URLs before launching children.
It is not a production health-check command.

```bash
# Separate disposable checkout only; preserve any existing work first.
npm ci --no-audit --no-fund
npm audit
npm audit --omit=dev
npm run migrations:check
npm run schema:check
npm run schema:drift
npm run check:assets
npm run check:conflicts

# Offline regression alternative; deliberately remove the live datasource from
# this child process. No production connection string belongs in this command.
env -u DATABASE_URL -u PREVIEW_SQLITE_URL NODE_ENV=test npm test

# Offline tests generate a SQLite client. Restore the production provider
# before the final production typecheck/build, with the approved environment.
node scripts/prisma.mjs generate --schema prisma/schema.prisma
npm run typecheck
npm run lint
```

Real MySQL migration replay, DB-backed tests, drift and bootstrap-idempotency
checks must also pass on the **new reviewed source** in a disposable CI database.
Older green main-branch CI does not certify unpublished repairs. Do not weaken the
loopback/schema/CI guards in `tests/seed-safety.mjs` to run it against production.

### Compile-only verification is not a migration

For an isolated verification checkout with an explicitly safe environment:

```bash
node scripts/prisma.mjs generate --schema prisma/schema.prisma
node node_modules/next/dist/bin/next build --webpack
node scripts/copy-standalone-assets.mjs
```

These are the generation/compilation commands used for the audit's MySQL-built
artifact. They do **not** reconcile/deploy migrations. A deliberately unreachable
loopback test datasource was used; the resulting static blog/setting lookup
warnings do not establish database acceptance or dynamic-content completeness.

**Do not substitute `npm run build` casually.** Its actual lifecycle is:

1. `scripts/prisma.mjs generate`;
2. `scripts/prisma-migration-reconcile.mjs`;
3. `scripts/prisma.mjs migrate deploy`;
4. `next build --webpack`;
5. `scripts/copy-standalone-assets.mjs`.

The reconciliation and deployment steps can change database migration state.
Review them, the pending migration plan, backup/restore evidence and the selected
datasource before approving the Hostinger build/deployment window. This audit
changed no production schema or published migration and executed neither step.

## 3. Environment and startup

`npm start` invokes the fail-closed `prestart` environment validator, then the
supported production launcher in `scripts/start-production.mjs`. The launcher
uses the generated standalone server. Do not add a competing PM2/systemd/Docker
stack to the Hostinger-managed application by assumption.

Keep the existing environment in the owner's secret store/hPanel. Review variable
**names and presence**, never paste their values into chat, Git or deployment logs:

| Configuration | Responsibility |
|---|---|
| `DATABASE_URL` | Approved MySQL endpoint/schema; do not print it |
| `APP_PUBLIC_URL`, `APP_ORIGIN` | Approved external origin and callback/CSRF configuration |
| `SESSION_SECRET`, `OPS_SECRET`, `PORTAL_SECRET` | Strong independently managed secrets required by startup policy |
| `IDENTITY_HASH_SECRET` | Stable identity hashing secret; preserve across releases |
| `AI_PROVIDER` | Explicit agent-provider choice; disabled/invalid/unconfigured explicit choices must not silently choose another provider |
| `AI_OPS_DRIVER` | `off` disables the in-process operations driver; enabling it authorizes real work and requires its own acceptance |
| `PREVIEW_SQLITE_URL` | **Unset in production.** The preview adapter is refused in production; it also refuses a conflicting non-file `DATABASE_URL` in development |
| Optional provider variables | Presence is configuration, not proof of delivery, a payment, inference or readiness |

The root lockfile is `package-lock.json`. Root Bun lockfiles are not the application
installation contract; optional sidecars retain their separate conventions.

## 4. Private local-model acceptance

No real model host, installed weights, live inference, Bangla/English quality or
model RSS was verified in the audit sandbox. Intercepted provider tests exercise
policy/protocol behavior only. A model catalogue entry is not an installed model,
a logical workforce profile is not a running worker, and a healthy HTTP process
is not a model acceptance decision.

- Keep Ollama / an OpenAI-compatible model server on an approved private network;
  do not expose it publicly or add a public tunnel as a workaround.
- `LOCAL_MODEL_*` and `LOCAL_OPENAI_*` configure the private providers. Blank
  `AI_PROVIDER_ORDER` is local-only `ollama,openai-compatible`. A remote provider
  such as `zai` must be explicitly approved and included; an invalid explicit
  provider order fails closed. Do not add a paid fallback without permission.
- `MODEL_API_KEY` protects the separate machine-to-machine model API. Do not place
  that key in frontend code or native/mobile client bundles.
- Weight acquisition, model selection, service installation and resource budgets
  need owner approval. This guide does not authorize downloads or recommend an
  unmeasured model as suitable for the owner's host.

### Actual evidence-tool commands

The root package has **no** `models:verify` or `bench:models` npm aliases. On the
approved model host, after configuring the private endpoint securely:

```bash
# Supply the host's actual Ollama manifests directory via the documented flag.
# /approved/ollama/models/manifests is a placeholder, not a measured host path.
node scripts/verify-local-models.mjs \
  --manifest-dir=/approved/ollama/models/manifests \
  --out=tool-results/local-model-verification.json

# Set LOCAL_MODEL_CHAT_MODEL to the owner-selected installed model first.
node scripts/benchmark-local-models.mjs \
  --out=tool-results/local-model-benchmarks.json
```

The verifier hashes the actual manifest and local blobs, checks byte lengths and
server-reported revision agreement, and reports incomplete/mismatched evidence
with a nonzero exit. A manifest digest alone is **not** a weight checksum. Both
tools are read-only with respect to catalogue/deployment records; `--apply` is not
implemented and is rejected. Neither command promotes a model automatically.

The benchmark measures first **streamed content** latency at the client and
provider-reported token throughput, plus small heuristic probes. It does **not**
produce a scored quality evaluation, measure model RSS, verify production load,
or establish acceptance from host free memory. `modelResidentMemoryMb` remains
null. Registry memory footprints and acceptance targets are configuration, not
host measurements or a guarantee that several models fit concurrently.

Owner acceptance must separately retain hashes/revisions, real process/container
RSS and peak memory under agreed concurrency, startup/first-content/throughput
measurements, human-reviewed Bangla/English and grounding evaluations, and a
reviewed promotion decision. Never invent missing measurements.

## 5. Database and seed acceptance

There are 20 published migrations. Use the immutable manifest/static checks above
and actual disposable-MySQL replay; do not describe every historical DDL operation
as non-destructive or non-blocking without reviewing the selected migration and
MySQL version/locking behavior.

Before any approved production migration: capture a read-only schema/migration
inventory, grants and backup/restore evidence; review pending SQL and the recovery
plan. Run `migrate status` / database verification only with the owner's authorized
read access. Do not execute a migration to discover whether the environment is
production.

The seed is a **bootstrap operation**, not an acceptance shortcut. Source and CI
checks exercise preservation/idempotency, but current production seed state was
not inspected. Require explicit owner approval before bootstrapping an empty
installation. Do not reset an existing administrator, replace operator-managed
content, or create fictional execution history to match catalogue sizes.

## 6. Post-start checks — authorized owner environment only

| Check | Honest expectation |
|---|---|
| Public `/api/health` | 200 and minimal database `UP` summary when its actual query succeeds; 503 when unavailable. No private provider/channel/agent diagnostics |
| `/api/health/deep` | Anonymous callers receive 401; a real Super Admin session is required. Review individual subsystem states, not HTTP 200 alone |
| Release identity | Served commit/source-state agrees with the reviewed clean artifact and Hostinger deployment logs; the health field is not a signed attestation |
| Login and MFA | Real administrator bootstrap/forced rotation/TOTP checks in the approved environment; missing MFA secret must not grant a session |
| Role boundaries | Representative CRM/project/finance/private-workforce/approval isolation, with session and CSRF checks; no shared Super Admin account as a workaround |
| Chat | Session, reload, ordered reconnect, attachment privacy, one durable reply on replay, hidden internal notes and accessible keyboard/contrast behavior |
| Client portal | Approved test identity and real OTP/delivery acceptance; merely rendering sign-in fields is insufficient |
| Providers | Separately authorized email/WhatsApp/SMS/social/payment/n8n/AI acceptance; record provider request IDs/statuses without credentials or unsolicited sends |
| Backup/restore/alerts | Current artifact, isolated restore and RPO/RTO evidence, plus an authorized test alert |

The local compiled-app browser evidence covers synthetic SQLite fixtures, not
Hostinger/MySQL. Its remaining widget accessibility findings are documented in the
[current audit](../audit/2026-11-18/REPOSITORY_AUDIT.md); ChatWidget was deliberately
left unchanged under the owner's separate-change-plan restriction.

## 7. Console/API and CI boundaries

Private memory, knowledge, workforce execution and deep diagnostics are not general
mobile-user APIs. They retain Super Admin/session or machine-key guards as defined
by their actual route handlers; mutation callers also need the appropriate CSRF,
capability and idempotency contracts. In particular `/api/knowledge/search` is
**POST**, not GET. A native/mobile application and its session/OTP/security design
remain a separate unverified deliverable; route existence does not certify it.

The authoritative CI definitions are `.github/workflows/ci.yml` and
`mysql-baseline.yml`. They include dependency/security, schema/migration, lint,
typecheck, test, build and smoke gates. The login/dead-database smoke assertions
were **strengthened** in this working tree; it is incorrect to say the audit never
modified CI. No gate was intentionally disabled or made non-blocking.

Obtain approval to publish the reviewed branch and run exact-source MySQL CI
before requesting merge/deployment. Then close every unresolved code, browser,
provider, backup/recovery and owner-acceptance gate in the audit register. Neither
green historical main CI nor a compile-only pass grants release authorization.
